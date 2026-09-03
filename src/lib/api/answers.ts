import type { Answer } from './schemas';

/**
 * Lectura segura de respuestas basadas en opciones.
 *
 * La documentación advierte, textualmente: «los ids de opción son únicos solo
 * DENTRO de su propio campo, así que el mismo id puede aparecer en dos
 * preguntas con significados distintos — lee siempre `label`, o mapea por
 * (fieldRef, id) mediante `choices`».
 *
 * Este módulo existe para que esa advertencia sea imposible de incumplir
 * desde el resto del código: nada agrupa nunca por un id suelto.
 */

/** Clave estable de una opción. Nunca uses el id a secas para agrupar. */
export function claveOpcion(fieldRef: string, idOpcion: string): string {
  return `${fieldRef}::${idOpcion}`;
}

/** Etiqueta legible de una opción, resuelta dentro de su propio campo. */
export function etiquetaDeOpcion(answer: Answer, idOpcion: string): string | null {
  const opcion = answer.choices?.find((c) => c.id === idOpcion);
  return opcion?.label ?? null;
}

/**
 * Etiquetas legibles de una answer, sea de selección simple o múltiple.
 *
 * Prefiere el `label` que ya envía la API y solo recurre a `choices` cuando
 * no viene, que es justo el orden que recomienda la documentación.
 */
export function etiquetasDeAnswer(answer: Answer): string[] {
  if (typeof answer.label === 'string') return [answer.label];
  if (Array.isArray(answer.label)) {
    return answer.label.filter((l): l is string => typeof l === 'string');
  }

  const ids = Array.isArray(answer.value) ? answer.value : [answer.value];
  return ids
    .filter((id): id is string => typeof id === 'string')
    .map((id) => etiquetaDeOpcion(answer, id))
    .filter((etiqueta): etiqueta is string => etiqueta !== null);
}
