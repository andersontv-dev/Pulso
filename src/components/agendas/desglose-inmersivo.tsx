'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Registro } from '@/lib/contracts/agendas';
import {
  ETIQUETAS_GRUPO,
  GRUPOS_CANAL,
  OTROS_PAISES,
  PAISES_CON_COLOR,
  agendasPorDiaYCanal,
  agendasPorPais,
  totalesPorCanal,
  type CortePais,
  type DiaPorCanal,
  type GrupoCanal,
} from '@/lib/domain/desglose';
import { resumenPorDia } from '@/lib/domain/embudo';
import {
  formatearDecimal,
  formatearDiaCorto,
  formatearDiaLargo,
  formatearEntero,
} from '@/lib/formato';
import { cn } from '@/lib/utils';

/**
 * Agendas por día de Inmersivo Presencial, desglosadas por canal y por país.
 *
 * Es la única gráfica de Pulso con color por categoría (docs/brand.md §4
 * explica por qué el resto es de serie única). Aquí sí hace falta: el equipo
 * de Inmersivo necesita ver de un vistazo cuánto viene de pauta, orgánico y
 * directo, y de qué país. Las paletas de canal y país son distintas a
 * propósito, para que un mismo color no signifique dos cosas en el panel.
 */
const COLOR_CANAL: Record<GrupoCanal, string> = {
  pauta: 'var(--canal-pauta)',
  organico: 'var(--canal-organico)',
  directo: 'var(--canal-directo)',
  otros: 'var(--canal-otros)',
};

const colorPais = (pais: string) => {
  const i = (PAISES_CON_COLOR as readonly string[]).indexOf(pais);
  return i === -1 ? 'var(--pais-otros)' : `var(--pais-${i + 1})`;
};

const porcentaje = (parte: number, total: number) =>
  total > 0 ? `${formatearDecimal((parte / total) * 100)}%` : '—';

function Muestra({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-sm', className)}
      style={{ backgroundColor: color }}
    />
  );
}

/** Solo el segmento más alto de cada barra lleva las esquinas redondeadas:
 *  así la barra apilada se lee como una sola pieza anclada a la base. */
function formaSegmento(grupo: GrupoCanal) {
  const siguientes = GRUPOS_CANAL.slice(GRUPOS_CANAL.indexOf(grupo) + 1);
  return function Segmento(props: BarShapeProps) {
    const dato = props.payload as DiaPorCanal;
    const esTope = siguientes.every((g) => dato[g] === 0);
    return <Rectangle {...props} radius={esTope ? [4, 4, 0, 0] : 0} />;
  };
}

