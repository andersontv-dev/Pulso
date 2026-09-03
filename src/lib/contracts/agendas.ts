import type { DiaPrograma, Kpis, SeriePrograma } from '@/lib/domain/types';
import type { RangoDias } from '@/lib/date/rangos';

/**
 * Contrato entre el servidor y el navegador.
 *
 * Es la única forma en que la interfaz ve los datos: series ya agregadas,
 * nunca respuestas crudas. Está en su propio módulo, sin dependencias de
 * transporte, para que lo puedan importar los dos lados.
 */

export interface ProgramaDisponible {
  id: string;
  nombre: string;
  rama: string | null;
  /** Formularios que alimentan este programa. Útil para diagnosticar por qué
   *  un programa no tiene datos. */
  formularios: { id: string; title: string }[];
}

/**
 * Aviso sobre la calidad de los datos devueltos.
 *
 * Existe para cumplir la promesa del ADR 0003: si algo no se pudo interpretar
 * o si faltan datos, se dice. Un total silenciosamente incompleto es peor que
 * un total con una advertencia al lado.
 */
export interface Aviso {
  tipo: 'truncado' | 'no-reconocido' | 'descartadas' | 'sin-programa';
  mensaje: string;
  cantidad: number;
}

export interface AgendasResponse {
  rango: RangoDias;
  rangoPrevio: RangoDias;
  timezone: string;
  /** Instante en que el servidor calculó estos datos. Alimenta el
   *  "actualizado hace X" de la interfaz. */
  generadoEn: string;
  /** `true` si viene de caché: útil para depurar la frescura. */
  desdeCache: boolean;
  dias: string[];
  kpis: Kpis;
  series: SeriePrograma[];
  totalPorDia: DiaPrograma[];
  programasDisponibles: ProgramaDisponible[];
  avisos: Aviso[];
}

export interface ErrorResponse {
  error: {
    codigo: string;
    mensaje: string;
  };
}

export type { DiaPrograma, Kpis, SeriePrograma, RangoDias };
