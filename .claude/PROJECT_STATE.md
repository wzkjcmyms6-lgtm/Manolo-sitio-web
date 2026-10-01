# Estado del proyecto

Actualizado: 2026-10-01 (fin de fase 3).

- **App**: PWA estática + Firebase (Auth + Firestore), una sola página,
  JS puro sin build. Ver `docs/ARCHITECTURE.md`.
- **Se preserva**: Hábitos, Ejercicio, Finanzas, Inversiones, offline.
- **Fase 1**: contraseña numérica, nota de hábitos, accesos + campana admin.
  Pendiente del dueño: `admins/{uid}` + publicar `firestore.rules`
  (`docs/ADMIN.md`).
- **Fase 2**: motores `actividad-motor.js` e `intervalos-motor.js`.
- **Fase 3**: Running con GPS (`actividad-ui.js` común, `actividad-gps.js`,
  `actividad-vista.js`, Leaflet vendorizado). Falta probar en el iPhone real
  (GPS, pantalla encendida, mapa con teselas).
- **Bicicleta**: aún el registro manual (fase 5 reutiliza `ActividadUI`).
- **Tests**: 206/206 (`npm test`); E2E `fase1.js`, `fase3.js`,
  `regresion.js` en verde.
