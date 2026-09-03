'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generarCsv, nombreArchivoCsv } from '@/lib/domain/csv';
import type { AgendasResponse } from '@/lib/contracts/agendas';

/**
 * Exporta la vista actual a CSV.
 *
 * Se genera en el navegador con los datos ya cargados: no hace falta una
 * segunda petición ni volver a agregar nada en el servidor, y lo que se
 * descarga es exactamente lo que está en pantalla.
 */
export function ExportarCsv({ datos }: { datos: AgendasResponse }) {
  const [anunciado, setAnunciado] = useState('');
  const vacio = datos.series.length === 0 || datos.dias.length === 0;

  function descargar() {
    const csv = generarCsv({
      series: datos.series,
      dias: datos.dias,
      timezone: datos.timezone,
    });
    const nombre = nombreArchivoCsv(datos.rango.desde, datos.rango.hasta);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));

    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.click();
    URL.revokeObjectURL(url);

    setAnunciado(`Archivo ${nombre} descargado.`);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={descargar} disabled={vacio}>
        <Download className="h-3.5 w-3.5" aria-hidden />
        Exportar CSV
      </Button>
      {/* La descarga no produce ningún cambio visible; sin esto, quien use un
          lector de pantalla no sabe que el botón hizo algo. */}
      <span role="status" aria-live="polite" className="sr-only">
        {anunciado}
      </span>
    </>
  );
}
