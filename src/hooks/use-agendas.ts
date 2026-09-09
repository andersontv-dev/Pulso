'use client';

import { useQuery } from '@tanstack/react-query';
import type { AgendasResponse, ErrorResponse } from '@/lib/contracts/agendas';
import { incluyeHoy, type RangoDias } from '@/lib/date/rangos';

/** Fallos consecutivos tras los cuales se corta el auto-refresco (ADR 0001).
 *  Seguir insistiendo contra una API caída solo suma carga. */
const FALLOS_PARA_CORTAR = 3;

export class ErrorAgendas extends Error {
  constructor(
    mensaje: string,
    readonly codigo: string,
    readonly status: number,
  ) {
    super(mensaje);
    this.name = 'ErrorAgendas';
  }
}

async function traerAgendas(
  rango: RangoDias,
  programas: string[],
  signal: AbortSignal,
): Promise<AgendasResponse> {
  const params = new URLSearchParams({ desde: rango.desde, hasta: rango.hasta });
  if (programas.length > 0) params.set('programas', programas.join(','));

  // next.config.ts's `basePath: "/pulso"` doesn't rewrite hand-written
  // fetch() calls (only next/link and asset URLs) — this must stay in sync
  // with that value by hand.
  const respuesta = await fetch(`/pulso/api/agendas?${params}`, { signal });

  if (!respuesta.ok) {
    const cuerpo = (await respuesta.json().catch(() => null)) as ErrorResponse | null;
    throw new ErrorAgendas(
      cuerpo?.error?.mensaje ?? 'No pudimos cargar los datos.',
      cuerpo?.error?.codigo ?? 'desconocido',
      respuesta.status,
    );
  }

  return respuesta.json() as Promise<AgendasResponse>;
}

export interface OpcionesAgendas {
  rango: RangoDias;
  programas: string[];
  timezone: string;
  intervaloMs: number;
  autoRefresco: boolean;
}

/**
 * Datos del dashboard con la política de refresco del ADR 0001.
 *
 * El auto-refresco solo se activa si el rango llega hasta hoy: un rango
 * histórico ya no cambia, y refrescarlo es tráfico regalado. Se pausa además
 * con la pestaña oculta y se corta tras varios fallos seguidos.
 */
export function useAgendas({
  rango,
  programas,
  timezone,
  intervaloMs,
  autoRefresco,
}: OpcionesAgendas) {
  const rangoVivo = incluyeHoy(rango, timezone);
  const debeRefrescar = autoRefresco && rangoVivo;

  const consulta = useQuery({
    queryKey: ['agendas', rango.desde, rango.hasta, [...programas].sort().join(',')],
    queryFn: ({ signal }) => traerAgendas(rango, programas, signal),
    refetchInterval: (query) => {
      if (!debeRefrescar) return false;
      if (query.state.fetchFailureCount >= FALLOS_PARA_CORTAR) return false;
      return intervaloMs;
    },
    refetchIntervalInBackground: false,
    // Un error del cliente (rango inválido) no mejora reintentando.
    retry: (intentos, error) =>
      error instanceof ErrorAgendas && error.status < 500 ? false : intentos < 2,
  });

  return {
    ...consulta,
    rangoVivo,
    refrescoActivo: debeRefrescar && consulta.failureCount < FALLOS_PARA_CORTAR,
  };
}
