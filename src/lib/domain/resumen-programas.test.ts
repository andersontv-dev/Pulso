import { describe, expect, it } from 'vitest';
import { agruparPorPrograma, formatearResumenProgramas } from './resumen-programas';

describe('agruparPorPrograma', () => {
  it('cuenta cuántos items hay de cada programa', () => {
    const items = [
      { programaNombre: 'Inmersivo' },
      { programaNombre: 'AI Sales' },
      { programaNombre: 'Inmersivo' },
    ];
    expect(agruparPorPrograma(items)).toEqual(
      expect.arrayContaining([
        { nombre: 'Inmersivo', cantidad: 2 },
        { nombre: 'AI Sales', cantidad: 1 },
      ]),
    );
  });

  it('con una lista vacía devuelve una lista vacía', () => {
    expect(agruparPorPrograma([])).toEqual([]);
  });
});

describe('formatearResumenProgramas', () => {
  it('ordena de mayor a menor aporte', () => {
    const texto = formatearResumenProgramas([
      { nombre: 'AI Sales', cantidad: 7 },
      { nombre: 'Inmersivo', cantidad: 6 },
    ]);
    expect(texto).toBe('AI Sales 7 · Inmersivo 6');
  });

  it('desempata alfabéticamente cuando la cantidad es igual', () => {
    const texto = formatearResumenProgramas([
      { nombre: 'Zeta', cantidad: 3 },
      { nombre: 'Alfa', cantidad: 3 },
    ]);
    expect(texto).toBe('Alfa 3 · Zeta 3');
  });

  it('omite los programas en cero', () => {
    const texto = formatearResumenProgramas([
      { nombre: 'AI Sales', cantidad: 0 },
      { nombre: 'Inmersivo', cantidad: 6 },
    ]);
    expect(texto).toBe('Inmersivo 6');
  });

  it('corta en el límite y suma el resto como "+K más"', () => {
    const texto = formatearResumenProgramas(
      [
        { nombre: 'A', cantidad: 5 },
        { nombre: 'B', cantidad: 4 },
        { nombre: 'C', cantidad: 3 },
      ],
      2,
    );
    expect(texto).toBe('A 5 · B 4 · +1 más');
  });
});
