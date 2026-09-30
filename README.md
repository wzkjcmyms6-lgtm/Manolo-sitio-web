# Manolo — Panel personal

Sitio web estático (HTML/CSS/JS puro, sin dependencias) para llevar control personal de hábitos, ejercicio y finanzas/inversiones.

## Estructura

- `index.html` — pantalla de inicio con versículo del día y accesos a cada sección.
- `habitos.html` — seguimiento semanal de hábitos (marca los días cumplidos).
- `ejercicio.html` — Ejercicio: mapa muscular (frente/espalda) y radar de distribución por semana, Gimnasio (rutinas, registro con buscador de ~570 ejercicios, RPE, notas, edición), Running y Bicicleta. Detalles en [`docs/mapa-muscular.md`](docs/mapa-muscular.md). Rangos de fuerza (estilo Symmetry) en Ejercicio › Rangos: [`docs/rangos.md`](docs/rangos.md).
- `finanzas.html` — registro de ingresos, gastos e inversiones con balance.
- `css/style.css` — estilos compartidos. Incluye un layout de **escritorio** (barra lateral fija) y uno de **móvil** distinto (barra superior + menú deslizante + barra de navegación inferior), controlados por media queries (`max-width: 768px`).
- `js/verses.js` — banco de versículos y lógica del "versículo del día".
- `js/main.js` — navegación (menú móvil, resaltado de sección activa).
- `js/habitos.js`, `js/gimnasio.js`, `js/running.js`, `js/bicicleta.js`, `js/finanzas.js` — lógica de cada sección.
- `js/muscle-engine.js`, `js/exercise-search.js`, `js/body-map.js`, `js/muscle-radar.js` (y afines) — mapa muscular; `data/ejercicios.json` se genera con `npm run ejercicios` desde free-exercise-db (dominio público).
- `sw.js` + `js/offline.js` — la app funciona sin conexión.

## Tests

`npm test` (usa el test runner de Node, sin dependencias).

## Datos

Los datos se guardan en Firebase (Firestore), dentro de la carpeta de cada usuario, con caché offline en el teléfono: sin conexión se ve lo último y lo que registres se sube solo al volver la red.

## Cómo verlo

Al ser un sitio estático, basta con abrir `index.html` en el navegador, o servirlo con cualquier servidor estático (por ejemplo `python3 -m http.server`) y también funciona directamente en GitHub Pages.
