import { describe, expect, it } from 'vitest';
import { construirRegistro, valorLegible } from './registro';
import type { ResponseLike } from './types';

const contexto = {
  formId: 'f1',
  formTitle: 'AI for Executives | Registro | 30X',
  programaId: 'ai-for-executives',
  programaNombre: 'AI for Executives',
  aDiaDeNegocio: (iso: string) => iso.slice(0, 10),
};

const BOOKED = 'Booked ✓ (https://api.calendly.com/scheduled_events/4e03f112)';

function respuesta(p: Partial<ResponseLike> = {}): ResponseLike {
  return { responseId: 'r1', submittedAt: '2026-09-01T12:00:00.000Z', answers: [], ...p };
}

describe('valorLegible', () => {
  it('prefiere el label sobre el id de opción', () => {
    // Los ids solo son únicos dentro de su campo: fuera no significan nada.
    expect(
      valorLegible({ fieldRef: 'q', type: 'multiple_choice', value: 'a1', label: 'MVP' }),
    ).toBe('MVP');
  });

  it('maneja arrays, booleanos y objetos', () => {
    expect(valorLegible({ fieldRef: 'q', type: 'x', value: ['a', 'b'] })).toBe('a, b');
    expect(valorLegible({ fieldRef: 'q', type: 'yes_no', value: true })).toBe('true');
    expect(valorLegible({ fieldRef: 'q', type: 'x', value: null })).toBe('');
  });
});

describe('construirRegistro', () => {
  const completa = respuesta({
    status: 'Completed',
    hidden: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'aix-sept', gclid: 'abc' },
    score: 14,
    tags: ['qualified'],
    answers: [
      { fieldRef: 'q1', type: 'short_text', question: '¿Cuál es tu nombre?', value: 'Ana' },
      { fieldRef: 'q2', type: 'short_text', question: '¿Cuál es tu apellido?', value: 'Ruiz' },
      { fieldRef: 'q3', type: 'email', question: '¿Correo?', value: 'Ana@Ejemplo.com' },
      { fieldRef: 'q4', type: 'phone_number', question: '¿WhatsApp?', value: '+57300' },
      { fieldRef: 'q5', type: 'short_text', question: '¿En qué empresa trabajas?', value: 'Acme' },
      { fieldRef: 'q6', type: 'calendly', question: 'Agenda tu llamada', value: BOOKED },
    ],
  });

  it('extrae los datos de contacto y normaliza el correo', () => {
    const r = construirRegistro(completa, contexto);
    expect(r.nombre).toBe('Ana Ruiz');
    expect(r.email).toBe('ana@ejemplo.com'); // en minúsculas, para poder agrupar
    expect(r.telefono).toBe('+57300');
    expect(r.empresa).toBe('Acme');
  });

  it('clasifica el canal y conserva la campaña', () => {
    const r = construirRegistro(completa, contexto);
    expect(r.canal).toBe('pauta');
    expect(r.fuente).toBe('google');
    expect(r.campana).toBe('aix-sept');
  });

  it('marca la agenda y el paso por Calendly', () => {
    const r = construirRegistro(completa, contexto);
    expect(r.agendada).toBe(true);
    expect(r.llegoACalendly).toBe(true);
    expect(r.estado).toBe('completada');
  });

  it('distingue llegar a Calendly de agendar', () => {
    const r = construirRegistro(
      respuesta({ answers: [{ fieldRef: 'q', type: 'calendly', question: 'Agenda', value: '' }] }),
      contexto,
    );
    expect(r.llegoACalendly).toBe(true);
    expect(r.agendada).toBe(false);
  });

  it('reconoce las respuestas parciales', () => {
    expect(construirRegistro(respuesta({ status: 'Partial' }), contexto).estado).toBe('parcial');
  });

  it('conserva todas las respuestas para el detalle y el export', () => {
    const r = construirRegistro(completa, contexto);
    expect(r.respuestas).toHaveLength(6);
    expect(r.respuestas[0]).toEqual({ pregunta: '¿Cuál es tu nombre?', valor: 'Ana' });
  });

  it('sobrevive a una respuesta sin nada', () => {
    const r = construirRegistro(respuesta(), contexto);
    expect(r.email).toBeNull();
    expect(r.canal).toBe('directo');
    expect(r.respuestas).toEqual([]);
  });
});