export function DesgloseInmersivo({
  dias,
  registros,
  programaNombre,
}: {
  dias: string[];
  registros: Registro[];
  programaNombre: string;
}) {
  const porDia = useMemo(() => agendasPorDiaYCanal(registros, dias), [registros, dias]);
  const totales = useMemo(() => totalesPorCanal(registros), [registros]);
  const paises = useMemo(() => agendasPorPais(registros), [registros]);
  const ciudadesPorDia = useMemo(() => resumenPorDia(registros), [registros]);
  const total = GRUPOS_CANAL.reduce((s, g) => s + totales[g], 0);
  const maximo = Math.max(...porDia.map((d) => d.total), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="rule-accent">Agendas por día · {programaNombre}</CardTitle>
        <p className="text-muted-foreground text-xs">
          Cuántas agendas vinieron de pauta, orgánico y directo, y de qué país. Pasa el mouse por
          una barra o por el donut para ver el detalle.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Agendas por canal">
          {/* Amarillo X sólido con texto negro en ambos modos: es el acento
              de la marca (el ~10% del color de la pantalla), no una serie. */}
          <li className="bg-accent text-accent-foreground border-accent-ring rounded-lg border p-3">
            <p className="text-xs opacity-75">Total</p>
            <p className="tabular mt-1 text-2xl font-semibold">{formatearEntero(total)}</p>
            <p className="text-xs opacity-75">agendas en el rango</p>
          </li>
          {GRUPOS_CANAL.map((g) => (
            <li key={g} className="border-border rounded-lg border p-3">
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Muestra color={COLOR_CANAL[g]} />
                {ETIQUETAS_GRUPO[g]}
              </p>
              <p className="tabular mt-1 text-2xl font-semibold">{formatearEntero(totales[g])}</p>
              <p className="text-muted-foreground tabular text-xs">
                {porcentaje(totales[g], total)} del total
              </p>
            </li>
          ))}
        </ul>

        {total === 0 ? (
          <p className="text-muted-foreground py-6 text-sm">
            Sin agendas de {programaNombre} en este rango.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <section
              aria-label="Agendas por día y canal"
              className="border-border flex flex-col rounded-lg border p-3 lg:col-span-2"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Por día y canal</h3>
                <ul className="text-muted-foreground flex flex-wrap gap-3 text-xs">
                  {GRUPOS_CANAL.map((g) => (
                    <li key={g} className="flex items-center gap-1.5">
                      <Muestra color={COLOR_CANAL[g]} />
                      {ETIQUETAS_GRUPO[g]}
                    </li>
                  ))}
                </ul>
              </div>
              {/* Crece hasta la altura del panel de país: si no, queda un
                  hueco vacío bajo las barras. */}
              <div className="min-h-60 w-full flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porDia} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
                    <XAxis
                      dataKey="dia"
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
                        const d = payload[0].payload as DiaPorCanal;
                        const ciudades = ciudadesPorDia.get(d.dia)?.ciudades ?? [];
                        return (
                          <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-xs shadow-lg">
                            <p className="font-medium">{formatearDiaLargo(d.dia)}</p>
                            <p className="tabular text-muted-foreground">
                              {formatearEntero(d.total)} {d.total === 1 ? 'agenda' : 'agendas'}
                            </p>
                            <ul className="mt-1 space-y-0.5 border-t pt-1">
                              {GRUPOS_CANAL.filter((g) => d[g] > 0).map((g) => (
                                <li key={g} className="tabular flex items-center gap-1.5">
                                  <Muestra color={COLOR_CANAL[g]} />
                                  {ETIQUETAS_GRUPO[g]}: {formatearEntero(d[g])} (
                                  {porcentaje(d[g], d.total)})
                                </li>
                              ))}
                            </ul>
                            {ciudades.length > 0 ? (
                              <p className="text-muted-foreground mt-1 border-t pt-1">
                                {ciudades
                                  .map((c) => `${c.ciudad} ${formatearEntero(c.cantidad)}`)
                                  .join(' · ')}
                              </p>
                            ) : null}
                          </div>
                        );
                      }}
                    />
                    {GRUPOS_CANAL.map((g) => (
                      <Bar
                        key={g}
                        dataKey={g}
                        name={ETIQUETAS_GRUPO[g]}
                        stackId="canal"
                        fill={COLOR_CANAL[g]}
                        // Separación de 2px del color de la tarjeta entre
                        // segmentos: sin ella, colores vecinos se funden.
                        stroke="var(--card)"
                        strokeWidth={2}
                        shape={formaSegmento(g)}
                        isAnimationActive={false}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <DonutPaises paises={paises} total={total} />
          </div>
        )}

        {total > 0 ? <TablaDesglose porDia={porDia} paises={paises} total={total} /> : null}
      </CardContent>
    </Card>
  );
}

function DonutPaises({ paises, total }: { paises: CortePais[]; total: number }) {
  return (
    <section aria-label="Agendas por país" className="border-border rounded-lg border p-3">
      <h3 className="mb-2 text-sm font-medium">Por país</h3>
      <div className="relative mx-auto h-44 w-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={paises}
              dataKey="cantidad"
              nameKey="pais"
              innerRadius="62%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {paises.map((p) => (
                <Cell key={p.pais} fill={colorPais(p.pais)} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as CortePais;
                return (
                  <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-xs shadow-lg">
                    <p className="flex items-center gap-1.5 font-medium">
                      <Muestra color={colorPais(p.pais)} />
                      {p.pais}
                    </p>
                    <p className="tabular text-muted-foreground">
                      {formatearEntero(p.cantidad)} agendas · {porcentaje(p.cantidad, total)}
                    </p>
                    <p className="text-muted-foreground mt-1 border-t pt-1">
                      {p.detalle
                        .map((d) => `${d.nombre} ${formatearEntero(d.cantidad)}`)
                        .join(' · ')}
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-xl font-semibold">{formatearEntero(total)}</span>
          <span className="text-muted-foreground text-xs">agendas</span>
        </div>
      </div>

      {/* La leyenda lleva el número exacto: comparar ángulos a ojo es
          impreciso, y el color solo dice de qué país se trata. */}
      <ul className="mt-3 space-y-2 text-xs">
        {paises.map((p) => (
          <li key={p.pais}>
            <div className="flex items-center gap-2">
              <Muestra color={colorPais(p.pais)} />
              <span className="min-w-0 flex-1 truncate font-medium">{p.pais}</span>
              <span className="tabular font-semibold">{porcentaje(p.cantidad, total)}</span>
              <span className="tabular text-muted-foreground w-10 text-right">
                {formatearEntero(p.cantidad)}
              </span>
            </div>
            <p className="text-muted-foreground truncate pl-[18px]">
              {p.detalle.map((d) => `${d.nombre} ${formatearEntero(d.cantidad)}`).join(' · ')}
            </p>
          </li>
        ))}
      </ul>
      {paises.some((p) => p.pais === OTROS_PAISES) ? (
        <p className="text-muted-foreground mt-2 text-[11px]">
          «Sin dato»: agendas cuya respuesta no permite saber la ciudad.
        </p>
      ) : null}
    </section>
  );
}

function TablaDesglose({
  porDia,
  paises,
  total,
}: {
  porDia: DiaPorCanal[];
  paises: CortePais[];
  total: number;
}) {
  const conAgendas = porDia.filter((d) => d.total > 0);
  return (
    <details className="group border-border rounded-md border">
      <summary className="text-muted-foreground cursor-pointer p-2 text-xs select-none">
        Ver como tabla
      </summary>
      <div className="grid gap-4 overflow-x-auto p-2 lg:grid-cols-3">
        <table className="tabular w-full text-xs lg:col-span-2">
          <caption className="sr-only">Agendas por día y canal</caption>
          <thead className="text-muted-foreground text-left">
            <tr>
              <th className="py-1 font-medium">Día</th>
              {GRUPOS_CANAL.map((g) => (
                <th key={g} className="py-1 text-right font-medium">
                  {ETIQUETAS_GRUPO[g]}
                </th>
              ))}
              <th className="py-1 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {conAgendas.map((d) => (
              <tr key={d.dia}>
                <td className="py-1">{formatearDiaCorto(d.dia)}</td>
                {GRUPOS_CANAL.map((g) => (
                  <td key={g} className="py-1 text-right">
                    {formatearEntero(d[g])}
                  </td>
                ))}
                <td className="py-1 text-right font-medium">{formatearEntero(d.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="tabular w-full text-xs">
          <caption className="sr-only">Agendas por país</caption>
          <thead className="text-muted-foreground text-left">
            <tr>
              <th className="py-1 font-medium">País</th>
              <th className="py-1 text-right font-medium">Agendas</th>
              <th className="py-1 text-right font-medium">%</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {paises.map((p) => (
              <tr key={p.pais}>
                <td className="py-1">{p.pais}</td>
                <td className="py-1 text-right">{formatearEntero(p.cantidad)}</td>
                <td className="py-1 text-right">{porcentaje(p.cantidad, total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
