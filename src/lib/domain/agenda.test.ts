import { describe, expect, it } from 'vitest';
import { esParcial, evaluarAgenda, extraerUtm, leerAgendado } from './agenda';
import type { ResponseLike } from './types';

const contexto = {
  formId: 'form_1',
  formTitle: 'AI Sales',
  programaId: 'ai-sales',
  aDiaDeNegocio: (iso: string) => iso.slice(0, 10),
};

function respuesta(parcial: Partial<ResponseLike> = {}): ResponseLike {
  return {
    responseId: 'r1',
    submittedAt: '2026-03-10T15:00:00.000Z',
    answers: [],
    ...parcial,
  };
}

describe('leerAgendado', () => {
  it('acepta las formas afirmativas plausibles', () => {
    expect(leerAgendado(true)).toBe('si');
    expect(leerAgendado('true')).toBe('si');
    expect(leerAgendado('Scheduled')).toBe('si');
    expect(leerAgendado({ scheduled: true })).toBe('si');
    expect(leerAgendado({ scheduled: 'true', event: {}, invitee: {} })).toBe('si');
  });

  it('deduce el booking por la presencia de evento o invitado', () => {
    // La documentación no fija cómo se serializa `scheduled`; que exista un
    // evento es prueba de que el booking se completó.
    expect(leerAgendado({ event: { uri: 'https://calendly.com/x' } })).toBe('si');
    expect(leerAgendado({ invitee: { email: 'a@b.com' } })).toBe('si');
  });

  it('reconoce las formas negativas', () => {
    expect(leerAgendado(false)).toBe('no');
    expect(leerAgendado(null)).toBe('no');
    expect(leerAgendado(undefined)).toBe('no');
    expect(leerAgendado('')).toBe('no');
    expect(leerAgendado('cancelled')).toBe('no');
    expect(leerAgendado({ scheduled: false })).toBe('no');
    expect(leerAgendado({ event: null, invitee: null })).toBe('no');
  });

  it('reconoce la representación real de form30x', () => {
    // Es literalmente como se ve un booking en el formulario:
    // Booked ✓ (https://api.calendly.com/scheduled_events/<uuid>)
    const real =
      'Booked ✓ (https://api.calendly.com/scheduled_events/4e03f112-db75-45de-8c9c-a8c2b69cd6a6)';
    expect(leerAgendado(real)).toBe('si');
    expect(leerAgendado({ label: real })).toBe('desconocido'); // el label se mira aparte
    expect(leerAgendado('Booked')).toBe('si');
    expect(leerAgendado('https://api.calendly.com/scheduled_events/abc')).toBe('si');
  });

  it('no confunde una negación que contiene la palabra afirmativa', () => {
    // "not booked" contiene "booked": el orden de comprobación importa.
    expect(leerAgendado('Not booked')).toBe('no');
    expect(leerAgendado('No agendado')).toBe('no');
    expect(leerAgendado('Booking cancelled')).toBe('no');
  });

  it('marca como desconocido lo que no sabe interpretar', () => {
    // El comportamiento clave: ante una forma nueva NO devuelve "no", porque
    // contar de menos en silencio es peor que avisar.
    expect(leerAgendado('vaya-forma-rara')).toBe('desconocido');
    expect(leerAgendado(42)).toBe('desconocido');
    expect(leerAgendado({ otraCosa: 1 })).toBe('desconocido');
  });
});

describe('esParcial', () => {
  it('detecta las marcas de respuesta incompleta', () => {
    expect(esParcial(respuesta({ partial: true }))).toBe(true);
    expect(esParcial(respuesta({ completed: false }))).toBe(true);
    expect(esParcial(respuesta({ status: 'Partial' }))).toBe(true);
    expect(esParcial(respuesta())).toBe(false);
  });
});

describe('extraerUtm', () => {
  it('conserva los hidden fields con contenido y descarta los vacíos', () => {
    expect(extraerUtm({ utm_source: 'newsletter', utm_medium: '  ', otro: 'x' })).toEqual({
      utm_source: 'newsletter',
      otro: 'x',
    });
    expect(extraerUtm(null)).toEqual({});
  });
});

describe('evaluarAgenda', () => {
  it('cuenta una respuesta con Calendly agendado', () => {
    const resultado = evaluarAgenda(
      respuesta({
        answers: [{ fieldRef: 'q1', type: 'calendly', value: { scheduled: true } }],
        hidden: { utm_source: 'ig' },
      }),
      contexto,
    );

    expect(resultado.tipo).toBe('agenda');
    if (resultado.tipo !== 'agenda') return;
    expect(resultado.agenda).toMatchObject({
      responseId: 'r1',
      programaId: 'ai-sales',
      dia: '2026-03-10',
      utm: { utm_source: 'ig' },
    });
  });

  it('no cuenta una respuesta sin pregunta de Calendly', () => {
    const r = evaluarAgenda(
      respuesta({ answers: [{ fieldRef: 'q1', type: 'email', value: 'a@b.com' }] }),
      contexto,
    );
    expect(r.tipo).toBe('sin-calendly');
  });

  it('no cuenta una respuesta que llegó a Calendly sin agendar', () => {
    const r = evaluarAgenda(
      respuesta({ answers: [{ fieldRef: 'q1', type: 'calendly', value: { scheduled: false } }] }),
      contexto,
    );
    expect(r.tipo).toBe('no-agendado');
  });

  it('descarta las respuestas parciales antes de mirar nada más', () => {
    const r = evaluarAgenda(
      respuesta({
        partial: true,
        answers: [{ fieldRef: 'q1', type: 'calendly', value: { scheduled: true } }],
      }),
      contexto,
    );
    expect(r.tipo).toBe('parcial');
  });

  it('reporta las formas no reconocidas en vez de tratarlas como cero', () => {
    const r = evaluarAgenda(
      respuesta({ answers: [{ fieldRef: 'q9', type: 'calendly', value: { forma: 'nueva' } }] }),
      contexto,
    );
    expect(r.tipo).toBe('no-reconocido');
    if (r.tipo !== 'no-reconocido') return;
    expect(r.motivo).toContain('q9');
    expect(r.muestra).toContain('nueva');
  });

  it('lee el booking desde la etiqueta si el valor no concluye', () => {
    const r = evaluarAgenda(
      respuesta({
        answers: [
          {
            fieldRef: 'q1',
            type: 'calendly',
            value: null,
            label: 'Booked ✓ (https://api.calendly.com/scheduled_events/4e03f112)',
          },
        ],
      }),
      contexto,
    );
    expect(r.tipo).toBe('agenda');
  });

  it('con varias preguntas de Calendly, basta una agendada', () => {
    const r = evaluarAgenda(
      respuesta({
        answers: [
          { fieldRef: 'q1', type: 'calendly', value: { scheduled: false } },
          { fieldRef: 'q2', type: 'calendly', value: { scheduled: true } },
        ],
      }),
      contexto,
    );
    expect(r.tipo).toBe('agenda');
  });
});
