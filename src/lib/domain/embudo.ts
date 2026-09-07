import { ETIQUETAS_CANAL, type Canal } from './canal';
import type { CorteEmbudo, Embudo, Registro } from './types';

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
