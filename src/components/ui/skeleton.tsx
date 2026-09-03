import { cn } from '@/lib/utils';

/** Bloque de carga. `aria-hidden` porque el estado de carga se anuncia una
 *  sola vez en la región viva del contenedor, no una vez por bloque. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div aria-hidden className={cn('bg-muted animate-pulse rounded-md', className)} {...props} />
  );
}
