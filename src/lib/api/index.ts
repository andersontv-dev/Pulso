import 'server-only';
import { getEnv } from '@/lib/config/env';
import { listarFormularios } from './forms';
import { listarRespuestas, type ResultadoRespuestas, type VentanaTemporal } from './responses';
import { FORMULARIOS_FIXTURE, respuestasFixture } from './fixtures/datos';
import type { Formulario } from './schemas';

/**
 * Punto de entrada de la capa de datos.
 *
 * Todo lo que necesita el resto de Pulso pasa por aquí. Es también donde se
 * decide entre la API real y las fixtures, de modo que ningún consumidor tiene
 * que saber en qué modo está.
 */

export async function obtenerFormularios(signal?: AbortSignal): Promise<Formulario[]> {
  if (getEnv().PULSO_USE_FIXTURES) return FORMULARIOS_FIXTURE;
  return listarFormularios(signal);
}

export async function obtenerRespuestas(
  formId: string,
  opciones: { ventana?: VentanaTemporal; signal?: AbortSignal } = {},
): Promise<ResultadoRespuestas> {
  if (getEnv().PULSO_USE_FIXTURES) {
    const { ventana } = opciones;
    const todas = respuestasFixture().filter((r) => r.responseId.startsWith(formId));
    const respuestas = ventana
      ? todas.filter((r) => {
          const t = new Date(r.submittedAt).getTime();
          return t >= ventana.desde && t < ventana.hasta;
        })
      : todas;
    return { respuestas, paginas: 1, truncado: false, descartadas: 0 };
  }

  return listarRespuestas(formId, opciones);
}

export { Form30xError } from './errors';
export type { CodigoError } from './errors';
export type { Formulario, Respuesta, Answer } from './schemas';
export type { ResultadoRespuestas, VentanaTemporal } from './responses';
export { claveOpcion, etiquetaDeOpcion, etiquetasDeAnswer } from './answers';
