import { z } from 'zod';

/**
 * Esquemas derivados de docs/api/form30x.md.
 *
 * Todos los objetos son "loose": conservan las claves desconocidas en vez de
 * descartarlas. Un campo nuevo en form30x no debe romper Pulso, y validar en
 * el borde convierte un cambio silencioso de contrato en un error localizado
 * en lugar de un `undefined` que viaja hasta una gráfica.
 */

export const opcionSchema = z.looseObject({
  id: z.string(),
  label: z.string().nullish(),
});

export const answerSchema = z.looseObject({
  fieldRef: z.string(),
  type: z.string(),
  question: z.string().nullish(),
  value: z.unknown().optional(),
  label: z.unknown().optional(),
  choices: z.array(opcionSchema).nullish(),
});

/**
 * Normaliza una respuesta antes de validarla.
 *
 * Aplana dos diferencias entre lo que documenta form30x y lo que devuelve de
 * verdad, comprobadas contra la API real:
 *
 * 1. **El identificador es `id`, no `responseId`.** La documentación muestra
 *    `responseId` porque describe el payload del *webhook*, no el de la API.
 * 2. **`hidden`, `score`, `tags` y `variables` viven dentro de `metadata`.**
 *    La propia documentación lo confirma en su sección técnica:
 *    `Response.metadata = { hidden, score, tags, variables }`. Leerlos de la
 *    raíz, como sugiere el ejemplo del webhook, deja las UTM siempre vacías
 *    sin que salte ningún error.
 *
 * Se conserva la lectura desde la raíz como alternativa, para que el mismo
 * esquema sirva si algún día se procesan webhooks (Fase 2).
 */
const normalizarRespuesta = (valor: unknown) => {
  if (typeof valor !== 'object' || valor === null) return valor;
  const bruto = valor as Record<string, unknown>;
  const metadata =
    typeof bruto.metadata === 'object' && bruto.metadata !== null
      ? (bruto.metadata as Record<string, unknown>)
      : {};

  return {
    ...bruto,
    responseId: bruto.responseId ?? bruto.id ?? bruto.response_id,
    submittedAt: bruto.submittedAt ?? bruto.submitted_at ?? bruto.createdAt ?? bruto.created_at,
    hidden: bruto.hidden ?? metadata.hidden,
    score: bruto.score ?? metadata.score,
    tags: bruto.tags ?? metadata.tags,
    variables: bruto.variables ?? metadata.variables,
  };
};

export const respuestaSchema = z.preprocess(
  normalizarRespuesta,
  z.looseObject({
    responseId: z.string(),
    submittedAt: z.string(),
    // `.transform` y no `.default`: el default solo cubre `undefined`, y un
    // `null` explícito llegaría al dominio, que exige un array.
    answers: z
      .array(answerSchema)
      .nullish()
      .transform((valor) => valor ?? []),
    hidden: z.record(z.string(), z.string()).nullish(),
    score: z.number().nullish(),
    tags: z.array(z.string()).nullish(),
    variables: z.record(z.string(), z.unknown()).nullish(),
    // Marcas de parcialidad: la documentación no dice cuál se usa (§10 de
    // docs/api/form30x.md), así que se aceptan las tres y el dominio decide.
    partial: z.unknown().optional(),
    completed: z.unknown().optional(),
    status: z.unknown().optional(),
  }),
);

const normalizarFormulario = (valor: unknown) => {
  if (typeof valor !== 'object' || valor === null) return valor;
  const bruto = valor as Record<string, unknown>;
  return { ...bruto, title: bruto.title ?? bruto.name ?? bruto.formTitle ?? '' };
};

export const formularioSchema = z.preprocess(
  normalizarFormulario,
  z.looseObject({
    id: z.string(),
    title: z.string(),
    slug: z.string().nullish(),
    published: z.boolean().nullish(),
    workspaceId: z.string().nullish(),
    /**
     * Total de respuestas del formulario.
     *
     * No aparece en la documentación en prosa, pero `GET /forms` lo devuelve
     * y es el único dato agregado que ofrece toda la API. Sirve para descartar
     * de antemano los formularios sin respuestas, que no pueden tener agendas.
     */
    responses: z.number().nullish(),
    fields: z.number().nullish(),
  }),
);

export type Opcion = z.infer<typeof opcionSchema>;
export type Answer = z.infer<typeof answerSchema>;
export type Respuesta = z.infer<typeof respuestaSchema>;
export type Formulario = z.infer<typeof formularioSchema>;
