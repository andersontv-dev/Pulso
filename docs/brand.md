# Marca 30X aplicada a Pulso

Fuente: brandbook oficial de 30X. Este documento traduce esas reglas a design
tokens de una interfaz web con modo claro y oscuro, y deja registradas las
mediciones de contraste que condicionan el maquetado.

> Nota sobre el brief: se mencionaba un `/docs/brand.pdf` que nunca llegó al
> repositorio. Los valores de abajo salen del brandbook oficial de 30X. Si el
> `brand.pdf` contradice algo, manda el PDF y se actualiza este documento.

---

## 1. Paleta oficial

| Color | Hex | Uso según el brandbook |
| ----- | --- | ---------------------- |
| Black Potencia | `#000000` | Portadas y cierres, títulos sobre claro, texto de cuerpo |
| **Amarillo X®** | `#E9FF7B` | Acento de energía **puntual (~10%)**: palabras hero, subrayados, filetes, CTAs. Nunca texto largo ni texto sobre blanco |
| Beige Crecimiento | `#DDD4C0` | Fondos alternativos cálidos, bloques destacados |
| Gris Net | `#F1F1F1` | Fondos claros, tarjetas, tablas cebra |
| White | `#FFFFFF` | Base estructural dominante |

Shades de jerarquía: amarillo `#F1FFAD` `#D9E565` `#BABF56` · beige `#F8F6F2`
`#F1EDE5` `#E2DBCA` `#B4AE9D` · grises `#EBEBEB` `#D6D6D6` `#8F8F8F` `#666666`
`#333333` `#1F1F1F`.

**Proporción cromática:** claros como base (60–70%), negro como estructura
(20–30%), Amarillo X solo para destacar (~10%). Si el amarillo domina la
pantalla, está mal usado.

**Gradientes oficiales** (solo estos): `#F1F1F1 → #E9FF7B` y `#FFFFFF → #E9FF7B`.

---

## 2. Contraste medido — la restricción que ordena el diseño

Ratios WCAG 2.1 calculados sobre la luminancia relativa real de cada color:

| Color | Sobre blanco `#FFFFFF` | Sobre negro `#000000` |
| ----- | ---------------------: | --------------------: |
| Amarillo X `#E9FF7B` | **1.10 : 1** ❌ | **19.05 : 1** ✅ |
| Amarillo shade `#D9E565` | 1.37 : 1 ❌ | 15.34 : 1 ✅ |
| Amarillo shade `#BABF56` | 1.97 : 1 ❌ | 10.68 : 1 ✅ |
| Gris `#8F8F8F` | 3.23 : 1 | 6.50 : 1 |
| Gris `#666666` | 5.74 : 1 ✅ | 3.66 : 1 |

Umbrales: **4.5:1** para texto normal (AA), **3:1** para texto grande y para
objetos gráficos y componentes de interfaz (WCAG 1.4.11).

### Las tres reglas que se derivan

1. **Ningún tono de amarillo de la marca sirve como texto sobre claro.** Ni
   siquiera el más oscuro (`#BABF56`, 1.97:1) llega al 4.5:1. Esto no es una
   opinión de diseño, es aritmética — y coincide con lo que el brandbook ya
   prohíbe explícitamente. En modo claro, el Amarillo X es **relleno**, con
   texto negro encima; nunca color de tipografía.
2. **Sobre negro el Amarillo X es excelente** (19.05:1). En modo oscuro puede
   ser color de texto, de acento y de serie destacada en las gráficas.
3. **Un relleno amarillo sobre blanco tampoco alcanza el 3:1** que exige
   WCAG 1.4.11 para objetos gráficos. Por eso, en modo claro, **toda superficie
   Amarillo X lleva un trazo oscuro** (`#BDC168` o más oscuro): el borde es lo
   que aporta el contraste, y es el mismo recurso que el brandbook usa para los
   botones ("pastilla Amarillo X, trazo `#BDC168`").

---

## 3. Tokens

Definidos como CSS custom properties en `src/app/globals.css`, en dos bloques
(`:root` y `.dark`). Nomenclatura compatible con shadcn/ui para que cualquier
componente añadido después con el CLI herede la marca sin retoques.

| Token | Claro | Oscuro | Papel |
| ----- | ----- | ------ | ----- |
| `--background` | `#FFFFFF` | `#000000` | Base |
| `--foreground` | `#1F1F1F` | `#F1F1F1` | Texto principal |
| `--card` | `#FFFFFF` | `#1F1F1F` | Superficie de tarjeta |
| `--muted` | `#F1F1F1` (Gris Net) | `#1F1F1F` | Fondos secundarios, cebra de tabla |
| `--muted-foreground` | `#666666` | `#8F8F8F` | Texto secundario (5.74:1 / 6.50:1) |
| `--border` | `#EBEBEB` | `#333333` | Separadores |
| `--accent` | `#E9FF7B` | `#E9FF7B` | Amarillo X — el mismo en ambos modos |
| `--accent-foreground` | `#000000` | `#000000` | Texto sobre amarillo, siempre negro |
| `--accent-ring` | `#BDC168` | `#BDC168` | Trazo obligatorio del amarillo en claro |
| `--warm` | `#DDD4C0` | `#3A362E` | Beige Crecimiento |

