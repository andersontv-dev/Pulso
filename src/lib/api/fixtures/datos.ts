import type { Formulario, Respuesta } from '../schemas';

/**
 * Datos de ejemplo deterministas.
 *
 * Sirven para dos cosas: arrancar Pulso sin credenciales (`PULSO_USE_FIXTURES=1`)
 * y dar a los tests e2e un dataset estable, sin red y sin API key.
 *
 * Reproducen a propósito los casos incómodos que se verán en producción:
 * respuestas sin Calendly, respuestas que llegaron a la pregunta sin agendar,
 * respuestas parciales, un valor con forma no reconocida, y un formulario cuyo
 * nombre no identifica ningún programa del catálogo.
 */

export const FORMULARIOS_FIXTURE: Formulario[] = [
  { id: 'form_ai_sales', title: 'AI Sales — Cohorte 12', published: true },
  { id: 'form_sales_machine', title: 'Sales Machine LATAM 2026', published: true },
  { id: 'form_growth', title: 'Growth Rockstar · inscripción', published: true },
  { id: 'form_ai_exec', title: 'AI for Executives 2026', published: true },
  { id: 'form_fundraising', title: 'Fundraising Fundamentals', published: true },
  // Sin programa reconocible: alimenta el grupo "Sin programa identificado".
  { id: 'form_encuesta', title: 'Encuesta interna de satisfacción', published: true },
];

/** Generador congruencial lineal: mismo semilla, misma secuencia, sin
 *  dependencias y sin sorpresas entre ejecuciones. */
function prng(semilla: number) {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado * 1664525 + 1013904223) >>> 0;
    return estado / 0x100000000;
  };
}

/** Intensidad relativa de cada formulario, para que los totales no salgan
 *  todos iguales y la ordenación de la tabla sea observable. */
const INTENSIDAD: Record<string, number> = {
  form_ai_sales: 6,
  form_sales_machine: 4,
  form_growth: 3,
  form_ai_exec: 2,
  form_fundraising: 1,
  form_encuesta: 1,
};

const DIAS_DE_HISTORICO = 120;

/**
 * Genera el histórico completo. Se ancla al día de hoy para que los presets
 * recientes siempre tengan datos, y la semilla depende del día y del
 * formulario, de modo que dentro de una misma jornada los números no bailan.
 */
export function respuestasFixture(): Respuesta[] {
  const respuestas: Respuesta[] = [];
  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);

  for (const formulario of FORMULARIOS_FIXTURE) {
    const intensidad = INTENSIDAD[formulario.id] ?? 1;

    for (let atras = 0; atras < DIAS_DE_HISTORICO; atras += 1) {
      const dia = new Date(hoy);
      dia.setUTCDate(dia.getUTCDate() - atras);
      const clave = dia.toISOString().slice(0, 10);
      const aleatorio = prng(hash(`${formulario.id}:${clave}`));

      // Los fines de semana bajan, como en la vida real.
      const finDeSemana = dia.getUTCDay() === 0 || dia.getUTCDay() === 6;
      const cuantas = Math.floor(aleatorio() * intensidad * (finDeSemana ? 0.4 : 1.4));

      for (let i = 0; i < cuantas; i += 1) {
        const hora = 8 + Math.floor(aleatorio() * 12);
        const marca = new Date(dia);
        marca.setUTCHours(hora, Math.floor(aleatorio() * 60), 0, 0);
        respuestas.push(
          construirRespuesta(`${formulario.id}-${clave}-${i}`, marca.toISOString(), aleatorio()),
        );
      }
    }
  }

  return respuestas;
}

function construirRespuesta(id: string, submittedAt: string, dado: number): Respuesta {
  const base = {
    responseId: id,
    submittedAt,
    hidden: { utm_source: dado > 0.5 ? 'newsletter' : 'instagram' },
    score: Math.round(dado * 20),
    tags: [],
    variables: {},
  };

  const correo = {
    fieldRef: 'q_email',
    type: 'email',
    question: 'Tu correo',
    value: 'persona@ejemplo.com',
  };

  // 8%: nunca llegó a la pregunta de Calendly.
  if (dado < 0.08) {
    return { ...base, answers: [correo] };
  }

  // 12%: llegó pero no agendó.
  if (dado < 0.2) {
    return {
      ...base,
      answers: [correo, { fieldRef: 'q_call', type: 'calendly', value: { scheduled: false } }],
    };
  }

  // 4%: respuesta parcial, que no debe contarse.
  if (dado < 0.24) {
    return {
      ...base,
      partial: true,
      answers: [correo, { fieldRef: 'q_call', type: 'calendly', value: { scheduled: true } }],
    };
  }

  // 2%: forma que el parser no reconoce. Debe aparecer como aviso, no
  // desaparecer en silencio.
  if (dado < 0.26) {
    return {
      ...base,
      answers: [correo, { fieldRef: 'q_call', type: 'calendly', value: { estado: 'raro' } }],
    };
  }

  return {
    ...base,
    answers: [
      correo,
      {
        fieldRef: 'q_call',
        type: 'calendly',
        question: 'Agenda tu llamada',
        value: {
          scheduled: true,
          event: { uri: `https://calendly.com/eventos/${id}` },
          invitee: { email: 'persona@ejemplo.com' },
        },
      },
    ],
  };
}

function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
