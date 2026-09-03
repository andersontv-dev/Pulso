'use client';

import { Fragment, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SeriePrograma } from '@/lib/contracts/agendas';
import {
  formatearDecimal,
  formatearDiaCorto,
  formatearDiaLargo,
  formatearEntero,
} from '@/lib/formato';
import { cn } from '@/lib/utils';
import { Sparkline } from './sparkline';

interface Props {
  series: SeriePrograma[];
  dias: string[];
}

/** Rejilla del día a día. Se despliega bajo la fila o la tarjeta, en vez de
 *  ocupar columnas: con 30 o 90 días, una columna por día obliga a un scroll
 *  horizontal interminable, que es justo lo que había que evitar. */
function DesgloseDiario({ serie }: { serie: SeriePrograma }) {
  return (
    <div className="bg-muted/50 rounded-md p-3">
      <p className="text-muted-foreground mb-2 text-xs font-medium">
        Día a día · {serie.programaNombre}
      </p>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1.5">
        {serie.dias.map((dia) => (
          <li
            key={dia.fecha}
            className={cn(
              'bg-background rounded border px-2 py-1.5',
              dia.agendas === 0 && 'opacity-60',
            )}
          >
            <span className="text-muted-foreground block text-[0.6875rem] leading-tight">
              <span className="sr-only">{formatearDiaLargo(dia.fecha)}</span>
              <span aria-hidden>{formatearDiaCorto(dia.fecha)}</span>
            </span>
            <span className="tabular block text-sm font-semibold">
              {formatearEntero(dia.agendas)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function resumen(serie: SeriePrograma) {
  const mejor = serie.dias.reduce(
    (a, b) => (b.agendas > a.agendas ? b : a),
    serie.dias[0] ?? { fecha: '', agendas: 0 },
  );
  return {
    promedio: serie.dias.length > 0 ? serie.total / serie.dias.length : 0,
    mejor,
  };
}

export function TablaProgramas({ series, dias }: Props) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const maximo = Math.max(...series.flatMap((s) => s.dias.map((d) => d.agendas)), 1);

  const alternar = (id: string) =>
    setAbiertos((previo) => {
      const siguiente = new Set(previo);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="rule-accent">Desglose por programa</CardTitle>
        <p className="text-muted-foreground text-xs">
          {series.length === 1 ? '1 programa' : `${series.length} programas`} · {dias.length}{' '}
          {dias.length === 1 ? 'día' : 'días'}. Despliega una fila para ver el día a día.
        </p>
      </CardHeader>

      <CardContent className="p-0 sm:p-4 sm:pt-0">
        {/* ---------- Escritorio: tabla densa ---------- */}
        <table className="hidden w-full border-collapse text-sm md:table">
          <caption className="sr-only">
            Agendas por programa, con total, promedio diario y mejor día del periodo.
          </caption>
          <thead>
            <tr className="border-border border-b text-left">
              <th scope="col" className="w-8" />
              <th scope="col" className="text-muted-foreground py-2 pr-3 text-xs font-medium">
                Programa
              </th>
              <th scope="col" className="text-muted-foreground py-2 pr-3 text-xs font-medium">
                Evolución
              </th>
              <th
                scope="col"
                className="text-muted-foreground py-2 pr-3 text-right text-xs font-medium"
              >
                Total
              </th>
              <th
                scope="col"
                className="text-muted-foreground py-2 pr-3 text-right text-xs font-medium"
              >
                Promedio
              </th>
              <th scope="col" className="text-muted-foreground py-2 text-right text-xs font-medium">
                Mejor día
              </th>
            </tr>
          </thead>
          <tbody>
            {series.map((serie) => {
              const { promedio, mejor } = resumen(serie);
              const abierto = abiertos.has(serie.programaId);
              return (
                <Fragment key={serie.programaId}>
                  <tr className="border-border/60 border-b last:border-0">
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => alternar(serie.programaId)}
                        aria-expanded={abierto}
                        aria-controls={`detalle-${serie.programaId}`}
                        aria-label={`${abierto ? 'Ocultar' : 'Ver'} el día a día de ${serie.programaNombre}`}
                        className="hover:bg-muted grid h-7 w-7 place-items-center rounded"
                      >
                        <ChevronRight
                          className={cn('h-4 w-4 transition-transform', abierto && 'rotate-90')}
                          aria-hidden
                        />
                      </button>
                    </td>
                    <th scope="row" className="py-2 pr-3 text-left font-medium">
                      {serie.programaNombre}
                      <span className="text-muted-foreground block text-xs font-normal">
                        {serie.rama ?? 'Sin rama'}
                      </span>
                    </th>
                    <td className="py-2 pr-3">
                      <Sparkline
                        dias={serie.dias}
                        maximo={maximo}
                        nombrePrograma={serie.programaNombre}
                      />
                    </td>
                    <td className="tabular py-2 pr-3 text-right font-semibold">
                      {formatearEntero(serie.total)}
                    </td>
                    <td className="tabular text-muted-foreground py-2 pr-3 text-right">
                      {formatearDecimal(promedio)}
                    </td>
                    <td className="tabular py-2 text-right">
                      {formatearEntero(mejor.agendas)}
                      <span className="text-muted-foreground block text-xs">
                        {mejor.fecha ? formatearDiaCorto(mejor.fecha) : '—'}
                      </span>
                    </td>
                  </tr>
                  {abierto ? (
                    <tr id={`detalle-${serie.programaId}`}>
                      <td colSpan={6} className="pb-3">
                        <DesgloseDiario serie={serie} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        {/* ---------- Móvil: tarjetas, no scroll horizontal ---------- */}
        <ul className="divide-border divide-y md:hidden">
          {series.map((serie) => {
            const { promedio, mejor } = resumen(serie);
            const abierto = abiertos.has(serie.programaId);
            return (
              <li key={serie.programaId} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{serie.programaNombre}</p>
                    <p className="text-muted-foreground text-xs">{serie.rama ?? 'Sin rama'}</p>
                  </div>
                  <p className="tabular text-xl leading-none font-bold">
                    {formatearEntero(serie.total)}
                  </p>
                </div>

                <div className="mt-2">
                  <Sparkline
                    dias={serie.dias}
                    maximo={maximo}
                    nombrePrograma={serie.programaNombre}
                  />
                </div>

                <dl className="text-muted-foreground mt-2 flex gap-4 text-xs">
                  <div>
                    <dt className="inline">Promedio: </dt>
                    <dd className="tabular text-foreground inline font-medium">
                      {formatearDecimal(promedio)}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">Mejor día: </dt>
                    <dd className="tabular text-foreground inline font-medium">
                      {formatearEntero(mejor.agendas)}
                      {mejor.fecha ? ` (${formatearDiaCorto(mejor.fecha)})` : ''}
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  onClick={() => alternar(serie.programaId)}
                  aria-expanded={abierto}
                  aria-controls={`detalle-movil-${serie.programaId}`}
                  aria-label={`${abierto ? 'Ocultar' : 'Ver'} el día a día de ${serie.programaNombre}`}
                  className="text-muted-foreground hover:text-foreground mt-2 inline-flex items-center gap-1 text-xs font-medium"
                >
                  <ChevronRight
                    className={cn('h-3.5 w-3.5 transition-transform', abierto && 'rotate-90')}
                    aria-hidden
                  />
                  {abierto ? 'Ocultar el día a día' : 'Ver el día a día'}
                </button>

                {abierto ? (
                  <div id={`detalle-movil-${serie.programaId}`} className="mt-2">
                    <DesgloseDiario serie={serie} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
