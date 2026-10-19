'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ErrorResponse } from '@/lib/contracts/agendas';
import type { ExclusionEntrada, ExclusionesResponse } from '@/lib/contracts/exclusiones';

// Igual que en use-agendas: el basePath de Next no reescribe fetch() a mano.
const RUTA = '/pulso/api/exclusiones';
const CLAVE = ['exclusiones'];

async function leerRespuesta(respuesta: Response): Promise<ExclusionesResponse> {
  if (!respuesta.ok) {
    const cuerpo = (await respuesta.json().catch(() => null)) as ErrorResponse | null;
    throw new Error(cuerpo?.error?.mensaje ?? 'No se pudo guardar el cambio.');
  }
  return respuesta.json() as Promise<ExclusionesResponse>;
}

/**
 * Registros eliminados a mano, y las acciones para eliminar y restaurar.
 *
 * Tras cada cambio se invalidan las agendas: el servidor vuelve a calcular
 * los números sobre las respuestas que ya tiene en memoria (no descarga de
 * form30x), así que el registro desaparece o vuelve en cuestión de segundos.
 */
export function useExclusiones() {
  const queryClient = useQueryClient();

  const lista = useQuery({
    queryKey: CLAVE,
    queryFn: async () => leerRespuesta(await fetch(RUTA)),
  });

  const alTerminar = (datos: ExclusionesResponse) => {
    queryClient.setQueryData(CLAVE, datos);
    void queryClient.invalidateQueries({ queryKey: ['agendas'] });
  };

  const eliminar = useMutation({
    mutationFn: async (entrada: ExclusionEntrada) =>
      leerRespuesta(
        await fetch(RUTA, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entrada),
        }),
      ),
    onSuccess: alTerminar,
  });

  const restaurar = useMutation({
    mutationFn: async (id: string) =>
      leerRespuesta(await fetch(`${RUTA}?id=${encodeURIComponent(id)}`, { method: 'DELETE' })),
    onSuccess: alTerminar,
  });

  return { lista, eliminar, restaurar };
}
