// `server-only` hace que el build falle si este módulo entra en un bundle de
// cliente. Es la red de seguridad para FORM30X_API_KEY, que la documentación
// describe como una credencial de administración de toda la compañía.
import 'server-only';
import { z } from 'zod';

const booleanish = z
  .string()
  .optional()
  .transform((v) => v === '1' || v?.toLowerCase() === 'true');

const positiveInt = (fallback: number) =>
  z.coerce.number().int().positive().catch(fallback).default(fallback);

const envSchema = z.object({
  FORM30X_API_URL: z.url().default('https://form.oracle30x.co'),
  FORM30X_API_KEY: z.string().min(1).optional(),
  PULSO_TIMEZONE: z.string().min(1).default('America/Bogota'),
  PULSO_POLL_INTERVAL_MS: positiveInt(60_000),
  PULSO_CACHE_TTL_MS: positiveInt(45_000),
  PULSO_MAX_CONCURRENCY: positiveInt(4),
  PULSO_USE_FIXTURES: booleanish,

  // Tope de páginas por formulario. Con limit=200, 50 páginas son 10.000
  // respuestas. Al alcanzarlo, Pulso lo declara en vez de devolver datos
  // incompletos como si fueran completos.
  FORM30X_MAX_PAGES: positiveInt(50),
  // La estructura de un formulario (qué campos tiene) cambia mucho menos que
  // sus respuestas, así que se cachea mucho más tiempo.
  PULSO_ESTRUCTURA_TTL_MS: positiveInt(600_000),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Lee y valida el entorno una sola vez.
 *
 * Es deliberadamente perezoso: validar al importar rompería `next build` en
 * una máquina sin credenciales, y el build no necesita la API key.
 */
export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  · ${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Configuración de entorno inválida:\n${detail}\n\nRevisa tu .env.local contra .env.example.`,
    );
  }

  cached = parsed.data;
  return cached;
}

/**
 * Igual que getEnv, pero exige que haya API key.
 *
 * Se separa para que el modo fixtures pueda arrancar el proyecto sin
 * credenciales y el mensaje de error apunte a la causa exacta en vez de
 * fallar con un 401 opaco desde form30x.
 */
export function getApiEnv(): Env & { FORM30X_API_KEY: string } {
  const env = getEnv();
  if (!env.FORM30X_API_KEY) {
    throw new Error(
      'Falta FORM30X_API_KEY. Genera una key en form30x → /developers con los scopes ' +
        '`forms:read` y `responses:read` (Pulso nunca escribe) y ponla en .env.local. ' +
        'Para arrancar sin credenciales, usa PULSO_USE_FIXTURES=1.',
    );
  }
  return { ...env, FORM30X_API_KEY: env.FORM30X_API_KEY };
}

/** Solo para tests: fuerza una relectura del entorno. */
export function resetEnvCache() {
  cached = undefined;
}
