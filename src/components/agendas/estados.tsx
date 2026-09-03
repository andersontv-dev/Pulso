'use client';

import { AlertTriangle, CalendarX, Info, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Aviso } from '@/lib/contracts/agendas';
import { KpisSkeleton } from './kpis';

/** Carga. La región viva anuncia el estado una sola vez, no un bloque por
 *  cada esqueleto. */
export function EstadoCargando() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando agendas…</span>
      <KpisSkeleton />
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-3 h-56 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 p-4">
          <Skeleton className="h-4 w-48" />
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function EstadoVacio({ onLimpiar }: { onLimpiar?: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3 p-8">
        <CalendarX className="text-muted-foreground h-6 w-6" aria-hidden />
        <div>
          <p className="font-semibold">No hay agendas en este periodo.</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Prueba con un rango más amplio o quita el filtro de programas.
          </p>
        </div>
        {onLimpiar ? (
          <Button type="button" variant="outline" size="sm" onClick={onLimpiar}>
            Ver todos los programas
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function EstadoError({
  mensaje,
  onReintentar,
  reintentando,
}: {
  mensaje: string;
  onReintentar: () => void;
  reintentando: boolean;
}) {
  return (
    <Card className="border-destructive/40">
      <CardContent className="flex flex-col items-start gap-3 p-8">
        <AlertTriangle className="text-destructive h-6 w-6" aria-hidden />
        <div role="alert">
          <p className="font-semibold">No pudimos cargar los datos.</p>
          <p className="text-muted-foreground mt-1 max-w-prose text-sm">{mensaje}</p>
        </div>
        <Button
          type="button"
          variant="accent"
          size="sm"
          onClick={onReintentar}
          disabled={reintentando}
        >
          <RefreshCw
            className={reintentando ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'}
            aria-hidden
          />
          {reintentando ? 'Reintentando…' : 'Reintentar'}
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Avisos sobre la calidad de los datos.
 *
 * Se muestran en la interfaz y no solo en los logs: un total incompleto sin
 * advertencia al lado es un número que alguien va a usar creyendo que está
 * bien (ADR 0003).
 */
export function Avisos({ avisos }: { avisos: Aviso[] }) {
  if (avisos.length === 0) return null;

  return (
    <ul className="space-y-2">
      {avisos.map((aviso) => (
        <li
          key={aviso.tipo}
          className="border-border bg-muted flex items-start gap-2 rounded-md border p-3 text-xs"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="text-muted-foreground">{aviso.mensaje}</span>
        </li>
      ))}
    </ul>
  );
}
