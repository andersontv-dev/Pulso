import { describe, expect, it } from 'vitest';
import { calcularEmbudo, correosRepetidos, cortarPorCanal, cortarPorPrograma } from './embudo';
import type { Registro } from './types';

function reg(p: Partial<Registro> = {}): Registro {
  return {
    id: Math.random().toString(36).slice(2),
    formId: 'f1',
    formTitle: 'AI Sales',
    programaId: 'ai-sales',
    programaNombre: 'AI Sales',
    submittedAt: '2026-09-01T12:00:00.000Z',
    dia: '2026-09-01',
    estado: 'completada',
    agendada: false,
    llegoACalendly: false,
    email: null,
    nombre: null,
    telefono: null,
    empresa: null,
    canal: 'directo',
    fuente: 'sin fuente',
    campana: null,
    utm: {},
    respuestas: [],
    score: null,
    tags: [],
    ...p,
  };
}

describe('calcularEmbudo', () => {
  it('cuenta las cuatro etapas y sus tasas', () => {
    const e = calcularEmbudo([
      reg({ estado: 'parcial' }),
      reg({ estado: 'parcial' }),
      reg({ estado: 'completada' }),
      reg({ estado: 'completada', llegoACalendly: true }),
      reg({ estado: 'completada', llegoACalendly: true, agendada: true }),
    ]);

    expect(e.iniciadas).toBe(5);
    expect(e.completadas).toBe(3);
    expect(e.llegaronACalendly).toBe(2);
    expect(e.agendadas).toBe(1);
    expect(e.tasaCompletado).toBe(60);
    expect(e.tasaAgendaSobreCompletadas).toBeCloseTo(33.33, 1);
    expect(e.tasaGlobal).toBe(20);
  });

  it('devuelve null en las tasas cuando no hay base', () => {
    // Un 0% inventado se lee como un dato real; null se lee como "no aplica".
    const e = calcularEmbudo([]);
    expect(e.tasaCompletado).toBeNull();
    expect(e.tasaAgendaSobreCompletadas).toBeNull();
    expect(e.tasaGlobal).toBeNull();
  });

  it('no divide entre cero cuando nadie completó', () => {
    const e = calcularEmbudo([reg({ estado: 'parcial' })]);
    expect(e.tasaCompletado).toBe(0);
    expect(e.tasaAgendaSobreCompletadas).toBeNull();
  });
});

describe('cortarPor', () => {
  it('agrupa por canal y ordena por agendas', () => {
    const cortes = cortarPorCanal([
      reg({ canal: 'organico' }),
      reg({ canal: 'pauta', agendada: true }),
      reg({ canal: 'pauta', agendada: true }),
      reg({ canal: 'pauta' }),
    ]);

    expect(cortes[0]).toMatchObject({
      clave: 'pauta',
      etiqueta: 'Pauta',
      iniciadas: 3,
      agendadas: 2,
    });
    expect(cortes[1]).toMatchObject({ clave: 'organico', etiqueta: 'Orgánico', agendadas: 0 });
  });

  it('agrupa por programa', () => {
    const cortes = cortarPorPrograma([
      reg({ programaNombre: 'AI Sales', agendada: true }),
      reg({ programaNombre: 'Next' }),
    ]);
    expect(cortes.map((c) => c.clave)).toEqual(['AI Sales', 'Next']);
  });
});

describe('correosRepetidos', () => {
  it('encuentra a la misma persona en varios programas', () => {
    // Contar dos inscripciones de la misma persona como dos leads distintos
    // infla el número sin que nadie lo note.
    const r = correosRepetidos([
      reg({ email: 'ana@x.com', programaNombre: 'AI Sales' }),
      reg({ email: 'ana@x.com', programaNombre: 'Next' }),
      reg({ email: 'ana@x.com', programaNombre: 'Next' }),
      reg({ email: 'beto@x.com' }),
    ]);

    expect(r).toEqual([{ email: 'ana@x.com', veces: 3, programas: ['AI Sales', 'Next'] }]);
  });

  it('ignora los registros sin correo', () => {
    expect(correosRepetidos([reg(), reg()])).toEqual([]);
  });
});
