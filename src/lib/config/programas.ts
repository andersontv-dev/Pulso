/**
 * Catálogo de programas de 30X.
 *
 * Fuente: "Programas CRECE 30X — Portafolio 2026". Ver docs/programas.md.
 *
 * La API de form30x no conoce el concepto "programa": solo formularios. Según
 * indicación del equipo, el nombre del formulario contiene el programa, así
 * que este catálogo es lo que permite pasar de uno a otro.
 *
 * ⚠️ Está incompleto a propósito: el PDF recibido viene recortado y le faltan
 * las fichas de la rama Presenciales, así que hay 16 de los 18 programas. Un
 * formulario que no case con ninguno NO se descarta: cae en "Sin programa
 * identificado" y la interfaz lo muestra. Para completarlo basta con añadir
 * entradas aquí.
 */

export const RAMAS = {
  presenciales: 'Presenciales',
  ia: 'Inteligencia Artificial',
  ventas: 'Ventas',
  growth: 'Growth',
  startups: 'Startups',
  empresas: 'Empresas',
} as const;

export type RamaId = keyof typeof RAMAS;

export interface ProgramaCatalogo {
  /** Identificador estable. No cambia aunque cambie el nombre comercial. */
  id: string;
  /** Nombre que se muestra en la interfaz. */
  nombre: string;
  rama: RamaId;
  /**
   * Cadenas que, encontradas en el nombre de un formulario, identifican este
   * programa. Se comparan ya normalizadas (minúsculas, sin acentos, sin
   * puntuación). Gana siempre la coincidencia más larga, de modo que
   * "sales machine" no lo capture el alias "sales" de otro programa.
   */
  alias: readonly string[];
}

export const PROGRAMAS: readonly ProgramaCatalogo[] = [
  // Rama 01 · Presenciales — incompleta en el PDF recibido
  {
    id: 'inmersion-ejecutiva',
    nombre: 'Inmersión Ejecutiva',
    rama: 'presenciales',
    alias: ['inmersion ejecutiva', 'inmersion', 'inmersivo'],
  },

  // Rama 02 · Inteligencia Artificial
  {
    id: 'ai-for-executives',
    nombre: 'AI for Executives',
    rama: 'ia',
    alias: ['ai for executives', 'ai executives', 'ai executive', 'ia para ejecutivos'],
  },
  {
    id: 'ai-for-developers',
    nombre: 'AI for Developers',
    rama: 'ia',
    alias: ['ai for developers', 'ai developers', 'ia para desarrolladores'],
  },
  {
    id: 'operaciones-con-ai',
    nombre: 'Operaciones con AI',
    rama: 'ia',
    alias: ['operaciones con ai', 'operaciones con ia', 'ai operations'],
  },
  {
    id: 'ai-second-brain',
    nombre: 'AI Second Brain',
    rama: 'ia',
    alias: ['ai second brain', 'second brain'],
  },
  { id: 'next', nombre: 'Next', rama: 'ia', alias: ['next fellowship', 'next'] },

  // Rama 03 · Ventas
  { id: 'sales-machine', nombre: 'Sales Machine', rama: 'ventas', alias: ['sales machine'] },
  { id: 'ai-sales', nombre: 'AI Sales', rama: 'ventas', alias: ['ai sales'] },
  {
    id: 'linkedin-sales',
    nombre: 'LinkedIn Sales',
    rama: 'ventas',
    alias: ['linkedin sales', 'linkedin'],
  },

  // Rama 04 · Growth
  { id: 'growth-rockstar', nombre: 'Growth Rockstar', rama: 'growth', alias: ['growth rockstar'] },
  {
    id: 'advanced-strategy',
    nombre: 'Advanced Strategy',
    rama: 'growth',
    alias: ['advanced strategy'],
  },
  { id: 'xtreme-growth', nombre: 'Xtreme Growth', rama: 'growth', alias: ['xtreme growth'] },
  {
    id: 'instagram-tiktok',
    nombre: 'Instagram & TikTok',
    rama: 'growth',
    alias: ['instagram y tiktok', 'instagram tiktok', 'instagram', 'tiktok'],
  },

  // Rama 05 · Startups
  {
    id: 'fundraising-fundamentals',
    nombre: 'Fundraising Fundamentals',
    rama: 'startups',
    alias: ['fundraising fundamentals', 'fundraising'],
  },
  {
    id: 'raise-your-round',
    nombre: 'Raise Your Round',
    rama: 'startups',
    alias: ['raise your round'],
  },
  {
    id: 'product-rockstar',
    nombre: 'Product Rockstar',
    rama: 'startups',
    alias: ['product rockstar'],
  },

  // Rama 06 · Empresas
  {
    id: 'planes-corporativos',
    nombre: 'Planes Corporativos',
    rama: 'empresas',
    alias: ['planes corporativos', 'plan corporativo', 'corporativo'],
  },
] as const;

/**
 * Programa de destino para los formularios cuyo nombre no identifica ninguno.
 *
 * Existe para que ningún dato desaparezca en silencio: un total que no cuadra
 * porque hay agendas visibles bajo esta etiqueta es un problema que alguien
 * puede resolver; uno que no cuadra porque se descartaron filas, no.
 */
export const PROGRAMA_DESCONOCIDO = {
  id: 'sin-identificar',
  nombre: 'Sin programa identificado',
  rama: null,
} as const;
