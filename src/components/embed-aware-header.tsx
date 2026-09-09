'use client';

import { useSearchParams } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';

/**
 * Embebido bajo bold.30x.com/analytics (?embed=1 en el src del iframe), la
 * página ya tiene el título "Analytics" de Bold arriba — repetir acá el
 * wordmark "Pulso" y la misma leyenda se veía como dos páginas apiladas en
 * vez de una. Fuera de ese contexto (acceso directo a /pulso) el header
 * completo se mantiene.
 */
export function EmbedAwareHeader() {
  const embed = useSearchParams().get('embed') === '1';
  if (embed) return null;

  return (
    <header className="border-border bg-background sticky top-0 z-30 border-b">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight">Pulso</span>
          <span className="text-muted-foreground hidden text-xs font-medium sm:inline">
            30X · Agendas por programa
          </span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
