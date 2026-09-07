import 'server-only';
import { obtenerCamposCalendly, obtenerFormularios, obtenerRespuestas } from '@/lib/api';
import type { Formulario } from '@/lib/api';
import { getEnv } from '@/lib/config/env';
import { evaluarAgenda } from '@/lib/domain/agenda';
import {
  calcularEmbudo,
  correosRepetidos,
  cortarPorCampana,
  cortarPorCanal,
  cortarPorFuente,
  cortarPorPrograma,
} from '@/lib/domain/embudo';
import { construirRegistro } from '@/lib/domain/registro';
import type { Registro } from '@/lib/domain/types';
import { calcularKpis } from '@/lib/domain/kpis';
import { resolverPrograma } from '@/lib/domain/programa';
import { construirSeries, serieTotal, type ProgramaVisible } from '@/lib/domain/series';
import type { Agenda } from '@/lib/domain/types';
import {
  diaDeNegocio,
  diasDelRango,
  limitesInstantaneos,
  rangoAnterior,
  type RangoDias,
} from '@/lib/date/rangos';
import type { AgendasResponse, Aviso, ProgramaDisponible } from '@/lib/contracts/agendas';
import { conCache, purgarCaducadas } from './cache';

interface AgendasDeFormulario {
  agendas: Agenda[];
  /** Todas las respuestas del formulario dentro de la ventana, normalizadas.
   *  Alimentan el embudo, los cortes por canal, la búsqueda y el export. */
  registros: Registro[];
  noReconocidas: number;
  descartadas: number;
  truncado: boolean;
  /** Respuestas traídas de la API antes de filtrar por fecha. Mide lo que
   *  cuesta que la API no tenga filtro por fecha. */
  descargadas: number;
  /**
   * `null` si los datos cubren todo el rango pedido. Si no, el día desde el
   * que sí hay cobertura: antes de esa fecha faltan agendas que la API no
   * dejó leer.
   */
  cubiertoDesde: string | null;
  programaNombre: string;
}

export interface ConsultaAgendas {
  rango: RangoDias;
  /** Programas seleccionados. Vacío significa "todos". */
  programas: string[];
  forzar?: boolean;
}

/**
 * Calcula el desglose de agendas por programa para un rango.
 *
 * El caché se aplica por formulario y ventana, no por petición completa: así
 * cambiar el filtro de programas no vuelve a descargar nada, porque los datos
 * crudos ya están en memoria y solo se reagrupan.
 */
