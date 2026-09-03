'use client';

import { useState } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { es } from 'date-fns/locale';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ETIQUETAS_PRESET,
  PRESETS,
  hoyEnTz,
  rangoDePreset,
  type Preset,
  type RangoDias,
} from '@/lib/date/rangos';
import 'react-day-picker/style.css';

interface Props {
  rango: RangoDias;
  timezone: string;
  onCambio: (rango: RangoDias) => void;
}

/** Convierte una clave YYYY-MM-DD en Date local para el calendario, anclada a
 *  mediodía para que ningún desfase la mueva de día. */
const aFecha = (clave: string) => {
  const [a, m, d] = clave.split('-').map(Number);
  return new Date(a, m - 1, d, 12);
};

const aClave = (fecha: Date) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(
    fecha.getDate(),
  ).padStart(2, '0')}`;

export function FiltroRango({ rango, timezone, onCambio }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [seleccion, setSeleccion] = useState<DateRange | undefined>({
    from: aFecha(rango.desde),
    to: aFecha(rango.hasta),
  });

  const hoy = hoyEnTz(timezone);
  const presetActivo = PRESETS.find((preset) => {
    const candidato = rangoDePreset(preset, timezone);
    return candidato.desde === rango.desde && candidato.hasta === rango.hasta;
  });

  const etiqueta = presetActivo
    ? ETIQUETAS_PRESET[presetActivo]
    : rango.desde === rango.hasta
      ? rango.desde
      : `${rango.desde} → ${rango.hasta}`;

  function aplicarPreset(preset: Preset) {
    const nuevo = rangoDePreset(preset, timezone);
    setSeleccion({ from: aFecha(nuevo.desde), to: aFecha(nuevo.hasta) });
    onCambio(nuevo);
    setAbierto(false);
  }

  function aplicarSeleccion(nueva: DateRange | undefined) {
    setSeleccion(nueva);
    if (!nueva?.from) return;
    const desde = aClave(nueva.from);
    const hasta = nueva.to ? aClave(nueva.to) : desde;
    onCambio({ desde, hasta });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id="etiqueta-rango" className="text-muted-foreground text-xs font-medium">
        Rango de fechas
      </span>

      <div className="flex flex-wrap items-center gap-1.5">
        {/* Los presets van visibles, no escondidos dentro del popover: son el
            90% de los usos y merecen un clic, no tres. */}
        <div role="group" aria-labelledby="etiqueta-rango" className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant={presetActivo === preset ? 'accent' : 'outline'}
              aria-pressed={presetActivo === preset}
              onClick={() => aplicarPreset(preset)}
            >
              {ETIQUETAS_PRESET[preset]}
            </Button>
          ))}
        </div>

        <Popover open={abierto} onOpenChange={setAbierto}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant={presetActivo ? 'outline' : 'accent'}
              aria-label={`Rango personalizado. Seleccionado: ${etiqueta}`}
            >
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              <span className="tabular">{presetActivo ? 'Personalizado' : etiqueta}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto">
            <DayPicker
              mode="range"
              locale={es}
              selected={seleccion}
              onSelect={aplicarSeleccion}
              defaultMonth={aFecha(rango.desde)}
              // El futuro no tiene agendas que reportar.
              disabled={{ after: aFecha(hoy) }}
              numberOfMonths={1}
              showOutsideDays={false}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
