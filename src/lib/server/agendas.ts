import 'server-only';
import { obtenerCamposCalendly, obtenerFormularios, obtenerRespuestas } from '@/lib/api';
import type { Formulario } from '@/lib/api';
import { getEnv } from '@/lib/config/env';
import { evaluarAgenda } from '@/lib/domain/agenda';
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
  noReconocidas: number;
  descartadas: number;
  truncado: boolean;
  /** Respuestas traídas de la API antes de filtrar por fecha. Mide lo que
   *  cuesta que la API no tenga filtro por fecha. */
  descargadas: number;
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

  // Solo los formularios que tienen pregunta de Calendly pueden producir
  // agendas. Filtrarlos aquí no es una optimización cosmética: en la cuenta
  // real evita paginar miles de respuestas de formularios de prueba,
  // encuestas NPS y listas de espera que nunca aportarían una sola agenda.
  //
  // Es además un filtro más honesto que una lista negra de títulos escrita a
  // mano, porque se deriva de lo que el formulario realmente es. La estructura
  // cambia poco, así que se cachea mucho más tiempo que los datos.
  const conCalendly = await Promise.all(
    todos.map(async (formulario) => {
      const campos = await conCache(
        `campos:${formulario.id}`,
        () => obtenerCamposCalendly(formulario.id),
        { ttlMs: env.PULSO_ESTRUCTURA_TTL_MS, forzar },
      );
      return campos.length > 0 ? formulario : null;
    }),
  );

  const formularios = conCalendly.filter((f): f is NonNullable<typeof f> => f !== null);
  const sinCalendly = todos.length - formularios.length;

  // Cada formulario se resuelve a un programa. Los que no casan van a
  // "Sin programa identificado" en vez de descartarse.
  const porPrograma = new Map<string, { info: ProgramaVisible; formularios: Formulario[] }>();
  for (const formulario of formularios) {
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

  const formulariosNecesarios = seleccionados.flatMap((p) => p.formularios.map((f) => f.id));
  const mapaFormularios = new Map(formularios.map((f) => [f.id, f]));

  const resultados = await Promise.all(
    formulariosNecesarios.map((formId) =>
      conCache(
        `agendas:${formId}:${ventana.desde}:${ventana.hasta}`,
        () => agendasDeFormulario(mapaFormularios.get(formId)!, ventana, tz),
        { ttlMs: env.PULSO_CACHE_TTL_MS, forzar },
      ),
    ),
  );

  const todas = resultados.flatMap((r) => r.agendas);
  const noReconocidas = suma(resultados.map((r) => r.noReconocidas));
  const descartadas = suma(resultados.map((r) => r.descartadas));
  const truncados = resultados.filter((r) => r.truncado).length;
  const descargadas = suma(resultados.map((r) => r.descargadas));

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
    kpis: calcularKpis(totalPorDia, serieTotal(seriesPrevias, diasPrevios)),
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

  const agendas: Agenda[] = [];
  let noReconocidas = 0;

  for (const respuesta of resultado.respuestas) {
    const evaluacion = evaluarAgenda(respuesta, {
      formId: formulario.id,
      formTitle: formulario.title,
      programaId: programa.id,
      aDiaDeNegocio: (iso) => diaDeNegocio(iso, tz),
    });

    if (evaluacion.tipo === 'agenda') agendas.push(evaluacion.agenda);
    else if (evaluacion.tipo === 'no-reconocido') noReconocidas += 1;
  }

  return {
    agendas,
    noReconocidas,
    descartadas: resultado.descartadas,
    truncado: resultado.truncado,
    descargadas: resultado.descargadas,
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
}: {
  noReconocidas: number;
  descartadas: number;
  truncados: number;
  programasDisponibles: ProgramaDisponible[];
  sinCalendly: number;
  descargadas: number;
  contadas: number;
}): Aviso[] {
  const avisos: Aviso[] = [];

  if (truncados > 0) {
    avisos.push({
      tipo: 'truncado',
      cantidad: truncados,
      mensaje: `Se alcanzó el tope de páginas en ${truncados} formulario(s): faltan datos. Sube FORM30X_MAX_PAGES.`,
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
