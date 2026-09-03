import { afterEach, describe, expect, it, vi } from 'vitest';
import { conCache, purgarCaducadas, vaciarCache } from './cache';

afterEach(() => {
  vaciarCache();
  vi.useRealTimers();
});

describe('conCache', () => {
  it('reutiliza el valor cacheado dentro del TTL', async () => {
    const producir = vi.fn().mockResolvedValue('valor');
    await conCache('k', producir, { ttlMs: 1000 });
    await conCache('k', producir, { ttlMs: 1000 });
    expect(producir).toHaveBeenCalledTimes(1);
  });

  it('deduplica las peticiones concurrentes', async () => {
    // Sin esto, N personas abriendo el dashboard a la vez serían N tandas de
    // peticiones contra una API que no publica rate limit.
    let resolver: (v: string) => void = () => {};
    const producir = vi.fn(() => new Promise<string>((r) => (resolver = r)));

    const a = conCache('k', producir, { ttlMs: 1000 });
    const b = conCache('k', producir, { ttlMs: 1000 });
    resolver('compartido');

    expect(await a).toBe('compartido');
    expect(await b).toBe('compartido');
    expect(producir).toHaveBeenCalledTimes(1);
  });

  it('vuelve a producir cuando el TTL expira', async () => {
    vi.useFakeTimers();
    const producir = vi.fn().mockResolvedValue('v');
    await conCache('k', producir, { ttlMs: 100 });
    vi.advanceTimersByTime(150);
    await conCache('k', producir, { ttlMs: 100 });
    expect(producir).toHaveBeenCalledTimes(2);
  });

  it('forzar salta el caché', async () => {
    const producir = vi.fn().mockResolvedValue('v');
    await conCache('k', producir, { ttlMs: 10_000 });
    await conCache('k', producir, { ttlMs: 10_000, forzar: true });
    expect(producir).toHaveBeenCalledTimes(2);
  });

  it('un fallo no se cachea', async () => {
    const producir = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue('ok');
    await expect(conCache('k', producir, { ttlMs: 1000 })).rejects.toThrow('boom');
    expect(await conCache('k', producir, { ttlMs: 1000 })).toBe('ok');
  });

  it('purgarCaducadas limpia sin tocar lo vigente', async () => {
    vi.useFakeTimers();
    const producir = vi.fn().mockResolvedValue('v');
    await conCache('corta', producir, { ttlMs: 50 });
    await conCache('larga', producir, { ttlMs: 10_000 });
    vi.advanceTimersByTime(100);
    purgarCaducadas();
    await conCache('larga', producir, { ttlMs: 10_000 });
    expect(producir).toHaveBeenCalledTimes(2);
  });
});
