import {
  PROGRAMAS,
  PROGRAMA_DESCONOCIDO,
  RAMAS,
  type ProgramaCatalogo,
} from '@/lib/config/programas';

/**
 * Normaliza un texto para poder compararlo: minúsculas, sin acentos, sin
 * puntuación y con los espacios colapsados.
 *
 * Es lo que hace que «AI Sales — Cohorte 12», «ai-sales_form» y «Formulario
 * AI Sales» se reconozcan los tres como el mismo programa.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita los diacríticos ya separados
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Alias ordenados de más largo a más corto: gana la coincidencia más
 *  específica, así «sales machine» no lo captura el alias «sales». */
const INDICE = PROGRAMAS.flatMap((programa) =>
  programa.alias.map((alias) => ({ programa, alias: normalizar(alias) })),
).sort((a, b) => b.alias.length - a.alias.length);

/**
 * Empareja el nombre de un formulario con un programa del catálogo.
 *
 * Devuelve `null` si ninguno encaja; quien llama decide qué hacer con ello
 * (en Pulso, agruparlo bajo «Sin programa identificado» y mostrarlo).
 */
export function emparejarPrograma(nombreFormulario: string): ProgramaCatalogo | null {
  // Los espacios en los extremos permiten exigir límite de palabra sin
  // recurrir a expresiones regulares construidas dinámicamente.
  const aguja = ` ${normalizar(nombreFormulario)} `;
  for (const { programa, alias } of INDICE) {
    if (aguja.includes(` ${alias} `)) return programa;
  }
  return null;
}

export interface ProgramaResuelto {
  id: string;
  nombre: string;
  rama: string | null;
}

/** Resuelve el programa de un formulario, con destino garantizado. */
export function resolverPrograma(nombreFormulario: string): ProgramaResuelto {
  const encontrado = emparejarPrograma(nombreFormulario);
  if (!encontrado) {
    return {
      id: PROGRAMA_DESCONOCIDO.id,
      nombre: PROGRAMA_DESCONOCIDO.nombre,
      rama: null,
    };
  }
  return {
    id: encontrado.id,
    nombre: encontrado.nombre,
    rama: RAMAS[encontrado.rama],
  };
}
