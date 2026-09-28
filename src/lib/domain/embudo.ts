import { ETIQUETAS_CANAL, type Canal } from './canal';
import type { CorteContenido, CorteEmbudo, Embudo, FuentePagoOrganico, Registro } from './types';

/**
 * Embudo de conversión sobre un conjunto de registros.
 *
 * `iniciadas` son las respuestas que empezaron a rellenarse, no las visitas.
 * form30x guarda una respuesta en cuanto alguien contesta algo; las vistas de
 * página viven en su analítica interna, que no expone ningún endpoint. Es una
 * diferencia importante: la tasa de completado se mide sobre quien empezó a
 * escribir, no sobre quien abrió el enlace.
 */
export function calcularEmbudo(registros: readonly Registro[]): Embudo {
  const iniciadas = registros.length;
  const completadas = registros.filter((r) => r.estado === 'completada').length;
  const llegaronACalendly = registros.filter((r) => r.llegoACalendly).length;
  const agendadas = registros.filter((r) => r.agendada).length;

  return {
    iniciadas,
    completadas,
    llegaronACalendly,
    agendadas,
    tasaCompletado: tasa(completadas, iniciadas),
    tasaAgendaSobreCompletadas: tasa(agendadas, completadas),
    tasaGlobal: tasa(agendadas, iniciadas),
  };
}

/** `null` cuando el denominador es cero. Sin base no hay porcentaje, y un 0%
 *  inventado se lee como un dato real. */
function tasa(parte: number, total: number): number | null {
  return total === 0 ? null : (parte / total) * 100;
}

/** Agrupa los registros por una dimensión y devuelve el embudo de cada corte,
 *  ordenado por volumen. */
export function cortarPor(
  registros: readonly Registro[],
  clave: (r: Registro) => string,
  etiqueta: (valor: string) => string = (v) => v,
): CorteEmbudo[] {
  const mapa = new Map<string, CorteEmbudo>();

  for (const r of registros) {
    const k = clave(r);
    const corte = mapa.get(k) ?? {
      clave: k,
      etiqueta: etiqueta(k),
      iniciadas: 0,
      completadas: 0,
      agendadas: 0,
    };
    corte.iniciadas += 1;
    if (r.estado === 'completada') corte.completadas += 1;
    if (r.agendada) corte.agendadas += 1;
    mapa.set(k, corte);
  }

  return [...mapa.values()].sort(
    (a, b) =>
      b.agendadas - a.agendadas ||
      b.iniciadas - a.iniciadas ||
      a.etiqueta.localeCompare(b.etiqueta, 'es'),
  );
}

export const cortarPorCanal = (registros: readonly Registro[]) =>
  cortarPor(
    registros,
    (r) => r.canal,
    (v) => ETIQUETAS_CANAL[v as Canal] ?? v,
  );

export const cortarPorFuente = (registros: readonly Registro[]) =>
  cortarPor(registros, (r) => r.fuente);

export const cortarPorCampana = (registros: readonly Registro[]) =>
  cortarPor(registros, (r) => r.campana ?? 'sin campaña');

export const cortarPorPrograma = (registros: readonly Registro[]) =>
  cortarPor(registros, (r) => r.programaNombre);

/**
 * Agendas por fuente (Substack, LinkedIn, Facebook…), partidas en pagado
 * (canal "pauta") vs orgánico (el resto de canales). A diferencia de
 * `cortarPorFuente`, que cuenta todo el embudo, aquí solo importa el
 * resultado final: cuántas agendas generó cada fuente y cuánto de eso fue
 * pauta pagada.
 */
export function cortarPorFuentePagoOrganico(
  registros: readonly Registro[],
): FuentePagoOrganico[] {
  const mapa = new Map<string, FuentePagoOrganico>();

  for (const r of registros) {
    if (!r.agendada) continue;
    const corte = mapa.get(r.fuente) ?? {
      fuente: r.fuente,
      pagado: 0,
      organico: 0,
      total: 0,
    };
    if (r.canal === 'pauta') corte.pagado += 1;
    else corte.organico += 1;
    corte.total += 1;
    mapa.set(r.fuente, corte);
  }

  return [...mapa.values()].sort(
    (a, b) => b.total - a.total || a.fuente.localeCompare(b.fuente, 'es'),
  );
}

/**
 * Identificador legible de la pieza de contenido que trajo una respuesta:
 * `utm_content` si viene etiquetado, o el `ad_id` de Meta cuando no lo trae
 * (frecuente en pauta bien configurada pero sin ese parámetro puntual).
 */
function contenidoDe(r: Registro): string {
  const contenido = (r.utm.utm_content ?? '').trim();
  if (contenido) return contenido;
  const adId = (r.utm.ad_id ?? '').trim();
  if (adId) return adId;
  return 'sin identificar';
}

/**
 * Agendas agrupadas por pieza de contenido (post, video, creativo…), solo
 * dentro de un canal (pagado u orgánico). Responde "de qué post concreto
 * vinieron las orgánicas" o "qué video de pauta generó estas agendas" —
 * `cortarPorFuentePagoOrganico` ya dice cuánto aportó cada fuente, esto baja
 * un nivel más, al contenido puntual dentro de esa fuente.
 */
export function cortarPorContenido(
  registros: readonly Registro[],
  esPagado: boolean,
): CorteContenido[] {
  const mapa = new Map<string, CorteContenido>();

  for (const r of registros) {
    if (!r.agendada) continue;
    if ((r.canal === 'pauta') !== esPagado) continue;
    const contenido = contenidoDe(r);
    const corte = mapa.get(contenido) ?? { contenido, agendadas: 0 };
    corte.agendadas += 1;
    mapa.set(contenido, corte);
  }

  return [...mapa.values()].sort(
    (a, b) => b.agendadas - a.agendadas || a.contenido.localeCompare(b.contenido, 'es'),
  );
}

/** Post/pieza orgánica que generó cada agenda (canal distinto de pauta). */
export const cortarPorPostOrganico = (registros: readonly Registro[]) =>
  cortarPorContenido(registros, false);

/** Video/creativo de pauta que generó cada agenda (canal "pauta"). */
export const cortarPorVideoPagado = (registros: readonly Registro[]) =>
  cortarPorContenido(registros, true);

/**
 * Correos que aparecen más de una vez.
 *
 * Un mismo correo repetido en varios formularios es una persona que se
 * inscribió a varios programas o que reintentó: saberlo evita contar como
 * leads distintos a la misma persona.
 */
export function correosRepetidos(
  registros: readonly Registro[],
): { email: string; veces: number; programas: string[] }[] {
  const mapa = new Map<string, { veces: number; programas: Set<string> }>();

  for (const r of registros) {
    if (!r.email) continue;
    const e = mapa.get(r.email) ?? { veces: 0, programas: new Set<string>() };
    e.veces += 1;
    e.programas.add(r.programaNombre);
    mapa.set(r.email, e);
  }

  return [...mapa.entries()]
    .filter(([, v]) => v.veces > 1)
    .map(([email, v]) => ({ email, veces: v.veces, programas: [...v.programas].sort() }))
    .sort((a, b) => b.veces - a.veces || a.email.localeCompare(b.email));
}
