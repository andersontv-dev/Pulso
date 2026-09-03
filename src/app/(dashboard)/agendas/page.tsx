import { Suspense } from 'react';
import { getEnv } from '@/lib/config/env';
import { Dashboard } from '@/components/agendas/dashboard';
import { EstadoCargando } from '@/components/agendas/estados';

/**
 * El dashboard lee los filtros de la URL con useSearchParams, así que necesita
 * un límite de Suspense: Next prerenderiza el armazón de esta página y los
 * parámetros de búsqueda solo se conocen en la petición real. El fallback es
 * el mismo esqueleto de carga, de modo que el HTML estático ya muestra la
 * forma final en vez de una pantalla en blanco.
 */
export default function AgendasPage() {
  // La configuración se lee en servidor y baja como props: el cliente necesita
  // el huso y el intervalo, pero nunca la API key.
  const env = getEnv();

  return (
    <Suspense fallback={<EstadoCargando />}>
      <Dashboard timezone={env.PULSO_TIMEZONE} intervaloMs={env.PULSO_POLL_INTERVAL_MS} />
    </Suspense>
  );
}
