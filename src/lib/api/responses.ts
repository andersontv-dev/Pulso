import 'server-only';
import { z } from 'zod';
import { getEnv } from '@/lib/config/env';
import { peticion } from './client';
import { extraerPagina, recorrerPaginas } from './pagination';
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
}

/**
 * Descarga las respuestas de un formulario dentro de una ventana temporal.
 *
 * La documentación no describe ningún filtro de fecha en `/responses`
 * (docs/api/form30x.md §8). La estrategia es doble:
 *
 * 1. Si `FORM30X_SUPPORTS_DATE_FILTER` está activo, se envían los parámetros
 *    de fecha como sugerencia al servidor.
 * 2. **En todo caso** se vuelve a filtrar en memoria.
 *
 * Así el resultado es correcto tanto si el servidor honra el filtro como si
 * lo ignora en silencio, que es lo que ocurriría hoy con un parámetro que no
 * existe.
 */
export async function listarRespuestas(
  formId: string,
  opciones: { ventana?: VentanaTemporal; signal?: AbortSignal } = {},
): Promise<ResultadoRespuestas> {
  const env = getEnv();
  const { ventana, signal } = opciones;

  const filtroFecha =
    env.FORM30X_SUPPORTS_DATE_FILTER && ventana
      ? {
          since: new Date(ventana.desde).toISOString(),
          until: new Date(ventana.hasta).toISOString(),
        }
      : {};

  const { items, paginas, truncado } = await recorrerPaginas(
    async (cursor) => {
      const cuerpo = await peticion(`/forms/${encodeURIComponent(formId)}/responses`, {
        schema: cuerpoCrudo,
        searchParams: {
          ...filtroFecha,
          ...(cursor ? { [env.FORM30X_CURSOR_PARAM]: cursor } : {}),
        },
        signal,
      });
      return extraerPagina(cuerpo);
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

  return { respuestas, paginas, truncado, descartadas };
}

function dentroDeVentana(iso: string, ventana: VentanaTemporal): boolean {
  const instante = new Date(iso).getTime();
  if (Number.isNaN(instante)) return false;
  return instante >= ventana.desde && instante < ventana.hasta;
}
