import type {
  CorteEmbudo,
  DiaPrograma,
  Embudo,
  Kpis,
  Registro,
  SeriePrograma,
} from '@/lib/domain/types';
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
  tipo:
    | 'truncado'
    | 'no-reconocido'
    | 'descartadas'
    | 'sin-programa'
    | 'sin-calendly'
    | 'coste'
    | 'cobertura';
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
  /**
   * Día a partir del cual los datos son fiables, o `null` si todo el rango
   * pedido (y el anterior) está cubierto.
   *
   * La API topa en 200 respuestas por formulario, así que de los de mucho
   * volumen solo se ve una ventana reciente. Este campo es lo que permite a
   * la interfaz distinguir «ese día no hubo agendas» de «ese día no lo
   * podemos ver», que son cosas muy distintas.
   */
  coberturaDesde: string | null;
  kpis: Kpis;
  /** Embudo del rango: iniciadas → completadas → llegaron a Calendly →
   *  agendadas. Ver la nota sobre "iniciadas" en domain/embudo.ts. */
  embudo: Embudo;
  /** Cortes del embudo por dimensión, ya ordenados por volumen. */
  porCanal: CorteEmbudo[];
  porFuente: CorteEmbudo[];
  porCampana: CorteEmbudo[];
  porPrograma: CorteEmbudo[];
  /**
   * Registros del rango, uno por respuesta.
   *
   * Van al navegador para que la búsqueda por correo, la vista de detalle y
   * el export funcionen sin más viajes al servidor. Están acotados por el
   * rango de fechas, así que su tamaño lo controla el propio filtro.
   */
  registros: Registro[];
  /** Correos que aparecen más de una vez, con en qué programas. */
  repetidos: { email: string; veces: number; programas: string[] }[];
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

export type { CorteEmbudo, DiaPrograma, Embudo, Kpis, Registro, SeriePrograma, RangoDias };
