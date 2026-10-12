import 'server-only';
import { getEnv } from '@/lib/config/env';
import { rangoDePreset } from '@/lib/date/rangos';
import { calcularAgendas } from './agendas';

export interface ResumenPrecarga {
  ok: boolean;
  motivo: string;
  duracionMs: number;
  error?: string;
}

let enCurso: Promise<ResumenPrecarga> | null = null;

/**
 * Descarga de nuevo las respuestas de TODOS los formularios y deja el caché
 * caliente, para que quien abra Pulso lea de memoria en vez de esperar a que
 * se pagine el histórico completo contra form30x.
 *
 * Reutiliza calcularAgendas con todos los programas y `forzar`: la caché de
 * respuestas va por formulario e ignora el rango, así que el rango aquí da
 * igual — solo hace falta que pase por todos los formularios.
 *
 * Nunca lanza: corre desde el arranque del servidor y desde el cron, y un
 * fallo de form30x no debe tumbar ninguno de los dos. Si ya hay una en curso
 * se devuelve esa en vez de lanzar otra en paralelo.
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
    const tz = getEnv().PULSO_TIMEZONE;
    await calcularAgendas({ rango: rangoDePreset('ultimos7', tz), programas: [], forzar: true });
    const resumen = { ok: true, motivo, duracionMs: Date.now() - inicio };
    console.info('[pulso] precarga completa', resumen);
    return resumen;
  } catch (e) {
    const resumen = {
      ok: false,
      motivo,
      duracionMs: Date.now() - inicio,
      error: e instanceof Error ? e.message : String(e),
    };
    console.error('[pulso] precarga fallida', resumen);
    return resumen;
  }
}
