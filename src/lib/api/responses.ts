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
    { maximoPaginas: env.FORM30X_MAX_PAGES },
  );

  let descartadas = 0;
  const respuestas: Respuesta[] = [];

  for (const item of items) {
    const validada = respuestaSchema.safeParse(item);
    if (!validada.success) {
      descartadas += 1;
      continue;
    }
    if (ventana && !dentroDeVentana(validada.data.submittedAt, ventana)) continue;
    respuestas.push(validada.data);
  }

  return { respuestas, paginas, truncado, descartadas, descargadas: items.length };
}

function dentroDeVentana(iso: string, ventana: VentanaTemporal): boolean {
  const instante = new Date(iso).getTime();
  if (Number.isNaN(instante)) return false;
  return instante >= ventana.desde && instante < ventana.hasta;
}
