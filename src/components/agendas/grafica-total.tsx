'use client';

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DiaPrograma } from '@/lib/contracts/agendas';
import { formatearDiaCorto, formatearDiaLargo, formatearEntero } from '@/lib/formato';

/**
 * Total diario de agendas.
 *
 * Serie única a propósito: la paleta de 30X no permite una escala categórica
 * legible, así que el desglose por programa se resuelve con pequeños múltiplos
 * en la tabla y aquí se muestra el agregado (docs/brand.md §4). Una sola serie
 * no necesita leyenda: el título la nombra.
 */
export function GraficaTotal({ dias, mejorDia }: { dias: DiaPrograma[]; mejorDia: string | null }) {
  const maximo = Math.max(...dias.map((d) => d.agendas), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="rule-accent">Agendas por día</CardTitle>
        <p className="text-muted-foreground text-xs">
          Total de todos los programas seleccionados. La barra destacada es el mejor día.
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dias} margin={{ top: 8, right: 4, bottom: 0, left: -20 }} barGap={2}>
              <XAxis
                dataKey="fecha"
                tickFormatter={formatearDiaCorto}
                tickLine={false}
                axisLine={{ stroke: 'var(--chart-grid)' }}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                allowDecimals={false}
                domain={[0, Math.ceil(maximo * 1.15)]}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                width={44}
              />
              <Tooltip
                cursor={{ fill: 'var(--muted)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const dato = payload[0].payload as DiaPrograma;
                  return (
                    <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-xs shadow-lg">
                      <p className="font-medium">{formatearDiaLargo(dato.fecha)}</p>
                      <p className="tabular text-muted-foreground mt-0.5">
                        {formatearEntero(dato.agendas)} {dato.agendas === 1 ? 'agenda' : 'agendas'}
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="agendas" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {dias.map((dia) => (
                  <Cell
                    key={dia.fecha}
                    fill={
                      dia.fecha === mejorDia && dia.agendas > 0
                        ? 'var(--chart-destacado)'
                        : 'var(--chart-mark)'
                    }
                    // El relleno destacado por sí solo no llega a 3:1 en modo
                    // claro; el trazo es lo que aporta el contraste.
                    stroke={dia.fecha === mejorDia ? 'var(--accent-ring)' : 'none'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
