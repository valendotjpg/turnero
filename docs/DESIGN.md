# Sistema visual de Turnero: "cuero y cobre"

Adaptación de una referencia de estilo tipo afiche (lienzo oscuro, un único color de acción, tipografía condensada enorme, todo plano) a un negocio de turnos de barrio. Se conserva la **estructura** de la referencia y se reemplaza la **paleta**: el rojo sangre y el vino de una marca de comida pasan a espresso, cuero, cobre y crema, más propios de una barbería, una peluquería o un estudio.

Los tokens viven en [`src/app/globals.css`](../src/app/globals.css) y los estilos de botones, píldoras, tarjetas y campos en [`src/components/styles.ts`](../src/components/styles.ts).

## Colores

| Token | Valor | Rol | Equivale en la referencia a |
| --- | --- | --- | --- |
| `background` | `#1a120c` espresso | Lienzo de todas las páginas | Velvet Wine |
| `card` | `#2b1d14` cuero | Tarjetas y secciones | Burgundy Stage |
| `accent` | `#f2742b` cobre | **La única señal de color**: acciones, estado activo y títulos | Impossible Red |
| `soft` | `#f5dcc2` crema | Opciones sin elegir, contrapunto suave | Blush Highlight |
| `nav` / `border` | `#000000` | Barra superior y filetes de tarjetas | Butcher Black |
| `foreground` | `#fbf6f0` hueso | Texto | Bone White |
| `muted` | `#c4a88e` | Texto secundario | — |
| `line` | `#8a6c57` | Borde de campos y botones fantasma | — |
| `danger` | `#ff8b73` | Errores (no es parte de la marca, pero la app los necesita) | — |

**Contraste verificado (WCAG):** texto ≥ 15:1, secundario ≥ 7:1, cobre sobre cuero 5,7:1, texto del botón (espresso) sobre cobre 6,4:1, bordes de campos ≥ 3,4:1.

**Diferencia con la referencia:** el texto de los botones va en espresso y no en blanco, porque el blanco sobre cobre no llega a 4,5:1.

## Tipografía

- **Títulos:** [Anton](https://fonts.google.com/specimen/Anton) (condensada, gratuita) en mayúsculas, con interlineado `0.9` (la referencia usa 0.73–0.8, pero las mayúsculas de Anton son más altas y con eso las líneas se pisan) y tracking `0.02em` (clase `display-type`). Reemplaza a la condensada propietaria de la referencia.
- **Texto e interfaz:** Geist.
- **Rótulos:** mayúsculas chicas con tracking abierto (clase `eyebrow`), a veces entre corchetes: `◂ PASO 1 ▸`.
- Cada página pública tiene una declaración grande: el hero de la landing (hasta 160 px), el nombre del negocio, "¡Listo, Ana!". En el panel, que es una herramienta de trabajo, los títulos se quedan en 48–60 px.

## Forma

- Botones y píldoras: radio de **15 px**, mayúsculas, 14 px. La acción principal es cobre lleno; la secundaria, un fantasma con borde, en la misma fila.
- Tarjetas: radio de **12 px**, superficie cuero, filete negro de 1 px. **Sin sombras ni degradés.**
- Opciones elegibles (servicios, días, horarios, días de la semana del panel): píldoras crema que pasan a cobre al elegirlas.
- Barra superior negra y fija en todas las páginas.

## Emails

Los clientes de correo manejan mal los fondos oscuros, así que los emails usan la misma paleta sobre fondo claro: títulos en una condensada del sistema (Impact) y un cobre más oscuro (`#b8521a`) para que el texto blanco del botón llegue a 4,9:1.

## No

- No sumar colores: cualquier tono nuevo rompe la disciplina de un solo acento.
- No usar el cobre para texto corrido ni para bordes.
- No volver al tema claro: el lienzo oscuro es la base de la identidad.
