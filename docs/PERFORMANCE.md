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
