'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
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
  const todos = seleccionados.length === 0;

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
            aria-labelledby="etiqueta-programas"
            aria-describedby="valor-programas"
            className="justify-between sm:min-w-56"
          >
            <span id="valor-programas" className="truncate">
              {cargando ? 'Cargando…' : etiqueta}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="max-h-[min(60vh,26rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto p-2">
          <div className="mb-2 flex items-center justify-between gap-2 border-b pb-2">
            <span className="text-xs font-semibold">Programas</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onCambio([])}
              disabled={todos}
            >
              Todos
            </Button>
          </div>

          <ul className="flex flex-col">
            {disponibles.map((programa) => {
              const marcado = todos || seleccionados.includes(programa.id);
              const idCasilla = `programa-${programa.id}`;
              return (
                <li key={programa.id}>
                  <label
                    htmlFor={idCasilla}
                    className="hover:bg-muted flex cursor-pointer items-start gap-2.5 rounded-md p-2"
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
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}
