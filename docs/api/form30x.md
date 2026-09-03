# form30x — referencia de API para Pulso

> Fuente: documentación oficial de desarrolladores de form30x (`/developers`),
> capturada el 2026-09-02 y transcrita aquí para que el repositorio sea
> autocontenido.
>
> **Cómo leer este documento.** Todo lo que aparece bajo _Documentado_ está
> literalmente en la documentación oficial. Todo lo que aparece bajo
> _No documentado_ es un hueco real: no lo inventes, no lo asumas en el código
> sin una comprobación en runtime. Cuando el `openapi.json` esté disponible,
> este documento se actualiza y las asunciones defensivas correspondientes se
> retiran.

---

## 1. Qué es form30x

Constructor de formularios conversacionales (una pregunta por pantalla) con
lógica, scoring, variables, integraciones y API REST/MCP. Un formulario son
`fields` (preguntas y pantallas) más cuatro blobs de configuración: `theme`,
`settings`, `logic` y `variables`. Cada respuesta completada se almacena y se
reparte a las integraciones conectadas.

Producción: `https://form.oracle30x.co`, sobre Google Cloud Run + Cloud SQL
(Postgres). El servidor MCP es un servicio aparte.

---

## 2. Autenticación

**Documentado**

- Cabecera: `Authorization: Bearer f30x_live_…`
- Las keys se generan desde la UI en `/developers` y **se muestran una sola vez**.
- Scopes: `forms:read`, `forms:write`, `responses:read`.

> ### ⚠️ Aviso de la documentación, citado literalmente
>
> _«Forms are company-wide: a valid key reads and edits ANY form in the company.
> Scopes separate read from write, not one form from another. Treat keys as
> admin credentials.»_

**Consecuencia para Pulso.** La key se emite solo con `forms:read` +
`responses:read`, vive únicamente en el servidor y jamás se expone al
navegador. Pulso no invoca ningún endpoint de escritura.

---

## 3. URL base

**El dominio real es `https://form.oracle30x.co`** (confirmado por el equipo
de 30X). La base de la API es, por tanto,
`https://form.oracle30x.co/api/v1`, y la spec legible por máquina está en
`https://form.oracle30x.co/api/v1/openapi.json`.

**Sobre la discrepancia de la documentación.** El texto oficial declara
`https://form.30x.com/api/v1` como base, pero la propia página se sirve desde
`form.oracle30x.co/developers` y el MCP remoto desde
`mcp.form.oracle30x.co/mcp`. Manda el dominio real. El origen sigue siendo
configurable vía `FORM30X_API_URL` en lugar de estar quemado en el código.

---

## 4. Endpoints

### Los que usa Pulso (todos de lectura)

| Método | Ruta | Devuelve | Scope |
| ------ | ---- | -------- | ----- |
| `GET` | `/forms` | Lista de formularios | `forms:read` |
| `GET` | `/forms/:id` | Documento completo: fields + logic + variables + settings + theme | `forms:read` |
| `GET` | `/forms/:id/fields` | Los campos, en orden | `forms:read` |
| `GET` | `/forms/:id/responses` | Respuestas, **paginadas por cursor** | `responses:read` |

### El resto del catálogo (Pulso no los toca)

Escritura sobre formularios (`POST/PATCH/PUT/DELETE /forms`, `/duplicate`,
`/publish`), campos (`/fields`, `/fields/:ref`, `/fields/:ref/move`), lógica
(`/logic`, `/logic/:ruleId`), `/settings`, `/theme`, `/variables`, más
`/validate` y `/simulate`. Todos exigen `forms:write` salvo `validate` y
`simulate`, que son `forms:read`.

---

## 5. Forma de una respuesta

La documentación garantiza que `GET /forms/:id/responses` devuelve **la misma
forma que el payload de webhook**, y que `GET /forms/:id` devuelve la
definición completa.

```jsonc
{
  "event": "response.completed",
  "formId": "…",
  "formTitle": "…",
  "responseId": "…",
  "submittedAt": "ISO-8601",
  "answers": [
    { "fieldRef": "…", "type": "email", "question": "Your email", "value": "a@b.com" },
    {
      "fieldRef": "…",
      "type": "multiple_choice",
      "question": "Etapa de tu startup",
      "value": "5ix6xpo",
      "label": "MVP con usuarios (sin ingresos)",
      "choices": [
        { "id": "xrkz0pu", "label": "Idea / validando problema" },
        { "id": "5ix6xpo", "label": "MVP con usuarios (sin ingresos)" }
      ]
    }
  ],
  "hidden": { "utm_source": "newsletter" },
  "score": 12,
  "tags": ["qualified"],
  "variables": { "score": 12, "fit": 8 }
}
```

