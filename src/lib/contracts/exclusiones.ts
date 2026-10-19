import { z } from 'zod';

/**
 * Un registro que alguien del equipo eliminó a mano (típicamente una agenda
 * de prueba). form30x no permite borrar respuestas por API, así que Pulso
 * no la borra allí: la excluye de todos sus números.
 *
 * Además del id se guarda una foto mínima del registro para poder listarlo
 * y restaurarlo aunque ya no caiga en el rango que se está mirando.
 */
export const exclusionEntradaSchema = z.object({
  id: z.string().min(1).max(200),
  formId: z.string().min(1).max(200),
  programaNombre: z.string().max(200),
  email: z.string().max(320).nullable(),
  nombre: z.string().max(200).nullable(),
  submittedAt: z.string().max(40),
  agendada: z.boolean(),
});

export type ExclusionEntrada = z.infer<typeof exclusionEntradaSchema>;

export interface Exclusion extends ExclusionEntrada {
  /** Correo de quien lo eliminó (identidad de IAP), o `null` en local. */
  eliminadoPor: string | null;
  eliminadoEn: string;
}

export interface ExclusionesResponse {
  exclusiones: Exclusion[];
}
