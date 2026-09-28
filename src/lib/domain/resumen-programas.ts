import { formatearEntero } from '@/lib/formato';

export interface ConteoPrograma {
  nombre: string;
  cantidad: number;
  /** De `cantidad`, cuántos llegaron por pauta pagada. */
  pagado: number;
  /** De `cantidad`, cuántos llegaron por cualquier otro canal. */
  organico: number;
}

/**
 * Agrupa una lista de items con `programaNombre` y `canal`, contando cuántos
 * hay de cada programa y partiendo ese total en pagado (canal "pauta") vs
 * orgánico (el resto). Sirve para desglosar un total general ("43
 * registros") en cuánto aporta cada programa y de qué canal viene, sin tener
 * que desplegar la tabla completa.
 */
export function agruparPorPrograma(
  items: readonly { programaNombre: string; canal: string }[],
): ConteoPrograma[] {
  const mapa = new Map<string, ConteoPrograma>();
  for (const item of items) {
    const c = mapa.get(item.programaNombre) ?? {
      nombre: item.programaNombre,
      cantidad: 0,
      pagado: 0,
      organico: 0,
    };
    c.cantidad += 1;
    if (item.canal === 'pauta') c.pagado += 1;
    else c.organico += 1;
    mapa.set(item.programaNombre, c);
  }
  return [...mapa.values()];
}

/**
 * Texto compacto "Programa N (P pauta, O orgánico) · …", ordenado de mayor a
 * menor aporte. Con más programas de los que caben en una línea, corta en
 * `limite` y suma el resto en "+K más" en vez de desbordar la tarjeta.
 */
export function formatearResumenProgramas(conteos: readonly ConteoPrograma[], limite = 6): string {
  const ordenados = [...conteos]
    .filter((c) => c.cantidad > 0)
    .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, 'es'));

  const visibles = ordenados.slice(0, limite);
  const texto = visibles
    .map(
      (c) =>
        `${c.nombre} ${formatearEntero(c.cantidad)} ` +
        `(${formatearEntero(c.pagado)} pauta, ${formatearEntero(c.organico)} orgánico)`,
    )
    .join(' · ');

  const ocultos = ordenados.length - visibles.length;
  return ocultos > 0 ? `${texto} · +${ocultos} más` : texto;
}
