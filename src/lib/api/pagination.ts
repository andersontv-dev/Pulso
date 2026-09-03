/**
 * Paginación por cursor con detección en runtime.
 *
 * La documentación dice que `GET /forms/:id/responses` está «paginada por
 * cursor» y nada más: no nombra el parámetro, ni el campo del cursor en la
 * respuesta, ni el tamaño de página, ni el orden (docs/api/form30x.md §7).
 *
 * Hasta tener el openapi.json, este módulo reconoce las convenciones
 * habituales en vez de apostar por una. Es un apaño consciente y acotado, no
 * una solución: cuando la especificación esté disponible, se sustituye por la
 * implementación exacta y este archivo se queda en veinte líneas.
 */

const CLAVES_ITEMS = ['data', 'items', 'results', 'responses', 'records'] as const;
const CLAVES_CURSOR = ['next_cursor', 'nextCursor', 'cursor', 'next', 'after'] as const;
const CLAVES_ANIDADAS = ['meta', 'paging', 'pagination', 'page', 'links'] as const;

export interface PaginaExtraida {
  items: unknown[];
  cursor: string | null;
}

/** Localiza el array de elementos y el cursor siguiente en un cuerpo del que
 *  no conocemos la forma exacta. */
export function extraerPagina(cuerpo: unknown): PaginaExtraida {
  if (Array.isArray(cuerpo)) return { items: cuerpo, cursor: null };

  if (typeof cuerpo !== 'object' || cuerpo === null) {
    return { items: [], cursor: null };
  }

  const objeto = cuerpo as Record<string, unknown>;

  let items: unknown[] = [];
  for (const clave of CLAVES_ITEMS) {
    if (Array.isArray(objeto[clave])) {
      items = objeto[clave];
      break;
    }
  }

  return { items, cursor: buscarCursor(objeto) };
}

function buscarCursor(objeto: Record<string, unknown>): string | null {
  const directo = leerCursor(objeto);
  if (directo) return directo;

  for (const contenedor of CLAVES_ANIDADAS) {
    const anidado = objeto[contenedor];
    if (typeof anidado === 'object' && anidado !== null) {
      const encontrado = leerCursor(anidado as Record<string, unknown>);
      if (encontrado) return encontrado;
    }
  }
  return null;
}

function leerCursor(objeto: Record<string, unknown>): string | null {
  for (const clave of CLAVES_CURSOR) {
    const valor = objeto[clave];
    if (typeof valor === 'string' && valor.trim() !== '') return valor;
  }
  // `has_more: false` es una señal explícita de fin que conviene respetar.
  if (objeto.has_more === false || objeto.hasMore === false) return null;
  return null;
}

export interface OpcionesRecorrido {
  /** Tope duro de páginas. Protege contra un servidor que devuelva siempre el
   *  mismo cursor y contra un histórico mucho mayor de lo previsto. */
  maximoPaginas: number;
}

export interface ResultadoRecorrido {
  items: unknown[];
  paginas: number;
  /** `true` si se alcanzó el tope: hay más datos de los que se leyeron y
   *  quien llama debe avisarlo, no ignorarlo. */
  truncado: boolean;
}

/**
 * Recorre todas las páginas invocando `traerPagina`.
 *
 * Corta si el cursor se repite: sin ese guardarraíl, un servidor que devuelva
 * siempre el mismo cursor deja el proceso girando indefinidamente.
 */
export async function recorrerPaginas(
  traerPagina: (cursor: string | null) => Promise<PaginaExtraida>,
  { maximoPaginas }: OpcionesRecorrido,
): Promise<ResultadoRecorrido> {
  const items: unknown[] = [];
  const cursoresVistos = new Set<string>();
  let cursor: string | null = null;
  let paginas = 0;

  while (paginas < maximoPaginas) {
    const pagina: PaginaExtraida = await traerPagina(cursor);
    paginas += 1;
    items.push(...pagina.items);

    if (!pagina.cursor) return { items, paginas, truncado: false };
    if (cursoresVistos.has(pagina.cursor)) {
      // El servidor repite cursor: se para y se declara truncado en vez de
      // seguir acumulando duplicados.
      return { items, paginas, truncado: true };
    }
    // Una página vacía con cursor conduce a un bucle sin fin de páginas vacías.
    if (pagina.items.length === 0) return { items, paginas, truncado: false };

    cursoresVistos.add(pagina.cursor);
    cursor = pagina.cursor;
  }

  return { items, paginas, truncado: true };
}
