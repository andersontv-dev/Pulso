import type { Agenda, DiaPrograma, SeriePrograma } from './types';

export interface ProgramaVisible {
  id: string;
  nombre: string;
  rama: string | null;
}

/**
 * Construye el desglose diario por programa.
 *
 * Devuelve una fila por programa con TODOS los días del rango, incluidos los
 * que tienen cero. Un hueco en una serie temporal se lee como "no hay dato";
 * un cero se lee como "ese día no hubo agendas", que es lo que de verdad pasó
 * y lo que hace comparables las filas entre sí.
 *
 * Los programas sin ninguna agenda en el rango también aparecen si están en
 * `programas`: si alguien filtra por un programa y no ve la fila, no sabe si
 * es que no hubo agendas o que el filtro no se aplicó.
 */
export function construirSeries(
  agendas: readonly Agenda[],
  dias: readonly string[],
  programas: readonly ProgramaVisible[],
): SeriePrograma[] {
  const conteos = new Map<string, Map<string, number>>();
  for (const programa of programas) {
    conteos.set(programa.id, new Map(dias.map((dia) => [dia, 0])));
  }

  for (const agenda of agendas) {
    const porDia = conteos.get(agenda.programaId);
    // Una agenda fuera del rango o de un programa no listado se ignora aquí;
    // el filtrado ya ocurrió antes, y contar dos veces sería peor.
    if (!porDia || !porDia.has(agenda.dia)) continue;
    porDia.set(agenda.dia, (porDia.get(agenda.dia) ?? 0) + 1);
  }

  return programas
    .map((programa) => {
      const porDia = conteos.get(programa.id)!;
      const celdas: DiaPrograma[] = dias.map((fecha) => ({
        fecha,
        agendas: porDia.get(fecha) ?? 0,
      }));
      return {
        programaId: programa.id,
        programaNombre: programa.nombre,
        rama: programa.rama,
        total: celdas.reduce((suma, celda) => suma + celda.agendas, 0),
        dias: celdas,
      };
    })
    .sort((a, b) => b.total - a.total || a.programaNombre.localeCompare(b.programaNombre, 'es'));
}

/**
 * Suma las series en una sola: el agregado que alimenta los KPIs.
 *
 * Indexa cada serie por fecha una sola vez. La versión ingenua —buscar la
 * fecha dentro de `serie.dias` en cada iteración— es cuadrática en el número
 * de días, y con un rango de un año eso son millones de comparaciones para
 * un resultado que cabe en un bucle.
 */
export function serieTotal(
  series: readonly SeriePrograma[],
  dias: readonly string[],
): DiaPrograma[] {
  const totales = new Map(dias.map((fecha) => [fecha, 0]));

  for (const serie of series) {
    for (const dia of serie.dias) {
      const acumulado = totales.get(dia.fecha);
      if (acumulado !== undefined) totales.set(dia.fecha, acumulado + dia.agendas);
    }
  }

  return dias.map((fecha) => ({ fecha, agendas: totales.get(fecha) ?? 0 }));
}
