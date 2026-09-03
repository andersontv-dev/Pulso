import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';

const numero = new Intl.NumberFormat('es-CO');
const decimal = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

export const formatearEntero = (valor: number) => numero.format(valor);
export const formatearDecimal = (valor: number) => decimal.format(valor);

/** Variación con signo explícito. El signo importa tanto como el número. */
export function formatearVariacion(pct: number | null): string {
  if (pct === null) return 'Sin base';
  const signo = pct > 0 ? '+' : '';
  return `${signo}${decimal.format(pct)}%`;
}

const aDate = (clave: string) => parse(clave, 'yyyy-MM-dd', new Date());

/** "10 mar" — corto para ejes y tarjetas. */
export const formatearDiaCorto = (clave: string) => format(aDate(clave), 'd MMM', { locale: es });

/** "martes, 10 de marzo de 2026" — para lectores de pantalla y tooltips. */
export const formatearDiaLargo = (clave: string) =>
  format(aDate(clave), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });

export function formatearHaceCuanto(iso: string, ahora: number = Date.now()): string {
  const segundos = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 1000));
  if (segundos < 10) return 'ahora mismo';
  if (segundos < 60) return `hace ${segundos} s`;
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  return horas < 24 ? `hace ${horas} h` : `hace ${Math.round(horas / 24)} d`;
}
