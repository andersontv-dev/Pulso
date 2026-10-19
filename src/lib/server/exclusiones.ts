import 'server-only';
import { getEnv } from '@/lib/config/env';
import type { Exclusion, ExclusionEntrada } from '@/lib/contracts/exclusiones';

/**
 * Registros eliminados a mano: un mapa `responseId → Exclusion`.
 *
 * form30x no expone DELETE de respuestas (docs/api/form30x.md §4), así que
 * "eliminar" en Pulso significa excluir: la respuesta sigue en form30x, pero
 * no entra a ningún número del dashboard. Por eso es reversible.
 *
 * Se guarda como un único JSON en Cloud Storage. Son decenas de entradas,
 * no miles, y Pulso corre en una sola instancia: una base de datos sería
 * desproporcionada. Las escrituras usan `ifGenerationMatch` para que dos
 * eliminaciones simultáneas no se pisen (si la versión cambió entre leer y
 * escribir, se vuelve a leer y se reaplica).
 */
type Mapa = Record<string, Exclusion>;

interface Instantanea {
  datos: Mapa;
  generacion: string;
}

interface Almacen {
  leer(): Promise<Instantanea>;
  /** `false` si la generación ya no es la leída (alguien escribió antes). */
  escribir(datos: Mapa, generacion: string): Promise<boolean>;
}

class AlmacenMemoria implements Almacen {
  private datos: Mapa = {};
  private generacion = 0;

  async leer(): Promise<Instantanea> {
    return { datos: structuredClone(this.datos), generacion: String(this.generacion) };
  }

  async escribir(datos: Mapa, generacion: string): Promise<boolean> {
    if (generacion !== String(this.generacion)) return false;
    this.datos = structuredClone(datos);
    this.generacion += 1;
    return true;
  }
}

/**
 * Cloud Storage por su API JSON, con el token de la cuenta de servicio que
 * da el servidor de metadatos de Cloud Run. Sin SDK: son dos llamadas y no
 * justifican una dependencia más.
 */
class AlmacenGcs implements Almacen {
  private token: { valor: string; expiraEn: number } | null = null;

  constructor(
    private readonly bucket: string,
    private readonly objeto: string,
  ) {}

  private async autorizacion(): Promise<string> {
    if (this.token && this.token.expiraEn > Date.now() + 60_000) return this.token.valor;
    const r = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      { headers: { 'Metadata-Flavor': 'Google' }, cache: 'no-store' },
    );
    if (!r.ok) throw new Error(`No se pudo obtener token de Cloud Storage (${r.status})`);
    const { access_token, expires_in } = (await r.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.token = { valor: access_token, expiraEn: Date.now() + expires_in * 1000 };
    return access_token;
  }

  async leer(): Promise<Instantanea> {
    const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(this.bucket)}/o/${encodeURIComponent(this.objeto)}?alt=media`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${await this.autorizacion()}` },
      cache: 'no-store',
    });
    // Aún no existe: nadie ha eliminado nada. Generación 0 = "solo crear si
    // no existe" al escribir.
    if (r.status === 404) return { datos: {}, generacion: '0' };
    if (!r.ok) throw new Error(`Cloud Storage respondió ${r.status} al leer exclusiones`);
    return {
      datos: (await r.json()) as Mapa,
      generacion: r.headers.get('x-goog-generation') ?? '0',
    };
  }

  async escribir(datos: Mapa, generacion: string): Promise<boolean> {
    const params = new URLSearchParams({
      uploadType: 'media',
      name: this.objeto,
      ifGenerationMatch: generacion,
    });
    const r = await fetch(
      `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(this.bucket)}/o?${params}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await this.autorizacion()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(datos),
        cache: 'no-store',
      },
    );
    if (r.status === 412) return false;
    if (!r.ok) throw new Error(`Cloud Storage respondió ${r.status} al guardar exclusiones`);
    return true;
  }
}

/** Cuánto se confía en la copia en memoria antes de releer el archivo. Con
 *  una sola instancia casi nunca cambia por fuera, pero así un cambio hecho
 *  a mano en el bucket también llega. */
const RELECTURA_MS = 60_000;
const INTENTOS_ESCRITURA = 5;

let almacen: Almacen | null = null;
let vigente: { datos: Mapa; leidoEn: number } | null = null;
let leyendo: Promise<Mapa> | null = null;
let cola: Promise<unknown> = Promise.resolve();

function obtenerAlmacen(): Almacen {
  if (almacen) return almacen;
  const env = getEnv();
  if (env.PULSO_EXCLUSIONES_BUCKET) {
    almacen = new AlmacenGcs(env.PULSO_EXCLUSIONES_BUCKET, env.PULSO_EXCLUSIONES_OBJETO);
  } else {
    if (process.env.NODE_ENV === 'production' && !env.PULSO_USE_FIXTURES) {
      console.warn(
        '[pulso] PULSO_EXCLUSIONES_BUCKET no está configurado: los registros eliminados ' +
          'se guardan en memoria y se perderán al reiniciar.',
      );
    }
    almacen = new AlmacenMemoria();
  }
  return almacen;
}

/** Mapa vigente de exclusiones, de memoria si es reciente. */
export async function obtenerExclusiones(): Promise<Mapa> {
  if (vigente && Date.now() - vigente.leidoEn < RELECTURA_MS) return vigente.datos;
  leyendo ??= obtenerAlmacen()
    .leer()
    .then(({ datos }) => {
      vigente = { datos, leidoEn: Date.now() };
      return datos;
    })
    .finally(() => {
      leyendo = null;
    });
  return leyendo;
}

/**
 * Lee-modifica-escribe, en serie dentro del proceso y con control de
 * versión contra el bucket. Si otro escribió entre medias, se reintenta
 * sobre la versión nueva.
 */
function modificar(cambio: (datos: Mapa) => Mapa): Promise<Mapa> {
  const tarea = cola.then(async () => {
    for (let intento = 0; intento < INTENTOS_ESCRITURA; intento += 1) {
      const { datos, generacion } = await obtenerAlmacen().leer();
      const nuevos = cambio(datos);
      if (await obtenerAlmacen().escribir(nuevos, generacion)) {
        vigente = { datos: nuevos, leidoEn: Date.now() };
        return nuevos;
      }
    }
    throw new Error('No se pudo guardar: el archivo de exclusiones cambió varias veces seguidas.');
  });
  // La cola sigue aunque esta tarea falle.
  cola = tarea.catch(() => undefined);
  return tarea;
}

export function excluir(entrada: ExclusionEntrada, eliminadoPor: string | null) {
  return modificar((datos) => ({
    ...datos,
    [entrada.id]: { ...entrada, eliminadoPor, eliminadoEn: new Date().toISOString() },
  }));
}

export function restaurar(id: string) {
  return modificar((datos) => {
    const { [id]: _quitado, ...resto } = datos;
    return resto;
  });
}

/** Solo para tests. */
export function reiniciarExclusiones(): void {
  almacen = null;
  vigente = null;
  leyendo = null;
  cola = Promise.resolve();
}
