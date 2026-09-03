# Pulso

Dashboard interno de reportería y analítica de **agendas por programa** para
30X. Lee la API de form30x, agrega las respuestas y muestra cuántas llamadas
se agendaron cada día, por programa.

Fase 1. Las alertas configurables (Fase 2) y el asistente conversacional
(Fase 3) no están construidos; la arquitectura está preparada para ellos.

---

## Arranque rápido

Necesitas **Node 20.9 o superior**.

```bash
git clone https://github.com/andersontv-dev/Pulso.git
cd Pulso
npm install
```

### Opción A — verlo funcionando ya, sin credenciales

```bash
cp .env.example .env.local
# edita .env.local y pon PULSO_USE_FIXTURES=1
npm run dev
```

Abre **http://localhost:3000**. Verás el dashboard con datos de ejemplo
deterministas que incluyen a propósito los casos incómodos: respuestas sin
Calendly, sin agendar, parciales, con una forma que el parser no reconoce, y
un formulario cuyo nombre no identifica ningún programa.

### Opción B — contra los datos reales

1. Entra en form30x → `/developers` y genera una API key **solo con los
   scopes `forms:read` y `responses:read`**. Pulso nunca escribe.

   > ⚠️ La documentación de form30x avisa de que una key válida lee y edita
   > **cualquier** formulario de la compañía: los scopes separan lectura de
   > escritura, no un formulario de otro. Trátala como credencial de admin.

2. ```bash
   cp .env.example .env.local
   ```

3. Pon la key en `FORM30X_API_KEY` y deja `PULSO_USE_FIXTURES=0`.

4. ```bash
   npm run dev
   ```

La key vive solo en el servidor. El navegador nunca habla con form30x: pide
los datos a `/api/agendas`, que devuelve series ya agregadas. Esa frontera
está impuesta por ESLint, no solo por convención.

---

## Comandos

| Comando                 | Qué hace                                  |
| ----------------------- | ----------------------------------------- |
| `npm run dev`           | Servidor de desarrollo en el puerto 3000  |
| `npm run build`         | Build de producción                       |
| `npm run start`         | Sirve el build de producción              |
| `npm run lint`          | ESLint                                    |
| `npm run typecheck`     | TypeScript sin emitir                     |
| `npm run test`          | Tests unitarios (Vitest)                  |
| `npm run test:watch`    | Vitest en modo watch                      |
| `npm run test:coverage` | Cobertura de `src/lib`                    |
| `npm run e2e`           | Tests end-to-end (Playwright)             |
| `npm run format`        | Prettier                                  |
| `npm run verify`        | lint + typecheck + tests, lo mismo que CI |

La primera vez que corras los e2e:

```bash
npx playwright install --with-deps chromium
```

Los e2e levantan solos un build de producción con fixtures: no necesitan red
ni credenciales.

---

## Variables de entorno

Todas están documentadas en [`.env.example`](.env.example). Las que
importan:

| Variable                 | Por defecto            | Para qué                               |
| ------------------------ | ---------------------- | -------------------------------------- |
| `FORM30X_API_KEY`        | —                      | Bearer token. **Server-only.**         |
| `FORM30X_API_URL`        | `https://form.30x.com` | Origen de la API, sin `/api/v1`        |
| `PULSO_TIMEZONE`         | `America/Bogota`       | Huso con el que se agrupa el día a día |
| `PULSO_POLL_INTERVAL_MS` | `60000`                | Cada cuánto se refresca                |
| `PULSO_CACHE_TTL_MS`     | `45000`                | TTL del caché en servidor              |
| `PULSO_MAX_CONCURRENCY`  | `4`                    | Peticiones simultáneas a form30x       |
| `PULSO_USE_FIXTURES`     | `0`                    | `1` sirve datos de ejemplo, sin red    |

Hay tres variables más (`FORM30X_CURSOR_PARAM`,
`FORM30X_SUPPORTS_DATE_FILTER`, `FORM30X_MAX_PAGES`) que existen porque la
documentación de form30x deja esos puntos sin especificar. Ver
[`docs/api/form30x.md`](docs/api/form30x.md) §7, §8 y §9.

---

## Cómo está montado

```
src/
├─ app/
│  ├─ (dashboard)/agendas/     La vista
│  └─ api/agendas/route.ts     El único punto que habla con form30x
├─ lib/
│  ├─ api/        Capa aislada de form30x: cliente, zod, paginación, errores
│  ├─ domain/     Lógica pura y testeable: agenda, programa, series, KPIs, CSV
│  ├─ date/       Rangos y días de negocio en el huso configurado
│  ├─ server/     Caché con TTL y el servicio de agregación
│  ├─ contracts/  El tipo que cruza de servidor a navegador
│  └─ config/     Entorno validado y catálogo de programas
├─ components/    UI (ui · filtros · agendas)
└─ hooks/         TanStack Query y estado en la URL
```

Dos reglas que impone ESLint y conviene conocer antes de tocar nada:

1. **`components/`, `hooks/` y las páginas no pueden importar `@/lib/api`.**
   La API key es server-only y la UI consume datos ya agregados.
2. **`lib/domain/` no puede importar el transporte ni Next.** Así la lógica
   de negocio se testea sin red, que es donde están los tests que importan.

Las decisiones que no se deducen leyendo el código están en
[`docs/adr/`](docs/adr/): por qué el refresco es polling, por qué el
navegador no habla con la API, qué cuenta como agenda y por qué el día de
negocio es `America/Bogota`.