**Tipografía:** Inter en todo, vía `next/font/google` (self-hosted, sin
petición a Google en runtime). Jerarquía adaptada del brandbook: H1 Bold,
H2 SemiBold, H3 Medium, cuerpo Regular con interlínea ~1.4, metadatos Medium.
Todo alineado a la izquierda; nada centrado.

---

## 4. Gráficas: por qué no hay paleta de series

El problema real: la marca tiene **un** color de acento sobre una base
monocroma, y el dashboard puede mostrar hasta 18 programas.

Se intentó construir una escala categórica de seis pasos con los tonos de la
marca (`#000000` `#333333` `#666666` `#8F8F8F` `#B4AE9D` `#E9FF7B` en claro, y
los amarillos y beiges en oscuro). **Ambas fallaron la validación**, y no por
poco:

| Comprobación | Claro | Oscuro |
| ------------ | ----- | ------ |
| Banda de luminosidad | FAIL | FAIL |
| Suelo de croma (lee como gris) | FAIL | FAIL |
| Separación para daltonismo | PASS (ΔE 10.0) | WARN (ΔE 6.1) |
| Suelo de visión normal (ΔE ≥ 15) | **FAIL (10.4)** | **FAIL (7.1)** |

El suelo de visión normal es el dato demoledor: `#B4AE9D` y `#8F8F8F` están a
ΔE 10.4, y `#D9E565` y `#E9FF7B` a ΔE 7.1. **Ni siquiera alguien con visión
cromática completa distingue esos pares en una gráfica.** No es un problema de
accesibilidad que se resuelva con un patrón de textura: es que la paleta de la
marca no contiene hues suficientes para codificar identidad por color, y
forzarla produciría una gráfica ilegible con estética de marca.

### La decisión: la identidad no se codifica con color

En vez de inventar hues fuera de la marca o de enviar una escala que no supera
sus propias comprobaciones, se cambia la forma:

1. **Una gráfica agregada de serie única** — el total diario de agendas. Una
   sola serie no necesita escala categórica ni leyenda: el título la nombra.
   La marca de datos es **neutra en los dos modos**: `#000000` en claro
   (21:1 sobre blanco) y `#D6D6D6` en oscuro (14.4:1 sobre negro). Ambas muy
   por encima del 3:1 de WCAG 1.4.11.

   Se probó primero con Amarillo X como marca principal en modo oscuro. Al
   renderizarlo, el resultado incumplía el brandbook: siete barras grandes
   convertían el amarillo en el color dominante de la pantalla, no en el
   acento del ~10% que manda la proporción cromática. La marca neutra deja el
   amarillo libre para lo que sí destaca.
2. **Pequeños múltiplos para el desglose por programa** — cada programa tiene
   su propia mini-gráfica en su propia fila, **todas del mismo color**. La
   identidad la da la posición y la etiqueta de texto de la fila, no el tono.
   Es más legible con 18 programas de lo que sería cualquier paleta de 18
   colores, y encaja con lo que se pidió: una fila por programa con el día a
   día.
3. **El Amarillo X queda libre para lo que sí es puntual**: la barra del mejor
   día, el filete de los encabezados, el preset de fecha activo, la casilla
   marcada. Ese es exactamente el ~10% de uso que manda el brandbook.

Tokens resultantes: `--chart-mark`, `--chart-destacado` y `--chart-grid`. No
hay `--chart-1..6` porque no hay series que numerar.

**El color nunca es el único portador de significado.** Cada mini-gráfica va
etiquetada con el nombre de su programa, los valores están como texto en la
tabla, y la gráfica agregada lleva su total anotado.

## 5. Voz

Español, tono directo, frases cortas, verbos activos en presente, segunda
persona. Sin emojis, sin signos de exclamación, sin clichés. Aplicado a los
textos de interfaz: los estados vacíos y de error dicen qué pasó y qué hacer,
no piden disculpas.

Ejemplos usados en Pulso: «No hay agendas en este periodo.» · «No pudimos
cargar los datos.» · «Reintentar».

---

## 6. Lo que NO se usa en Pulso

Las figuras geométricas en duplas sangradas y la fotografía editorial son
recursos de pieza impresa y presentación. Un dashboard operativo que se mira
muchas veces al día prioriza densidad de información y legibilidad: metemos la
marca por paleta, tipografía, retícula a la izquierda y uso disciplinado del
acento, no por ornamento detrás de las tablas.
