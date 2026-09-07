# Pulso

Dashboard interno de reportería y analítica para 30X. Lee la API de form30x y
muestra el **embudo completo** de cada programa: cuántas personas empezaron el
formulario, cuántas lo completaron, cuántas llegaron al paso de agendamiento y
cuántas agendaron llamada — con el desglose por canal de adquisición, búsqueda
por correo y export completo.

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

| Variable                 | Por defecto                 | Para qué                               |
| ------------------------ | --------------------------- | -------------------------------------- |
| `FORM30X_API_KEY`        | —                           | Bearer token. **Server-only.**         |
| `FORM30X_API_URL`        | `https://form.oracle30x.co` | Origen de la API, sin `/api/v1`        |
| `PULSO_TIMEZONE`         | `America/Bogota`            | Huso con el que se agrupa el día a día |
| `PULSO_POLL_INTERVAL_MS` | `60000`                     | Cada cuánto se refresca                |
| `PULSO_CACHE_TTL_MS`     | `45000`                     | TTL del caché en servidor              |
| `PULSO_MAX_CONCURRENCY`  | `4`                         | Peticiones simultáneas a form30x       |
| `PULSO_USE_FIXTURES`     | `0`                         | `1` sirve datos de ejemplo, sin red    |

Dos variables más: `FORM30X_MAX_PAGES` (tope de páginas por formulario; con
páginas de 200, el valor por defecto son 10.000 respuestas) y
`PULSO_ESTRUCTURA_TTL_MS` (cuánto se cachea qué campos tiene cada formulario,
que cambia mucho menos que sus respuestas).

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

## Qué muestra

| Vista                        | Qué responde                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Embudo**                   | De los que iniciaron, ¿cuántos completaron y cuántos agendaron?                                                                                   |
| **KPIs**                     | Total de agendas, variación, promedio diario, mejor y peor día                                                                                    |
| **Agendas por día**          | La evolución diaria del agregado                                                                                                                  |
| **Registros**                | Búsqueda por correo, nombre, empresa, teléfono, programa o campaña, con el detalle completo de cada respuesta y cuántas veces aparece cada correo |
| **Canal / Fuente / Campaña** | Cuánto generó la pauta, cuánto lo orgánico, cuánto los referidos, y con qué tasa de conversión cada uno                                           |
| **Desglose por programa**    | Una fila por programa con su día a día                                                                                                            |

Dos exports: **Exportar todo** (una fila por respuesta, con contacto, embudo,
atribución y una columna por cada pregunta del formulario) y **Solo agendas**
(agendas por día y programa, en formato largo).

### Una precisión sobre «iniciaron»

Son quienes **empezaron a responder**, no las visitas. form30x guarda una
respuesta en cuanto alguien escribe algo; las vistas de página existen en su
analítica interna pero **no tienen endpoint de API**. La tasa de completado se
mide, por tanto, sobre quien empezó a escribir, no sobre quien abrió el enlace.

### Cómo se clasifica el canal

De los hidden fields que capturan tus formularios:

| Canal             | Cómo se detecta                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| **Pauta**         | `hsa_*` (auto-etiquetado de Google Ads), `gclid`, `ad_id`, `campaign_id`, o `utm_medium` de pago |
| **Referido**      | `referral_30x` o `utm_medium=referral`                                                           |
| **Orgánico**      | Trae UTM pero no son de pago                                                                     |
| **Sin etiquetar** | Trae un identificador de clic pero ninguna UTM                                                   |
| **Directo**       | Sin ningún parámetro de campaña                                                                  |

`fbclid` por sí solo **no** cuenta como pauta: la documentación de form30x
advierte que Meta también lo añade a las comparticiones orgánicas.

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
- **No hay filtro de fecha.** Confirmado por la especificación: `limit` y
  `cursor`, nada más. Todo rango se resuelve descargando el histórico y
  filtrando en memoria.
- **No hay rate limit especificado.** Ni en la documentación ni en el
  `openapi.json`. Por eso la concurrencia por defecto es baja y hay backoff.
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

El catálogo se validó contra los formularios reales de la cuenta y se corrigió
con lo que apareció: «Operaciones Escalables con AI» no casaba con el alias del
portafolio, la rama Presenciales se completó con Inmersivo Presencial y
Multipliers, y se añadieron los programas aliados (IA para Abogados,
Aceleradora 5Q, Lab 10) que tienen formularios activos con volumen.
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

1. **⛔ La API tiene un techo de 200 respuestas por formulario, y no hay
   forma de superarlo.** Medido: `?limit=5000` devuelve 200, y el servidor no
   envía la cabecera `X-Next-Cursor` que su propia especificación declara.
   Las 200 más recientes de _AI for Executives_ cubren **4,6 días**; en
   formularios de más volumen, menos. En la práctica «Hoy» y «Ayer» son
   exactos y **«Últimos 7 días» ya sale incompleto** para los programas
   grandes.

   Pulso no lo disimula: detecta el borde de cobertura, nombra los programas
   afectados con el día desde el que sí hay datos, y muestra «No comparable»
   en la variación en vez de inventar un porcentaje contra un periodo que no
   puede ver.

   **La solución no está en este código.** O el equipo de form30x arregla la
   cabecera —es un bug del servidor contra su spec—, o la fuente pasa a ser
   otra (Metabase, o los exports CSV, que sí traen el histórico completo).

   Para saber si ya lo arreglaron, sin tener que probar nada a mano:

   ```bash
   npm run diagnostico
   ```

   Comprueba la paginación, la ventana de histórico alcanzable, el `ETag` y
   el filtro por fecha, y dice en una línea si Pulso ya puede leer los datos
   completos.

2. **La API tampoco permite filtrar respuestas por fecha, y eso se paga.**
   Confirmado con el `openapi.json`: los únicos parámetros son `limit` y
   `cursor`. Contar «los últimos 7 días» obliga a recorrer el histórico
   completo de cada formulario. La cuenta real tiene ~17.500 respuestas, con
   varios formularios por encima de 3.000. Se mitiga consultando solo los
   formularios publicados que tienen pregunta de Calendly, pidiendo páginas de
   200 y cacheando en servidor, pero el coste de fondo no desaparece.
3. **El caché es memoria del proceso.** Sirve para una instancia o para uso
   local. Con varias instancias haría falta un caché compartido.
4. **Sin filtro de fecha en la API, un rango largo es caro.** Por eso el
   endpoint rechaza rangos de más de 400 días con un mensaje que lo explica.
5. **No sabemos si la fecha de la reunión está disponible.** El desglose
   agrupa por fecha de agendamiento. Si el objeto `event` de Calendly trae la
   fecha de la reunión, se puede ofrecer como alternativa; la documentación no
   describe su forma.
6. **Las respuestas parciales se descartan.** Validado contra el export real:
   de 1.337 respuestas, 754 eran parciales y **ninguna tenía booking**, así
   que descartarlas es correcto y no pierde ninguna agenda.
7. **No hay autenticación.** Fase 1 corre en local. Si esto se despliega para
   el equipo, necesita login antes de salir de tu máquina.
8. **La tabla y las tarjetas coexisten en el DOM** y CSS oculta la que no
   toca. Es robusto para SSR pero duplica nodos; con listas muy largas
   convendría virtualizar o resolverlo con una sola estructura.
9. **El catálogo se mantiene a mano.** Se validó contra los formularios reales
   y hoy cubre lo que hay, pero cada formulario nuevo con un nombre no visto
   caerá en «Sin programa identificado» hasta que alguien añada su alias. El
   aviso en pantalla existe justamente para que se note.

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
