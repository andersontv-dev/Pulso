import 'server-only';
import { z } from 'zod';
import { getEnv } from '@/lib/config/env';
import { peticion } from './client';
import { extraerPagina, recorrerPaginas } from './pagination';
import { formularioSchema, type Formulario } from './schemas';

const listaFormularios = z.unknown();

/**
 * Lista todos los formularios de la compañía.
 *
 * `GET /forms` está documentado pero no se documenta si pagina. Se recorre con
 * el mismo mecanismo que las respuestas: si no pagina, la primera página no
 * trae cursor y el recorrido termina en una sola petición.
 */
export async function listarFormularios(signal?: AbortSignal): Promise<Formulario[]> {
  const env = getEnv();

  const { items } = await recorrerPaginas(
    async (cursor) => {
      const cuerpo = await peticion(`/forms`, {
        schema: listaFormularios,
        searchParams: cursor ? { [env.FORM30X_CURSOR_PARAM]: cursor } : undefined,
        signal,
      });
      return extraerPagina(cuerpo);
    },
    { maximoPaginas: env.FORM30X_MAX_PAGES },
  );

  // Se validan uno a uno y se descartan los que no encajen, en vez de tirar
  // toda la lista porque un formulario venga raro.
  return items
    .map((item) => formularioSchema.safeParse(item))
    .filter((r): r is { success: true; data: Formulario } => r.success)
    .map((r) => r.data);
}
