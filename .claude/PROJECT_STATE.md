# Estado del proyecto

Actualizado: 2026-10-01 (después del plan maestro: Running/Bici sin GPS).

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
- **Después (pedido del dueño)**: GPS retirado (D-033); resumen semanal
  tipo Strava en Running y Bici (D-035); rutinas CSV de varios días en una
  cola, la completada pasa al final (D-034, D-036); km opcionales (D-037).
  Ver `docs/RUNNING.md`, `docs/CYCLING.md`, `docs/CSV_ROUTINES.md`.
  Deslizar hacia abajo para cerrar todas las hojas (D-038,
  `js/hoja-deslizar.js`).
- **Hábito Scalping** (2026-10-21): plan de 180 días, módulo del dueño
  `js/scalping-habit.js` (no tocar) + pantallas `js/habito-scalping.js`;
  integrado al motor como Medible de 2 sesiones (D-039 a D-041,
  `docs/SCALPING.md`).
- **Falta la prueba real en el iPhone**: pantalla encendida, voz y pitidos
  de las rutinas guiadas, teclado numérico.
- **Tests**: 214/214 (`npm test`); E2E `fase1` (39), `running` (64),
  `hojas` (16), `scalping` (59), `regresion` (39) en verde.
