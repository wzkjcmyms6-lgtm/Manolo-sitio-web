# Manolo — Panel personal

Aplicación web instalable (PWA) para llevar **Hábitos, Ejercicio (gimnasio,
Running con rutinas guiadas y Bicicleta, con resumen semanal), Finanzas e Inversiones**. HTML/CSS/JS puro,
sin compilación; datos en Firebase (Auth + Firestore) con caché offline.

- `index.html` — la app completa (una sola página; las demás `.html` solo
  redirigen). Navegación por `#hash` en `js/modules.js`.
- `js/` — un archivo por pantalla y módulos de cálculo sin pantalla (UMD)
  probados con `node --test`.
- `vendor/` — Firebase 10.7.1 guardado en el repo.
- `sw.js` + `js/offline.js` — funciona sin conexión (`npm run sw` tras
  cambiar archivos).
- `firestore.rules` — copia de las reglas de seguridad (se publican en la
  consola de Firebase; ver `docs/ADMIN.md`).

## Documentación

Empieza por [`docs/PROJECT.md`](docs/PROJECT.md) (índice) y
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Estado actual del trabajo:
[`.claude/PROJECT_STATE.md`](.claude/PROJECT_STATE.md).

## Pruebas

- `npm test` — pruebas de la lógica (Node 18+, sin instalar nada).
- `node scripts/e2e/<prueba>.js [carpeta-capturas]` — pruebas de pantalla con
  Playwright y un Firebase falso (ver `docs/TESTING.md`).

## Cómo verlo

Servir la carpeta con cualquier servidor estático (por ejemplo
`python3 -m http.server`) o abrir la versión publicada en GitHub Pages.
