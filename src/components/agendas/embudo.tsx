'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Embudo } from '@/lib/contracts/agendas';
import { formatearDecimal, formatearEntero } from '@/lib/formato';
import { cn } from '@/lib/utils';

const porcentaje = (v: number | null) => (v === null ? '—' : `${formatearDecimal(v)}%`);

/**
 * Embudo de conversión.
 *
 * Las barras son proporcionales a la primera etapa, así que la caída se ve
 * antes de leer un solo número. La última etapa lleva el acento porque es la
 * que importa; las demás son neutras.
 */
export function EmbudoConversion({ embudo }: { embudo: Embudo }) {
  const { iniciadas } = embudo;

  const etapas = [
    {
      clave: 'iniciadas',
      titulo: 'Iniciaron el formulario',
      valor: iniciadas,
      nota: 'Empezaron a responder',
      tasa: null as number | null,
      pie: null as string | null,
    },
    {
      clave: 'completadas',
      titulo: 'Completaron',
      valor: embudo.completadas,
      nota: 'Llegaron al final',
      tasa: embudo.tasaCompletado,
      pie: 'de quienes iniciaron',
    },
    {
      clave: 'calendly',
      titulo: 'Llegaron a la llamada',
      valor: embudo.llegaronACalendly,
      nota: 'Vieron el paso de agendamiento',
      tasa: iniciadas === 0 ? null : (embudo.llegaronACalendly / iniciadas) * 100,
      pie: 'de quienes iniciaron',
    },
    {
      clave: 'agendadas',
      titulo: 'Agendaron llamada',
      valor: embudo.agendadas,
      nota: 'Booking de Calendly confirmado',
      tasa: embudo.tasaGlobal,
      pie: 'de quienes iniciaron',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="rule-accent">Embudo de conversión</CardTitle>
        <p className="text-muted-foreground text-xs">
          «Iniciaron» son quienes empezaron a responder, no las visitas: form30x guarda la respuesta
          en cuanto alguien escribe algo, y las vistas de página no están disponibles por API.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {etapas.map((etapa, i) => {
          const ancho = iniciadas === 0 ? 0 : (etapa.valor / iniciadas) * 100;
          const ultima = i === etapas.length - 1;
          return (
            <div key={etapa.clave}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{etapa.titulo}</span>
                <span className="tabular flex items-baseline gap-2">
                  <span className="text-base font-bold">{formatearEntero(etapa.valor)}</span>
                  {etapa.tasa !== null ? (
                    <span className="text-muted-foreground text-xs">
                      {porcentaje(etapa.tasa)} {etapa.pie}
                    </span>
                  ) : null}
                </span>
              </div>

              <div
                className="bg-muted mt-1 h-6 w-full overflow-hidden rounded"
                role="img"
                aria-label={`${etapa.titulo}: ${formatearEntero(etapa.valor)}${
                  etapa.tasa !== null ? `, ${porcentaje(etapa.tasa)} ${etapa.pie}` : ''
                }`}
              >
                <div
                  className={cn(
                    'h-full rounded',
                    ultima ? 'bg-accent border-accent-ring border' : 'bg-chart-mark',
                  )}
                  style={{ width: `${Math.max(ancho, etapa.valor > 0 ? 1.5 : 0)}%` }}
                />
              </div>

              <p className="text-muted-foreground mt-0.5 text-xs">{etapa.nota}</p>
            </div>
          );
        })}

        {embudo.completadas > 0 ? (
          <p className="text-muted-foreground border-t pt-3 text-xs">
            De cada 100 que completan el formulario,{' '}
            <span className="text-foreground font-semibold">
              {embudo.tasaAgendaSobreCompletadas === null
                ? '—'
                : formatearDecimal(embudo.tasaAgendaSobreCompletadas)}
            </span>{' '}
            agendan llamada.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
