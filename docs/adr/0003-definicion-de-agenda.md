# ADR 0003 — Qué cuenta como una agenda

**Estado:** aceptada · **Fecha:** 2026-09-03

## Decisión

Una **agenda** es una respuesta de form30x que contiene una answer de tipo
`calendly` con el booking confirmado. Definición dada por el equipo: «una
agenda es un Calendly o booking agendado».

La regla vive en un solo sitio, `src/lib/domain/agenda.ts`. Ningún otro módulo
decide qué cuenta y qué no.

## Detalles que la documentación no cierra

La documentación dice que el valor almacenado de una pregunta `calendly` es
`{ scheduled, event, invitee }`, pero no especifica cómo se serializa
`scheduled`. El parser acepta las formas plausibles (booleano, cadena
`"true"`/`"scheduled"`, presencia de un objeto `event` con datos) y, cuando el
valor tiene una forma que no reconoce, **lo registra como no reconocido en vez
de contarlo como cero**. Contar de menos en silencio es el peor resultado
posible para un dashboard de reportería.

## Se cuenta por fecha de agendamiento, no de reunión

El desglose diario agrupa por `submittedAt` —cuándo se hizo el booking—, que
es el único campo garantizado por la documentación. Agrupar por la fecha de la
reunión sería más útil comercialmente, pero depende de qué contenga exactamente
el objeto `event`, que la documentación no describe. Cuando se confirme con
datos reales, se ofrecerá como alternativa.

## Limitación que se hereda de la API

form30x guarda la respuesta en el momento del booking y no recibe eventos
posteriores de Calendly. **Una reunión cancelada o reprogramada no se refleja.**
Pulso cuenta bookings creados, no reuniones vigentes, y lo dice en la interfaz
en lugar de dejar que se asuma lo contrario.

## Respuestas parciales

Si un formulario tiene `partialSubmissions` activo se almacenan respuestas
incompletas. La documentación no dice con qué campo viajan en la API, así que
se descartan de forma defensiva cuando se detecta cualquier marca de
incompletitud reconocible.
