import { OPCIONES_EDICION_RETIRADAS, ciudadEnTexto } from '@/lib/config/ciudades';
import { clasificarCanal, fuenteDe } from './canal';
import { esParcial, esTipoBooking, leerAgendado, extraerUtm } from './agenda';
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
  // Ningún formulario real pregunta "ciudad" literalmente (verificado contra
  // la API): Inmersivo Presencial pregunta "¿En qué edición...?" y la ciudad
  // viene dentro de esa respuesta — ver ciudadDesdeEdicion más abajo. Esta
  // pista se deja como vía directa por si algún formulario futuro sí la
  // pregunta así.
  ciudad: ['ciudad', 'sede', 'city'],
  // "¿En qué edición de 30X te gustaría participar?" — dropdown cuya label
  // real es "CDMX · 05 - 07 Oct · 2026": ciudad, fechas y año en un campo.
  edicion: ['edicion', 'edition'],
} as const;

const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const coincidePista = (a: AnswerLike, pistas: readonly string[]) => {
  const pregunta = normalizar(a.question ?? '');
  return pistas.some((p) => pregunta.includes(p));
};

/**
 * Como valorLegible, pero recupera el label de las opciones de edición que
 * se borraron del formulario (ver OPCIONES_EDICION_RETIRADAS): sin esto, la
 * respuesta solo trae un id como "njetcld".
 */
function valorDeAnswer(a: AnswerLike): string {
  const valor = valorLegible(a);
  if (coincidePista(a, PISTAS.edicion)) return OPCIONES_EDICION_RETIRADAS[valor] ?? valor;
  return valor;
}

function buscarPorPista(answers: AnswerLike[], pistas: readonly string[]): string | null {
  for (const a of answers) {
    if (coincidePista(a, pistas)) {
      const valor = valorDeAnswer(a);
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
 * Último recurso para una ciudad que aún no está en CIUDADES: el segmento
 * de la edición que no es el nombre del programa ni una fecha. Cubre los dos
 * formatos reales: "CDMX · 05 - 07 Oct · 2026" y, en el formulario del
 * asignador, "Inmersivo Presencial · Bogotá · 26 Oct · 2026". `null` si no
 * trae el separador "·" — se prefiere no adivinar a adivinar mal.
 */
function ciudadDesdeEdicion(edicion: string | null): string | null {
  if (!edicion || !edicion.includes('·')) return null;
  const segmento = edicion
    .split('·')
    .map((s) => s.trim())
    .find((s) => s !== '' && !/\d/.test(s) && !/inmersiv|presencial|30x/i.test(s));
  return segmento ?? null;
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

/**
 * `true` si el correo es del dominio del equipo (`@30x.com`).
 *
 * El equipo prueba los formularios con su propio correo: esas respuestas no
 * son leads reales y no deben contarse en ningún número del dashboard — ni
 * como agenda, ni como registro, ni en ningún desglose.
 */
export function esCorreoDePrueba(email: string | null): boolean {
  return email !== null && email.endsWith('@30x.com');
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
  const calendly = answers.filter((a) => esTipoBooking(a.type));
  const agendada = calendly.some(
    (a) => leerAgendado(a.value) === 'si' || leerAgendado(a.label) === 'si',
  );
  const utm = extraerUtm(respuesta.hidden);

  const nombre = buscarPorPista(answers, PISTAS.nombre);
  const apellido = buscarPorPista(answers, PISTAS.apellido);
  const edicion = buscarPorPista(answers, PISTAS.edicion);
  const ciudadDirecta = buscarPorPista(answers, PISTAS.ciudad);
  // Orden de confianza: lo que la persona respondió, luego la edición que
  // eligió, y por último el título del formulario — el de Miami
  // ("Inmersivo Presencial Miami | Registro | 30X") no pregunta edición.
  const conocida =
    ciudadEnTexto(ciudadDirecta) ?? ciudadEnTexto(edicion) ?? ciudadEnTexto(contexto.formTitle);
  const ciudad = conocida?.nombre ?? ciudadDirecta ?? ciudadDesdeEdicion(edicion);

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
    ciudad,
    pais: conocida?.pais ?? null,
    edicion,
    canal: clasificarCanal(utm),
    fuente: fuenteDe(utm),
    campana: utm.utm_campaign ?? null,
    utm,
    respuestas: answers
      .filter((a) => (a.question ?? '').trim() !== '')
      .map((a) => ({ pregunta: (a.question ?? '').trim(), valor: valorDeAnswer(a) })),
    score: typeof respuesta.score === 'number' ? respuesta.score : null,
    tags: Array.isArray(respuesta.tags) ? respuesta.tags.filter((t) => typeof t === 'string') : [],
  };
}
