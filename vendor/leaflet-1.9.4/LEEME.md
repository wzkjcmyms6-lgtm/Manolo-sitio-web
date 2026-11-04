# Leaflet 1.9.4 (vendorizado)

Copia de `leaflet/dist/leaflet.js` (solo sin el comentario final `sourceMappingURL`) y `leaflet.css` del paquete
npm `leaflet@1.9.4` (licencia BSD-2-Clause, ver `LICENSE`). Recuperado de git
(`a66de91`) en 2026-11 para mostrar las rutas importadas (D-068). Lo carga
`js/run-mapa.js` **solo al abrir un mapa** (detalle de una actividad); no está
en `index.html`, pero el service worker lo guarda para usarlo sin internet.
Las teselas vienen de OpenStreetMap con su atribución visible y sin descargas
masivas (ver `docs/DECISIONS.md`, D-009 y D-068).
