'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme-provider';

export function Providers({ children }: { children: ReactNode }) {
  // El QueryClient se crea dentro del componente para que cada render de
  // servidor tenga el suyo y no se filtre caché entre peticiones.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Los datos se consideran frescos un tercio del intervalo de
            // polling: evita refetches redundantes al montar componentes.
            staleTime: 20_000,
            refetchOnWindowFocus: true,
            // La API no publica rate limit (docs/api/form30x.md §9), así que
            // el cliente reintenta poco y con backoff.
            retry: 2,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
