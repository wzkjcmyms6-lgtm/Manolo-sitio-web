# Estado del proyecto

Actualizado: 2026-10-01 (fin de fase 4).

- **App**: PWA estática + Firebase (Auth + Firestore), una sola página,
  JS puro sin build. Ver `docs/ARCHITECTURE.md`.
- **Se preserva**: Hábitos, Ejercicio, Finanzas, Inversiones, offline.
- **Fase 1**: contraseña numérica, nota de hábitos, accesos + campana admin.
  Pendiente del dueño: `admins/{uid}` + publicar `firestore.rules`.
- **Fases 2–4**: motores deportivos; Running con GPS, mapa, resumen,
  recuperación; rutinas por intervalos desde CSV/Excel con pitidos y voz.
  Falta la prueba real en el iPhone (GPS, pantalla encendida, mapa, voz,
  pitidos con música / modo silencio).
- **Bicicleta**: aún el registro manual (fase 5 reutiliza `ActividadUI`).
- **Tests**: 215/215 (`npm test`); E2E `fase1`, `fase3`, `fase4`,
  `regresion` en verde.