### ⚠️ Los ids de opción no son globales

Citado de la documentación:

> _«Option ids are unique only INSIDE their own field, so the same id can appear
> in two questions with different meanings — always read `label`, or map by
> (fieldRef, id) via `choices`.»_

Pulso encapsula esto en `src/lib/api/answers.ts`. Ningún consumidor agrupa por
`id` suelto.

### Valor almacenado por tipo de pregunta

| Tipo | Valor almacenado |
| ---- | ---------------- |
| `short_text` / `long_text` | string |
| `email` / `phone_number` / `website` | string (email y website validados por formato) |
| `number` | number |
| `multiple_choice` / `picture_choice` | array de ids de opción (o un id suelto si no es multi-selección) |
| `dropdown` | id de opción |
| `yes_no` / `legal` | boolean |
| `rating` | number (1..steps) |
| `opinion_scale` / `nps` | number (0..10 por defecto) |
| `ranking` | array ordenado de ids |
| `matrix` | objeto fila → columna(s) |
| `date` | string en el formato configurado |
| `file_upload` | `{ name, link/path }` |
| `payment` | objeto de pago |
| **`calendly`** | **`{ scheduled, event, invitee }`** |

Pantallas que no recogen respuesta: `welcome_screen`, `statement`,
`end_screen`, más el marcador `group`.

---

## 6. La pregunta `calendly` — el corazón de Pulso

**Documentado.** El tipo `calendly` incrusta la página de agendamiento y
_«the booking is saved as the answer»_, con valor `{ scheduled, event, invitee }`.
Puede reenviar parámetros de tracking (`utm_campaign`, `utm_source`,
`utm_medium`, `utm_content`, `utm_term`, `salesforce_uuid`) hacia Calendly.

**Definición de agenda en Pulso:** una respuesta que contiene una answer de
tipo `calendly` cuyo booking está confirmado. Ver `src/lib/domain/agenda.ts`.

**No documentado, y nos importa:**

- La forma interna de `event` e `invitee`. No sabemos si `event` incluye la
  fecha/hora de la reunión. Por eso Pulso agrupa el desglose diario por
  `submittedAt` (cuándo se agendó), que sí está garantizado.
- Cómo se serializa `scheduled` exactamente. El parser acepta varias formas
  plausibles y falla de manera explícita si no reconoce ninguna, en vez de
  contar de menos en silencio.

**Limitación estructural.** form30x guarda la respuesta en el momento del
booking y no existe evento de actualización desde Calendly. Una reunión
cancelada o reprogramada **no se refleja**. Pulso cuenta _bookings creados_,
no reuniones vigentes, y así lo dice en la interfaz.

---

## 7. Paginación

**Documentado:** `GET /forms/:id/responses` está _«paginadas por cursor»_.

**No documentado:** el nombre del parámetro del cursor, el nombre del campo del
cursor en la respuesta, el tamaño de página por defecto, el tamaño máximo, y el
orden de los resultados.

**Cómo lo trata Pulso.** `src/lib/api/pagination.ts` detecta el cursor en
runtime probando los nombres convencionales (`next_cursor`, `nextCursor`,
`cursor`, `next`, y un `meta`/`paging` anidado), y corta con un tope duro de
páginas para no entrar en un bucle infinito si el servidor devuelve siempre el
mismo cursor. En cuanto tengamos el `openapi.json`, esto se reemplaza por la
implementación exacta.

---

## 8. Filtro por fecha

**No documentado.** No aparece ningún parámetro `since`, `until`, `from`, `to`
ni equivalente para `/responses`.

**Impacto.** Si de verdad no existe, obtener «los últimos 7 días» obliga a
paginar el histórico completo de cada formulario y filtrar en memoria: el coste
es proporcional a todas las respuestas que existen, no a las del rango pedido.
Es el mayor riesgo de rendimiento del proyecto y la razón de que Pulso tenga
caché en servidor desde el primer día.

**Cómo lo trata Pulso.** `listResponses` acepta una ventana temporal opcional y
la envía como query params si `FORM30X_SUPPORTS_DATE_FILTER` está activo; en
cualquier caso **siempre** vuelve a filtrar en memoria, de modo que el
resultado es correcto tanto si el servidor honra el filtro como si lo ignora.

---

## 9. Rate limit

**No documentado. Ni una mención en toda la documentación:** ni cuota, ni
cabeceras de rate limit, ni `Retry-After`.

**Cómo lo trata Pulso.** Concurrencia limitada (`PULSO_MAX_CONCURRENCY`, por
defecto 4), reintentos con backoff exponencial y jitter ante `429` y `5xx`,
respeto de `Retry-After` si el servidor lo envía, y caché en servidor para que
N personas mirando el dashboard no se traduzcan en N tandas de peticiones.

