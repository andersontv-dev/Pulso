# Catálogo de programas 30X

Fuente: _Programas CRECE 30X — Portafolio 2026_ (PDF, 47 páginas, agosto 2026).

El portafolio declara **18 programas en 6 ramas**. Este catálogo alimenta
`src/lib/config/programas.ts`, que sirve para dos cosas: normalizar el nombre
que se muestra en la interfaz y agrupar por rama.

## El catálogo se validó contra la cuenta real

El PDF recibido está recortado: salta de la página 02 (índice) a la 08, así
que faltan las fichas de la rama 01 · Presenciales. Ese hueco **se cerró
cruzando el catálogo con los 50 formularios reales de la cuenta**, que es una
fuente mejor que el portafolio impreso porque refleja lo que de verdad está
recibiendo inscripciones.

Lo que apareció al hacer ese cruce:

| Hallazgo                                                                                                                                        | Qué se hizo                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| «Operaciones Escalables con AI» (239 respuestas) no casaba: el portafolio lo llama «Operaciones con AI»                                         | Se añadió el alias real                                                      |
| «Inmersivo Presencial» (3.046 respuestas) es el programa de Presenciales que faltaba                                                            | Se renombró la entrada y se ajustaron los alias                              |
| «Multiplier Meeting» y «Salas de mentorías Multiplier» confirman **Multipliers** como el segundo programa de Presenciales                       | Se añadió al catálogo                                                        |
| «IA para abogados» (1.457 respuestas), «Aceleradora 5Q» (324) y «Becas Lab10» (8) tienen volumen real pero no están entre los 18 del portafolio | Se añadieron como **programas aliados**, que es como los nombra la página 45 |
| «Fundraising School» es el nombre real del formulario, no «Fundraising Fundamentals»                                                            | Se añadió el alias                                                           |

Sin estas correcciones, unas 5.000 respuestas habrían caído en «Sin programa
identificado».

**El catálogo seguirá quedándose corto**, porque cada cohorte nueva trae
formularios nuevos. Por eso el emparejamiento degrada con elegancia: un
formulario cuyo nombre no case con ningún programa conocido **no se descarta**,
se agrupa bajo «Sin programa identificado» y la interfaz lo muestra con un
aviso. Un dato huérfano que se ve es un problema que alguien puede arreglar;
uno que se descarta en silencio es un número mal que nadie detecta.

Para ampliarlo: añade la entrada en `src/lib/config/programas.ts` con los
alias que aparezcan en el título del formulario. No hace falta tocar nada más.

**Formularios que nunca aparecerán**, y está bien que así sea: los que no
tienen pregunta de Calendly. Pulso ni siquiera descarga sus respuestas, porque
no pueden producir una agenda. Eso deja fuera automáticamente las encuestas
NPS, los formularios de prueba («My typeform»), las listas de espera y los
marcados como `[NO USAR]`, sin necesidad de mantener una lista negra.

## Ramas

| #   | Rama                    | Programas | Descripción                                                                                                  |
| --- | ----------------------- | --------: | ------------------------------------------------------------------------------------------------------------ |
| 01  | Presenciales            |         2 | Inmersiones y membresías donde founders y ejecutivos comparten sala con operadores que ya escalaron en LATAM |
| 02  | Inteligencia Artificial |         5 | Del criterio ejecutivo al agente en producción                                                               |
| 03  | Ventas                  |         3 | Sistemas comerciales B2B repetibles y medibles                                                               |
| 04  | Growth                  |         4 | Adquisición, activación, retención y monetización                                                            |
| 05  | Startups                |         3 | Fundamentos, fundraising real y gestión de producto                                                          |
| 06  | Empresas                |         1 | Formación corporativa en IA por área                                                                         |

## Programas

| #   | Programa                         | Rama                    |
| --- | -------------------------------- | ----------------------- |
| 01  | _(no consta en el PDF recibido)_ | Presenciales            |
| 02  | Inmersión Ejecutiva              | Presenciales            |
| 03  | AI for Executives                | Inteligencia Artificial |
| 04  | AI for Developers                | Inteligencia Artificial |
| 05  | Operaciones con AI               | Inteligencia Artificial |
| 06  | AI Second Brain                  | Inteligencia Artificial |
| 07  | Next                             | Inteligencia Artificial |
| 08  | Sales Machine                    | Ventas                  |
| 09  | AI Sales                         | Ventas                  |
| 10  | LinkedIn Sales                   | Ventas                  |
| 11  | Growth Rockstar                  | Growth                  |
| 12  | Advanced Strategy                | Growth                  |
| 13  | Xtreme Growth                    | Growth                  |
| 14  | Instagram & TikTok               | Growth                  |
| 15  | Fundraising Fundamentals         | Startups                |
| 16  | Raise Your Round                 | Startups                |
| 17  | Product Rockstar                 | Startups                |
| 18  | Planes Corporativos              | Empresas                |

## Cómo se empareja un formulario con su programa

La API de form30x no conoce el concepto «programa»: solo formularios y
workspaces. Según indicación del equipo, **el nombre del formulario contiene el
programa**.

El emparejamiento vive en `src/lib/domain/programa.ts` y normaliza antes de
comparar: minúsculas, sin acentos, sin signos de puntuación y con los espacios
colapsados. Así «AI Sales — Cohorte 12», «ai-sales_form» y «Formulario AI
Sales» caen los tres en el mismo programa.

Se busca la coincidencia **más larga** de entre todos los alias, para que
«Sales Machine» no sea capturado por el alias «sales» de otro programa. Los
alias por programa se declaran en el catálogo y se pueden ampliar sin tocar la
lógica.
