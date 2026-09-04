import 'server-only';
import type { z } from 'zod';
import { getApiEnv } from '@/lib/config/env';
import { Form30xError, codigoDesdeStatus } from './errors';

const PREFIJO = '/api/v1';
const INTENTOS_MAXIMOS = 3;
const TIMEOUT_MS = 20_000;

/**
 * Semáforo de concurrencia.
 *
 * La documentación de form30x no publica rate limit ni cabeceras de cuota
 * (docs/api/form30x.md §9). Sin ese dato, la única postura responsable es
 * limitar cuántas peticiones salen a la vez en lugar de descubrir el límite
 * a base de que nos lo apliquen.
 */
class Semaforo {
  private activos = 0;
  private cola: Array<() => void> = [];

  constructor(private readonly maximo: number) {}

  async adquirir(): Promise<() => void> {
    if (this.activos >= this.maximo) {
      await new Promise<void>((resolve) => this.cola.push(resolve));
    }
    this.activos += 1;
    let liberado = false;
    return () => {
      if (liberado) return;
      liberado = true;
      this.activos -= 1;
      this.cola.shift()?.();
    };
  }
}

let semaforo: Semaforo | undefined;
function obtenerSemaforo(maximo: number): Semaforo {
  semaforo ??= new Semaforo(maximo);
  return semaforo;
}

export interface OpcionesPeticion<T> {
  /** Esquema con el que validar el cuerpo. Si falta, se devuelve sin validar. */
  schema?: z.ZodType<T>;
  searchParams?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
}

/**
 * Cuerpo más cabeceras.
 *
 * Las cabeceras no son un extra: el cursor de paginación de form30x viaja en
 * `X-Next-Cursor`, no en el cuerpo. Una capa de transporte que solo devolviera
 * el JSON haría imposible paginar, y lo peor es que fallaría en silencio
 * quedándose con la primera página.
 */
export interface RespuestaApi<T> {
  datos: T;
  cabeceras: Headers;
}

/**
 * Realiza una petición autenticada contra form30x.
 *
 * Reintenta solo lo que tiene sentido reintentar —429, 5xx y fallos de
 * transporte— con backoff exponencial y jitter, y respeta `Retry-After`
 * cuando el servidor lo envía. Un 401 o un 422 no se reintentan: reintentar
 * un error del cliente solo multiplica la carga sin cambiar el resultado.
 */
export async function peticion<T = unknown>(
  ruta: string,
  opciones: OpcionesPeticion<T> = {},
): Promise<RespuestaApi<T>> {
  const env = getApiEnv();
  const url = construirUrl(env.FORM30X_API_URL, ruta, opciones.searchParams);
  const liberar = await obtenerSemaforo(env.PULSO_MAX_CONCURRENCY).adquirir();

  try {
    let ultimoError: Form30xError | undefined;

    for (let intento = 0; intento < INTENTOS_MAXIMOS; intento += 1) {
      if (intento > 0) {
        await esperar(retardo(intento, ultimoError));
      }

      try {
        const respuesta = await fetchConTimeout(url, env.FORM30X_API_KEY, opciones.signal);

        if (!respuesta.ok) {
          ultimoError = await errorDesdeRespuesta(respuesta);
          if (!ultimoError.reintentable) throw ultimoError;
          continue;
        }

        const cuerpo: unknown = await respuesta.json();
        if (!opciones.schema) return { datos: cuerpo as T, cabeceras: respuesta.headers };

        const validado = opciones.schema.safeParse(cuerpo);
        if (!validado.success) {
          // Un fallo de esquema no se reintenta: el servidor devolvería lo
          // mismo. Se propaga con la ruta exacta del problema.
          throw new Form30xError(`form30x devolvió datos inesperados en ${ruta}`, {
            codigo: 'esquema',
            reintentable: false,
            detalle: validado.error.issues.slice(0, 5),
          });
        }
        return { datos: validado.data, cabeceras: respuesta.headers };
      } catch (error) {
        if (error instanceof Form30xError) {
          if (!error.reintentable) throw error;
          ultimoError = error;
          continue;
        }
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        ultimoError = new Form30xError(`No se pudo conectar con form30x: ${mensaje(error)}`, {
          codigo: 'red',
          detalle: error,
        });
      }
    }

    throw ultimoError ?? new Form30xError('Fallo desconocido', { codigo: 'desconocido' });
  } finally {
    liberar();
  }
}

function construirUrl(
  base: string,
  ruta: string,
  params?: Record<string, string | number | undefined>,
): URL {
  const url = new URL(`${PREFIJO}${ruta.startsWith('/') ? ruta : `/${ruta}`}`, base);
  for (const [clave, valor] of Object.entries(params ?? {})) {
    if (valor !== undefined && valor !== '') url.searchParams.set(clave, String(valor));
  }
  return url;
}

async function fetchConTimeout(url: URL, apiKey: string, externo?: AbortSignal) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);
  const cancelar = () => controlador.abort();
  externo?.addEventListener('abort', cancelar);

  try {
    return await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: controlador.signal,
      // Pulso gestiona su propio caché en servidor con TTL; el de Next
      // duplicaría la política y haría más difícil razonar sobre la frescura.
      cache: 'no-store',
    });
  } finally {
    clearTimeout(temporizador);
    externo?.removeEventListener('abort', cancelar);
  }
}

async function errorDesdeRespuesta(respuesta: Response): Promise<Form30xError> {
  const codigo = codigoDesdeStatus(respuesta.status);
  let detalle: unknown;
  try {
    detalle = await respuesta.json();
  } catch {
    detalle = await respuesta.text().catch(() => undefined);
  }

  const error = new Form30xError(`form30x respondió ${respuesta.status} en ${respuesta.url}`, {
    codigo,
    status: respuesta.status,
    detalle,
  });

  const retryAfter = respuesta.headers.get('retry-after');
  if (retryAfter) {
    Object.defineProperty(error, 'retryAfterMs', { value: parseRetryAfter(retryAfter) });
  }
  return error;
}

/** `Retry-After` admite segundos o una fecha HTTP; la documentación no dice
 *  si form30x lo envía, así que se soportan ambas formas. */
function parseRetryAfter(valor: string): number | undefined {
  const segundos = Number(valor);
  if (Number.isFinite(segundos)) return Math.max(0, segundos * 1000);
  const fecha = Date.parse(valor);
  return Number.isNaN(fecha) ? undefined : Math.max(0, fecha - Date.now());
}

/** Backoff exponencial con jitter. El jitter evita que varias peticiones
 *  rechazadas a la vez vuelvan todas juntas y se rechacen otra vez. */
function retardo(intento: number, error?: Form30xError): number {
  const indicado = (error as { retryAfterMs?: number } | undefined)?.retryAfterMs;
  if (typeof indicado === 'number') return Math.min(indicado, 30_000);
  const base = Math.min(500 * 2 ** (intento - 1), 8_000);
  return base + Math.random() * 250;
}

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const mensaje = (error: unknown) => (error instanceof Error ? error.message : String(error));
