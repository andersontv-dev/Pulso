'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatearDuracionAprox, formatearHaceCuanto } from '@/lib/formato';

/**
 * Edad de los datos, renovación manual y conmutador de auto-refresco.
 *
 * Un dato viejo etiquetado como viejo es honesto; un dato viejo que aparenta
 * ser fresco es un error de producto. Por eso se muestra la edad de los
 * datos de form30x (precargados cada `cadaMinutos`), no la de la respuesta
 * del servidor, que siempre parecería recién hecha.
 */
export function IndicadorFrescura({
  datosDe,
  generadoEn,
  cadaMinutos,
  estimacionMs,
  alcance,
  cargando,
  actualizando,
  errorActualizar,
  autoRefresco,
  refrescoActivo,
  rangoVivo,
  onActualizarAhora,
  onCambiarAuto,
}: {
  datosDe: string | null | undefined;
  generadoEn: string | undefined;
  cadaMinutos: number | undefined;
  estimacionMs: number | null | undefined;
  /** Nombres de los programas filtrados; vacío o null = todos. */
  alcance: string[] | null;
  cargando: boolean;
  actualizando: boolean;
  errorActualizar: string | null;
  autoRefresco: boolean;
  refrescoActivo: boolean;
  rangoVivo: boolean;
  onActualizarAhora: () => void;
  onCambiarAuto: (valor: boolean) => void;
}) {
  const [, forzarRender] = useState(0);

  // El texto es relativo, así que se vuelve a pintar cada 15 s aunque no
  // lleguen datos nuevos; si no, "hace 5 s" se quedaría congelado.
  useEffect(() => {
    const id = setInterval(() => forzarRender((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const idAuto = 'auto-refresco';
  const edad = datosDe ?? generadoEn;
  const estimacion = estimacionMs ? formatearDuracionAprox(estimacionMs) : null;
  // Con un filtro de programas, "Actualizar ahora" solo descarga esos
  // formularios: se dice cuáles, para que nadie espere ver el resto renovado.
  const nombreAlcance = alcance && alcance.length > 0 ? alcance.join(', ') : null;

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
      <span role="status" aria-live="polite" className="tabular">
        {actualizando
          ? `Descargando ${nombreAlcance ?? 'todos los programas'} de form30x…${
              estimacion ? ` (suele tardar ${estimacion})` : ''
            }`
          : cargando
            ? 'Cargando…'
            : edad
              ? `Datos de form30x de ${formatearHaceCuanto(edad)}${
                  cadaMinutos ? ` · se actualizan solos cada ${cadaMinutos} min` : ''
                }`
              : ''}
      </span>

      <span className="flex items-center gap-1.5">
        <input
          id={idAuto}
          type="checkbox"
          checked={autoRefresco}
          onChange={(e) => onCambiarAuto(e.target.checked)}
          disabled={!rangoVivo}
          className="accent-accent h-3.5 w-3.5"
        />
        <label htmlFor={idAuto} className={rangoVivo ? '' : 'opacity-60'}>
          Auto-refresco
        </label>
      </span>

      {/* Un rango histórico no cambia: refrescarlo sería tráfico regalado
          (ADR 0001). Se dice, en vez de dejar el conmutador inerte sin
          explicación. */}
      {!rangoVivo ? <span>· Rango histórico, no cambia</span> : null}
      {rangoVivo && autoRefresco && !refrescoActivo ? (
        <span className="text-destructive">· Pausado tras varios fallos</span>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onActualizarAhora}
        disabled={actualizando || cargando}
        title={
          nombreAlcance
            ? `Vuelve a descargar de form30x solo los formularios de ${nombreAlcance}`
            : 'Vuelve a descargar de form30x los formularios de todos los programas'
        }
      >
        <RefreshCw
          className={actualizando ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'}
          aria-hidden
        />
        {actualizando
          ? 'Actualizando…'
          : `Actualizar ${nombreAlcance ?? 'ahora'}${estimacion ? ` · ${estimacion}` : ''}`}
      </Button>

      {errorActualizar ? (
        <span className="text-destructive">
          · No se pudo actualizar ({errorActualizar}). Se muestran los datos anteriores.
        </span>
      ) : null}
    </div>
  );
}
