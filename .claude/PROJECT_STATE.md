# Estado del proyecto

Actualizado: 2026-10-01 (fin de fase 5).

- **App**: PWA estática + Firebase (Auth + Firestore), una sola página,
  JS puro sin build. Ver `docs/ARCHITECTURE.md`.
- **Se preserva**: Hábitos, Ejercicio, Finanzas, Inversiones, offline.
- **Fase 1**: contraseña numérica, nota de hábitos, accesos + campana admin.
  Pendiente del dueño: `admins/{uid}` + publicar `firestore.rules`.
- **Fases 2–5**: motores deportivos; Running con GPS + rutinas CSV con
  avisos; Bicicleta con GPS (velocidad primero). Código común:
  `actividad-ui.js`, `actividad-registro.js`.
- **Falta la prueba real en el iPhone**: GPS, pantalla encendida, mapa,
  voz y pitidos.
- **Tests**: 215/215 (`npm test`); E2E `fase1`, `fase3`, `fase4`, `fase5`,
  `regresion` en verde.
