'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatearHaceCuanto } from '@/lib/formato';

/**
 * "Actualizado hace X" con refresco manual y conmutador de auto-refresco.
 *
 * Un dato viejo etiquetado como viejo es honesto; un dato viejo que aparenta
 * ser fresco es un error de producto. Por eso la frescura es visible siempre,
 * no solo cuando algo falla.
 */
export function IndicadorFrescura({
  generadoEn,
  refrescando,
  autoRefresco,
  refrescoActivo,
  rangoVivo,
  onRefrescar,
  onCambiarAuto,
}: {
  generadoEn: string | undefined;
  refrescando: boolean;
  autoRefresco: boolean;
  refrescoActivo: boolean;
  rangoVivo: boolean;
  onRefrescar: () => void;
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

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
      <span role="status" aria-live="polite" className="tabular">
        {refrescando
          ? 'Actualizando…'
          : generadoEn
            ? `Actualizado ${formatearHaceCuanto(generadoEn)}`
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

      <Button type="button" variant="ghost" size="sm" onClick={onRefrescar} disabled={refrescando}>
        <RefreshCw
          className={refrescando ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'}
          aria-hidden
        />
        Refrescar
      </Button>
    </div>
  );
}
