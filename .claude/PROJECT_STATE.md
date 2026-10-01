# Estado del proyecto

Actualizado: 2026-10-01 (fin de fase 6).

- **App**: PWA estática + Firebase (Auth + Firestore), una sola página,
  JS puro sin build. Ver `docs/ARCHITECTURE.md`.
- **Se preserva**: Hábitos, Ejercicio, Finanzas, Inversiones, offline.
- **Fase 1**: contraseña numérica, nota de hábitos, accesos + campana admin.
  Pendiente del dueño: `admins/{uid}` + publicar `firestore.rules`.
- **Fases 2–6**: motores deportivos; Running (GPS, rutinas CSV con avisos) y
  Bicicleta (GPS, velocidad primero); historial con progreso semanal,
  tendencia, marcas GPS y gráficos en el detalle.
- **Falta la prueba real en el iPhone**: GPS, pantalla encendida, mapa,
  voz y pitidos.
- **Tests**: 224/224 (`npm test`); E2E `fase1`, `fase3`–`fase6`,
  `regresion` en verde.
