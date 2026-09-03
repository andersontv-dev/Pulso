import type { DiaPrograma, Kpis } from './types';

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
