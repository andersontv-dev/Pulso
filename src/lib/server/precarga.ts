import 'server-only';
import { obtenerCamposCalendly, obtenerFormularios, obtenerRespuestas } from '@/lib/api';
import type { Formulario, ResultadoRespuestas } from '@/lib/api';
import { getEnv } from '@/lib/config/env';
import { conCache } from './cache';

export interface ResumenPrecarga {
  ok: boolean;
  motivo: string;
  duracionMs: number;
  /** Formularios cuyas respuestas se renovaron. */
  renovados: number;
  /** Formularios que siguieron fallando tras el segundo intento. Conservan
   *  los datos de la precarga anterior (el caché no borra en un fallo). */
  fallidos: number;
  error?: string;
}

let enCurso: Promise<ResumenPrecarga> | null = null;

/**
 * Descarga de nuevo las respuestas de TODOS los formularios con booking y
 * deja el caché caliente, para que quien abra Pulso lea de memoria en vez de
 * esperar a que se pagine el histórico completo contra form30x.
 *
 * Solo se fuerzan las respuestas: la lista de formularios y sus campos usan
 * su caché normal (TTL corto y 10 min). Forzarlos también duplicaba cientos
 * de peticiones por ciclo y empujaba a form30x a responder `rate_limited`.
 *
 * Cada formulario va por su cuenta: antes la precarga reutilizaba
 * calcularAgendas, cuyo Promise.all tumbaba la descarga ENTERA cuando un
 * solo formulario fallaba ("fetch failed" tras 6 min). Ahora un fallo deja
 * ese formulario con sus datos anteriores y se reintenta una vez al final,
 * cuando el resto ya no compite por la API.
 *
 * Nunca lanza. Si ya hay una en curso se devuelve esa en vez de lanzar otra.
 */
export function precargar(motivo: string): Promise<ResumenPrecarga> {
  enCurso ??= ejecutar(motivo).finally(() => {
    enCurso = null;
  });
  return enCurso;
}

async function ejecutar(motivo: string): Promise<ResumenPrecarga> {
  const inicio = Date.now();
  try {
    const env = getEnv();
    const todos = await conCache('formularios', () => obtenerFormularios(), {
      ttlMs: env.PULSO_CACHE_TTL_MS,
    });
    const candidatos = todos.filter((f) => (f.responses ?? 1) > 0);

    const renovar = async (formulario: Formulario) => {
      const campos = await conCache(
        `campos:${formulario.id}`,
        () => obtenerCamposCalendly(formulario.id),
        { ttlMs: env.PULSO_ESTRUCTURA_TTL_MS },
      );
      if (campos.length === 0) return false;
      await conCache<ResultadoRespuestas>(
        `respuestas:${formulario.id}`,
        () => obtenerRespuestas(formulario.id),
        { ttlMs: env.PULSO_DATOS_TTL_MS, forzar: true },
      );
      return true;
    };

    let renovados = 0;
    const pendientes: Formulario[] = [];
    const primera = await Promise.allSettled(candidatos.map(renovar));
    primera.forEach((r, i) => {
      if (r.status === 'rejected') pendientes.push(candidatos[i]);
      else if (r.value) renovados += 1;
    });

    // Segunda vuelta en serie: lo que falló suele ser transitorio (timeout,
    // conexión cortada, rate limit) y ahora no compite con nadie.
    let fallidos = 0;
    let ultimoError: string | undefined;
    for (const formulario of pendientes) {
      try {
        if (await renovar(formulario)) renovados += 1;
      } catch (e) {
        fallidos += 1;
        ultimoError = `${formulario.title}: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    const resumen: ResumenPrecarga = {
      ok: fallidos === 0,
      motivo,
      duracionMs: Date.now() - inicio,
      renovados,
      fallidos,
      ...(ultimoError ? { error: ultimoError } : {}),
    };
    if (resumen.ok) console.info('[pulso] precarga completa', resumen);
    else console.warn('[pulso] precarga parcial', resumen);
    return resumen;
  } catch (e) {
    // Solo llega aquí si falla la lista de formularios.
    const resumen: ResumenPrecarga = {
      ok: false,
      motivo,
      duracionMs: Date.now() - inicio,
      renovados: 0,
      fallidos: 0,
      error: e instanceof Error ? e.message : String(e),
    };
    console.error('[pulso] precarga fallida', resumen);
    return resumen;
  }
}
