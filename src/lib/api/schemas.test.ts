import { describe, expect, it } from 'vitest';
import { respuestaSchema } from './schemas';

/**
 * Estos tests fijan las dos diferencias entre lo que documenta form30x y lo
 * que devuelve de verdad, comprobadas contra la API real de 30X.
 */
describe('respuestaSchema — forma real de la API', () => {
  const real = {
    id: 'resp_123',
    submittedAt: '2026-09-01T15:00:00.000Z',
    completed: true,
    answers: [{ fieldRef: 'q1', type: 'email', value: 'a@b.com' }],
    metadata: {
      hidden: { utm_source: 'newsletter' },
      score: 12,
      tags: ['qualified'],
      variables: { fit: 8 },
    },
  };

  it('acepta `id` como identificador', () => {
    const r = respuestaSchema.parse(real);
    expect(r.responseId).toBe('resp_123');
  });

  it('saca hidden, score, tags y variables de metadata', () => {
    // Leerlos de la raíz, como sugiere el ejemplo del webhook en la
    // documentación, dejaría las UTM vacías sin que saltara ningún error.
    const r = respuestaSchema.parse(real);
    expect(r.hidden).toEqual({ utm_source: 'newsletter' });
    expect(r.score).toBe(12);
    expect(r.tags).toEqual(['qualified']);
  });

  it('sigue aceptando la forma del webhook, con todo en la raíz', () => {
    // Fase 2 procesará webhooks; el mismo esquema debe servir.
    const r = respuestaSchema.parse({
      responseId: 'resp_9',
      submittedAt: '2026-09-01T15:00:00.000Z',
      answers: [],
      hidden: { utm_source: 'ig' },
      score: 3,
    });
    expect(r.responseId).toBe('resp_9');
    expect(r.hidden).toEqual({ utm_source: 'ig' });
  });

  it('conserva `completed`, que es la marca real de respuesta parcial', () => {
    const r = respuestaSchema.parse({ ...real, completed: false });
    expect(r.completed).toBe(false);
  });
});
