import 'server-only';
import { z } from 'zod';
import { getEnv } from '@/lib/config/env';
import { peticion } from './client';
import { LIMITE_MAXIMO, extraerPagina, recorrerPaginas } from './pagination';
import { formularioSchema, type Formulario } from './schemas';

const cuerpoCrudo = z.unknown();

/**
 * Lista los formularios de la compañía.
 *
 * Por defecto solo los publicados: un formulario sin publicar no está
 * recibiendo respuestas, así que traer sus datos es trabajo tirado. El filtro
 * lo aplica el servidor (`published` es un parámetro de la API), no nosotros.
 */
export async function listarFormularios(
  opciones: { soloPublicados?: boolean; signal?: AbortSignal } = {},
): Promise<Formulario[]> {
  const env = getEnv();
  const { soloPublicados = true, signal } = opciones;

  const { items } = await recorrerPaginas(
    async (cursor) => {
      const { datos, cabeceras } = await peticion(`/forms`, {
        schema: cuerpoCrudo,
        searchParams: {
          limit: LIMITE_MAXIMO,
          ...(soloPublicados ? { published: 'true' } : {}),
          ...(cursor ? { cursor } : {}),
        },
        signal,
      });
      return extraerPagina(datos, cabeceras);
    },
    { maximoPaginas: env.FORM30X_MAX_PAGES, limitePedido: LIMITE_MAXIMO },
  );

  // Se validan uno a uno y se descartan los que no encajen, en vez de tirar
  // toda la lista porque un formulario venga raro.
  return items
    .map((item) => formularioSchema.safeParse(item))
    .filter((r): r is { success: true; data: Formulario } => r.success)
    .map((r) => r.data);
}

const camposSchema = z.unknown();

/**
 * Devuelve los `fieldRef` de las preguntas de Calendly de un formulario.
 *
 * Sirve para saber si un formulario **puede** producir agendas. Uno sin
 * pregunta de Calendly nunca generará ninguna, así que no hace falta
 * descargar sus respuestas: en la cuenta real eso evita paginar miles de
 * respuestas de formularios de prueba, encuestas NPS y listas de espera.
 *
 * Es también un filtro más honesto que una lista negra de títulos escrita a
 * mano, porque se deriva de lo que el formulario realmente es.
 */
export async function camposCalendly(formId: string, signal?: AbortSignal): Promise<string[]> {
  const { datos, cabeceras } = await peticion(`/forms/${encodeURIComponent(formId)}/fields`, {
    schema: camposSchema,
    signal,
  });

  const { items } = extraerPagina(datos, cabeceras);

  return items
    .filter(
      (campo): campo is { ref: string; type: string } =>
        typeof campo === 'object' &&
        campo !== null &&
        (campo as { type?: unknown }).type === 'calendly',
    )
    .map((campo) => campo.ref)
    .filter((ref) => typeof ref === 'string');
}
