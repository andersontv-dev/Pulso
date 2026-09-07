import type { Registro, SeriePrograma } from './types';

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
  return `\ufeff${filas.join('\r\n')}\r\n`;
}

/**
 * CSV de registros: una fila por respuesta, con todo lo que se sabe de ella.
 *
 * Las columnas fijas cubren identificación, embudo y atribución. Después se
 * añade **una columna por cada pregunta distinta** que aparezca en los
 * registros, de modo que el archivo lleve las respuestas literales y no solo
 * los agregados. Es lo que permite abrirlo en una hoja de cálculo y cruzar lo
 * que haga falta sin volver a pedir nada.
 */
export function generarCsvRegistros(registros: readonly Registro[], timezone: string): string {
  // Las preguntas se recogen en orden de aparición: así las columnas siguen
  // el orden del formulario en vez de salir alfabéticas.
  const preguntas: string[] = [];
  const vistas = new Set<string>();
  for (const r of registros) {
    for (const { pregunta } of r.respuestas) {
      if (!vistas.has(pregunta)) {
        vistas.add(pregunta);
        preguntas.push(pregunta);
      }
    }
  }

  const cabecera = [
    `fecha (${timezone})`,
    'hora',
    'programa',
    'formulario',
    'estado',
    'llego_a_calendly',
    'agendada',
    'email',
    'nombre',
    'telefono',
    'empresa',
    'canal',
    'fuente',
    'campana',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'score',
    'tags',
    'id_respuesta',
    ...preguntas,
  ];

  const filas = [cabecera.map(escaparCelda).join(',')];

  for (const r of registros) {
    const porPregunta = new Map(r.respuestas.map((x) => [x.pregunta, x.valor]));
    filas.push(
      [
        r.dia,
        r.submittedAt.slice(11, 16),
        r.programaNombre,
        r.formTitle,
        r.estado,
        r.llegoACalendly ? 'si' : 'no',
        r.agendada ? 'si' : 'no',
        r.email ?? '',
        r.nombre ?? '',
        r.telefono ?? '',
        r.empresa ?? '',
        r.canal,
        r.fuente,
        r.campana ?? '',
        r.utm.utm_source ?? '',
        r.utm.utm_medium ?? '',
        r.utm.utm_campaign ?? '',
        r.utm.utm_content ?? '',
        r.utm.utm_term ?? '',
        r.score ?? '',
        r.tags.join(' | '),
        r.id,
        ...preguntas.map((p) => porPregunta.get(p) ?? ''),
      ]
        .map(escaparCelda)
        .join(','),
    );
  }

  return `\ufeff${filas.join('\r\n')}\r\n`;
}

/** Nombre de archivo con el rango dentro, para que varias exportaciones no se
 *  pisen en la carpeta de descargas. */
export function nombreArchivoCsv(
  desde: string,
  hasta: string,
  tipo: 'agendas' | 'registros' = 'agendas',
): string {
  const rango = desde === hasta ? desde : `${desde}_a_${hasta}`;
  return `pulso-${tipo}-${rango}.csv`;
}
