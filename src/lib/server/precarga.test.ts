import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCache } from '@/lib/config/env';
import { conCache, vaciarCache } from './cache';

const api = vi.hoisted(() => ({
  obtenerFormularios: vi.fn(),
  obtenerCamposCalendly: vi.fn(),
  obtenerRespuestas: vi.fn(),
}));
vi.mock('@/lib/api', () => api);

const { precargar } = await import('./precarga');

const formulario = (id: string) => ({ id, title: `Form ${id}`, responses: 10 });

describe('precargar', () => {
  beforeEach(() => {
    process.env.FORM30X_API_KEY = 'test-key';
    process.env.FORM30X_API_URL = 'https://form.test';
    resetEnvCache();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    api.obtenerFormularios.mockResolvedValue([formulario('a'), formulario('b')]);
    api.obtenerCamposCalendly.mockResolvedValue(['booking']);
  });

  afterEach(() => {
    vaciarCache();
    vi.restoreAllMocks();
    api.obtenerRespuestas.mockReset();
    delete process.env.FORM30X_API_KEY;
    delete process.env.FORM30X_API_URL;
    resetEnvCache();
  });

  it('un formulario que falla no tumba la precarga de los demás y se reintenta al final', async () => {
    let fallosB = 0;
    api.obtenerRespuestas.mockImplementation(async (id: string) => {
      if (id === 'b' && fallosB++ === 0) throw new Error('fetch failed');
      return { respuestas: [id] };
    });

    const resumen = await precargar('test');

    expect(resumen).toMatchObject({ ok: true, renovados: 2, fallidos: 0 });
    expect(api.obtenerRespuestas).toHaveBeenCalledTimes(3);
  });

  it('si sigue fallando, conserva los datos anteriores y lo reporta como parcial', async () => {
    await conCache('respuestas:b', async () => ({ respuestas: ['viejo'] }), { ttlMs: 60_000 });
    api.obtenerRespuestas.mockImplementation(async (id: string) => {
      if (id === 'b') throw new Error('fetch failed');
      return { respuestas: [id] };
    });

    const resumen = await precargar('test');

    expect(resumen).toMatchObject({ ok: false, renovados: 1, fallidos: 1 });
    const vigente = await conCache('respuestas:b', async () => ({ respuestas: ['nuevo'] }), {
      ttlMs: 60_000,
    });
    expect(vigente).toEqual({ respuestas: ['viejo'] });
  });
});
