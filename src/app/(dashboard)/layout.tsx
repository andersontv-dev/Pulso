import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
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
      <main id="contenido" className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
