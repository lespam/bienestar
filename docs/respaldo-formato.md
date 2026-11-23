# Formato del respaldo y del paquete de continuidad

El respaldo y el paquete de continuidad son **el mismo archivo**: un ZIP. Se exporta en un aparato (teléfono o
computadora) y se importa en el otro, en cualquier dirección. No hay cuentas ni servidor.

## Contenido del ZIP

| Archivo | Qué es |
| --- | --- |
| `datos.json` | Todas las tablas de la base y la información del paquete (abajo). |
| `fotos/N.ext` | Las fotos y las imágenes, una por archivo. En `datos.json` cada una aparece como `{ "$foto": "fotos/N.ext", "tipo": "image/jpeg" }`. |

## `datos.json`

```json
{
  "app": "bienestar",
  "formato": 2,
  "fecha": "2026-11-23",
  "creado": 1795410000000,
  "origen": "telefono",
  "areas": { "comida": 1795409000000, "cuerpo": 1795300000000 },
  "tablas": { "menu": [ … ], "recetas": [ … ] }
}
```

- `app`: siempre `"bienestar"`. Si no es así, el archivo se rechaza.
- `formato`: la versión del archivo. Una app solo abre archivos de su versión o de una anterior; uno más nuevo se rechaza con un aviso, sin cambiar nada.
- `fecha`: AAAA-MM-DD en que se creó.
- `creado` (formato 2): milisegundos desde 1970, para decirte «se creó hoy 8:15 pm».
- `origen` (formato 2): `telefono`, `computadora` u `otro`. Solo se usa para decírtelo.
- `areas` (formato 2): cuándo cambió por última vez cada **área** (milisegundos). Las áreas sin cambios anotados no aparecen.
- `tablas`: una lista de filas por tabla de la base.

### Qué nunca viaja
- La clave de la IA (`ajustes` → `ia.clave`) y cualquier otra clave privada.
- Las copias internas (`copias`) y las fechas internas de cambio (`sync`).
- Un cronómetro o temporizador corriendo.

### Versiones
| Formato | Qué trae |
| --- | --- |
| 1 | Solo `app`, `formato`, `fecha` y `tablas`. Al importarlo no hay fechas por área: se propone traer todo, como siempre. |
| 2 | Agrega `creado`, `origen` y `areas`. |

Para subir el formato: sube `FORMATO` en `src/core/respaldo.ts`, documenta aquí lo que cambia y mantén la lectura de los formatos anteriores.

## Áreas

Cada tabla está en una sola área (`src/core/grupos.ts`; una prueba falla si una tabla nueva no está en ninguna).

| Área | Tablas |
| --- | --- |
| Rutina y sesiones | `sesiones`, `series`, `descansos`, `sustitutos`, `fichas`, `entreno`, `calentados` |
| Comida y menú | `recetas`, `perfiles`, `comida`, `menu`, `flexibles`, `registro`, `historial` |
| Cuerpo | `pesos`, `medidas`, `fotos`, `periodo`, `cuerpo` |
| Mente y Alma | `metas`, `areas`, `semanas`, `mente`, `mensajes`, `coleccion` |
| Hogar | `hogar`, `hogarDia` |
| Herramientas | `herramientas` |
| Ajustes y contenido personal | `ajustes`, `contenido` |

Cada tabla se puede combinar de una de tres formas: por **clave** (cada fila tiene la suya), como **filas** sueltas (se
comparan por su contenido) o como **bloque** (filas que se apuntan entre sí, como una sesión y sus series: solo se
reemplazan o se conservan completas). Un área se puede combinar si ninguna de sus tablas es un bloque.

## Cómo se decide al importar

La app guarda en la tabla `sync` dos cosas, solo en ese aparato:
- `mod`: cuándo cambió cada tabla (se anota con ganchos de la base en cada escritura).
- `base`: la fecha de cada área en el último intercambio (cuando se **entrega** un paquete o se **recibe** uno).

Para cada área se compara la fecha del paquete (A) y la de aquí (L) con esa base (B):

| Cambió el paquete (A > B) | Cambió lo de aquí (L > B) | Se propone |
| --- | --- | --- |
| sí | no | Reemplazar con el paquete |
| no | sí | Conservar lo de aquí |
| sí | sí | Combinar (si se puede); si no, gana la fecha más reciente |
| no | no | Nada |

Reglas fijas: nunca se borra lo de aquí con un área vacía del paquete; si aquí no hay nada, se trae el paquete; un
respaldo sin fechas (formato 1) propone reemplazar. **Tú siempre confirmas** y puedes cambiar cada área.

Al combinar: las tablas por clave se juntan y, si la misma clave cambió en los dos lados, gana el lado más reciente del
área; las filas sueltas se agregan si no están ya. Lo que se quitó en un aparato puede volver.

Antes de cambiar algo se guarda una copia interna (7 días), y «Deshacer» vuelve a ella.

Las fechas son las del reloj de cada aparato: si uno está mal puesto, la comparación se confunde. Por eso la app siempre muestra las fechas antes de aplicar.
