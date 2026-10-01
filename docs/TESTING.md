# Pruebas

## Estado actual
- `npm test` → **206 pruebas, todas pasan** (fin de fase 3). Lógica pura UMD:
  hábitos, finanzas, mapa muscular, rangos, rutinas, importador, series,
  sesiones, versión del service worker.
- `tests/sw-version.test.js` falla si se cambia un archivo de la app sin
  correr `npm run sw` (protege la caché offline).
- **Pantalla (E2E)** en `scripts/e2e/` (Playwright + Chromium, 390 px):
  `node scripts/e2e/fase1.js [capturas]` (login, nota de hábitos, accesos y
  admin), `node scripts/e2e/fase3.js [capturas]` (Running con GPS y reloj
  simulados: preparar, correr, pausar, recuperar tras recargar, resumen,
  mapa, guardar, abrir, eliminar, permiso denegado, registro a mano) y
  `node scripts/e2e/regresion.js [capturas]` (15 pantallas sin errores +
  marcar una serie en Gimnasio). Utilidades comunes en `scripts/e2e/comun.js`. Usan `fake-firebase.js`: Firestore
  y Auth en memoria, con las reglas de `accesos`/`admins` simuladas. **No
  prueban las reglas reales** (se verifican al publicarlas, `docs/ADMIN.md`).

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
