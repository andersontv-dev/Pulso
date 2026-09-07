import { clasificarCanal, fuenteDe } from './canal';
import { esParcial, leerAgendado, TIPO_CALENDLY, extraerUtm } from './agenda';
import type { AnswerLike, Registro, ResponseLike } from './types';

/**
 * Convierte una respuesta cruda en un registro normalizado.
 *
 * Es el paso que hace posible todo lo que no es "contar agendas": el embudo,
 * el desglose por canal, la búsqueda por correo y el export completo. Los
 * datos siguen viniendo de la misma descarga; solo se aprovechan mejor.
 */

/** Palabras que identifican una pregunta por su enunciado. Los formularios de
 *  30X no usan refs estables entre sí, así que se reconoce por el texto. */
const PISTAS = {
  nombre: ['nombre', 'name', 'cual es tu nombre'],
  apellido: ['apellido', 'last name'],
  empresa: ['empresa', 'compañia', 'compania', 'company', 'organizacion'],
} as const;

const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

function buscarPorPista(answers: AnswerLike[], pistas: readonly string[]): string | null {
  for (const a of answers) {
    const pregunta = normalizar(a.question ?? '');
    if (pistas.some((p) => pregunta.includes(p))) {
      const valor = valorLegible(a);
      if (valor) return valor;
    }
  }
  return null;
}

function buscarPorTipo(answers: AnswerLike[], tipo: string): string | null {
  const a = answers.find((x) => x.type === tipo);
  return a ? valorLegible(a) : null;
}

/**
 * Texto legible del valor de una answer.
 *
 * Prefiere `label`, que es lo que la documentación recomienda: los ids de
 * opción solo son únicos dentro de su propio campo y no significan nada
 * fuera de él.
 */
export function valorLegible(answer: AnswerLike): string {
  const { label, value } = answer;
  if (typeof label === 'string' && label.trim() !== '') return label.trim();
  if (Array.isArray(label)) return label.filter((l) => typeof l === 'string').join(', ');
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) return value.map((v) => String(v)).join(', ');
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export interface ContextoRegistro {
  formId: string;
  formTitle: string;
  programaId: string;
  programaNombre: string;
  aDiaDeNegocio: (iso: string) => string;
}

export function construirRegistro(respuesta: ResponseLike, contexto: ContextoRegistro): Registro {
  const answers = respuesta.answers ?? [];
  const calendly = answers.filter((a) => a.type === TIPO_CALENDLY);
  const agendada = calendly.some(
    (a) => leerAgendado(a.value) === 'si' || leerAgendado(a.label) === 'si',
  );
  const utm = extraerUtm(respuesta.hidden);

  const nombre = buscarPorPista(answers, PISTAS.nombre);
  const apellido = buscarPorPista(answers, PISTAS.apellido);

  return {
    id: respuesta.responseId,
    formId: contexto.formId,
    formTitle: contexto.formTitle,
    programaId: contexto.programaId,
    programaNombre: contexto.programaNombre,
    submittedAt: respuesta.submittedAt,
    dia: contexto.aDiaDeNegocio(respuesta.submittedAt),
    estado: esParcial(respuesta) ? 'parcial' : 'completada',
    agendada,
    llegoACalendly: calendly.length > 0,
    email: buscarPorTipo(answers, 'email')?.toLowerCase() ?? null,
    nombre: [nombre, apellido].filter(Boolean).join(' ') || null,
    telefono: buscarPorTipo(answers, 'phone_number'),
    empresa: buscarPorPista(answers, PISTAS.empresa),
    canal: clasificarCanal(utm),
    fuente: fuenteDe(utm),
    campana: utm.utm_campaign ?? null,
    utm,
    respuestas: answers
      .filter((a) => (a.question ?? '').trim() !== '')
      .map((a) => ({ pregunta: (a.question ?? '').trim(), valor: valorLegible(a) })),
    score: typeof respuesta.score === 'number' ? respuesta.score : null,
    tags: Array.isArray(respuesta.tags) ? respuesta.tags.filter((t) => typeof t === 'string') : [],
  };
}
