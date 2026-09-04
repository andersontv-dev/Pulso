import { describe, expect, it, vi } from 'vitest';
import {
  CABECERA_CURSOR,
  LIMITE_MAXIMO,
  extraerPagina,
  recorrerPaginas,
  type PaginaExtraida,
} from './pagination';

const cabeceras = (cursor?: string) =>
  new Headers(cursor ? { [CABECERA_CURSOR]: cursor } : undefined);

describe('extraerPagina', () => {
  it('lee el cursor de la cabecera X-Next-Cursor, no del cuerpo', () => {
    // Es el detalle que fija el openapi.json y que no se podía deducir: una
    // implementación que buscara el cursor en el JSON pararía en la primera
    // página creyendo que no hay más datos.
    const p = extraerPagina({ data: [1, 2] }, cabeceras('id_ultimo'));
    expect(p).toEqual({ items: [1, 2], issues: [], cursor: 'id_ultimo' });
  });

  it('ignora un cursor en el cuerpo, que no es donde vive', () => {
    const p = extraerPagina({ data: [1], next_cursor: 'trampa' }, cabeceras());
    expect(p.cursor).toBeNull();
  });

  it('recoge las advertencias no bloqueantes del 200', () => {
    const p = extraerPagina({ data: [], issues: [{ code: 'x' }] }, cabeceras());
    expect(p.issues).toEqual([{ code: 'x' }]);
  });

  it('trata la cabecera vacía como fin de páginas', () => {
    expect(extraerPagina({ data: [1] }, cabeceras('   ')).cursor).toBeNull();
  });

  it('no revienta ante un cuerpo inesperado', () => {
    expect(extraerPagina(null, cabeceras())).toEqual({ items: [], issues: [], cursor: null });
    expect(extraerPagina('texto', cabeceras())).toEqual({ items: [], issues: [], cursor: null });
  });

  it('el límite máximo es el que declara la especificación', () => {
    expect(LIMITE_MAXIMO).toBe(200);
  });
});

describe('recorrerPaginas', () => {
  const pagina = (items: unknown[], cursor: string | null): PaginaExtraida => ({
    items,
    issues: [],
    cursor,
  });

  it('concatena todas las páginas hasta que se acaba el cursor', async () => {
    const traer = vi
      .fn<(c: string | null) => Promise<PaginaExtraida>>()
      .mockResolvedValueOnce(pagina([1, 2], 'c1'))
      .mockResolvedValueOnce(pagina([3], null));

    const r = await recorrerPaginas(traer, { maximoPaginas: 10 });
    expect(r.items).toEqual([1, 2, 3]);
    expect(r.truncado).toBe(false);
    expect(traer).toHaveBeenNthCalledWith(1, null);
    expect(traer).toHaveBeenNthCalledWith(2, 'c1');
  });

  it('acumula las advertencias de todas las páginas', async () => {
    const traer = vi
      .fn<(c: string | null) => Promise<PaginaExtraida>>()
      .mockResolvedValueOnce({ items: [1], issues: ['a'], cursor: 'c1' })
      .mockResolvedValueOnce({ items: [2], issues: ['b'], cursor: null });
    const r = await recorrerPaginas(traer, { maximoPaginas: 10 });
    expect(r.issues).toEqual(['a', 'b']);
  });

  it('corta si el servidor repite el cursor, y lo declara truncado', async () => {
    const traer = vi.fn().mockResolvedValue(pagina([1], 'siempre-el-mismo'));
    const r = await recorrerPaginas(traer, { maximoPaginas: 50 });
    expect(r.truncado).toBe(true);
    expect(traer).toHaveBeenCalledTimes(2);
  });

  it('respeta el tope de páginas y avisa de que hay más datos', async () => {
    const traer = vi
      .fn<(c: string | null) => Promise<PaginaExtraida>>()
      .mockImplementation(async (c) => pagina([1], `cursor-${String(c)}`));
    const r = await recorrerPaginas(traer, { maximoPaginas: 3 });
    expect(r.paginas).toBe(3);
    expect(r.truncado).toBe(true);
  });

  it('sospecha truncamiento si la página vino llena y sin cursor', async () => {
    // Comprobado contra el servidor real: no siempre manda X-Next-Cursor
    // aunque la especificación lo declare. Devolver una lista truncada como
    // si fuera completa sería el fallo silencioso que hay que evitar.
    const traer = vi.fn().mockResolvedValue(pagina([1, 2, 3], null));
    const r = await recorrerPaginas(traer, { maximoPaginas: 10, limitePedido: 3 });
    expect(r.truncado).toBe(true);
  });

  it('no sospecha nada si la página vino a medias', async () => {
    const traer = vi.fn().mockResolvedValue(pagina([1, 2], null));
    const r = await recorrerPaginas(traer, { maximoPaginas: 10, limitePedido: 200 });
    expect(r.truncado).toBe(false);
  });

  it('para ante una página vacía con cursor', async () => {
    const traer = vi.fn().mockResolvedValue(pagina([], 'c1'));
    const r = await recorrerPaginas(traer, { maximoPaginas: 10 });
    expect(r).toEqual({ items: [], issues: [], paginas: 1, truncado: false });
  });
});
