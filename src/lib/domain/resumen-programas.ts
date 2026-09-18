import { formatearEntero } from '@/lib/formato';

export interface ConteoPrograma {
  nombre: string;
  cantidad: number;
}

/**
 * Agrupa una lista de items con `programaNombre` y cuenta cuántos hay de
 * cada uno. Sirve para desglosar un total general ("43 registros") en
 * cuánto aporta cada programa, sin tener que desplegar la tabla completa.
 */
export function agruparPorPrograma(items: readonly { programaNombre: string }[]): ConteoPrograma[] {
  const mapa = new Map<string, number>();
  for (const item of items) {
    mapa.set(item.programaNombre, (mapa.get(item.programaNombre) ?? 0) + 1);
  }
  return [...mapa.entries()].map(([nombre, cantidad]) => ({ nombre, cantidad }));
}

/**
 * Texto compacto "Programa N · Programa N …", ordenado de mayor a menor
 * aporte. Con más programas de los que caben en una línea, corta en
 * `limite` y suma el resto en "+K más" en vez de desbordar la tarjeta.
 */
export function formatearResumenProgramas(conteos: readonly ConteoPrograma[], limite = 6): string {
  const ordenados = [...conteos]
    .filter((c) => c.cantidad > 0)
    .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, 'es'));

  const visibles = ordenados.slice(0, limite);
  const texto = visibles.map((c) => `${c.nombre} ${formatearEntero(c.cantidad)}`).join(' · ');

  const ocultos = ordenados.length - visibles.length;
  return ocultos > 0 ? `${texto} · +${ocultos} más` : texto;
}
