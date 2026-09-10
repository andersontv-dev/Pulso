import type { Agenda, DiaPrograma, Kpis } from './types';

/** El día y el instante hasta el que cuenta, para acotar el periodo
 *  anterior a una comparación justa contra un "hoy" parcial. */
export interface CorteComparable {
  dia: string;
  instanteMs: number;
}

/**
 * Filtra las agendas del periodo anterior para que sean comparables con un
 * rango actual que llega hasta hoy (parcial).
 *
 * Sin este corte, el día equivalente del periodo anterior entra completo
 * (24 horas) mientras que hoy solo lleva lo que va del día: la "Variación"
 * sale negativa aunque el ritmo real sea el mismo. `corte` es `null` cuando
 * el rango actual no incluye hoy —un rango histórico ya está completo por
 * los dos lados y no necesita acotarse.
 */
export function agendasComparables(
  agendas: readonly Agenda[],
  corte: CorteComparable | null,
): Agenda[] {
  if (!corte) return [...agendas];
  return agendas.filter(
    (a) => a.dia !== corte.dia || new Date(a.bookedAt).getTime() <= corte.instanteMs,
  );
}

/**
 * Calcula los KPIs de la cabecera a partir del agregado diario.
 *
 * `dias` debe incluir los días vacíos del rango: el promedio diario y el peor
 * día solo son correctos si los ceros están presentes.
 */
export function calcularKpis(
  dias: readonly DiaPrograma[],
  diasPrevios: readonly DiaPrograma[] = [],
): Kpis {
  const total = sumar(dias);
  const totalPrevio = sumar(diasPrevios);

  return {
    total,
    totalPrevio,
    variacionPct: variacion(total, totalPrevio),
    promedioDiario: dias.length > 0 ? total / dias.length : 0,
    mejorDia: extremo(dias, 'mejor'),
    peorDia: extremo(dias, 'peor'),
  };
}

function sumar(dias: readonly DiaPrograma[]): number {
  return dias.reduce((suma, dia) => suma + dia.agendas, 0);
}

/**
 * Variación porcentual contra el periodo anterior.
 *
 * Devuelve `null` cuando el periodo anterior fue cero. No es un caso raro
 * —pasa con cualquier programa nuevo— y es el error clásico de los
 * dashboards: dividir entre cero y mostrar 0%, "∞%" o "NaN%". Sin base de
 * comparación no hay variación, y la interfaz lo dice con esas palabras.
 */
export function variacion(actual: number, previo: number): number | null {
  if (previo === 0) return null;
  return ((actual - previo) / previo) * 100;
}

/**
 * Mejor y peor día del rango.
 *
 * Ante empate gana el día más antiguo, para que el resultado sea
 * determinista y no cambie de un refresco a otro.
 */
function extremo(dias: readonly DiaPrograma[], cual: 'mejor' | 'peor'): DiaPrograma | null {
  if (dias.length === 0) return null;
  return dias.reduce((elegido, candidato) =>
    cual === 'mejor'
      ? candidato.agendas > elegido.agendas
        ? candidato
        : elegido
      : candidato.agendas < elegido.agendas
        ? candidato
        : elegido,
  );
}
