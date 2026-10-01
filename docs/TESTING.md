# Pruebas

## Estado actual
- `npm test` → **175 pruebas, todas pasan** (1 oct 2026). Lógica pura UMD:
  hábitos, finanzas, mapa muscular, rangos, rutinas, importador, series,
  sesiones, versión del service worker.
- `tests/sw-version.test.js` falla si se cambia un archivo de la app sin
  correr `npm run sw` (protege la caché offline).
- Sin E2E en el repo. Las pruebas de pantalla se hacen con Playwright +
  Chromium del entorno y un **doble falso de Firebase** (Firestore en
  memoria) fuera del repo; propuesta: llevarlo a `scripts/e2e/` en fase 1
  como herramienta opcional (no entra en `npm test`).

## Por fase (mínimos)
- **F1**: contraseña (teclado, ocultar/mostrar, válido/ inválido/ vacío),
  nota de hábito (sin nota, con nota, editar, hábitos viejos), evento de
  login (1 por inicio de sesión, sin duplicados, sin datos sensibles),
  bandeja admin (ver, leído, historial), usuario normal sin acceso
  (verificado con las reglas publicadas).
- **F2–F5**: motor (Haversine, filtros, pausas, tiempo en movimiento,
  ritmo/velocidad, parciales, serialización), intervalos (cambios, cuenta
  atrás, fin, recuperación con timestamps), CSV (válido, vacío, columnas,
  duraciones, filas incompletas, tamaño, caracteres especiales).
- **Dispositivo real (iPhone)**: GPS, wake lock, voz y sonido se validan en
  el teléfono del dueño; nada se da por funcionando sin esa prueba.
- **Regresión** en cada fase: `npm test` + recorrido de Hábitos, Ejercicio y
  Finanzas en 390 px.
