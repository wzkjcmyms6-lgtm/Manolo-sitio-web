# Estado del proyecto

Actualizado: 2026-10-01 (fin de fase 1).

- **App**: PWA estática + Firebase (Auth + Firestore), una sola página,
  JS puro sin build. Ver `docs/ARCHITECTURE.md`.
- **Funciona y se preserva**: Hábitos, Ejercicio (Feed, Entrenamiento,
  Rangos, Perfil), Finanzas, Inversiones, offline.
- **Fase 1 hecha**: contraseña con teclado numérico (+ letras y ver/ocultar),
  nota de hábitos (`descripcion`), accesos + campana del admin
  (`js/accesos*.js`), `firestore.rules` en el repo, `scripts/e2e/`.
- **Pendiente del dueño**: crear `admins/{su uid}` y publicar
  `firestore.rules` (pasos en `docs/ADMIN.md`). Sin eso la campana no aparece
  y el registro de accesos falla en silencio (la app sigue igual).
- **No existe aún**: GPS, voz, motor deportivo, rutinas de Running.
- **Running/Bicicleta**: registro manual simple (`running.js`,
  `bicicleta.js`).
- **Tests**: 181/181 (`npm test`); E2E `node scripts/e2e/fase1.js` y
  `node scripts/e2e/regresion.js` en verde.
