import type { Registro } from './types';

/**
 * Desglose de agendas por canal y por país, para la vista detallada de
 * Inmersivo Presencial.
 *
 * Los grupos de canal son los tres que el equipo mira (pauta, orgánico y
 * directo) más "otros" (referido y sin etiquetar), que son pocos y no
 * merecen un color propio cada uno. El orden es fijo y es también el de
 * apilado y el de la leyenda: el color sigue al canal, no a su tamaño.
 */
export const GRUPOS_CANAL = ['pauta', 'organico', 'directo', 'otros'] as const;
export type GrupoCanal = (typeof GRUPOS_CANAL)[number];

export const ETIQUETAS_GRUPO: Record<GrupoCanal, string> = {
  pauta: 'Pauta',
  organico: 'Orgánico',
  directo: 'Directo',
  otros: 'Otros',
};

export function grupoDeCanal(canal: string): GrupoCanal {
  return canal === 'pauta' || canal === 'organico' || canal === 'directo' ? canal : 'otros';
}

/**
 * Países con color propio, en el orden fijo del donut. El orden está pensado
 * para que dos tonos parecidos (naranja y ámbar) nunca queden contiguos.
 * Cualquier otro país, y las agendas sin ciudad reconocida, van a "Otros".
 */
export const PAISES_CON_COLOR = ['Colombia', 'México', 'Estados Unidos', 'Venezuela'] as const;
export const OTROS_PAISES = 'Otros / sin dato';

export type ConteoCanal = Record<GrupoCanal, number>;

export interface DiaPorCanal extends ConteoCanal {
  dia: string;
  total: number;
}

export interface CortePais {
  pais: string;
  cantidad: number;
  /** Ciudades dentro del país (o, en "Otros", el país o "Sin ciudad"). */
  detalle: { nombre: string; cantidad: number }[];
}

const vacio = (): ConteoCanal => ({ pauta: 0, organico: 0, directo: 0, otros: 0 });

/** Agendas de cada día del rango, partidas por canal. Incluye los días sin
 *  agendas: un cero es información, no un hueco en la gráfica. */
export function agendasPorDiaYCanal(
  registros: readonly Registro[],
  dias: readonly string[],
): DiaPorCanal[] {
  const porDia = new Map<string, ConteoCanal>(dias.map((d) => [d, vacio()]));
  for (const r of registros) {
    if (!r.agendada) continue;
    const conteo = porDia.get(r.dia);
    if (conteo) conteo[grupoDeCanal(r.canal)] += 1;
  }
  return dias.map((dia) => {
    const c = porDia.get(dia)!;
    return { dia, ...c, total: c.pauta + c.organico + c.directo + c.otros };
  });
}

export function totalesPorCanal(registros: readonly Registro[]): ConteoCanal {
  const total = vacio();
  for (const r of registros) if (r.agendada) total[grupoDeCanal(r.canal)] += 1;
  return total;
}

/** Agendas por país en el orden fijo de PAISES_CON_COLOR, con "Otros" al
 *  final. Los países sin agendas no aparecen. */
export function agendasPorPais(registros: readonly Registro[]): CortePais[] {
  const grupos = new Map<string, Map<string, number>>();
  for (const r of registros) {
    if (!r.agendada) continue;
    const conColor = (PAISES_CON_COLOR as readonly string[]).includes(r.pais ?? '');
    const pais = conColor ? r.pais! : OTROS_PAISES;
    const nombre = conColor ? (r.ciudad ?? 'Sin ciudad') : (r.pais ?? r.ciudad ?? 'Sin ciudad');
    const detalle = grupos.get(pais) ?? new Map<string, number>();
    detalle.set(nombre, (detalle.get(nombre) ?? 0) + 1);
    grupos.set(pais, detalle);
  }
  return [...PAISES_CON_COLOR, OTROS_PAISES]
    .filter((p) => grupos.has(p))
    .map((pais) => {
      const detalle = [...grupos.get(pais)!.entries()]
        .map(([nombre, cantidad]) => ({ nombre, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, 'es'));
      return { pais, cantidad: detalle.reduce((s, d) => s + d.cantidad, 0), detalle };
    });
}
