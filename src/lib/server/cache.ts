import 'server-only';

/**
 * Caché en memoria con TTL y deduplicación de peticiones en vuelo.
 *
 * La deduplicación es la parte que de verdad importa: sin ella, diez personas
 * abriendo el dashboard a la vez lanzarían diez tandas idénticas de peticiones
 * contra una API que no publica rate limit. Con ella, la primera hace el
 * trabajo y las otras nueve esperan a su resultado.
 *
 * Limitación conocida: es memoria del proceso. Sirve para un despliegue de una
 * instancia o para uso local. Con varias instancias haría falta un caché
 * compartido (ver ADR 0002 y la deuda técnica del README).
 */

interface Entrada<T> {
  valor: T;
  expiraEn: number;
  /** Cuándo terminó de producirse el valor: la edad real del dato. */
  guardadoEn: number;
  /** Cuánto tardó en producirse. Sirve para estimar cuánto tardará la
   *  próxima vez que alguien fuerce la recarga. */
  duracionMs: number;
}

const almacen = new Map<string, Entrada<unknown>>();
const enVuelo = new Map<string, Promise<unknown>>();

export interface OpcionesCache {
  ttlMs: number;
  /** Salta el caché y fuerza la recarga, conservando la deduplicación. */
  forzar?: boolean;
}

export async function conCache<T>(
  clave: string,
  producir: () => Promise<T>,
  { ttlMs, forzar = false }: OpcionesCache,
): Promise<T> {
  const ahora = Date.now();

  if (!forzar) {
    const entrada = almacen.get(clave) as Entrada<T> | undefined;
    if (entrada && entrada.expiraEn > ahora) return entrada.valor;
  }

  const yaEnCurso = enVuelo.get(clave) as Promise<T> | undefined;
  if (yaEnCurso) return yaEnCurso;

  const inicio = Date.now();
  const promesa = producir()
    .then((valor) => {
      const fin = Date.now();
      almacen.set(clave, {
        valor,
        expiraEn: fin + ttlMs,
        guardadoEn: fin,
        duracionMs: fin - inicio,
      });
      return valor;
    })
    .finally(() => {
      enVuelo.delete(clave);
    });

  enVuelo.set(clave, promesa);
  return promesa;
}

/** Edad y coste de una entrada vigente, o `null` si no está en caché. */
export function metadatosCache(clave: string): { guardadoEn: number; duracionMs: number } | null {
  const entrada = almacen.get(clave);
  if (!entrada || entrada.expiraEn <= Date.now()) return null;
  return { guardadoEn: entrada.guardadoEn, duracionMs: entrada.duracionMs };
}

/** Elimina las entradas caducadas. Se invoca de forma oportunista para que el
 *  mapa no crezca sin límite en un proceso de larga vida. */
export function purgarCaducadas(): void {
  const ahora = Date.now();
  for (const [clave, entrada] of almacen) {
    if (entrada.expiraEn <= ahora) almacen.delete(clave);
  }
}

/** Solo para tests. */
export function vaciarCache(): void {
  almacen.clear();
  enVuelo.clear();
}
