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
 * Normaliza los nombres de campo antes de validar.
 *
 * La documentación fija `responseId` y `submittedAt`, pero no pudimos
 * comprobarlo contra la API real, así que se aceptan también las variantes
 * habituales. Es preferible a fallar con un error de esquema por una
 * diferencia de nomenclatura.
 */
const normalizarRespuesta = (valor: unknown) => {
  if (typeof valor !== 'object' || valor === null) return valor;
  const bruto = valor as Record<string, unknown>;
  return {
    ...bruto,
    responseId: bruto.responseId ?? bruto.id ?? bruto.response_id,
    submittedAt: bruto.submittedAt ?? bruto.submitted_at ?? bruto.createdAt ?? bruto.created_at,
  };
};

export const respuestaSchema = z.preprocess(
  normalizarRespuesta,
  z.looseObject({
    responseId: z.string(),
    submittedAt: z.string(),
    answers: z.array(answerSchema).nullish().default([]),
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
  }),
);

export type Opcion = z.infer<typeof opcionSchema>;
export type Answer = z.infer<typeof answerSchema>;
export type Respuesta = z.infer<typeof respuestaSchema>;
export type Formulario = z.infer<typeof formularioSchema>;
