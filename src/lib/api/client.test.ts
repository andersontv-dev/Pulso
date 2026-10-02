import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCache } from '@/lib/config/env';
import { peticion } from './client';

/**
 * El caso que rompió producción: con formularios grandes (varias páginas
 * seguidas), una sola página lenta disparaba el timeout interno de
 * fetchConTimeout, y ese abort se relanzaba sin reintentar — tumbando toda
 * la descarga de un formulario de miles de respuestas por una página.
 */
describe('peticion', () => {
  beforeEach(() => {
    process.env.FORM30X_API_KEY = 'test-key';
    process.env.FORM30X_API_URL = 'https://form.test';
    resetEnvCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.FORM30X_API_KEY;
    delete process.env.FORM30X_API_URL;
    resetEnvCache();
  });

  it('reintenta un abort interno (timeout de una página) como un fallo transitorio', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(peticion('/forms')).rejects.toMatchObject({ codigo: 'red' });
    // INTENTOS_MAXIMOS = 3: se reintentó, no se rindió al primer intento.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('respeta un abort externo (el caller canceló) y no lo reintenta', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'));
    vi.stubGlobal('fetch', fetchMock);

    const controlador = new AbortController();
    controlador.abort();

    await expect(peticion('/forms', { signal: controlador.signal })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