export async function calcularAgendas({
  rango,
  programas,
  forzar = false,
}: ConsultaAgendas): Promise<AgendasResponse> {
  const env = getEnv();
  const tz = env.PULSO_TIMEZONE;
  const previo = rangoAnterior(rango);

  purgarCaducadas();

  const todos = await conCache('formularios', () => obtenerFormularios(), {
    ttlMs: env.PULSO_CACHE_TTL_MS,
    forzar,
  });

  // El programa se deriva del título, sin tocar la red. Por eso la lista de
  // programas disponibles se construye con TODOS los formularios: el
  // desplegable del filtro sale completo aunque después solo se consulten
  // unos pocos.
  const porPrograma = new Map<string, { info: ProgramaVisible; formularios: Formulario[] }>();
  for (const formulario of todos) {
    const resuelto = resolverPrograma(formulario.title);
    const entrada = porPrograma.get(resuelto.id) ?? { info: resuelto, formularios: [] };
    entrada.formularios.push(formulario);
    porPrograma.set(resuelto.id, entrada);
  }

  const programasDisponibles: ProgramaDisponible[] = [...porPrograma.values()]
    .map(({ info, formularios: fs }) => ({
      ...info,
      formularios: fs.map((f) => ({ id: f.id, title: f.title })),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const seleccionados =
    programas.length > 0
      ? programasDisponibles.filter((p) => programas.includes(p.id))
      : programasDisponibles;

  // Una sola ventana que cubre el rango y el periodo anterior: se descarga una
  // vez y sirve para el desglose y para la variación de los KPIs.
  const ventana = limitesInstantaneos({ desde: previo.desde, hasta: rango.hasta }, tz);

  const idsSeleccionados = new Set(seleccionados.flatMap((p) => p.formularios.map((f) => f.id)));

  // Un formulario sin respuestas no puede tener agendas, y `GET /forms` ya nos
  // dice cuántas tiene. Descartarlo aquí ahorra dos peticiones por cabeza sin
  // consultar nada.
  const candidatos = todos.filter((f) => idsSeleccionados.has(f.id) && (f.responses ?? 1) > 0);

  /**
   * Comprobación de Calendly y descarga de respuestas, encadenadas POR
   * FORMULARIO en lugar de en dos fases.
   *
   * Antes se esperaba a tener los campos de los 36 formularios y solo
   * entonces se empezaba a pedir respuestas. Esa barrera hacía que el
   * formulario más lento retrasara a todos los demás: 9 rondas para los
   * campos más 8 para las respuestas. Encadenando por formulario, cada uno
   * avanza en cuanto puede y el semáforo mantiene la carga acotada.
   */
  const resultados = (
    await Promise.all(
      candidatos.map(async (formulario) => {
        const campos = await conCache(
          `campos:${formulario.id}`,
          () => obtenerCamposCalendly(formulario.id),
          { ttlMs: env.PULSO_ESTRUCTURA_TTL_MS, forzar },
        );

        // Sin pregunta de Calendly no puede haber agendas: no se piden sus
        // respuestas. Es un filtro derivado de lo que el formulario es, no de
        // una lista negra de títulos escrita a mano.
        if (campos.length === 0) return null;

        return conCache(
          `agendas:${formulario.id}:${ventana.desde}:${ventana.hasta}`,
          () => agendasDeFormulario(formulario, ventana, tz),
          { ttlMs: env.PULSO_CACHE_TTL_MS, forzar },
        );
      }),
    )
  ).filter((r): r is NonNullable<typeof r> => r !== null);

  const sinCalendly = candidatos.length - resultados.length;

  const todas = resultados.flatMap((r) => r.agendas);

  // Los registros del rango pedido (no del periodo anterior, que solo sirve
  // para la variación de los KPIs).
  const diasDelRangoSet = new Set(diasDelRango(rango));
  const registros = resultados
    .flatMap((r) => r.registros)
    .filter((r) => diasDelRangoSet.has(r.dia))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const noReconocidas = suma(resultados.map((r) => r.noReconocidas));
  const descartadas = suma(resultados.map((r) => r.descartadas));
  const truncados = resultados.filter((r) => r.truncado).length;
  const descargadas = suma(resultados.map((r) => r.descargadas));

  // Programas cuyo rango no está cubierto entero, con el día desde el que sí.
  const incompletos = [
    ...new Map(
      resultados
        .filter((r) => r.cubiertoDesde !== null)
        .map((r) => [r.programaNombre, r.cubiertoDesde!] as const),
    ).entries(),
  ].sort((a, b) => a[0].localeCompare(b[0], 'es'));

  // El borde global es el peor de los bordes: el día más reciente a partir
  // del cual todos los formularios consultados tienen datos. Antes de esa
  // fecha hay al menos un programa del que no sabemos nada.
  const coberturaDesde =
    incompletos.length > 0
      ? incompletos
          .map(([, desde]) => desde)
          .sort()
          .at(-1)!
      : null;

  const dias = diasDelRango(rango);
  const diasPrevios = diasDelRango(previo);
  const visibles: ProgramaVisible[] = seleccionados.map(({ id, nombre, rama }) => ({
    id,
    nombre,
    rama,
  }));

  const series = construirSeries(enRango(todas, dias), dias, visibles);
  const seriesPrevias = construirSeries(enRango(todas, diasPrevios), diasPrevios, visibles);
  const totalPorDia = serieTotal(series, dias);

  return {
    rango,
    rangoPrevio: previo,
    timezone: tz,
    generadoEn: new Date().toISOString(),
    desdeCache: false,
    dias,
    coberturaDesde,
    kpis: calcularKpis(totalPorDia, serieTotal(seriesPrevias, diasPrevios)),
    embudo: calcularEmbudo(registros),
    porCanal: cortarPorCanal(registros),
    porFuente: cortarPorFuente(registros).slice(0, 15),
    porCampana: cortarPorCampana(registros).slice(0, 15),
    porPrograma: cortarPorPrograma(registros),
    registros,
    repetidos: correosRepetidos(registros).slice(0, 50),
    series,
    totalPorDia,
    programasDisponibles,
    avisos: construirAvisos({
      noReconocidas,
      descartadas,
      truncados,
      programasDisponibles,
      sinCalendly,
      descargadas,
      contadas: todas.length,
      incompletos,
    }),
  };
}

async function agendasDeFormulario(
  formulario: Formulario,
  ventana: { desde: number; hasta: number },
  tz: string,
): Promise<AgendasDeFormulario> {
  const programa = resolverPrograma(formulario.title);
  const resultado = await obtenerRespuestas(formulario.id, { ventana });

  // El servidor topa en 200 respuestas por formulario y no envía cursor, así
  // que de un formulario con miles solo se ve una ventana reciente. Si el
  // tope se alcanzó y la respuesta más antigua que llegó es posterior al
  // inicio del rango, hay días del rango sobre los que no se puede afirmar
  // nada. Se detecta y se dice; no se rellena con ceros ni se calla.
  const bordeMs = resultado.masAntigua ? new Date(resultado.masAntigua).getTime() : null;
  const hayHueco = resultado.topeAlcanzado && bordeMs !== null && bordeMs > ventana.desde;

  const agendas: Agenda[] = [];
  const registros: Registro[] = [];
  let noReconocidas = 0;

  const aDiaDeNegocio = (iso: string) => diaDeNegocio(iso, tz);

  for (const respuesta of resultado.respuestas) {
    // Un registro por respuesta, sea agenda o no: el embudo necesita también
    // las que no convirtieron, y son las mismas que ya se descargaron.
    registros.push(
      construirRegistro(respuesta, {
        formId: formulario.id,
        formTitle: formulario.title,
        programaId: programa.id,
        programaNombre: programa.nombre,
        aDiaDeNegocio,
      }),
    );

    const evaluacion = evaluarAgenda(respuesta, {
      formId: formulario.id,
      formTitle: formulario.title,
      programaId: programa.id,
      aDiaDeNegocio,
    });

    if (evaluacion.tipo === 'agenda') agendas.push(evaluacion.agenda);
    else if (evaluacion.tipo === 'no-reconocido') noReconocidas += 1;
  }

  return {
    agendas,
    registros,
    noReconocidas,
    descartadas: resultado.descartadas,
    truncado: resultado.truncado,
    descargadas: resultado.descargadas,
    cubiertoDesde: hayHueco ? diaDeNegocio(resultado.masAntigua!, tz) : null,
    programaNombre: programa.nombre,
  };
}

function enRango(agendas: Agenda[], dias: string[]): Agenda[] {
  const conjunto = new Set(dias);
  return agendas.filter((a) => conjunto.has(a.dia));
}

function construirAvisos({
  noReconocidas,
  descartadas,
  truncados,
  programasDisponibles,
  sinCalendly,
  descargadas,
  contadas,
  incompletos,
}: {
  noReconocidas: number;
  descartadas: number;
  truncados: number;
  programasDisponibles: ProgramaDisponible[];
  sinCalendly: number;
  descargadas: number;
  contadas: number;
  incompletos: (readonly [string, string])[];
}): Aviso[] {
  const avisos: Aviso[] = [];

  // Este va primero: afecta a la veracidad de los números, no a su coste.
  if (incompletos.length > 0) {
    const detalle = incompletos.map(([nombre, desde]) => `${nombre} (desde ${desde})`).join(', ');
    avisos.push({
      tipo: 'cobertura',
      cantidad: incompletos.length,
      mensaje:
        `Datos incompletos en ${incompletos.length} programa(s): ${detalle}. ` +
        'La API de form30x devuelve como máximo 200 respuestas por formulario y no permite pedir más, ' +
        'así que antes de esas fechas faltan agendas. Los totales de este rango están por debajo del real.',
    });
  }

  if (truncados > 0) {
    avisos.push({
      tipo: 'truncado',
      cantidad: truncados,
      mensaje: `Se alcanzó el tope de páginas en ${truncados} formulario(s): puede faltar información.`,
    });
  }

  if (noReconocidas > 0) {
    avisos.push({
      tipo: 'no-reconocido',
      cantidad: noReconocidas,
      mensaje: `${noReconocidas} respuesta(s) con un valor de Calendly que no supimos interpretar. No se cuentan como agenda; revísalas en form30x.`,
    });
  }

  if (descartadas > 0) {
    avisos.push({
      tipo: 'descartadas',
      cantidad: descartadas,
      mensaje: `${descartadas} respuesta(s) no cumplían el esquema esperado y se omitieron. Puede que la API haya cambiado.`,
    });
  }

  // La API no permite filtrar por fecha, así que se descarga todo el
  // histórico de cada formulario y se descarta en memoria. Cuando la
  // proporción se dispara, conviene que se vea en vez de sufrirla en silencio.
  if (descargadas > 0 && contadas * 20 < descargadas && descargadas > 1000) {
    avisos.push({
      tipo: 'coste',
      cantidad: descargadas,
      mensaje: `Se descargaron ${descargadas} respuestas para contar ${contadas} agendas del periodo: la API de form30x no permite filtrar por fecha. Un rango más corto no lo abarata; el caché sí.`,
    });
  }

  if (sinCalendly > 0) {
    avisos.push({
      tipo: 'sin-calendly',
      cantidad: sinCalendly,
      mensaje: `${sinCalendly} formulario(s) no tienen pregunta de Calendly y no se consultan: no pueden producir agendas.`,
    });
  }

  const sinPrograma = programasDisponibles.find((p) => p.id === 'sin-identificar');
  if (sinPrograma) {
    avisos.push({
      tipo: 'sin-programa',
      cantidad: sinPrograma.formularios.length,
      mensaje: `${sinPrograma.formularios.length} formulario(s) no coinciden con ningún programa del catálogo. Se agrupan aparte; añádelos en src/lib/config/programas.ts.`,
    });
  }

  return avisos;
}

const suma = (valores: number[]) => valores.reduce((a, b) => a + b, 0);
