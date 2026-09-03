/**
 * Paginación por cursor de form30x.
 *
 * Implementada contra el `openapi.json` real, no por deducción. Los dos
 * detalles que la especificación fija y que no se podían adivinar:
 *
 * 1. **El cursor viaja en la cabecera `X-Next-Cursor`**, no en el cuerpo. La
 *    versión anterior de este módulo lo buscaba dentro del JSON, así que
 *    habría traído solo la primera página de cada formulario y habría parado
 *    creyendo que no había más. Con formularios de 3.000 respuestas eso es
 *    mostrar el 1,5% de los datos sin avisar.
 * 2. **`limit` admite hasta 200** (por defecto 50). Usar el máximo reduce a la
 *    cuarta parte las idas y vueltas contra una API que no publica rate limit.
 *
 * El cuerpo es siempre `{ data: [...], issues: [...] }`.
 */

/** Cabecera donde form30x devuelve el cursor de la página siguiente. */
export const CABECERA_CURSOR = 'x-next-cursor';

/** Tamaño de página máximo que acepta la API. */
export const LIMITE_MAXIMO = 200;

export interface PaginaExtraida {
  items: unknown[];
  /** Advertencias no bloqueantes que la API adjunta al 200. */
  issues: unknown[];
  cursor: string | null;
}

/** Separa el cuerpo `{ data, issues }` y lee el cursor de las cabeceras. */
export function extraerPagina(cuerpo: unknown, cabeceras: Headers): PaginaExtraida {
  const objeto =
    typeof cuerpo === 'object' && cuerpo !== null ? (cuerpo as Record<string, unknown>) : {};

  const cursorCrudo = cabeceras.get(CABECERA_CURSOR);
  const cursor = cursorCrudo && cursorCrudo.trim() !== '' ? cursorCrudo.trim() : null;

  return {
    items: Array.isArray(objeto.data) ? objeto.data : [],
    issues: Array.isArray(objeto.issues) ? objeto.issues : [],
    cursor,
  };
}

export interface OpcionesRecorrido {
  /** Tope duro de páginas. Con `limit=200`, 50 páginas son 10.000 registros. */
  maximoPaginas: number;
}

export interface ResultadoRecorrido {
  items: unknown[];
  issues: unknown[];
  paginas: number;
  /** `true` si se paró antes de agotar los datos. Quien llama debe avisarlo:
   *  devolver datos incompletos como si fueran completos es el peor fallo
   *  posible en una herramienta de reportería. */
  truncado: boolean;
}

/**
 * Recorre todas las páginas invocando `traerPagina`.
 *
 * Corta si el cursor se repite. La especificación dice que el cursor es «el id
 * del último item de la página anterior», así que un servidor que devolviera
 * siempre el mismo dejaría el proceso girando indefinidamente.
 */
export async function recorrerPaginas(
  traerPagina: (cursor: string | null) => Promise<PaginaExtraida>,
  { maximoPaginas }: OpcionesRecorrido,
): Promise<ResultadoRecorrido> {
  const items: unknown[] = [];
  const issues: unknown[] = [];
  const cursoresVistos = new Set<string>();
  let cursor: string | null = null;
  let paginas = 0;

  while (paginas < maximoPaginas) {
    const pagina: PaginaExtraida = await traerPagina(cursor);
    paginas += 1;
    items.push(...pagina.items);
    issues.push(...pagina.issues);

    if (!pagina.cursor) return { items, issues, paginas, truncado: false };
    if (pagina.items.length === 0) return { items, issues, paginas, truncado: false };
    if (cursoresVistos.has(pagina.cursor)) {
      return { items, issues, paginas, truncado: true };
    }

    cursoresVistos.add(pagina.cursor);
    cursor = pagina.cursor;
  }

  return { items, issues, paginas, truncado: true };
}
