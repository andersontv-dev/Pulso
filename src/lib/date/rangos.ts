import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

/**
 * Rangos de fecha en el huso de negocio (ADR 0004).
 *
 * Un rango se expresa como dos claves de día `YYYY-MM-DD`, ambas inclusive,
 * ya resueltas en el huso configurado. Trabajar con claves de día y no con
 * instantes elimina toda una clase de errores: una vez construida la clave,
 * nada más abajo puede reinterpretarla en otro huso.
 */
export interface RangoDias {
  /** YYYY-MM-DD inclusive. */
  desde: string;
  /** YYYY-MM-DD inclusive. */
  hasta: string;
}

export const PRESETS = ['hoy', 'ayer', 'ultimos7', 'ultimos30', 'mesActual'] as const;
export type Preset = (typeof PRESETS)[number];

export const ETIQUETAS_PRESET: Record<Preset, string> = {
  hoy: 'Hoy',
  ayer: 'Ayer',
  ultimos7: 'Últimos 7 días',
  ultimos30: 'Últimos 30 días',
  mesActual: 'Mes actual',
};

const CLAVE = /^\d{4}-\d{2}-\d{2}$/;

export function esClaveValida(clave: string): boolean {
  if (!CLAVE.test(clave)) return false;
  const fecha = claveADate(clave);
  return !Number.isNaN(fecha.getTime()) && dateAClave(fecha) === clave;
}

/**
 * Convierte un instante ISO-8601 en su día de negocio.
 *
 * Esta función es la razón de ser del módulo: `2026-03-11T03:30:00Z` es día 11
 * en UTC pero día 10 en Bogotá. Agrupar por los diez primeros caracteres del
 * ISO, que es la tentación evidente, produce conteos corridos.
 */
export function diaDeNegocio(iso: string, tz: string): string {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) {
    throw new RangeError(`Fecha ISO inválida: ${iso}`);
  }
  return format(new TZDate(instante, tz), 'yyyy-MM-dd');
}

/** El día de hoy según el huso de negocio, no según el reloj del servidor. */
export function hoyEnTz(tz: string, ahora: Date = new Date()): string {
  return format(new TZDate(ahora, tz), 'yyyy-MM-dd');
}

/* --------------------------------------------------------------------------
 * Aritmética de claves de día.
 *
 * Se ancla a mediodía UTC para que sumar días nunca cruce un cambio de horario
 * de verano ni un límite de día por un desfase de una hora.
 * ----------------------------------------------------------------------- */

function claveADate(clave: string): Date {
  const [anio, mes, dia] = clave.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia, 12));
}

function dateAClave(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function sumarDias(clave: string, dias: number): string {
  const fecha = claveADate(clave);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return dateAClave(fecha);
}

/** Días entre dos claves. `diferenciaDias('2026-01-01', '2026-01-03')` es 2. */
export function diferenciaDias(desde: string, hasta: string): number {
  const ms = claveADate(hasta).getTime() - claveADate(desde).getTime();
  return Math.round(ms / 86_400_000);
}

/** Número de días que abarca el rango, ambos extremos incluidos. */
export function longitudRango(rango: RangoDias): number {
  return diferenciaDias(rango.desde, rango.hasta) + 1;
}

/** Todas las claves de día del rango, en orden. Incluye los días sin datos:
 *  un día con cero agendas es información, no una ausencia. */
export function diasDelRango(rango: RangoDias): string[] {
  const total = longitudRango(rango);
  if (total <= 0) return [];
  return Array.from({ length: total }, (_, i) => sumarDias(rango.desde, i));
}

/** Normaliza un rango con los extremos invertidos. */
export function ordenarRango(rango: RangoDias): RangoDias {
  return diferenciaDias(rango.desde, rango.hasta) < 0
    ? { desde: rango.hasta, hasta: rango.desde }
    : rango;
}

/**
 * El periodo inmediatamente anterior, de la misma longitud.
 *
 * Es la base de la variación de los KPIs: comparar siete días contra los siete
 * anteriores, no contra un mes.
 */
export function rangoAnterior(rango: RangoDias): RangoDias {
  const longitud = longitudRango(rango);
  return {
    desde: sumarDias(rango.desde, -longitud),
    hasta: sumarDias(rango.desde, -1),
  };
}

export function rangoDePreset(preset: Preset, tz: string, ahora: Date = new Date()): RangoDias {
  const hoy = hoyEnTz(tz, ahora);
  switch (preset) {
    case 'hoy':
      return { desde: hoy, hasta: hoy };
    case 'ayer': {
      const ayer = sumarDias(hoy, -1);
      return { desde: ayer, hasta: ayer };
    }
    case 'ultimos7':
      // Siete días contando hoy, que es lo que la gente espera de "últimos 7".
      return { desde: sumarDias(hoy, -6), hasta: hoy };
    case 'ultimos30':
      return { desde: sumarDias(hoy, -29), hasta: hoy };
    case 'mesActual':
      return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
  }
}

/** ¿El rango llega hasta hoy? Determina si tiene sentido auto-refrescar:
 *  un rango histórico ya no cambia (ADR 0001). */
export function incluyeHoy(rango: RangoDias, tz: string, ahora: Date = new Date()): boolean {
  return rango.hasta >= hoyEnTz(tz, ahora);
}

/**
 * Límites del rango como instantes, para filtrar respuestas por `submittedAt`.
 * `hasta` es exclusivo: es el inicio del día siguiente, lo que evita perder
 * los milisegundos finales del último día.
 */
export function limitesInstantaneos(
  rango: RangoDias,
  tz: string,
): { desde: number; hasta: number } {
  return {
    desde: inicioDeDia(rango.desde, tz),
    hasta: inicioDeDia(sumarDias(rango.hasta, 1), tz),
  };
}

function inicioDeDia(clave: string, tz: string): number {
  const [anio, mes, dia] = clave.split('-').map(Number);
  return new TZDate(anio, mes - 1, dia, 0, 0, 0, 0, tz).getTime();
}
