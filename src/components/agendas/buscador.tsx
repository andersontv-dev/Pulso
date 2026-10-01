'use client';

import { useMemo, useState } from 'react';
import { CalendarCheck, ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Registro } from '@/lib/contracts/agendas';
import { ETIQUETAS_CANAL, type Canal } from '@/lib/domain/canal';
import { contenidoDe } from '@/lib/domain/embudo';
import { agruparPorPrograma, formatearResumenProgramas } from '@/lib/domain/resumen-programas';
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

interface OpcionLista {
  valor: string;
  etiqueta: string;
  cantidad: number;
}

/** Agrupa y cuenta, ordenado de mayor a menor aporte. Fuente de las opciones
 *  de cada FiltroLista: siempre se deriva de los datos, nunca de una lista
 *  fija, porque qué fuentes/contenidos existen cambia con el rango y los
 *  programas seleccionados arriba. */
function opcionesDesde(
  registros: readonly Registro[],
  valorDe: (r: Registro) => string,
  etiquetaDe: (valor: string) => string = (v) => v,
): OpcionLista[] {
  const mapa = new Map<string, number>();
  for (const r of registros) {
    const v = valorDe(r);
    mapa.set(v, (mapa.get(v) ?? 0) + 1);
  }
  return [...mapa.entries()]
    .map(([valor, cantidad]) => ({ valor, etiqueta: etiquetaDe(valor), cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.etiqueta.localeCompare(b.etiqueta, 'es'));
}

/**
 * Selección única con buscador, para filtros cuyas opciones vienen de los
 * datos (fuente, contenido) o son pocas pero merecen el mismo patrón que el
 * resto de filtros de la página (canal). Calca FiltroProgramas pero de a uno.
 */
function FiltroLista({
  etiqueta,
  etiquetaTodos,
  opciones,
  seleccionado,
  onCambio,
}: {
  etiqueta: string;
  etiquetaTodos: string;
  opciones: OpcionLista[];
  seleccionado: string | null;
  onCambio: (valor: string | null) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const listadas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return opciones;
    return opciones.filter((o) => o.etiqueta.toLowerCase().includes(q));
  }, [opciones, busqueda]);

  const etiquetaBoton = seleccionado
    ? (opciones.find((o) => o.valor === seleccionado)?.etiqueta ?? seleccionado)
    : etiquetaTodos;

  return (
    <Popover
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) setBusqueda('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={seleccionado ? 'accent' : 'outline'}
          disabled={opciones.length === 0}
          aria-label={`${etiqueta}. ${etiquetaBoton}`}
          className="justify-between"
        >
          <span className="max-w-32 truncate">{etiquetaBoton}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="max-h-[min(60vh,24rem)] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto p-2">
        <div className="mb-2 space-y-2 border-b pb-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">{etiqueta}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                onCambio(null);
                setAbierto(false);
              }}
              disabled={!seleccionado}
            >
              {etiquetaTodos}
            </Button>
          </div>

          {opciones.length > 6 ? (
            <div className="relative">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2"
                aria-hidden
              />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={`Buscar ${etiqueta.toLowerCase()}…`}
                aria-label={`Buscar ${etiqueta.toLowerCase()}`}
                className="border-input bg-background h-8 w-full rounded-md border pr-2 pl-8 text-sm"
              />
            </div>
          ) : null}
        </div>

        {listadas.length === 0 ? (
          <p className="text-muted-foreground p-2 text-xs">Ninguna coincidencia.</p>
        ) : (
          <ul role="radiogroup" aria-label={etiqueta} className="flex flex-col">
            {listadas.map((o) => {
              const marcado = seleccionado === o.valor;
              return (
                <li key={o.valor}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={marcado}
                    onClick={() => {
                      onCambio(marcado ? null : o.valor);
                      setAbierto(false);
                    }}
                    className={cn(
                      'hover:bg-muted flex w-full items-center justify-between gap-2 rounded-md p-2 text-left text-sm',
                      marcado && 'bg-accent/15 font-medium',
                    )}
                  >
                    <span className="min-w-0 truncate">{o.etiqueta}</span>
                    <span className="text-muted-foreground tabular shrink-0 text-xs">
                      {formatearEntero(o.cantidad)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
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
  const [canalFiltro, setCanalFiltro] = useState<string | null>(null);
  const [fuenteFiltro, setFuenteFiltro] = useState<string | null>(null);
  const [contenidoFiltro, setContenidoFiltro] = useState<string | null>(null);
  const [ciudadFiltro, setCiudadFiltro] = useState<string | null>(null);
  const [edicionFiltro, setEdicionFiltro] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [visibles, setVisibles] = useState(PASO);

  const conteos = useMemo(() => contarPorEmail(registros), [registros]);

  // Las opciones de cada filtro se derivan de TODOS los registros del rango,
  // no de lo ya filtrado: así no desaparecen opciones a medida que se afina
  // la búsqueda, que es justo cuando más se las necesita ver.
  const opcionesCanal = useMemo(
    () =>
      opcionesDesde(
        registros,
        (r) => r.canal,
        (v) => ETIQUETAS_CANAL[v as Canal] ?? v,
      ),
    [registros],
  );
  const opcionesFuente = useMemo(() => opcionesDesde(registros, (r) => r.fuente), [registros]);
  const opcionesContenido = useMemo(() => opcionesDesde(registros, contenidoDe), [registros]);
  // A diferencia de canal/fuente/contenido, la ciudad no la responde todo el
  // mundo (solo eventos presenciales): se arma solo con quien la trae, y el
  // filtro ni se muestra cuando ningún registro del rango la tiene.
  const opcionesCiudad = useMemo(
    () =>
      opcionesDesde(
        registros.filter((r) => r.ciudad !== null),
        (r) => r.ciudad!,
      ),
    [registros],
  );
  // Misma lógica que ciudad: edición es más fina (incluye fecha), así que
  // también es opcional y solo se muestra cuando hay algo que filtrar.
  const opcionesEdicion = useMemo(
    () =>
      opcionesDesde(
        registros.filter((r) => r.edicion !== null),
        (r) => r.edicion!,
      ),
    [registros],
  );

  const filtrados = useMemo(() => {
    const q = consulta.trim().toLowerCase();
    return registros.filter((r) => {
      if (soloAgendadas && !r.agendada) return false;
      if (canalFiltro && r.canal !== canalFiltro) return false;
      if (fuenteFiltro && r.fuente !== fuenteFiltro) return false;
      if (contenidoFiltro && contenidoDe(r) !== contenidoFiltro) return false;
      if (ciudadFiltro && r.ciudad !== ciudadFiltro) return false;
      if (edicionFiltro && r.edicion !== edicionFiltro) return false;
      if (q === '') return true;
      // Se busca por correo, nombre, empresa, teléfono, programa y campaña:
      // quien busca rara vez recuerda exactamente por cuál de ellos.
      return [r.email, r.nombre, r.empresa, r.telefono, r.programaNombre, r.campana]
        .filter(Boolean)
        .some((campo) => campo!.toLowerCase().includes(q));
    });
  }, [
    registros,
    consulta,
    soloAgendadas,
    canalFiltro,
    fuenteFiltro,
    contenidoFiltro,
    ciudadFiltro,
    edicionFiltro,
  ]);

  const mostrados = filtrados.slice(0, visibles);
  const restantes = filtrados.length - mostrados.length;
  const idBusqueda = 'buscador-registros';

  const resumenProgramas = useMemo(
    () => formatearResumenProgramas(agruparPorPrograma(filtrados)),
    [filtrados],
  );

  const hayFiltrosActivos =
    consulta !== '' ||
    soloAgendadas ||
    canalFiltro !== null ||
    fuenteFiltro !== null ||
    contenidoFiltro !== null ||
    ciudadFiltro !== null ||
    edicionFiltro !== null;

  function limpiarFiltros() {
    setConsulta('');
    setSoloAgendadas(false);
    setCanalFiltro(null);
    setFuenteFiltro(null);
    setContenidoFiltro(null);
    setCiudadFiltro(null);
    setEdicionFiltro(null);
    setVisibles(PASO);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="rule-accent">Registros</CardTitle>
        <p className="text-muted-foreground text-xs">
          Busca por correo, nombre, empresa, teléfono, programa o campaña, o filtra por canal,
          fuente o contenido. Despliega una fila para ver todas sus respuestas.
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

        {/* Filtros estructurados: afinan por canal (pauta/orgánico…), fuente
            (incluye la cuenta de Instagram concreta) y contenido (post/video),
            combinables entre sí y con la búsqueda de arriba. */}
        <div className="flex flex-wrap items-center gap-2">
          <FiltroLista
            etiqueta="Canal"
            etiquetaTodos="Todos los canales"
            opciones={opcionesCanal}
            seleccionado={canalFiltro}
            onCambio={setCanalFiltro}
          />
          <FiltroLista
            etiqueta="Fuente"
            etiquetaTodos="Todas las fuentes"
            opciones={opcionesFuente}
            seleccionado={fuenteFiltro}
            onCambio={setFuenteFiltro}
          />
          <FiltroLista
            etiqueta="Post / video"
            etiquetaTodos="Todo el contenido"
            opciones={opcionesContenido}
            seleccionado={contenidoFiltro}
            onCambio={setContenidoFiltro}
          />
          {opcionesCiudad.length > 0 ? (
            <FiltroLista
              etiqueta="Ciudad"
              etiquetaTodos="Todas las ciudades"
              opciones={opcionesCiudad}
              seleccionado={ciudadFiltro}
              onCambio={setCiudadFiltro}
            />
          ) : null}
          {opcionesEdicion.length > 0 ? (
            <FiltroLista
              etiqueta="Edición"
              etiquetaTodos="Todas las ediciones"
              opciones={opcionesEdicion}
              seleccionado={edicionFiltro}
              onCambio={setEdicionFiltro}
            />
          ) : null}

          {hayFiltrosActivos ? (
            <Button type="button" size="sm" variant="ghost" onClick={limpiarFiltros}>
              Limpiar filtros
            </Button>
          ) : null}
        </div>

        <div className="space-y-0.5" role="status" aria-live="polite">
          <p className="text-muted-foreground text-xs">
            {formatearEntero(filtrados.length)} {filtrados.length === 1 ? 'registro' : 'registros'}
            {restantes > 0 ? ` · mostrando ${mostrados.length}` : ''}
            {consulta ? ` · filtrado por "${consulta}"` : ''}
          </p>
          {resumenProgramas ? (
            <p className="text-muted-foreground text-xs">{resumenProgramas}</p>
          ) : null}
        </div>

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
