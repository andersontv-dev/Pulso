import type { AnswerLike, EvaluacionAgenda, ResponseLike } from './types';

/** Tipo de pregunta de form30x que registra un booking de Calendly. */
export const TIPO_CALENDLY = 'calendly';

const VERDADEROS = new Set(['true', '1', 'yes', 'si', 'sí', 'scheduled', 'confirmed', 'active']);
const FALSOS = new Set(['false', '0', 'no', 'unscheduled', 'canceled', 'cancelled', 'pending', '']);

type Lectura = 'si' | 'no' | 'desconocido';

/**
 * Decide si el valor de una answer de Calendly representa un booking hecho.
 *
 * La documentación dice que el valor almacenado es `{ scheduled, event,
 * invitee }` pero no especifica cómo se serializa `scheduled`. Este lector
 * acepta las formas plausibles y, ante cualquier otra, devuelve
 * «desconocido» en lugar de asumir que no hubo agenda.
 */
export function leerAgendado(valor: unknown): Lectura {
  if (valor === null || valor === undefined) return 'no';
  if (typeof valor === 'boolean') return valor ? 'si' : 'no';

  if (typeof valor === 'string') {
    const v = valor.trim().toLowerCase();
    if (VERDADEROS.has(v)) return 'si';
    if (FALSOS.has(v)) return 'no';
    return 'desconocido';
  }

  if (typeof valor === 'object') {
    const obj = valor as Record<string, unknown>;

    // `scheduled` manda cuando viene con un valor utilizable.
    if (obj.scheduled !== undefined && obj.scheduled !== null) {
      const lectura = leerAgendado(obj.scheduled);
      if (lectura !== 'desconocido') return lectura;
    }

    // Si no, la existencia de un evento o de un invitado es la prueba de que
    // el booking se completó: form30x guarda la respuesta al agendar.
    if (tieneContenido(obj.event) || tieneContenido(obj.invitee)) return 'si';

    // Un objeto de Calendly vacío significa que se llegó a la pregunta pero
    // no se agendó.
    if ('event' in obj || 'invitee' in obj || 'scheduled' in obj) return 'no';
  }

  return 'desconocido';
}

function tieneContenido(valor: unknown): boolean {
  if (valor === null || valor === undefined) return false;
  if (typeof valor === 'string') return valor.trim().length > 0;
  if (Array.isArray(valor)) return valor.length > 0;
  if (typeof valor === 'object') return Object.keys(valor as object).length > 0;
  return Boolean(valor);
}

/**
 * Detecta una respuesta parcial.
 *
 * Los formularios con `partialSubmissions` activo guardan respuestas
 * incompletas que luego se actualizan en sitio. La UI de form30x distingue
 * parcial de completada, pero la documentación no dice con qué campo viaja
 * esa distinción en la API, así que se comprueban las formas razonables.
 */
export function esParcial(respuesta: ResponseLike): boolean {
  if (respuesta.partial === true) return true;
  if (respuesta.completed === false) return true;
  const estado = typeof respuesta.status === 'string' ? respuesta.status.toLowerCase() : '';
  return estado === 'partial' || estado === 'incomplete';
}

/** Extrae las UTM y demás hidden fields, descartando los vacíos. */
export function extraerUtm(hidden: Record<string, string> | null | undefined) {
  const salida: Record<string, string> = {};
  for (const [clave, valor] of Object.entries(hidden ?? {})) {
    if (typeof valor === 'string' && valor.trim() !== '') salida[clave] = valor;
  }
  return salida;
}

export interface ContextoEvaluacion {
  formId: string;
  formTitle: string;
  programaId: string;
  /** Convierte el instante ISO en día de negocio (YYYY-MM-DD). */
  aDiaDeNegocio: (iso: string) => string;
}

/**
 * Evalúa si una respuesta cuenta como agenda.
 *
 * Definición (ADR 0003): una agenda es una respuesta con una answer de tipo
 * `calendly` cuyo booking está confirmado.
 *
 * Se agrupa por `submittedAt` —cuándo se agendó— porque es el único campo
 * garantizado por la documentación. La fecha de la reunión viviría dentro de
 * `event`, cuya forma no está documentada.
 */
export function evaluarAgenda(
  respuesta: ResponseLike,
  contexto: ContextoEvaluacion,
): EvaluacionAgenda {
  if (esParcial(respuesta)) return { tipo: 'parcial' };

  const answers = respuesta.answers ?? [];
  const calendly = answers.filter((a: AnswerLike) => a.type === TIPO_CALENDLY);
  if (calendly.length === 0) return { tipo: 'sin-calendly' };

  let vioDesconocido: AnswerLike | undefined;

  for (const answer of calendly) {
    const lectura = leerAgendado(answer.value);
    if (lectura === 'si') {
      return {
        tipo: 'agenda',
        agenda: {
          responseId: respuesta.responseId,
          formId: contexto.formId,
          formTitle: contexto.formTitle,
          programaId: contexto.programaId,
          bookedAt: respuesta.submittedAt,
          dia: contexto.aDiaDeNegocio(respuesta.submittedAt),
          utm: extraerUtm(respuesta.hidden),
        },
      };
    }
    if (lectura === 'desconocido') vioDesconocido ??= answer;
  }

  if (vioDesconocido) {
    return {
      tipo: 'no-reconocido',
      motivo: `Valor de Calendly con forma no reconocida en el campo ${vioDesconocido.fieldRef}`,
      muestra: recortar(vioDesconocido.value),
    };
  }

  return { tipo: 'no-agendado' };
}

/** Muestra acotada del valor, para diagnosticar sin volcar datos personales
 *  completos en logs o en la interfaz. */
function recortar(valor: unknown, maximo = 120): string {
  let texto: string;
  try {
    texto = typeof valor === 'string' ? valor : JSON.stringify(valor);
  } catch {
    texto = String(valor);
  }
  texto ??= String(valor);
  return texto.length > maximo ? `${texto.slice(0, maximo)}…` : texto;
}
