import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3100);
// Sin `/pulso`: la app corre con `basePath: '/pulso'` (se sirve embebida en
// Bold bajo ese path), así que la raíz del origen no existe — cada test
// navega con la ruta completa (`/pulso/agendas`, no `/agendas`) para que
// quede explícito, en vez de depender de cómo Playwright resuelve un
// `page.goto('/algo')` contra un baseURL con su propio path.
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * Permite apuntar a un Chromium ya instalado en el sistema.
 *
 * Hace falta cuando la versión de @playwright/test del proyecto espera una
 * build de navegador distinta de la que hay en la máquina (entornos CI con
 * navegadores preinstalados, contenedores). Sin esta variable, Playwright usa
 * su navegador propio, que es el caso normal.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: { baseURL, trace: 'on-first-retry' },
  // Los datos llegan por fetch al montar; 5 s no bastan en un arranque frío.
  expect: { timeout: 15_000 },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'], launchOptions: { executablePath } },
    },
  ],
  webServer: {
    // Se testea el build de producción, no `next dev`, por dos razones: es lo
    // que de verdad se despliega, y en dev la primera compilación de cada
    // ruta tarda segundos y convierte los tests en intermitentes.
    //
    // En CI el build ya corrió como su propio paso (ver ci.yml): Playwright
    // no muestra el stdout del webServer por defecto, así que meter el build
    // aquí dentro convertía cualquier build lento en un "Timed out waiting
    // ...from config.webServer" sin ninguna pista de qué tardó. En local no
    // hay ese paso previo, así que se sigue compilando antes de arrancar.
    //
    // PULSO_USE_FIXTURES mantiene los e2e herméticos: sin red y sin API key.
    //
    // --hostname 0.0.0.0: sin esto, `next start` anuncia "Local:
    // http://localhost:3100" pero en runners de GitHub Actions `localhost`
    // suele resolver primero a IPv6 (::1); Playwright sondea el `127.0.0.1`
    // literal de `baseURL`, así que la conexión fallaba en silencio (sin
    // registrar cada intento) hasta agotar el timeout, aunque el server
    // estuviera sano. Atarlo a todas las interfaces lo hace alcanzable por
    // 127.0.0.1 sin importar a qué resuelva "localhost" en esa máquina.
    command: process.env.CI
      ? `PULSO_USE_FIXTURES=1 npx next start --hostname 0.0.0.0 --port ${PORT}`
      : `PULSO_USE_FIXTURES=1 npm run build && PULSO_USE_FIXTURES=1 npx next start --hostname 0.0.0.0 --port ${PORT}`,
    // La raíz del origen (`baseURL` a secas) siempre da 404 por el basePath
    // — y Playwright NO cuenta un 404 como "listo", así que sondearla se
    // quedaba esperando para siempre aunque el server estuviera sano y
    // respondiendo al instante. `/pulso/agendas` sí existe (200).
    url: `${baseURL}/pulso/agendas`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Por defecto Playwright no muestra el stdout del webServer: el timeout
    // anterior fue 2 minutos en silencio total, sin ni un byte de log, así
    // que no había forma de saber si el server nunca arrancó, arrancó en
    // otro puerto/host, o crasheó. Esto hace que la próxima vez se vea.
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
