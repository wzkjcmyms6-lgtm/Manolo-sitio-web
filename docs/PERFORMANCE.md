# Rendimiento y batería

## Mediciones (fase 7, 1 oct 2026)

| Qué | Tamaño | Comprimido (gzip) |
|---|---|---|
| Todo lo que carga `index.html` | 1.713 KB | 494 KB |
| · Firebase (firestore + auth) | 465 KB | 136 KB |
| · Finanzas (`js/finanzas/app.js`) | 266 KB | 71 KB |
| · Deporte (Running, Bici, rutinas, análisis) | 119 KB → **68 KB** sin GPS (D-033) | 44 KB → **22 KB** |
| `data/ejercicios.json` (tras iniciar sesión) | 156 KB | — |

El service worker guarda todo en el teléfono: desde la segunda apertura la
app carga sin red.

## Demos de los ejercicios (2026-11-05, D-091)

1114 imágenes WebP (15,4 MB en el repo, ~14 KB cada una) que **no** entran
en el precache: el teléfono baja solo las que ves (máx. 240 guardadas,
~3,4 MB) y las de tus rutinas (~30 KB por ejercicio). La base de
ejercicios pasa de 156 KB a 180 KB por los campos nuevos (`mec`, `fz`,
`niv`, `demo`).

## Biblia (2026-11-06, D-102)

El texto de la Reina-Valera 1909 son 66 archivos JSON (3,8 MB; 1,26 MB
comprimido) que **no** entran en el precache: cada libro se baja al
abrirlo (Salmos, el más grande, ~250 KB) y queda en la caché
`manolo-biblia`; "Descargar la Biblia" guarda los 66. El arranque suma
solo el código y los estilos del lector (~36 KB sin comprimir). En memoria quedan los 8
últimos libros abiertos.

## Decisiones

- **No se carga el deporte "por partes"** (D-030): ahorraría ~44 KB
  comprimidos con riesgo de romper el orden de carga; no compensa.
- **Durante una rutina guiada**: la pantalla se actualiza 4 veces por
  segundo (para que la cuenta 3-2-1 caiga a tiempo; solo cambia texto); el
  borrador local se guarda cada 10 s; la pantalla encendida se suelta al
  pausar. Sin GPS no hay consumo de ubicación (D-033).
- **Resumen semanal**: un SVG chico dibujado al ancho real de su caja (se
  redibuja solo si cambia el ancho o la semana elegida).
- **Escritorio**: la rutina y su resumen tienen un ancho máximo (560 px); el
  resumen semanal, 720 px.
