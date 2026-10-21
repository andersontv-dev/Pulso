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

/** País con color propio, o "Otros / sin dato". Es la clave del filtro por
 *  país: la misma que agrupa el donut. */
export function grupoPais(r: Pick<Registro, 'pais'>): string {
  return (PAISES_CON_COLOR as readonly string[]).includes(r.pais ?? '') ? r.pais! : OTROS_PAISES;
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
    const pais = grupoPais(r);
    const nombre =
      pais !== OTROS_PAISES ? (r.ciudad ?? 'Sin ciudad') : (r.pais ?? r.ciudad ?? 'Sin ciudad');
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

const MESES: Record<string, number> = {
  ene: 1,
  jan: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  aug: 8,
  sep: 9,
  set: 9,
  oct: 10,
  nov: 11,
  dic: 12,
  dec: 12,
};

const dosDigitos = (n: number) => String(n).padStart(2, '0');

/**
 * Fechas del evento a partir del label de la edición, en sus formatos reales:
 * "Bogotá · 26 -28 Oct · 2026", "CDMX · 05 - 07 Oct · 2026" y, en el
 * formulario del asignador, "Inmersivo Presencial · Bogotá · 26 Oct · 2026".
 * `null` si el label no trae día, mes y año reconocibles.
 */
export function fechasDeEdicion(
  edicion: string | null,
): { inicio: string; fin: string; etiqueta: string } | null {
  if (!edicion) return null;
  const m = /(\d{1,2})\s*(?:-\s*(\d{1,2}))?\s+([a-záéíóú]{3})[a-záéíóú]*\.?/i.exec(edicion);
  const anio = /\b(20\d{2})\b/.exec(edicion)?.[1];
  if (!m || !anio) return null;
  const mes = MESES[m[3].toLowerCase()];
  if (!mes) return null;
  const desde = Number(m[1]);
  const hasta = m[2] ? Number(m[2]) : desde;
  const abreviado = m[3].toLowerCase();
  return {
    inicio: `${anio}-${dosDigitos(mes)}-${dosDigitos(desde)}`,
    fin: `${anio}-${dosDigitos(mes)}-${dosDigitos(hasta)}`,
    etiqueta: hasta !== desde ? `${desde}–${hasta} ${abreviado}` : `${desde} ${abreviado}`,
  };
}

export interface EdicionSede {
  /** Clave estable: el inicio del evento, o "sin-edicion". */
  clave: string;
  fechas: { inicio: string; fin: string; etiqueta: string } | null;
  cantidad: number;
}

export interface Sede {
  ciudad: string;
  pais: string | null;
  cantidad: number;
  porCanal: ConteoCanal;
  /** Ediciones de esa ciudad, de la más próxima a la más lejana; las que no
   *  traen edición (p.ej. el formulario de Miami) van al final. */
  ediciones: EdicionSede[];
}

/** Agendas por ciudad, con su reparto por canal y por edición. Ordenadas de
 *  más a menos agendas; "Sin ciudad" siempre al final. */
export function agendasPorSede(registros: readonly Registro[]): Sede[] {
  const sedes = new Map<string, Sede & { _ed: Map<string, EdicionSede> }>();
  for (const r of registros) {
    if (!r.agendada) continue;
    const ciudad = r.ciudad ?? 'Sin ciudad';
    const sede = sedes.get(ciudad) ?? {
      ciudad,
      pais: r.pais,
      cantidad: 0,
      porCanal: vacio(),
      ediciones: [],
      _ed: new Map<string, EdicionSede>(),
    };
    sede.cantidad += 1;
    sede.porCanal[grupoDeCanal(r.canal)] += 1;
    const fechas = fechasDeEdicion(r.edicion);
    const clave = fechas?.inicio ?? 'sin-edicion';
    const ed = sede._ed.get(clave) ?? { clave, fechas, cantidad: 0 };
    ed.cantidad += 1;
    sede._ed.set(clave, ed);
    sedes.set(ciudad, sede);
  }
  return [...sedes.values()]
    .map(({ _ed, ...sede }) => ({
      ...sede,
      ediciones: [..._ed.values()].sort((a, b) =>
        a.clave === 'sin-edicion'
          ? 1
          : b.clave === 'sin-edicion'
            ? -1
            : a.clave.localeCompare(b.clave),
      ),
    }))
    .sort((a, b) =>
      a.ciudad === 'Sin ciudad'
        ? 1
        : b.ciudad === 'Sin ciudad'
          ? -1
          : b.cantidad - a.cantidad || a.ciudad.localeCompare(b.ciudad, 'es'),
    );
}
