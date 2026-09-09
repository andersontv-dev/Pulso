import { Suspense, type ReactNode } from 'react';
import { EmbedAwareHeader } from '@/components/embed-aware-header';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      {/* useSearchParams (to detect ?embed=1) opts this out of the static
          shell, so it needs its own Suspense boundary — otherwise the page
          can't prerender at all. */}
      <Suspense fallback={null}>
        <EmbedAwareHeader />
      </Suspense>
      <main id="contenido" className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
