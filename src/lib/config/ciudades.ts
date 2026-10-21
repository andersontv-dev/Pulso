/**
 * Ciudades donde 30X hace eventos presenciales, con su país.
 *
 * La ciudad no viene en un campo propio: sale de la respuesta de "edición"
 * ("Bogotá · 26 -28 Oct · 2026", o con el programa delante en el formulario
 * del asignador: "Inmersivo Presencial · Bogotá · 26 Oct · 2026") o del
 * título del formulario ("Inmersivo Presencial Miami | Registro | 30X").
 * Reconocerla contra una lista conocida es más robusto que cortar el texto
 * por posición, que ya falló una vez cuando cambió el formato.
 *
 * Una ciudad nueva se añade aquí; hasta entonces sus registros salen como
 * "Sin dato" en el desglose por país, no como un país inventado.
 */
export interface CiudadConocida {
  nombre: string;
  pais: string;
  alias: readonly string[];
}

export const CIUDADES: readonly CiudadConocida[] = [
  { nombre: 'CDMX', pais: 'México', alias: ['cdmx', 'ciudad de mexico', 'mexico city'] },
  { nombre: 'Bogotá', pais: 'Colombia', alias: ['bogota'] },
  { nombre: 'Medellín', pais: 'Colombia', alias: ['medellin'] },
  { nombre: 'Caracas', pais: 'Venezuela', alias: ['caracas'] },
  { nombre: 'Miami', pais: 'Estados Unidos', alias: ['miami'] },
  { nombre: 'Lima', pais: 'Perú', alias: ['lima'] },
  { nombre: 'Madrid', pais: 'España', alias: ['madrid'] },
  { nombre: 'Panamá', pais: 'Panamá', alias: ['ciudad de panama'] },
];

/**
 * Opciones de "¿En qué edición de 30X te gustaría participar?" que se
 * borraron del formulario de Inmersivo Presencial.
 *
 * form30x devuelve el label de una opción leyéndolo de la definición ACTUAL
 * del formulario (docs/api/form30x.md §9.10): si la opción se borra, las
 * respuestas viejas solo traen el id. Con las ediciones ya pasadas eso dejó
 * sin ciudad 339 agendas de un mes. Los labels se tomaron de la definición
 * real leída por la API el 2026-09-29, cuando las cuatro opciones existían.
 *
 * Los ids de opción solo son únicos dentro de su pregunta, así que este mapa
 * se aplica exclusivamente a la pregunta de edición.
 */
export const OPCIONES_EDICION_RETIRADAS: Readonly<Record<string, string>> = {
  iu88hyb: 'CDMX · 05 - 07 Oct · 2026',
  njetcld: 'Caracas · 21 - 23 Oct · 2026',
  kgfybfq: 'Bogotá · 26 -28 Oct · 2026',
  h88134m: 'Miami · 18 -20 Nov · 2026',
};

const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Primera ciudad conocida que aparezca como palabra completa en el texto. */
export function ciudadEnTexto(texto: string | null | undefined): CiudadConocida | null {
  if (!texto) return null;
  const t = ` ${normalizar(texto).replace(/[^a-z0-9]+/g, ' ')} `;
  return CIUDADES.find((c) => c.alias.some((a) => t.includes(` ${a} `))) ?? null;
}

export function paisDeCiudad(ciudad: string | null): string | null {
  if (!ciudad) return null;
  return CIUDADES.find((c) => c.nombre === ciudad)?.pais ?? ciudadEnTexto(ciudad)?.pais ?? null;
}