---

## Qué cuenta como una agenda

Una respuesta de form30x con una pregunta de tipo `calendly` cuyo booking
está confirmado. Se cuenta por **`submittedAt`**, es decir por la fecha en
que se agendó, que es el único campo que la documentación garantiza.

**form30x no recibe cancelaciones desde Calendly.** Pulso cuenta bookings
creados, no reuniones vigentes, y lo dice en la interfaz en vez de dejar que
se asuma lo contrario.

---

## Lo que esta API no permite

Resumen; el detalle está en
[`docs/api/form30x.md`](docs/api/form30x.md) §13.

- **No hay ningún endpoint de agregación.** Todo KPI se calcula bajando
  respuestas crudas y contándolas. De ahí el caché en servidor.
- **No hay filtro de fecha documentado** en `/responses`. Pulso lo envía
  igualmente si lo activas, pero **siempre** vuelve a filtrar en memoria, así
  que el resultado es correcto tanto si el servidor lo honra como si lo
  ignora.
- **No hay rate limit documentado.** Ni cuota, ni cabeceras. Por eso la
  concurrencia por defecto es baja y hay backoff.
- **No hay tiempo real de verdad.** Ni SSE ni streaming. Los webhooks
  existen, pero se configuran solo desde la UI de form30x y necesitan una
  URL pública más una base de datos. El refresco es polling por obligación.
- **La API no conoce "programa".** Se deriva del nombre del formulario, con
  el catálogo de [`src/lib/config/programas.ts`](src/lib/config/programas.ts).
- **La analítica del propio form30x no está expuesta** (vistas, starts,
  completions, embudo). Sin ella no hay tasa de conversión visita → agenda.

---

## Cuando un programa no aparece

Si ves el aviso «formularios no coinciden con ningún programa del catálogo»,
añade una entrada en
[`src/lib/config/programas.ts`](src/lib/config/programas.ts) con los alias
que aparezcan en el nombre del formulario. No hay que tocar nada más.

El catálogo tiene 16 de los 18 programas del portafolio 2026: el PDF que
recibimos viene recortado y le faltan las fichas de la rama Presenciales.
Ver [`docs/programas.md`](docs/programas.md).

---

## Marca y accesibilidad

Los colores y la tipografía salen del brandbook de 30X y están en
[`docs/brand.md`](docs/brand.md) con los contrastes medidos. Dos cosas que
condicionan cualquier cambio de diseño:

- **Ningún tono de amarillo de la marca sirve como texto sobre claro.**
  Amarillo X da 1.10:1 sobre blanco. En modo claro es relleno con trazo
  oscuro; sobre negro, donde da 19.05:1, sí puede ser texto.
- **No hay paleta de series.** Se probó una escala categórica con los tonos
  de la marca y falló la validación de separación: dos de sus pasos quedan a
  ΔE 7.1 en visión normal, indistinguibles incluso sin daltonismo. La
  identidad de cada programa se transmite con pequeños múltiplos y etiquetas,
  no con color.

Ambos modos cumplen AA, el toggle persiste, y la interfaz es navegable por
teclado.

---

## Deuda técnica y pendientes

Lo que queda abierto, sin adornos:

1. **Falta el `openapi.json` de form30x.** Es el bloqueo principal. Sin él,
   la paginación por cursor se detecta en runtime probando nombres
   convencionales, no se sabe si `/responses` acepta filtro de fecha y no se
   conoce el rate limit. Con la spec, `src/lib/api/pagination.ts` se reduce a
   veinte líneas y el rendimiento mejora bastante.
2. **El caché es memoria del proceso.** Sirve para una instancia o para uso
   local. Con varias instancias haría falta un caché compartido.
3. **Sin filtro de fecha en la API, un rango largo es caro.** Por eso el
   endpoint rechaza rangos de más de 400 días con un mensaje que lo explica.
4. **No sabemos si la fecha de la reunión está disponible.** El desglose
   agrupa por fecha de agendamiento. Si el objeto `event` de Calendly trae la
   fecha de la reunión, se puede ofrecer como alternativa; la documentación no
   describe su forma.
5. **Las respuestas parciales se descartan de forma defensiva.** La
   documentación no dice con qué campo viaja esa distinción en la API, así
   que se comprueban tres formas plausibles. Conviene verificarlo con datos
   reales.
6. **No hay autenticación.** Fase 1 corre en local. Si esto se despliega para
   el equipo, necesita login antes de salir de tu máquina.
7. **La tabla y las tarjetas coexisten en el DOM** y CSS oculta la que no
   toca. Es robusto para SSR pero duplica nodos; con listas muy largas
   convendría virtualizar o resolverlo con una sola estructura.
8. **Faltan 2 de los 18 programas** en el catálogo (rama Presenciales),
   porque el PDF recibido está recortado.

---

## Fases siguientes

- **Fase 2 — Alertas.** Reglas configurables por usuario, con aviso en la app
  y por email. Necesita persistencia, un planificador y un proveedor de
  correo: nada de eso lo da form30x. Los webhooks serían aquí el reemplazo
  natural del polling, y `lib/domain` ya devuelve las series temporales que
  una regla necesita evaluar.
- **Fase 3 — Asistente conversacional.** Preguntas en lenguaje natural sobre
  los datos, citando periodo y filtros, y diciendo «no tengo ese dato» en vez
  de inventar. Se enchufa en `lib/domain` y en el contrato de
  `lib/contracts/agendas.ts`, sin reimplementar la agregación.
