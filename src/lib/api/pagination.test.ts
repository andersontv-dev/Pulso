import { describe, expect, it, vi } from 'vitest';
import { extraerPagina, recorrerPaginas, type PaginaExtraida } from './pagination';

describe('extraerPagina', () => {
  it('acepta un array desnudo', () => {
    expect(extraerPagina([1, 2])).toEqual({ items: [1, 2], cursor: null });
  });

  it('reconoce las convenciones habituales para la lista', () => {
    for (const clave of ['data', 'items', 'results', 'responses', 'records']) {
      expect(extraerPagina({ [clave]: [1] }).items).toEqual([1]);
    }
  });

  it('reconoce el cursor suelto o anidado', () => {
    expect(extraerPagina({ data: [], next_cursor: 'abc' }).cursor).toBe('abc');
    expect(extraerPagina({ data: [], nextCursor: 'abc' }).cursor).toBe('abc');
    expect(extraerPagina({ data: [], meta: { next_cursor: 'x' } }).cursor).toBe('x');
    expect(extraerPagina({ data: [], pagination: { cursor: 'y' } }).cursor).toBe('y');
  });

  it('devuelve null cuando no hay más páginas', () => {
    expect(extraerPagina({ data: [1] }).cursor).toBeNull();
    expect(extraerPagina({ data: [1], has_more: false, cursor: '' }).cursor).toBeNull();
  });

  it('no revienta ante un cuerpo inesperado', () => {
    expect(extraerPagina(null)).toEqual({ items: [], cursor: null });
    expect(extraerPagina('texto')).toEqual({ items: [], cursor: null });
  });
});

describe('recorrerPaginas', () => {
  const pagina = (items: unknown[], cursor: string | null): PaginaExtraida => ({ items, cursor });

  it('concatena todas las páginas hasta que se acaba el cursor', async () => {
    const traer = vi
      .fn<(c: string | null) => Promise<PaginaExtraida>>()
      .mockResolvedValueOnce(pagina([1, 2], 'c1'))
      .mockResolvedValueOnce(pagina([3], null));

    const resultado = await recorrerPaginas(traer, { maximoPaginas: 10 });
    expect(resultado).toEqual({ items: [1, 2, 3], paginas: 2, truncado: false });
    expect(traer).toHaveBeenNthCalledWith(1, null);
    expect(traer).toHaveBeenNthCalledWith(2, 'c1');
  });

  it('corta si el servidor repite el cursor, y lo declara truncado', async () => {
    // Sin este guardarraíl, el proceso giraría indefinidamente.
    const traer = vi.fn().mockResolvedValue(pagina([1], 'siempre-el-mismo'));
    const resultado = await recorrerPaginas(traer, { maximoPaginas: 50 });
    expect(resultado.truncado).toBe(true);
    expect(traer).toHaveBeenCalledTimes(2);
  });

  it('respeta el tope de páginas y avisa de que hay más datos', async () => {
    const traer = vi
      .fn<(c: string | null) => Promise<PaginaExtraida>>()
      .mockImplementation(async (c) => pagina([1], `cursor-${String(c)}`));
    const resultado = await recorrerPaginas(traer, { maximoPaginas: 3 });
    expect(resultado.paginas).toBe(3);
    expect(resultado.truncado).toBe(true);
  });

  it('para ante una página vacía con cursor', async () => {
    const traer = vi.fn().mockResolvedValue(pagina([], 'c1'));
    const resultado = await recorrerPaginas(traer, { maximoPaginas: 10 });
    expect(resultado).toEqual({ items: [], paginas: 1, truncado: false });
  });
});
