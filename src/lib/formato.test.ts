import { describe, expect, it } from 'vitest';
import { formatearDuracionAprox, formatearHaceCuanto, formatearVariacion } from './formato';

describe('formatearDuracionAprox', () => {
  it('usa segundos hasta minuto y medio, y minutos después', () => {
    expect(formatearDuracionAprox(400)).toBe('~1 s');
    expect(formatearDuracionAprox(42_300)).toBe('~42 s');
    expect(formatearDuracionAprox(89_000)).toBe('~89 s');
    expect(formatearDuracionAprox(150_000)).toBe('~3 min');
  });
});

describe('formatearVariacion', () => {
  it('marca el signo explícitamente', () => {
    expect(formatearVariacion(12.34)).toBe('+12,3%');
    expect(formatearVariacion(-5)).toBe('-5%');
    expect(formatearVariacion(0)).toBe('0%');
  });

  it('dice "sin base" en vez de inventar un porcentaje', () => {
    expect(formatearVariacion(null)).toBe('Sin base');
  });
});

describe('formatearHaceCuanto', () => {
  const ahora = new Date('2026-03-10T12:00:00Z').getTime();
  const hace = (ms: number) => new Date(ahora - ms).toISOString();

  it('escala de segundos a días', () => {
    expect(formatearHaceCuanto(hace(3_000), ahora)).toBe('ahora mismo');
    expect(formatearHaceCuanto(hace(30_000), ahora)).toBe('hace 30 s');
    expect(formatearHaceCuanto(hace(300_000), ahora)).toBe('hace 5 min');
    expect(formatearHaceCuanto(hace(7_200_000), ahora)).toBe('hace 2 h');
    expect(formatearHaceCuanto(hace(172_800_000), ahora)).toBe('hace 2 d');
  });

  it('nunca muestra un tiempo negativo por desfase de relojes', () => {
    expect(formatearHaceCuanto(new Date(ahora + 5000).toISOString(), ahora)).toBe('ahora mismo');
  });
});
