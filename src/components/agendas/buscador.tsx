'use client';

import { useMemo, useState } from 'react';
import { CalendarCheck, ChevronRight, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Registro } from '@/lib/contracts/agendas';
import { ETIQUETAS_CANAL, type Canal } from '@/lib/domain/canal';
import { formatearDiaLargo, formatearEntero } from '@/lib/formato';
import { cn } from '@/lib/utils';

/** Cuántos registros se muestran de entrada. Con datos reales la lista puede
 *  tener cientos, y volcarlos todos sepulta el resto del panel. */
const PASO = 15;

/** Cuenta cuántas veces aparece cada correo en el conjunto cargado. */
function contarPorEmail(registros: readonly Registro[]) {
  const mapa = new Map<string, number>();
  for (const r of registros) {
    if (r.email) mapa.set(r.email, (mapa.get(r.email) ?? 0) + 1);
  }
  return mapa;
}

function Detalle({ registro }: { registro: Registro }) {
  const utms = Object.entries(registro.utm);

  return (
    <div className="bg-muted/50 space-y-3 rounded-md p-3 text-xs">
      <div>
        <p className="mb-1 font-semibold">Respuestas</p>
        {registro.respuestas.length === 0 ? (
          <p className="text-muted-foreground">Sin respuestas registradas.</p>
        ) : (
          <dl className="grid gap-1.5 sm:grid-cols-2">
            {registro.respuestas.map((r, i) => (
              <div key={`${r.pregunta}-${i}`} className="bg-background rounded border p-2">
                <dt className="text-muted-foreground">{r.pregunta}</dt>
                <dd className="mt-0.5 font-medium break-words">{r.valor || '—'}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div>
        <p className="mb-1 font-semibold">Atribución</p>
        {utms.length === 0 ? (
          <p className="text-muted-foreground">
            Sin parámetros de campaña: llegó de forma directa.
          </p>
        ) : (
          <dl className="grid gap-1.5 sm:grid-cols-3">
            {utms.map(([k, v]) => (
              <div key={k} className="bg-background rounded border p-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="mt-0.5 font-medium break-all">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <p className="text-muted-foreground border-t pt-2">
        Formulario: {registro.formTitle} · id {registro.id}
        {registro.score !== null ? ` · score ${registro.score}` : ''}
        {registro.tags.length > 0 ? ` · tags: ${registro.tags.join(', ')}` : ''}
      </p>
    </div>
  );
}

export function Buscador({ registros }: { registros: Registro[] }) {
  const [consulta, setConsulta] = useState('');
  const [soloAgendadas, setSoloAgendadas] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [visibles, setVisibles] = useState(PASO);

  const conteos = useMemo(() => contarPorEmail(registros), [registros]);

  const filtrados = useMemo(() => {
    const q = consulta.trim().toLowerCase();
    return registros.filter((r) => {
      if (soloAgendadas && !r.agendada) return false;
      if (q === '') return true;
      // Se busca por correo, nombre, empresa, teléfono, programa y campaña:
      // quien busca rara vez recuerda exactamente por cuál de ellos.
      return [r.email, r.nombre, r.empresa, r.telefono, r.programaNombre, r.campana]
        .filter(Boolean)
        .some((campo) => campo!.toLowerCase().includes(q));
    });
  }, [registros, consulta, soloAgendadas]);

  const mostrados = filtrados.slice(0, visibles);
  const restantes = filtrados.length - mostrados.length;
  const idBusqueda = 'buscador-registros';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="rule-accent">Registros</CardTitle>
        <p className="text-muted-foreground text-xs">
          Busca por correo, nombre, empresa, teléfono, programa o campaña. Despliega una fila para
          ver todas sus respuestas.
        </p>
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-0">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={idBusqueda} className="sr-only">
            Buscar registros
          </label>
          <div className="relative min-w-0 flex-1">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2"
              aria-hidden
            />
            <input
              id={idBusqueda}
              type="search"
              value={consulta}
              onChange={(e) => {
                setConsulta(e.target.value);
                setVisibles(PASO); // una búsqueda nueva empieza por el principio
              }}
              placeholder="correo@ejemplo.com, nombre, empresa…"
              className="border-input bg-background h-9 w-full rounded-md border pr-8 pl-8 text-sm"
            />
            {consulta ? (
              <button
                type="button"
                onClick={() => setConsulta('')}
                aria-label="Limpiar búsqueda"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </div>

          <Button
            type="button"
            size="sm"
            variant={soloAgendadas ? 'accent' : 'outline'}
            aria-pressed={soloAgendadas}
            onClick={() => setSoloAgendadas((v) => !v)}
          >
            <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
            Solo agendadas
          </Button>
        </div>

        <p className="text-muted-foreground text-xs" role="status" aria-live="polite">
          {formatearEntero(filtrados.length)} {filtrados.length === 1 ? 'registro' : 'registros'}
          {restantes > 0 ? ` · mostrando ${mostrados.length}` : ''}
          {consulta ? ` · filtrado por "${consulta}"` : ''}
        </p>

        {mostrados.length === 0 ? (
          <p className="text-muted-foreground py-6 text-sm">
            Ningún registro coincide. Prueba con otro término o amplía el rango de fechas.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {mostrados.map((r) => {
              const veces = r.email ? (conteos.get(r.email) ?? 1) : 1;
              const estaAbierto = abierto === r.id;
              return (
                <li key={r.id} className="py-2">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setAbierto(estaAbierto ? null : r.id)}
                      aria-expanded={estaAbierto}
                      aria-controls={`detalle-registro-${r.id}`}
                      className="hover:bg-muted -m-1 flex min-w-0 flex-1 items-start gap-2 rounded p-1 text-left"
                    >
                      <ChevronRight
                        className={cn(
                          'text-muted-foreground mt-0.5 h-4 w-4 shrink-0 transition-transform',
                          estaAbierto && 'rotate-90',
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate text-sm font-medium">
                            {r.email ?? r.nombre ?? '(sin correo)'}
                          </span>
                          {veces > 1 ? (
                            <Badge
                              variant="accent"
                              title="Veces que este correo aparece en el periodo"
                            >
                              ×{veces}
                            </Badge>
                          ) : null}
                          {r.agendada ? (
                            <Badge variant="positive">Agendó</Badge>
                          ) : r.estado === 'completada' ? (
                            <Badge>Completó</Badge>
                          ) : (
                            <Badge>Parcial</Badge>
                          )}
                        </span>
                        <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                          {r.programaNombre} · {ETIQUETAS_CANAL[r.canal as Canal] ?? r.canal}
                          {r.fuente !== 'sin fuente' ? ` (${r.fuente})` : ''} ·{' '}
                          {formatearDiaLargo(r.dia)}
                        </span>
                      </span>
                    </button>
                  </div>

                  {estaAbierto ? (
                    <div id={`detalle-registro-${r.id}`} className="mt-2">
                      <Detalle registro={r} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {restantes > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setVisibles((v) => v + PASO * 2)}
          >
            Ver {Math.min(restantes, PASO * 2)} más de {formatearEntero(restantes)} restantes
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
