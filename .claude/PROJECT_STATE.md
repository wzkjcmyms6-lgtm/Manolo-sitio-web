# Estado del proyecto

Actualizado: 2026-11-04 (empieza Running al nivel de Strava, D-060 a D-069).

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
  `docs/SCALPING.md`). Desde 2026-10-23 el día avanza solo con días
  completos (`js/scalping-avance.js`, D-042).
- **Falta la prueba real en el iPhone**: pantalla encendida, voz y pitidos
  de las rutinas guiadas, teclado numérico.
- **Tests**: 221/221 (`npm test`); E2E `fase1` (39), `running` (64),
  `hojas` (21), `scalping` (75), `emojis` (10), `regresion` (39) en verde.
- **Después (2026-10-28 a 2026-10-30)**: Inversiones aparte, Libros más
  inteligente, Biblia, Movilidad, Medir tiempos (provisoria), tarjetas de
  crédito (D-052 a D-059).
- **Running al nivel de Strava (2026-11-04, fases 0–8 hechas)**: importar
  GPX/TCX/FIT/ZIP (también el export de Strava), motor de métricas,
  detalle con mapa y gráfico, feed de tarjetas con barra propia, Progreso
  y Ajustes, resumen inteligente y mismo recorrido, segmentos, mapa de
  calor, compartir imagen y exportar todo. Sin GPS en vivo (D-033 sigue).
  D-060 a D-077, diseño en `docs/RUNNING.md`. Falta: validar con el export
  real del dueño y su OK para publicar en el Feed.
- **Hábitos: categorías y siguiente nivel (2026-11-05, fases 0–8 hechas)**:
  categorías completas en `meta/habitos_juego.categorias` (migración en
  lectura), Temporada 2 (subir cuesta más), Hoy filtrado y agrupado,
  página por categoría y Estadísticas por categoría, se marca solo con
  Running, Bici, Movilidad, Libros, Biblia y Finanzas, plantillas, hora y
  aviso de pendientes. D-079 a D-087, todo en `docs/HABITOS.md`. Fe, Lectura,
  Cuidado personal y Hogar vienen de fábrica (D-088); sin recordatorios
  fuera de Manolo por ahora. Falta: la lista del iPhone (`docs/TESTING.md`).
- **Tests (2026-11-05)**: 424 unitarias; E2E de Running: `run-importar`,
  `run-detalle`, `run-feed`, `run-progreso`, `run-inteligencia`,
  `run-segmentos`, `run-compartir`, `run-qa`; de Hábitos: `habitos` (193,
  a 390 y 1280 px); además de las de siempre (todas en verde el 2026-11-05).
