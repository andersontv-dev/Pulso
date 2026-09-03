# ADR 0004 — El día de negocio es America/Bogota

**Estado:** aceptada · **Fecha:** 2026-09-03

## Contexto

`submittedAt` llega en ISO-8601 UTC. Un desglose «día a día» exige decidir
dónde empieza el día, o los conteos quedan corridos varias horas y las agendas
de la tarde se contabilizan al día siguiente.

## Decisión

Huso de negocio configurable vía `PULSO_TIMEZONE`, por defecto
`America/Bogota` (30X es una escuela de negocios con sede en Colombia).

El troceo diario usa `@date-fns/tz`, no aritmética manual sobre `Date`. Los
presets de rango («hoy», «ayer», «últimos 7 días»…) se calculan en el mismo
huso, de modo que «hoy» significa lo mismo en el filtro y en la tabla.

Las claves de día son cadenas `YYYY-MM-DD` ya resueltas en el huso de negocio:
una vez construido el bucket, no queda ninguna ambigüedad que pueda
reinterpretarse más abajo.

## Consecuencias

- El CSV exportado lleva las fechas en el mismo huso, y la cabecera del archivo
  lo declara para que nadie lo interprete como UTC.
- Si el equipo reporta en otro huso, es una variable de entorno, no un cambio
  de código.