---

## 10. Concurrencia, errores y validación

**Documentado**

- Todo `GET` devuelve un `ETag`. Se reenvía como `If-Match` al escribir; si el
  documento cambió, la escritura falla con `409` y devuelve el documento
  actual. Sin `If-Match`, gana el último que escribe.
- `422` en validación de integridad referencial, con `error.issues` señalando
  la ruta exacta. Los warnings viajan en `issues` dentro de un `200`.

**No documentado:** si el servidor honra `If-None-Match` para devolver `304` en
lecturas. Sería revalidación barata y gratis, pero **no se asume**: Pulso lo
detecta en runtime y solo lo aprovecha si el servidor responde `304`.

**No documentado:** la forma del cuerpo de error en `401`, `403` y `429`.

---

## 11. Webhooks

**Documentado.** `POST` de cada respuesta completada a tu URL. Cabeceras
`Content-Type: application/json`, `X-Form30x-Event` y
`X-Form30x-Signature: sha256=<HMAC-SHA256 del cuerpo crudo con el secreto
whsec_…>`. Verificar con comparación en tiempo constante. Un reintento
automático a ~1.5 s. Las entregas se registran con estado y cuerpo.

**Por qué Pulso no los usa en Fase 1.** Se configuran únicamente desde la UI
—no hay endpoint de API para gestionarlos—, exigen una URL pública accesible
desde internet y una base de datos donde persistir lo recibido. Una aplicación
que corre en `localhost` no puede recibirlos. Es infraestructura de Fase 2.

---

## 12. Otras integraciones (contexto, Pulso no las usa)

API Connector (dispara en la carga del formulario, no al enviar), HubSpot
Contacts, Slack, Google Sheets y Drive, y tracking con Pixel/GA4/GTM/JS
personalizado.

---

## 13. Lo que la API NO permite hacer

Inventario explícito de límites, para que nadie prometa lo imposible:

1. **No existe ningún endpoint de agregación.** Ni conteos, ni agrupación por
   día, ni `/analytics`. Todo KPI se calcula bajando respuestas crudas.
2. **No hay filtro de fecha documentado** en `/responses` (§8).
3. **No hay rate limit documentado** (§9).
4. **No hay push en tiempo real para un consumidor externo.** Ni SSE, ni
   long-polling, ni streaming. Los webhooks van hacia fuera, no hacia una app
   local. El refresco es polling por obligación, no por preferencia.
5. **La API no conoce el concepto «programa».** Conoce formularios y
   workspaces. El programa se deriva del nombre del formulario.
6. **Las cancelaciones de Calendly son invisibles** (§6).
7. **La analítica del propio producto no está expuesta.** Vistas, starts,
   completions, tasa de finalización, tiempo promedio y embudo de drop-off
   existen en la pestaña Results → Analytics, construidos desde una tabla
   interna `FormEvent`, pero **ningún endpoint REST los devuelve**. Sin ellos
   no hay tasa de conversión visita → agenda.
8. **No hay filtrado por tag, score ni contenido de respuesta.** Todo se filtra
   después de traerlo.
9. **No hay snapshots históricos.** Si alguien renombra una opción en el
   builder, las respuestas antiguas conservan el id pero el label se lee de la
   definición actual: un informe del mes pasado puede cambiar retroactivamente.
10. **Las respuestas parciales son ambiguas en la API.** Si un formulario tiene
    `partialSubmissions` activo se guardan respuestas incompletas que luego se
    «actualizan en sitio». La UI de Results distingue parcial de completada,
    pero la documentación no dice con qué campo viaja esa distinción en la API.
    Pulso las descarta de forma defensiva.
11. **Borrar un formulario borra sus respuestas.** Sin borrado suave ni
    auditoría.

---

## 14. Ejemplos de la documentación

Los ejemplos de la documentación usan `form.30x.com`; aquí van con el dominio
real:

```bash
# leer el documento completo
curl https://form.oracle30x.co/api/v1/forms/FORM_ID \
  -H "Authorization: Bearer f30x_live_..." -D-

# comprobar dónde acabaría un respondiente, antes de publicar
curl -X POST https://form.oracle30x.co/api/v1/forms/FORM_ID/simulate \
  -H "Authorization: Bearer f30x_live_..." -H "Content-Type: application/json" \
  -d '{"answers":{"q7x2ab91":"c_low"}}'
```

## 15. MCP y ACP

Existe un servidor MCP en `https://mcp.form.oracle30x.co/mcp` (Streamable
HTTP, JSON-RPC 2.0) cuyas herramientas se generan desde el mismo OpenAPI, y un
puente ACP por stdio. Pulso no los usa: para un dashboard, HTTP directo es más
simple y más fácil de cachear.
