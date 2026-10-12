/**
 * Precarga al arrancar cada instancia del servidor.
 *
 * Sin esto, después de un deploy o un reinicio el caché está vacío hasta el
 * siguiente ciclo del cron (hasta 30 min), y el primero en entrar paga la
 * descarga completa. No se espera el resultado: `register` debe terminar
 * antes de que el servidor acepte peticiones, y la precarga tarda decenas
 * de segundos. Mientras corre, las peticiones que lleguen se deduplican
 * contra la misma descarga en vuelo (ver conCache).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // `next build` también inicializa el servidor para generar páginas; ahí no
  // hay que tocar form30x.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  const { precargar } = await import('./lib/server/precarga');
  void precargar('arranque');
}
