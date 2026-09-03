import { describe, expect, it } from 'vitest';
import { claveOpcion, etiquetaDeOpcion, etiquetasDeAnswer } from './answers';
import type { Answer } from './schemas';

const answer: Answer = {
  fieldRef: 'q1',
  type: 'multiple_choice',
  value: '5ix6xpo',
  label: 'MVP con usuarios (sin ingresos)',
  choices: [
    { id: 'xrkz0pu', label: 'Idea / validando problema' },
    { id: '5ix6xpo', label: 'MVP con usuarios (sin ingresos)' },
  ],
};

describe('claveOpcion', () => {
  it('incluye el fieldRef, porque los ids solo son únicos dentro del campo', () => {
    // El mismo id en dos preguntas significa cosas distintas; agrupar por id
    // suelto mezclaría datos de preguntas diferentes.
    expect(claveOpcion('q1', 'abc')).not.toBe(claveOpcion('q2', 'abc'));
  });
});

describe('etiquetaDeOpcion', () => {
  it('resuelve la etiqueta dentro del campo', () => {
    expect(etiquetaDeOpcion(answer, '5ix6xpo')).toBe('MVP con usuarios (sin ingresos)');
    expect(etiquetaDeOpcion(answer, 'no-existe')).toBeNull();
  });
});

describe('etiquetasDeAnswer', () => {
  it('prefiere el label que ya envía la API', () => {
    expect(etiquetasDeAnswer(answer)).toEqual(['MVP con usuarios (sin ingresos)']);
  });

  it('recurre a choices cuando no hay label', () => {
    expect(etiquetasDeAnswer({ ...answer, label: undefined })).toEqual([
      'MVP con usuarios (sin ingresos)',
    ]);
  });

  it('maneja la selección múltiple', () => {
    expect(
      etiquetasDeAnswer({ ...answer, label: undefined, value: ['xrkz0pu', '5ix6xpo'] }),
    ).toEqual(['Idea / validando problema', 'MVP con usuarios (sin ingresos)']);
  });
});
