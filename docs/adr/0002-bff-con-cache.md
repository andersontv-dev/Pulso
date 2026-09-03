# ADR 0002 — El navegador no habla con form30x

**Estado:** aceptada · **Fecha:** 2026-09-03

## Contexto

La API no tiene ningún endpoint de agregación: para saber cuántas agendas hubo
cada día hay que traerse las respuestas crudas y contarlas. Además, la
documentación advierte que una API key de form30x lee y edita **cualquier**
formulario de la compañía.

## Decisión

Toda comunicación con form30x pasa por route handlers de Next
(`src/app/api/**`). El navegador solo consume `/api/agendas`, que devuelve
series ya agregadas.

Tres razones, en orden de importancia:

1. **Seguridad.** La API key es, según la propia documentación, una credencial
   de admin de toda la compañía. En el cliente sería visible con las DevTools
   abiertas. Puesta en el servidor, nunca entra en el bundle. La frontera está
   además impuesta por ESLint (`no-restricted-imports` sobre `@/lib/api`), no
   solo por convención.
2. **Volumen.** Agregar miles de respuestas para pintar treinta barras es
   trabajo de servidor. En el cliente sería descargar megabytes en cada
   refresco.
3. **Coste compartido.** Con un caché de TTL corto en servidor
   (`PULSO_CACHE_TTL_MS`), varias personas mirando el mismo rango comparten una
   sola tanda de peticiones.

## Consecuencias

- El caché es en memoria del proceso. Suficiente para un despliegue de una
  instancia o para uso local; si Pulso escala a varias instancias hará falta un
  caché compartido. Anotado como deuda técnica.
- El contrato entre servidor y cliente (`AgendasResponse`) queda como frontera
  explícita, que es justo lo que Fase 3 necesita para consultar datos sin
  reimplementar la agregación.
