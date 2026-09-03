'use client';

import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Kpis, RangoDias } from '@/lib/contracts/agendas';
import {
  formatearDecimal,
  formatearDiaLargo,
  formatearEntero,
  formatearVariacion,
} from '@/lib/formato';
import { cn } from '@/lib/utils';

function Tarjeta({
  titulo,
  children,
  detalle,
}: {
  titulo: string;
  children: React.ReactNode;
  detalle?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-muted-foreground text-xs font-medium">{titulo}</p>
        <div className="tabular mt-1 text-2xl leading-tight font-bold">{children}</div>
        {detalle ? <div className="text-muted-foreground mt-1 text-xs">{detalle}</div> : null}
      </CardContent>
    </Card>
  );
}

export function KpisSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {Array.from({ length: 5 }, (_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-7 w-16" />
            <Skeleton className="mt-2 h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function KpisAgendas({ kpis, rangoPrevio }: { kpis: Kpis; rangoPrevio: RangoDias }) {
  const { variacionPct } = kpis;
  const sube = variacionPct !== null && variacionPct > 0;
  const baja = variacionPct !== null && variacionPct < 0;
  const Icono =
    variacionPct === null ? ArrowRight : sube ? ArrowUpRight : baja ? ArrowDownRight : Minus;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Tarjeta titulo="Total de agendas">{formatearEntero(kpis.total)}</Tarjeta>

      <Tarjeta
        titulo="Variación"
        detalle={
          variacionPct === null
            ? 'El periodo anterior no tuvo agendas'
            : `vs ${formatearEntero(kpis.totalPrevio)} del ${rangoPrevio.desde} al ${rangoPrevio.hasta}`
        }
      >
        {/* La dirección se transmite con icono y signo, no solo con color:
            el color nunca es el único portador de significado. */}
        <span
          className={cn(
            'inline-flex items-center gap-1',
            sube && 'text-positive',
            baja && 'text-destructive',
            variacionPct === null && 'text-muted-foreground text-lg',
          )}
        >
          <Icono className="h-5 w-5 shrink-0" aria-hidden />
          {formatearVariacion(variacionPct)}
        </span>
      </Tarjeta>

      <Tarjeta titulo="Promedio diario" detalle="Incluye los días sin agendas">
        {formatearDecimal(kpis.promedioDiario)}
      </Tarjeta>

      <Tarjeta
        titulo="Mejor día"
        detalle={kpis.mejorDia ? formatearDiaLargo(kpis.mejorDia.fecha) : 'Sin datos'}
      >
        {kpis.mejorDia ? formatearEntero(kpis.mejorDia.agendas) : '—'}
      </Tarjeta>

      <Tarjeta
        titulo="Peor día"
        detalle={kpis.peorDia ? formatearDiaLargo(kpis.peorDia.fecha) : 'Sin datos'}
      >
        {kpis.peorDia ? formatearEntero(kpis.peorDia.agendas) : '—'}
      </Tarjeta>
    </div>
  );
}
