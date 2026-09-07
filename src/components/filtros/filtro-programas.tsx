'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ProgramaDisponible } from '@/lib/contracts/agendas';

interface Props {
  disponibles: ProgramaDisponible[];
  seleccionados: string[];
  onCambio: (programas: string[]) => void;
  cargando?: boolean;
}

/**
 * Multi-selección de programas.
 *
 * La lista vacía significa "todos", no "ninguno": es lo que espera quien abre
 * el dashboard sin tocar nada, y evita el estado inútil de un dashboard sin
 * ninguna serie.
 */
export function FiltroProgramas({ disponibles, seleccionados, onCambio, cargando }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState('');
  const todos = seleccionados.length === 0;

  // Con dieciséis programas, buscar por nombre es más rápido que recorrer la
  // lista con la vista.
  const listados = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return disponibles;
    return disponibles.filter(
      (p) => p.nombre.toLowerCase().includes(q) || (p.rama ?? '').toLowerCase().includes(q),
    );
  }, [disponibles, filtro]);

  const etiqueta = todos
    ? `Todos los programas${disponibles.length ? ` (${disponibles.length})` : ''}`
    : seleccionados.length === 1
      ? (disponibles.find((p) => p.id === seleccionados[0])?.nombre ?? '1 programa')
      : `${seleccionados.length} programas`;

  function alternar(id: string, marcado: boolean) {
    // Al tocar el primer programa se parte de "todos", que es el estado que
    // el usuario está viendo en pantalla.
    const base = todos ? disponibles.map((p) => p.id) : seleccionados;
    const siguiente = marcado ? [...new Set([...base, id])] : base.filter((p) => p !== id);
    onCambio(siguiente.length === disponibles.length ? [] : siguiente);
  }

  /**
   * Deja seleccionado únicamente ese programa.
   *
   * Sin esto, ver un solo programa exigía destildar los otros quince a mano.
   * Las casillas sirven para ajustar una selección; "Solo" sirve para el caso
   * más frecuente, que es mirar uno.
   */
  function soloEste(id: string) {
    onCambio(disponibles.length === 1 ? [] : [id]);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id="etiqueta-programas" className="text-muted-foreground text-xs font-medium">
        Programa
      </span>

      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={cargando || disponibles.length === 0}
            // El nombre accesible lleva el propósito y el valor. Con solo
            // aria-labelledby apuntando a "Programa", un lector de pantalla
            // no anunciaría qué está seleccionado.
            aria-label={`Programa. ${cargando ? 'Cargando' : etiqueta}`}
            className="justify-between sm:min-w-56"
          >
            <span className="truncate">{cargando ? 'Cargando…' : etiqueta}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="max-h-[min(60vh,26rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto p-2">
          <div className="mb-2 space-y-2 border-b pb-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold">Programas</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onCambio([])}
                disabled={todos}
              >
                Seleccionar todos
              </Button>
            </div>

            <div className="relative">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2"
                aria-hidden
              />
              <input
                type="search"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar programa…"
                aria-label="Buscar programa"
                className="border-input bg-background h-8 w-full rounded-md border pr-2 pl-8 text-sm"
              />
            </div>
          </div>

          {listados.length === 0 ? (
            <p className="text-muted-foreground p-2 text-xs">Ningún programa coincide.</p>
          ) : null}

          <ul className="flex flex-col">
            {listados.map((programa) => {
              const marcado = todos || seleccionados.includes(programa.id);
              const idCasilla = `programa-${programa.id}`;
              return (
                <li key={programa.id} className="hover:bg-muted group flex items-start rounded-md">
                  <label
                    htmlFor={idCasilla}
                    className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 p-2"
                  >
                    <Checkbox
                      id={idCasilla}
                      checked={marcado}
                      onCheckedChange={(v) => alternar(programa.id, v === true)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-tight">{programa.nombre}</span>
                      <span className="text-muted-foreground block text-xs">
                        {programa.rama ?? 'Sin rama'} ·{' '}
                        {programa.formularios.length === 1
                          ? '1 formulario'
                          : `${programa.formularios.length} formularios`}
                      </span>
                    </span>
                  </label>

                  {/* El atajo para el caso frecuente: mirar un programa a solas
                      sin tener que destildar todos los demás. */}
                  <button
                    type="button"
                    onClick={() => soloEste(programa.id)}
                    aria-label={`Ver solo ${programa.nombre}`}
                    className="text-muted-foreground hover:text-accent-foreground hover:bg-accent hover:border-accent-ring my-2 mr-2 shrink-0 rounded border border-transparent px-2 py-1 text-xs font-medium"
                  >
                    Solo
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}
