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
  // Tiene Calendly pero su nombre no identifica ningún programa del catálogo:
  // alimenta el grupo "Sin programa identificado", que debe verse y no
  // desaparecer en silencio.
  { id: 'form_reto', title: 'Reto Copilot Pro Track AIX Septiembre', published: true },
  // Sin pregunta de Calendly: no puede producir agendas, así que Pulso ni
  // siquiera descarga sus respuestas. Ejercita el aviso correspondiente.
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
  form_reto: 2,
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

/**
 * Mezcla de canales parecida a la real: bastante pauta, algo de orgánico,
 * referidos sueltos y tráfico sin etiquetar. Cubre las cinco categorías del
 * clasificador para que la vista de atribución tenga algo que mostrar.
 */
function hiddenDe(dado: number): Record<string, string> {
  if (dado < 0.45)
    return {
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'aix-septiembre',
      gclid: 'Cj0KCQ',
      hsa_net: 'adwords',
    };
  if (dado < 0.62)
    return { utm_source: 'meta', utm_medium: 'paid_social', utm_campaign: 'retargeting-q3' };
  if (dado < 0.78)
    return { utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'boletin-semanal' };
  if (dado < 0.86) return { utm_source: 'instagram', utm_medium: 'social', ig_account: '30x' };
  if (dado < 0.93) return { referral_30x: 'mentor-42' };
  if (dado < 0.97) return { fbclid: 'IwAR0abc' };
  return {};
}

/** Un puñado de personas que se repiten entre programas, para que la búsqueda
 *  por correo y el contador de repetidos tengan sentido. */
const PERSONAS = [
  ['Ana', 'Ruiz', 'Acme'],
  ['Beto', 'Salas', 'Nubia'],
  ['Carla', 'Mejia', 'Vento'],
  ['Diego', 'Ortiz', 'Kairo'],
  ['Elena', 'Pardo', 'Lumen'],
  ['Fabio', 'Nieto', 'Draco'],
  ['Gina', 'Cano', 'Solaris'],
  ['Hugo', 'Vera', 'Meridian'],
] as const;

function construirRespuesta(id: string, submittedAt: string, dado: number): Respuesta {
  const [nombre, apellido, empresa] =
    PERSONAS[Math.floor(dado * PERSONAS.length) % PERSONAS.length];

  // El canal se deriva de un valor INDEPENDIENTE de `dado`. Si ambos salieran
  // del mismo número, canal y etapa del embudo quedarían correlacionados y el
  // demo mostraría cosas falsas, como que la pauta convierte al 0%.
  const dadoCanal = (hash(`canal:${id}`) % 1000) / 1000;

  const base = {
    responseId: id,
    submittedAt,
    hidden: hiddenDe(dadoCanal),
    score: Math.round(dado * 20),
    tags: dado > 0.8 ? ['qualified'] : [],
    variables: {},
  };

  const correo = {
    fieldRef: 'q_email',
    type: 'email',
    question: '¿Cuál es tu correo electrónico?',
    value: `${nombre.toLowerCase()}.${apellido.toLowerCase()}@ejemplo.com`,
  };

  const perfil = [
    { fieldRef: 'q_nombre', type: 'short_text', question: '¿Cuál es tu nombre?', value: nombre },
    {
      fieldRef: 'q_apellido',
      type: 'short_text',
      question: '¿Cuál es tu apellido?',
      value: apellido,
    },
    {
      fieldRef: 'q_empresa',
      type: 'short_text',
      question: '¿En qué empresa trabajas?',
      value: empresa,
    },
    {
      fieldRef: 'q_cargo',
      type: 'multiple_choice',
      question: '¿Cuál es tu cargo?',
      value: 'c1',
      label: dado > 0.5 ? 'Director / VP' : 'Fundador / C-Level',
    },
  ];

  // 30%: parcial, abandonó antes de terminar. Es la etapa más ancha del
  // embudo real, así que también aquí.
  if (dado < 0.3) {
    return { ...base, status: 'Partial', answers: [correo, perfil[0]] };
  }

  // 20%: completó pero nunca llegó a la pregunta de Calendly.
  if (dado < 0.5) {
    return { ...base, status: 'Completed', answers: [correo, ...perfil] };
  }

  // 12%: llegó a Calendly y no agendó. El campo viene vacío, como en la
  // cuenta real: no hay un `scheduled: false` explícito.
  if (dado < 0.62) {
    return {
      ...base,
      status: 'Completed',
      answers: [
        correo,
        ...perfil,
        { fieldRef: 'q_call', type: 'calendly', question: 'Agenda tu llamada', value: '' },
      ],
    };
  }

  // 2%: forma que el parser no reconoce. Debe aparecer como aviso, no
  // desaparecer en silencio.
  if (dado < 0.64) {
    return {
      ...base,
      status: 'Completed',
      answers: [correo, ...perfil, { fieldRef: 'q_call', type: 'calendly', value: { raro: 1 } }],
    };
  }

  // El resto agendó, con la representación real de form30x.
  return {
    ...base,
    status: 'Completed',
    answers: [
      correo,
      ...perfil,
      {
        fieldRef: 'q_call',
        type: 'calendly',
        question: 'Agenda tu llamada',
        value: `Booked ✓ (https://api.calendly.com/scheduled_events/${id})`,
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
