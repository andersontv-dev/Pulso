/**
 * Tipos del dominio de Pulso.
 *
 * Este módulo es deliberadamente independiente del transporte: describe las
 * formas que necesita la lógica de negocio con interfaces estructurales, no
 * importando los tipos de `lib/api`. Así la lógica se puede testear sin red
 * y sin conocer form30x, y ESLint impone esa frontera.
 */

/** Una answer tal como la necesita el dominio. Estructuralmente compatible
 *  con lo que devuelve `lib/api` tras validar con zod. */
export interface AnswerLike {
  fieldRef: string;
  type: string;
  question?: string | null;
  value?: unknown;
  label?: unknown;
}

/** Una respuesta de formulario, con las marcas de parcialidad que la
 *  documentación no define pero que pueden venir. */
export interface ResponseLike {
  responseId: string;
  submittedAt: string;
  answers: AnswerLike[];
  hidden?: Record<string, string> | null;
  partial?: unknown;
  completed?: unknown;
  status?: unknown;
}

/** Un formulario, reducido a lo que el dominio necesita. */
export interface FormLike {
  id: string;
  title: string;
}

/** La unidad de negocio: un booking de Calendly confirmado. */
export interface Agenda {
  responseId: string;
  formId: string;
  formTitle: string;
  programaId: string;
  /** Instante del agendamiento, ISO-8601 tal como lo devuelve la API. */
  bookedAt: string;
  /** Día de negocio (YYYY-MM-DD) ya resuelto en el huso configurado. */
  dia: string;
  utm: Record<string, string>;
}

/** Una celda del desglose diario. */
export interface DiaPrograma {
  /** YYYY-MM-DD en el huso de negocio. */
  fecha: string;
  agendas: number;
}

/** La serie de un programa a lo largo del rango, con los días vacíos
 *  incluidos: un día con cero agendas es información, no una ausencia. */
export interface SeriePrograma {
  programaId: string;
  programaNombre: string;
  rama: string | null;
  total: number;
  dias: DiaPrograma[];
}

export interface Kpis {
  total: number;
  totalPrevio: number;
  /** Variación porcentual contra el periodo anterior. `null` cuando el
   *  periodo anterior fue cero: no existe una variación definida y mostrar
   *  0% o infinito sería mentir. */
  variacionPct: number | null;
  promedioDiario: number;
  mejorDia: DiaPrograma | null;
  peorDia: DiaPrograma | null;
}

/**
 * Resultado de evaluar si una respuesta es una agenda.
 *
 * Es un tipo discriminado y no un booleano a propósito: permite contar
 * cuántas respuestas tenían una forma que no supimos interpretar y avisar
 * de ello, en vez de contarlas como cero en silencio. Para un dashboard de
 * reportería, contar de menos sin avisar es el peor fallo posible.
 */
export type EvaluacionAgenda =
  | { tipo: 'agenda'; agenda: Agenda }
  | { tipo: 'sin-calendly' }
  | { tipo: 'no-agendado' }
  | { tipo: 'parcial' }
  | { tipo: 'no-reconocido'; motivo: string; muestra: string };
