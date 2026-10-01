# Rendimiento y batería

## Mediciones (fase 7, 1 oct 2026)

| Qué | Tamaño | Comprimido (gzip) |
|---|---|---|
| Todo lo que carga `index.html` | 1.713 KB | 494 KB |
| · Firebase (firestore + auth) | 465 KB | 136 KB |
| · Finanzas (`js/finanzas/app.js`) | 266 KB | 71 KB |
| · Deporte (Running, Bici, rutinas, análisis) | 119 KB | 44 KB (9 %) |
| Leaflet (solo al abrir un mapa) | 144 KB | — |
| `data/ejercicios.json` (tras iniciar sesión) | 156 KB | — |

El service worker guarda todo en el teléfono: desde la segunda apertura la
app carga sin red. Leaflet queda en caché la primera vez que se abre un mapa.

## Decisiones

- **No se carga el deporte "por partes"** (D-030): ahorraría ~44 KB
  comprimidos con riesgo de romper el orden de carga; no compensa.
- **Durante la actividad** (D-031): la pantalla se actualiza 1 vez por
  segundo (4 con rutina, para la cuenta 3-2-1); el trazo en vivo se redibuja
  como mucho cada 3 s; el borrador local se guarda cada 10 s (30 s con más de
  3.000 puntos); tras 3 minutos en pausa se apaga el GPS y vuelve al reanudar;
  la pantalla encendida se suelta al pausar.
- **Mapas**: los que se cierran se liberan (`remove()`), sin acumular
  oyentes en la ventana.
- **Gráficos**: escala mínima en el eje Y (30 s/km, 4 km/h, 10 m) para no
  exagerar diferencias chicas.
- **Escritorio**: la actividad y su resumen tienen un ancho máximo (560 px).
