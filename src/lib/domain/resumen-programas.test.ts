import { describe, expect, it } from 'vitest';
import { agruparPorPrograma, formatearResumenProgramas } from './resumen-programas';

describe('agruparPorPrograma', () => {
  it('cuenta cuántos items hay de cada programa y los parte en pagado/orgánico', () => {
    const items = [
      { programaNombre: 'Inmersivo', canal: 'pauta' as const },
      { programaNombre: 'AI Sales', canal: 'organico' as const },
      { programaNombre: 'Inmersivo', canal: 'directo' as const },
    ];
    expect(agruparPorPrograma(items)).toEqual(
      expect.arrayContaining([
        { nombre: 'Inmersivo', cantidad: 2, pagado: 1, organico: 1 },
        { nombre: 'AI Sales', cantidad: 1, pagado: 0, organico: 1 },
      ]),
    );
  });

  it('con una lista vacía devuelve una lista vacía', () => {
    expect(agruparPorPrograma([])).toEqual([]);
  });
});

describe('formatearResumenProgramas', () => {
  const item = (nombre: string, cantidad: number, pagado = 0) => ({
    nombre,
    cantidad,
    pagado,
    organico: cantidad - pagado,
  });

  it('ordena de mayor a menor aporte, con el desglose pagado/orgánico', () => {
    const texto = formatearResumenProgramas([item('AI Sales', 7, 3), item('Inmersivo', 6, 6)]);
    expect(texto).toBe('AI Sales 7 (3 pauta, 4 orgánico) · Inmersivo 6 (6 pauta, 0 orgánico)');
  });

  it('desempata alfabéticamente cuando la cantidad es igual', () => {
    const texto = formatearResumenProgramas([item('Zeta', 3), item('Alfa', 3)]);
    expect(texto).toBe('Alfa 3 (0 pauta, 3 orgánico) · Zeta 3 (0 pauta, 3 orgánico)');
  });

  it('omite los programas en cero', () => {
    const texto = formatearResumenProgramas([item('AI Sales', 0), item('Inmersivo', 6, 2)]);
    expect(texto).toBe('Inmersivo 6 (2 pauta, 4 orgánico)');
  });

  it('corta en el límite y suma el resto como "+K más"', () => {
    const texto = formatearResumenProgramas([item('A', 5, 1), item('B', 4, 2), item('C', 3, 3)], 2);
    expect(texto).toBe('A 5 (1 pauta, 4 orgánico) · B 4 (2 pauta, 2 orgánico) · +1 más');
  });
});
