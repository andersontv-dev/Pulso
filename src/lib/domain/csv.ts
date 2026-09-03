import type { SeriePrograma } from './types';

/**
 * Caracteres que convierten una celda en fórmula al abrir el CSV en Excel,
 * Google Sheets o LibreOffice.
 *
 * Un nombre de formulario viene de datos que edita cualquiera del equipo en
 * form30x. Si alguien nombra un formulario `=HYPERLINK(...)`, sin este
 * saneado el CSV exportado ejecutaría eso en la máquina de quien lo abra.
 */
const PELIGROSOS = ['=', '+', '-', '@', '\t', '\r'];

function escaparCelda(valor: string | number): string {
  let texto = String(valor);

  // Se antepone una comilla simple para neutralizar la fórmula sin perder el
  // texto original a la vista.
  if (texto.length > 0 && PELIGROSOS.includes(texto[0])) {
    texto = `'${texto}`;
  }

  if (/[",\n\r]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

export interface OpcionesCsv {
  series: readonly SeriePrograma[];
  dias: readonly string[];
  timezone: string;
}

/**
 * Genera el CSV del desglose diario: una fila por (día, programa).
 *
 * Formato largo y no tabla cruzada, porque es el que las tablas dinámicas y
 * cualquier herramienta de análisis consumen sin retoques.
 *
 * El huso horario viaja en el nombre de la columna de fecha en vez de en una
 * línea de comentario: así el archivo sigue siendo CSV válido para cualquier
 * parser y nadie interpreta las fechas como UTC.
 */
export function generarCsv({ series, dias, timezone }: OpcionesCsv): string {
  const cabecera = [`fecha (${timezone})`, 'programa', 'rama', 'agendas'];
  const filas: string[] = [cabecera.map(escaparCelda).join(',')];

  // Se indexa cada serie una vez en lugar de buscar la fecha dentro del bucle:
  // con un año de rango y dieciocho programas, la búsqueda lineal anidada
  // ronda el millón de comparaciones.
  const porPrograma = series.map((serie) => ({
    serie,
    porDia: new Map(serie.dias.map((d) => [d.fecha, d.agendas])),
  }));

  for (const dia of dias) {
    for (const { serie, porDia } of porPrograma) {
      filas.push(
        [dia, serie.programaNombre, serie.rama ?? '', porDia.get(dia) ?? 0]
          .map(escaparCelda)
          .join(','),
      );
    }
  }

  // CRLF según RFC 4180, y BOM para que Excel en Windows reconozca UTF-8 y no
  // destroce los acentos de "Inmersión Ejecutiva".
  return `﻿${filas.join('\r\n')}\r\n`;
}

/** Nombre de archivo con el rango dentro, para que varias exportaciones no se
 *  pisen en la carpeta de descargas. */
export function nombreArchivoCsv(desde: string, hasta: string): string {
  return desde === hasta ? `pulso-agendas-${desde}.csv` : `pulso-agendas-${desde}_a_${hasta}.csv`;
}
