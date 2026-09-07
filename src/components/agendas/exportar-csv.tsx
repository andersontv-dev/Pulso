'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generarCsv, generarCsvRegistros, nombreArchivoCsv } from '@/lib/domain/csv';
import type { AgendasResponse } from '@/lib/contracts/agendas';

function descargar(contenido: string, nombre: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

/**
 * Exporta la vista actual a CSV, en dos formatos.
 *
 * Se genera en el navegador con los datos ya cargados: sin segunda petición y
 * sin volver a agregar nada en el servidor, así que lo que se descarga es
 * exactamente lo que está en pantalla.
 */
export function ExportarCsv({ datos }: { datos: AgendasResponse }) {
  const [anunciado, setAnunciado] = useState('');

  const exportarRegistros = () => {
    const nombre = nombreArchivoCsv(datos.rango.desde, datos.rango.hasta, 'registros');
    descargar(generarCsvRegistros(datos.registros, datos.timezone), nombre);
    setAnunciado(`Archivo ${nombre} descargado con ${datos.registros.length} registros.`);
  };

  const exportarAgendas = () => {
    const nombre = nombreArchivoCsv(datos.rango.desde, datos.rango.hasta, 'agendas');
    descargar(
      generarCsv({ series: datos.series, dias: datos.dias, timezone: datos.timezone }),
      nombre,
    );
    setAnunciado(`Archivo ${nombre} descargado.`);
  };

  return (
    <>
      <Button
        type="button"
        variant="accent"
        size="sm"
        onClick={exportarRegistros}
        disabled={datos.registros.length === 0}
        title="Una fila por respuesta, con contacto, embudo, atribución y todas las preguntas"
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        Exportar todo
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={exportarAgendas}
        disabled={datos.series.length === 0}
        title="Agendas por día y programa, en formato largo"
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        Solo agendas
      </Button>

      {/* La descarga no produce ningún cambio visible; sin esto, quien use un
          lector de pantalla no sabe que el botón hizo algo. */}
      <span role="status" aria-live="polite" className="sr-only">
        {anunciado}
      </span>
    </>
  );
}
