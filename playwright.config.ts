import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3100);
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
    command: process.env.CI
      ? `PULSO_USE_FIXTURES=1 npx next start --port ${PORT}`
      : `PULSO_USE_FIXTURES=1 npm run build && PULSO_USE_FIXTURES=1 npx next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
