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

export function KpisAgendas({
  kpis,
  rangoPrevio,
  coberturaDesde,
  corteComparacion,
}: {
  kpis: Kpis;
  rangoPrevio: RangoDias;
  /** Día desde el que hay datos fiables; `null` si todo está cubierto. */
  coberturaDesde: string | null;
  /** `null` si la comparación es entre dos periodos completos; si no, el día
   *  y la hora hasta donde cuenta el periodo anterior. */
  corteComparacion: { dia: string; horaLocal: string } | null;
}) {
  // Si la cobertura empieza después de que terminara el periodo anterior, ese
  // periodo no es que tuviera cero agendas: es que no lo podemos ver. Decir
  // una cosa por la otra convertiría una limitación de la API en un dato
  // falso sobre el negocio.
  const previoSinCobertura = coberturaDesde !== null && coberturaDesde > rangoPrevio.desde;
  const { variacionPct } = kpis;
  const sube = variacionPct !== null && variacionPct > 0;
  const baja = variacionPct !== null && variacionPct < 0;
  const Icono =
    variacionPct === null ? ArrowRight : sube ? ArrowUpRight : baja ? ArrowDownRight : Minus;

  return (
    // Región con nombre: da a quien usa lector de pantalla un punto de
    // navegación, y desambigua "Mejor día" de la columna homónima de la tabla.
    <section aria-label="Indicadores del periodo" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Tarjeta titulo="Total de agendas">{formatearEntero(kpis.total)}</Tarjeta>

      <Tarjeta
        titulo="Variación"
        detalle={
          previoSinCobertura
            ? `Sin datos del periodo anterior: la API solo devuelve desde ${coberturaDesde}`
            : variacionPct === null
              ? 'El periodo anterior no tuvo agendas'
              : corteComparacion
                ? `vs ${formatearEntero(kpis.totalPrevio)} del ${rangoPrevio.desde} al ${rangoPrevio.hasta} ` +
                  `(el ${corteComparacion.dia} solo cuenta hasta las ${corteComparacion.horaLocal}, igual que hoy)`
                : `vs ${formatearEntero(kpis.totalPrevio)} del ${rangoPrevio.desde} al ${rangoPrevio.hasta}`
        }
      >
        {/* La dirección se transmite con icono y signo, no solo con color:
            el color nunca es el único portador de significado. */}
        <span
          className={cn(
            'inline-flex items-center gap-1',
            !previoSinCobertura && sube && 'text-positive',
            !previoSinCobertura && baja && 'text-destructive',
            (variacionPct === null || previoSinCobertura) && 'text-muted-foreground text-lg',
          )}
        >
          {previoSinCobertura ? (
            'No comparable'
          ) : (
            <>
              <Icono className="h-5 w-5 shrink-0" aria-hidden />
              {formatearVariacion(variacionPct)}
            </>
          )}
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
    </section>
  );
}
