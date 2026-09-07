/**
 * Clasificación del canal de adquisición a partir de los hidden fields.
 *
 * Los formularios de 30X capturan, además de las cinco UTM estándar, los
 * parámetros de auto-etiquetado de Google Ads (`hsa_*`), los identificadores
 * de clic (`gclid`, `fbclid`), los de campaña (`ad_id`, `campaign_id`) y un
 * `referral_30x` propio.
 */

export type Canal = 'pauta' | 'organico' | 'referido' | 'sin-etiquetar' | 'directo';

export const ETIQUETAS_CANAL: Record<Canal, string> = {
  pauta: 'Pauta',
  organico: 'Orgánico',
  referido: 'Referido',
  'sin-etiquetar': 'Sin etiquetar',
  directo: 'Directo',
};

export const DESCRIPCIONES_CANAL: Record<Canal, string> = {
  pauta: 'Llegó por un anuncio pagado (hsa_*, gclid, ad_id o utm_medium de pago).',
  organico: 'Trae UTM pero no son de pago: newsletter, redes orgánicas, contenido.',
  referido: 'Viene de una referencia (referral_30x o utm_medium=referral).',
  'sin-etiquetar':
    'Trae un identificador de clic pero ninguna UTM. Puede ser un anuncio mal etiquetado o una compartición orgánica: form30x avisa de estos casos en #utms-research.',
  directo: 'Sin ningún parámetro de campaña en la URL.',
};

/** `utm_medium` que indican tráfico pagado. */
const MEDIOS_PAGADOS = new Set([
  'cpc',
  'ppc',
  'paid',
  'paidsocial',
  'paid_social',
  'paid-social',
  'ads',
  'ad',
  'display',
  'cpm',
  'cpv',
  'social_paid',
]);

/** Presencia de cualquiera de estos basta para considerarlo pauta. */
const SENALES_PAUTA = ['gclid', 'ad_id', 'campaign_id', 'hsa_acc', 'hsa_cam', 'hsa_ad', 'hsa_net'];

/**
 * Identificadores de clic que NO prueban que sea pauta.
 *
 * La documentación de form30x es explícita: Meta añade `fbclid` también a las
 * comparticiones orgánicas, así que por sí solo no distingue un anuncio de un
 * enlace compartido por alguien.
 */
const CLICS_AMBIGUOS = ['fbclid', 'ttclid', 'li_fat_id', 'msclkid'];

const UTMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id'];

const tiene = (hidden: Record<string, string>, clave: string) =>
  typeof hidden[clave] === 'string' && hidden[clave].trim() !== '';

export function clasificarCanal(hidden: Record<string, string>): Canal {
  const medio = (hidden.utm_medium ?? '').trim().toLowerCase();
  const fuente = (hidden.utm_source ?? '').trim().toLowerCase();

  if (MEDIOS_PAGADOS.has(medio) || SENALES_PAUTA.some((c) => tiene(hidden, c))) return 'pauta';
  if (medio === 'referral' || tiene(hidden, 'referral_30x')) return 'referido';

  const conUtm = UTMS.some((c) => tiene(hidden, c));
  if (conUtm) return 'organico';

  // Sin UTM pero con identificador de clic: es justo el caso que form30x
  // reporta para investigar, porque puede ser un anuncio mal etiquetado.
  if (CLICS_AMBIGUOS.some((c) => tiene(hidden, c))) return 'sin-etiquetar';

  return fuente ? 'organico' : 'directo';
}

/** Fuente legible: `utm_source`, o el origen deducido cuando no viene. */
export function fuenteDe(hidden: Record<string, string>): string {
  const fuente = (hidden.utm_source ?? '').trim();
  if (fuente) return fuente;
  if (tiene(hidden, 'hsa_net')) return hidden.hsa_net.trim();
  if (tiene(hidden, 'gclid')) return 'google';
  if (tiene(hidden, 'fbclid')) return 'meta';
  if (tiene(hidden, 'ig_account')) return 'instagram';
  if (tiene(hidden, 'referral_30x')) return 'referido';
  return 'sin fuente';
}
