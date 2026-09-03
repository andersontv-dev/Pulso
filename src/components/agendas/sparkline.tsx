import type { DiaPrograma } from '@/lib/contracts/agendas';
import { formatearDiaCorto } from '@/lib/formato';

/**
 * Mini-gráfica de barras de una fila.
 *
 * SVG a mano y no Recharts: dieciocho instancias de una librería de gráficas en
 * una tabla es peso y trabajo de render que no hace falta para dibujar unas
 * barras. Todas las filas usan el mismo color; la identidad del programa la da
 * su etiqueta, no el tono (docs/brand.md §4).
 */
export function Sparkline({
  dias,
  maximo,
  nombrePrograma,
}: {
  dias: DiaPrograma[];
  maximo: number;
  nombrePrograma: string;
}) {
  if (dias.length === 0) return null;

  const alto = 28;
  const anchoBarra = 4;
  const separacion = 2; // el espaciador de 2px que separa marcas contiguas
  const ancho = dias.length * (anchoBarra + separacion) - separacion;
  const escala = maximo > 0 ? alto / maximo : 0;

  const pico = dias.reduce((a, b) => (b.agendas > a.agendas ? b : a), dias[0]);

  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      width={ancho}
      height={alto}
      role="img"
      aria-label={`Evolución diaria de ${nombrePrograma}. Máximo ${pico.agendas} el ${formatearDiaCorto(pico.fecha)}.`}
      className="overflow-visible"
      preserveAspectRatio="none"
    >
      {dias.map((dia, i) => {
        const altura = Math.max(dia.agendas * escala, dia.agendas > 0 ? 2 : 1);
        return (
          <rect
            key={dia.fecha}
            x={i * (anchoBarra + separacion)}
            y={alto - altura}
            width={anchoBarra}
            height={altura}
            rx={1.5}
            fill={dia.agendas > 0 ? 'var(--chart-mark)' : 'var(--chart-grid)'}
          />
        );
      })}
    </svg>
  );
}
