# ADR 0001 — El refresco "en tiempo real" es polling

**Estado:** aceptada · **Fecha:** 2026-09-03

## Contexto

La Fase 1 pide «datos en tiempo real» y que se justifique la estrategia elegida
entre polling, SSE o webhooks, «según lo que permita la API».

## Qué permite la API

- **SSE / streaming / long-polling:** no existe. La documentación no expone
  ningún endpoint de este tipo. Descartado por imposible, no por preferencia.
- **Webhooks:** existen (`response.completed`, firmados con HMAC-SHA256), pero
  (a) se configuran solo desde la UI de form30x, no hay endpoint de API para
  gestionarlos; (b) empujan hacia una URL pública accesible desde internet, que
  una aplicación corriendo en `localhost` no tiene; y (c) obligan a persistir lo
  recibido en una base de datos que Fase 1 no contempla.
- **Polling sobre REST:** es lo único disponible.

## Decisión

Polling con `refetchInterval` de TanStack Query, 60 s por defecto
(`PULSO_POLL_INTERVAL_MS`), con cuatro atenuantes:

1. **Solo si el rango incluye hoy.** Un rango histórico no cambia; en ese caso
   el intervalo se desactiva. Esto elimina la mayor parte del tráfico inútil.
2. **Pausa con la pestaña oculta** (`refetchIntervalInBackground: false`) y
   refresco al recuperar el foco.
3. **Caché en servidor** (ADR 0002): N personas mirando el dashboard son una
   sola tanda de peticiones a form30x, no N.
4. **Cliente defensivo:** concurrencia limitada, backoff exponencial con jitter,
   respeto de `Retry-After`, y corte del auto-refresco tras varios fallos
   consecutivos, mostrando el error con botón de reintento.

La interfaz muestra siempre «actualizado hace X» y permite refrescar a mano.
Un dato viejo etiquetado como viejo es honesto; un dato viejo que aparenta ser
fresco es un error de producto.

## Consecuencias

- La latencia máxima entre una agenda real y su aparición es el intervalo de
  polling. Aceptable para reportería; no sirve para alertas de segundos.
- `RealtimeStrategy` queda como una interfaz en el código, de modo que Fase 2
  pueda enchufar webhooks sin tocar la interfaz de usuario.
