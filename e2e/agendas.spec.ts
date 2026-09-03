import { expect, test, type Page } from '@playwright/test';

/**
 * Tests de extremo a extremo del dashboard de agendas.
 *
 * Corren contra el servidor arrancado por playwright.config.ts con
 * PULSO_USE_FIXTURES=1: sin red, sin API key y con datos deterministas. Un
 * test e2e que depende de una API externa falla por motivos ajenos al código
 * y acaba ignorándose.
 */

/** Espera a que el dashboard termine de cargar. */
async function esperarDatos(page: Page) {
  await expect(page.getByRole('heading', { name: 'Agendas por programa' })).toBeVisible();
  // El esqueleto anuncia "Cargando agendas…" en una región viva; su
  // desaparición es la señal fiable de que los datos llegaron.
  await expect(page.getByText('Cargando agendas…')).toBeHidden({ timeout: 30_000 });
  await expect(kpis(page).getByText('Total de agendas', { exact: true })).toBeVisible();
}

/** La región de indicadores. Desambigua de las columnas homónimas de la tabla. */
const kpis = (page: Page) => page.getByRole('region', { name: 'Indicadores del periodo' });

/**
 * Los dos diseños —tabla en escritorio y tarjetas en móvil— coexisten en el
 * DOM y CSS oculta el que no toca, así que los localizadores por texto se
 * filtran por visibilidad.
 */
const visible = (page: Page, texto: string | RegExp) =>
  page.getByText(texto).filter({ visible: true });

test.describe('dashboard de agendas', () => {
  test('carga los KPIs y el desglose por programa', async ({ page }) => {
    await page.goto('/agendas');
    await esperarDatos(page);

    for (const kpi of [
      'Total de agendas',
      'Variación',
      'Promedio diario',
      'Mejor día',
      'Peor día',
    ]) {
      await expect(kpis(page).getByText(kpi, { exact: true })).toBeVisible();
    }

    await expect(page.getByRole('heading', { name: /Desglose por programa/ })).toBeVisible();
    // Las fixtures incluyen un formulario cuyo nombre no identifica programa:
    // debe estar visible, no descartado en silencio.
    await expect(visible(page, 'Sin programa identificado').first()).toBeVisible();
  });

  test('la raíz redirige a /agendas', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/agendas/);
  });

  test('los presets de fecha cambian el rango y quedan en la URL', async ({ page }) => {
    await page.goto('/agendas');
    await esperarDatos(page);

    await page.getByRole('button', { name: 'Últimos 30 días', exact: true }).click();
    await expect(page).toHaveURL(/desde=\d{4}-\d{2}-\d{2}&hasta=\d{4}-\d{2}-\d{2}/);
    await expect(
      page.getByRole('button', { name: 'Últimos 30 días', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(visible(page, /· 30 días/).first()).toBeVisible();
  });

  test('un rango histórico desactiva el auto-refresco y lo explica', async ({ page }) => {
    // Rango cerrado en el pasado: no puede cambiar, así que refrescarlo sería
    // tráfico regalado (ADR 0001).
    await page.goto('/agendas?desde=2026-01-05&hasta=2026-01-11');
    await esperarDatos(page);

    await expect(page.getByLabel('Auto-refresco')).toBeDisabled();
    await expect(page.getByText('Rango histórico, no cambia')).toBeVisible();
  });

  test('un programa en la URL deja una sola serie', async ({ page }) => {
    await page.goto('/agendas?programas=ai-sales');
    await esperarDatos(page);

    await expect(visible(page, /^1 programa · /)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Programa. AI Sales' })).toBeVisible();
  });

  test('destildar un programa lo quita de las series y de la URL', async ({ page }) => {
    await page.goto('/agendas');
    await esperarDatos(page);

    // El estado inicial es "todos", así que la primera interacción destilda.
    await page.getByRole('button', { name: /^Programa\./ }).click();
    await page.getByRole('checkbox', { name: /^AI Sales/ }).click();
    await page.keyboard.press('Escape');

    await expect(page).toHaveURL(/programas=/);
    await expect(page).not.toHaveURL(/programas=[^&]*ai-sales/);
    await expect(visible(page, /^5 programas · /)).toBeVisible();
  });

  test('un rango inválido muestra el error con reintento, no una pantalla en blanco', async ({
    page,
  }) => {
    // El servidor rechaza los rangos futuros; la interfaz debe explicarlo.
    await page.goto('/agendas?desde=2099-01-01&hasta=2099-01-07');

    await expect(page.getByRole('alert').first()).toContainText('No pudimos cargar los datos');
    await expect(page.getByRole('alert').first()).toContainText('no puede terminar en el futuro');
    await expect(page.getByRole('button', { name: /Reintentar/ })).toBeVisible();
  });

  test('el día a día se despliega bajo la fila del programa', async ({ page }) => {
    await page.goto('/agendas?desde=2026-08-28&hasta=2026-09-03');
    await esperarDatos(page);

    // El botón visible es el de la tabla en escritorio y el de la tarjeta en
    // móvil; ambos comparten nombre accesible.
    const desplegar = page
      .getByRole('button', { name: 'Ver el día a día de AI Sales' })
      .filter({ visible: true });

    await desplegar.click();
    await expect(visible(page, 'Día a día · AI Sales')).toBeVisible();

    // Al desplegarse, el nombre del botón cambia a "Ocultar…": se vuelve a
    // consultar en vez de reutilizar el localizador anterior.
    const plegar = page
      .getByRole('button', { name: 'Ocultar el día a día de AI Sales' })
      .filter({ visible: true });
    await expect(plegar).toHaveAttribute('aria-expanded', 'true');
  });

  test('exporta un CSV con la cabecera y el huso declarado', async ({ page }) => {
    await page.goto('/agendas?desde=2026-08-28&hasta=2026-09-03');
    await esperarDatos(page);

    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar CSV' }).click();
    const archivo = await descarga;

    expect(archivo.suggestedFilename()).toBe('pulso-agendas-2026-08-28_a_2026-09-03.csv');

    const ruta = await archivo.path();
    const contenido = await (await import('node:fs/promises')).readFile(ruta, 'utf8');
    expect(contenido).toContain('fecha (America/Bogota),programa,rama,agendas');
    expect(contenido).toContain('AI Sales');
  });
});

test.describe('tema', () => {
  test('el selector cambia el tema y la preferencia sobrevive a una recarga', async ({ page }) => {
    await page.goto('/agendas');
    await esperarDatos(page);

    await page.getByRole('radio', { name: 'Oscuro' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.getByRole('radio', { name: 'Oscuro' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await page.getByRole('radio', { name: 'Claro' }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });
});

test.describe('accesibilidad y responsive', () => {
  test('se puede llegar a los filtros con el teclado', async ({ page }) => {
    await page.goto('/agendas');
    await esperarDatos(page);

    // El primer tabulador debe caer en el salto al contenido, que es lo que
    // permite a quien navega con teclado esquivar la cabecera.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  });

  test('en móvil la tabla se colapsa a tarjetas y no hay scroll horizontal', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Solo aplica al proyecto móvil');

    await page.goto('/agendas?desde=2026-08-28&hasta=2026-09-03');
    await esperarDatos(page);

    // La tabla de escritorio existe en el DOM pero está oculta por CSS.
    await expect(page.locator('table')).toBeHidden();
    await expect(page.getByRole('button', { name: /Ver el día a día/ }).first()).toBeVisible();

    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(desborda, 'el documento no debe desbordar horizontalmente').toBe(false);
  });
});
