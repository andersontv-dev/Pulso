import { describe, expect, it } from 'vitest';
import { calcularKpis, variacion } from './kpis';
import type { DiaPrograma } from './types';

const dias = (...valores: number[]): DiaPrograma[] =>
  valores.map((agendas, i) => ({
    fecha: `2026-03-${String(i + 1).padStart(2, '0')}`,
    agendas,
  }));

describe('variacion', () => {
  it('calcula subidas y bajadas', () => {
    expect(variacion(120, 100)).toBe(20);
    expect(variacion(80, 100)).toBeCloseTo(-20);
  });

  it('devuelve null si no hay base de comparación', () => {
    // El bug clásico del dashboard: dividir entre cero y mostrar 0%, ∞% o NaN%.
    expect(variacion(10, 0)).toBeNull();
    expect(variacion(0, 0)).toBeNull();
  });
});

describe('calcularKpis', () => {
  it('calcula total, promedio y extremos contando los días vacíos', () => {
    const kpis = calcularKpis(dias(5, 0, 10, 1), dias(2, 2, 2, 2));

    expect(kpis.total).toBe(16);
    expect(kpis.totalPrevio).toBe(8);
    expect(kpis.variacionPct).toBe(100);
    expect(kpis.promedioDiario).toBe(4); // 16 / 4 días, no 16 / 3 con datos
    expect(kpis.mejorDia).toEqual({ fecha: '2026-03-03', agendas: 10 });
    // El peor día es un día con cero: eso es justo lo que hay que ver.
    expect(kpis.peorDia).toEqual({ fecha: '2026-03-02', agendas: 0 });
  });

  it('desempata por el día más antiguo, de forma determinista', () => {
    const kpis = calcularKpis(dias(7, 7, 3, 3));
    expect(kpis.mejorDia?.fecha).toBe('2026-03-01');
    expect(kpis.peorDia?.fecha).toBe('2026-03-03');
  });

  it('sobrevive a un rango sin días', () => {
    expect(calcularKpis([], [])).toEqual({
      total: 0,
      totalPrevio: 0,
      variacionPct: null,
      promedioDiario: 0,
      mejorDia: null,
      peorDia: null,
    });
  });

  it('con un solo día, mejor y peor son el mismo', () => {
    const kpis = calcularKpis(dias(4));
    expect(kpis.mejorDia).toEqual(kpis.peorDia);
    expect(kpis.promedioDiario).toBe(4);
  });
});
