# Catálogo de programas 30X

Fuente: *Programas CRECE 30X — Portafolio 2026* (PDF, 47 páginas, agosto 2026).

El portafolio declara **18 programas en 6 ramas**. Este catálogo alimenta
`src/lib/config/programas.ts`, que sirve para dos cosas: normalizar el nombre
que se muestra en la interfaz y agrupar por rama.

## ⚠️ El catálogo está incompleto, a propósito

El PDF recibido **está recortado**: salta de la página 02 (índice) a la página
08, así que faltan las fichas de la **rama 01 · Presenciales** (2 programas).
De los 18 programas, aquí están documentados 16. «Inmersión Ejecutiva» aparece
nombrada en la página 44 del portafolio y se incluye por eso; el segundo
programa de Presenciales no consta en el documento recibido.

**Esto no rompe Pulso.** El emparejamiento entre formulario y programa está
diseñado para degradar con elegancia: un formulario cuyo nombre no case con
ningún programa conocido **no se descarta**, se agrupa bajo «Sin programa
identificado» y la interfaz lo muestra de forma visible. Un dato huérfano que
se ve es un problema que se puede arreglar; uno que se descarta en silencio es
un número mal que nadie detecta.

Para completar el catálogo: añade las entradas que falten en
`src/lib/config/programas.ts`. No hace falta tocar nada más.

## Ramas

| # | Rama | Programas | Descripción |
| - | ---- | --------: | ----------- |
| 01 | Presenciales | 2 | Inmersiones y membresías donde founders y ejecutivos comparten sala con operadores que ya escalaron en LATAM |
| 02 | Inteligencia Artificial | 5 | Del criterio ejecutivo al agente en producción |
| 03 | Ventas | 3 | Sistemas comerciales B2B repetibles y medibles |
| 04 | Growth | 4 | Adquisición, activación, retención y monetización |
| 05 | Startups | 3 | Fundamentos, fundraising real y gestión de producto |
| 06 | Empresas | 1 | Formación corporativa en IA por área |

## Programas

| # | Programa | Rama |
| - | -------- | ---- |
| 01 | *(no consta en el PDF recibido)* | Presenciales |
| 02 | Inmersión Ejecutiva | Presenciales |
| 03 | AI for Executives | Inteligencia Artificial |
| 04 | AI for Developers | Inteligencia Artificial |
| 05 | Operaciones con AI | Inteligencia Artificial |
| 06 | AI Second Brain | Inteligencia Artificial |
| 07 | Next | Inteligencia Artificial |
| 08 | Sales Machine | Ventas |
| 09 | AI Sales | Ventas |
| 10 | LinkedIn Sales | Ventas |
| 11 | Growth Rockstar | Growth |
| 12 | Advanced Strategy | Growth |
| 13 | Xtreme Growth | Growth |
| 14 | Instagram & TikTok | Growth |
| 15 | Fundraising Fundamentals | Startups |
| 16 | Raise Your Round | Startups |
| 17 | Product Rockstar | Startups |
| 18 | Planes Corporativos | Empresas |

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
