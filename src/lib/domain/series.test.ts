import { describe, expect, it } from 'vitest';
import { construirSeries, serieTotal, type ProgramaVisible } from './series';
import type { Agenda } from './types';

const DIAS = ['2026-03-08', '2026-03-09', '2026-03-10'];
const PROGRAMAS: ProgramaVisible[] = [
  { id: 'ai-sales', nombre: 'AI Sales', rama: 'Ventas' },
  { id: 'growth-rockstar', nombre: 'Growth Rockstar', rama: 'Growth' },
];

function agenda(programaId: string, dia: string, id = `${programaId}-${dia}`): Agenda {
  return {
    responseId: id,
    formId: 'f1',
    formTitle: 't',
    programaId,
    bookedAt: `${dia}T12:00:00.000Z`,
    dia,
    utm: {},
  };
}

describe('construirSeries', () => {
  it('rellena con ceros los días sin agendas', () => {
    const [serie] = construirSeries([agenda('ai-sales', '2026-03-09')], DIAS, [PROGRAMAS[0]]);
    // Un cero dice "ese día no hubo agendas"; un hueco diría "no hay dato".
    expect(serie.dias).toEqual([
      { fecha: '2026-03-08', agendas: 0 },
      { fecha: '2026-03-09', agendas: 1 },
      { fecha: '2026-03-10', agendas: 0 },
    ]);
    expect(serie.total).toBe(1);
  });

  it('incluye los programas sin ninguna agenda en el rango', () => {
    // Si se filtra por un programa y su fila desaparece, no se distingue
    // "no hubo agendas" de "el filtro no se aplicó".
    const series = construirSeries([], DIAS, PROGRAMAS);
    expect(series).toHaveLength(2);
    expect(series.every((s) => s.total === 0)).toBe(true);
  });

  it('ordena por total descendente y desempata por nombre', () => {
    const series = construirSeries(
      [
        agenda('growth-rockstar', '2026-03-08'),
        agenda('growth-rockstar', '2026-03-09'),
        agenda('ai-sales', '2026-03-08'),
      ],
      DIAS,
      PROGRAMAS,
    );
    expect(series.map((s) => s.programaId)).toEqual(['growth-rockstar', 'ai-sales']);
  });

  it('ignora agendas fuera del rango o de un programa no listado', () => {
    const series = construirSeries(
      [
        agenda('ai-sales', '2026-03-09'),
        agenda('ai-sales', '2026-03-25'), // fuera del rango
        agenda('desconocido', '2026-03-09'), // programa no listado
      ],
      DIAS,
      [PROGRAMAS[0]],
    );
    expect(series[0].total).toBe(1);
  });
});

describe('serieTotal', () => {
  it('suma las series programa a programa por día', () => {
    const series = construirSeries(
      [
        agenda('ai-sales', '2026-03-08'),
        agenda('growth-rockstar', '2026-03-08'),
        agenda('ai-sales', '2026-03-10'),
      ],
      DIAS,
      PROGRAMAS,
    );
    expect(serieTotal(series, DIAS)).toEqual([
      { fecha: '2026-03-08', agendas: 2 },
      { fecha: '2026-03-09', agendas: 0 },
      { fecha: '2026-03-10', agendas: 1 },
    ]);
  });
});
