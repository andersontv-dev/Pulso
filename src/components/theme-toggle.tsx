'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Nunca emite cambios: solo distingue servidor de cliente ya hidratado. */
const subscribeNever = () => () => {};

const OPTIONS = [
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Oscuro', Icon: Moon },
  { value: 'system', label: 'Sistema', Icon: Monitor },
] as const;

/**
 * Selector de tema con los tres estados reales de next-themes.
 *
 * Se implementa como un radiogroup y no como un botón que cicla: con tres
 * opciones, un botón cíclico obliga a adivinar en qué estado estás y no se
 * puede anunciar bien a un lector de pantalla.
 *
 * La preferencia persiste en localStorage (lo hace next-themes) y el script
 * que inyecta en <head> la aplica antes del primer pintado, así que no hay
 * parpadeo al recargar.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  // El tema persistido solo se conoce en el cliente, así que marcar la opción
  // activa durante el render de servidor provocaría un desajuste de
  // hidratación. useSyncExternalStore devuelve false en servidor y true tras
  // hidratar, sin necesidad de escribir estado dentro de un efecto.
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  return (
    <div
      role="radiogroup"
      aria-label="Tema de la interfaz"
      className="border-border bg-muted inline-flex items-center gap-0.5 rounded-md border p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-sm transition-colors',
              'hover:bg-background/70 text-muted-foreground',
              selected && 'bg-accent text-accent-foreground border-accent-ring border',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
