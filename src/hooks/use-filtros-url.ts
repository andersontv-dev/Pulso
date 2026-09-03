'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { esClaveValida, ordenarRango, rangoDePreset, type RangoDias } from '@/lib/date/rangos';

/**
 * Filtros sincronizados con la URL.
 *
 * Que el estado viva en la URL hace que una vista concreta —un rango y unos
 * programas— se pueda pegar en un mensaje y que el botón atrás funcione. En
 * una herramienta de reportería que se comparte en el equipo, eso vale más
 * que guardarlo en un estado local.
 */
export interface Filtros {
  rango: RangoDias;
  programas: string[];
}

export function useFiltrosUrl(timezone: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filtros = useMemo<Filtros>(() => {
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');
    const rango =
      desde && hasta && esClaveValida(desde) && esClaveValida(hasta)
        ? ordenarRango({ desde, hasta })
        : rangoDePreset('ultimos7', timezone);

    const programas = (searchParams.get('programas') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    return { rango, programas };
  }, [searchParams, timezone]);

  const actualizar = useCallback(
    (siguiente: Partial<Filtros>) => {
      const params = new URLSearchParams(searchParams.toString());
      const rango = siguiente.rango ?? filtros.rango;
      params.set('desde', rango.desde);
      params.set('hasta', rango.hasta);

      const programas = siguiente.programas ?? filtros.programas;
      if (programas.length > 0) params.set('programas', programas.join(','));
      else params.delete('programas');

      // `replace` y no `push`: cambiar un filtro no debería llenar el
      // historial de entradas por las que nadie quiere volver atrás.
      //
      // El cast es el escape correcto de `typedRoutes`: una query string
      // construida en runtime no es verificable estáticamente. Se acota al
      // tipo que espera el router en vez de usar `any`.
      const destino = `${pathname}?${params}` as Parameters<typeof router.replace>[0];
      router.replace(destino, { scroll: false });
    },
    [filtros, pathname, router, searchParams],
  );

  return { filtros, actualizar };
}
