# Estado del proyecto

Actualizado: 2026-10-01 (fin de fase 2).

- **App**: PWA estática + Firebase (Auth + Firestore), una sola página,
  JS puro sin build. Ver `docs/ARCHITECTURE.md`.
- **Funciona y se preserva**: Hábitos, Ejercicio, Finanzas, Inversiones,
  offline.
- **Fase 1**: contraseña numérica, nota de hábitos, accesos + campana admin,
  `firestore.rules`, `scripts/e2e/`. Pendiente del dueño: `admins/{uid}` y
  publicar reglas (`docs/ADMIN.md`).
- **Fase 2**: `js/actividad-motor.js` e `js/intervalos-motor.js` hechos y
  probados; **todavía no se cargan en `index.html`** (eso es la fase 3).
  Diseño en `docs/SPORTS.md`, `docs/GPS.md`, `docs/DATABASE.md`.
- **Running/Bicicleta** en la app: aún el registro manual simple.
- **Tests**: 201/201 (`npm test`); E2E `scripts/e2e/fase1.js` y
  `regresion.js` en verde.
