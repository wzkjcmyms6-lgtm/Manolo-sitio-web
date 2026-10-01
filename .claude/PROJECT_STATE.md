# Estado del proyecto

Actualizado: 2026-10-01 (fin de fase 8: plan maestro completo).

- **App**: PWA estática + Firebase (Auth + Firestore), una sola página,
  JS puro sin build. Ver `docs/ARCHITECTURE.md`.
- **Se preserva**: Hábitos, Ejercicio, Finanzas, Inversiones, offline.
- **Fase 1**: contraseña numérica, nota de hábitos, accesos + campana admin.
  Pendiente del dueño: `admins/{uid}` + publicar `firestore.rules`.
- **Fases 2–6**: Running (GPS, rutinas CSV con avisos) y Bicicleta (GPS),
  historial con progreso, marcas y gráficos.
- **Fase 7**: mediciones, ahorros de batería, liberar mapas, gráficos con
  escala mínima, ancho máximo en escritorio, revisión de seguridad.
- **Fase 8**: QA final. Regresión en teléfono y computadora con acciones
  de siempre; simulador de Firestore completado; lista de pruebas para el
  iPhone en `docs/TESTING.md`. Sin cambios en la app.
- **Falta la prueba real en el iPhone**: GPS, pantalla encendida, mapa,
  voz y pitidos.
- **Tests**: 225/225 (`npm test`); E2E `fase1` (39), `fase3` (45), `fase4`
  (30), `fase5` (24), `fase6` (15), `regresion` (37) en verde.
