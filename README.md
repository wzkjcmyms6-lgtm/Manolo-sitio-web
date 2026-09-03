# Manolo — Panel personal

Sitio web estático (HTML/CSS/JS puro, sin dependencias) para llevar control personal de hábitos, ejercicio y finanzas/inversiones.

## Estructura

- `index.html` — pantalla de inicio con versículo del día y accesos a cada sección.
- `habitos.html` — seguimiento semanal de hábitos (marca los días cumplidos).
- `ejercicio.html` — registro de entrenamientos (fecha, tipo, duración, notas).
- `finanzas.html` — registro de ingresos, gastos e inversiones con balance.
- `css/style.css` — estilos compartidos. Incluye un layout de **escritorio** (barra lateral fija) y uno de **móvil** distinto (barra superior + menú deslizante + barra de navegación inferior), controlados por media queries (`max-width: 768px`).
- `js/verses.js` — banco de versículos y lógica del "versículo del día".
- `js/main.js` — navegación (menú móvil, resaltado de sección activa).
- `js/habitos.js`, `js/ejercicio.js`, `js/finanzas.js` — lógica de cada sección.

## Datos

Por ahora todos los datos se guardan en el navegador (`localStorage`), como primera versión rápida de usar. Es un buen punto de partida para migrar después a una base de datos independiente (por ejemplo, un backend propio o un servicio como Supabase/Firebase) sin tener que rediseñar la interfaz.

## Cómo verlo

Al ser un sitio estático, basta con abrir `index.html` en el navegador, o servirlo con cualquier servidor estático (por ejemplo `python3 -m http.server`) y también funciona directamente en GitHub Pages.
