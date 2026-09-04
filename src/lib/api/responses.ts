import 'server-only';
import { z } from 'zod';
import { getEnv } from '@/lib/config/env';
import { peticion } from './client';
import { LIMITE_MAXIMO, extraerPagina, recorrerPaginas } from './pagination';
import { respuestaSchema, type Respuesta } from './schemas';

const cuerpoCrudo = z.unknown();

export interface VentanaTemporal {
  /** Inicio inclusivo, en milisegundos epoch. */
  desde: number;
  /** Fin exclusivo, en milisegundos epoch. */
  hasta: number;
}

export interface ResultadoRespuestas {
  respuestas: Respuesta[];
  paginas: number;
  /** Se alcanzó el tope de páginas: faltan datos y hay que decirlo. */
  truncado: boolean;
  /** Respuestas que no pasaron la validación de esquema. */
  descartadas: number;
  /** Cuántas se descargaron antes de filtrar por fecha. Mide lo que cuesta
   *  no tener filtro de fecha en la API. */
  descargadas: number;
  /**
   * `submittedAt` más antiguo entre las descargadas, o `null` si no hubo
   * ninguna.
   *
   * Es la pieza que permite saber **hasta dónde llega lo que sabemos**. El
   * servidor topa en 200 respuestas por formulario y no envía cursor, así que
   * de un formulario con 3.000 respuestas solo vemos una ventana reciente.
   * Comparando este instante con el inicio del rango pedido se detecta si esa
   * ventana lo cubre entero o si faltan días.
   */
  masAntigua: string | null;
  /** `true` si el servidor devolvió el máximo que acepta: señal de que hay
   *  más datos de los que se pudieron leer. */
  topeAlcanzado: boolean;
}

/**
 * Descarga las respuestas de un formulario y filtra por ventana temporal.
 *
 * **La API no tiene filtro por fecha.** El `openapi.json` lo confirma: los
 * únicos parámetros de `GET /forms/:id/responses` son `limit` y `cursor`. Así
 * que traer «los últimos 7 días» obliga a recorrer el histórico completo del
 * formulario y descartar en memoria lo que sobra.
 *
 * Es la restricción más cara del proyecto y la razón de que haya caché en
 * servidor. `descargadas` deja medido el coste real.
 */
export async function listarRespuestas(
  formId: string,
  opciones: { ventana?: VentanaTemporal; signal?: AbortSignal } = {},
): Promise<ResultadoRespuestas> {
  const env = getEnv();
  const { ventana, signal } = opciones;

  const { items, paginas, truncado } = await recorrerPaginas(
    async (cursor) => {
      const { datos, cabeceras } = await peticion(
        `/forms/${encodeURIComponent(formId)}/responses`,
        {
          schema: cuerpoCrudo,
          searchParams: { limit: LIMITE_MAXIMO, ...(cursor ? { cursor } : {}) },
          signal,
        },
      );
      return extraerPagina(datos, cabeceras);
    },
    { maximoPaginas: env.FORM30X_MAX_PAGES, limitePedido: LIMITE_MAXIMO },
  );

  let descartadas = 0;
  let masAntigua: number | null = null;
  const respuestas: Respuesta[] = [];

  for (const item of items) {
    const validada = respuestaSchema.safeParse(item);
    if (!validada.success) {
      descartadas += 1;
      continue;
    }

    // Se registra sobre TODAS las validadas, no solo las del rango: es lo que
    // marca el borde de lo que la API nos dejó ver.
    const instante = new Date(validada.data.submittedAt).getTime();
    if (!Number.isNaN(instante) && (masAntigua === null || instante < masAntigua)) {
      masAntigua = instante;
    }

    if (ventana && !dentroDeVentana(validada.data.submittedAt, ventana)) continue;
    respuestas.push(validada.data);
  }

  return {
    respuestas,
    paginas,
    truncado,
    descartadas,
    descargadas: items.length,
    masAntigua: masAntigua === null ? null : new Date(masAntigua).toISOString(),
    topeAlcanzado: items.length >= LIMITE_MAXIMO,
  };
}

function dentroDeVentana(iso: string, ventana: VentanaTemporal): boolean {
  const instante = new Date(iso).getTime();
  if (Number.isNaN(instante)) return false;
  return instante >= ventana.desde && instante < ventana.hasta;
}
