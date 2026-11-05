# Cambios

## 2026-11-05 · Ejercicio: entreno en vivo más inteligente (fase 3)
- "Hoy toca" arriba de la pestaña Entrenamiento: empezar la rutina del
  día cuesta 2 toques; si ya la hiciste, dice "✓ Hecho".
- Cada serie ya trae el peso que toca hoy y una línea dice por qué ("Hoy
  4 × 5 con 110 kg · la última vez 4 × 8 con 105 kg → sube 5 kg").
- Calentamiento sugerido (con un toque se agrega), discos por lado,
  RIR opcional por serie (0–4+), superseries A1/A2 con descanso al final
  de la ronda, récord en vivo.
- El descanso avisa con pitidos y voz y deja la pantalla encendida.
- Al terminar, un resumen: contra la última vez, récords, músculos y
  "¿Qué tan duro fue?" para la carga de la sesión.
- Pruebas: `tests/ej-entreno.test.js` (10) y el E2E `ejercicio.js` con el
  entreno completo (167 controles).

## 2026-11-05 · Ejercicio: ficha completa (fase 2)
- La ficha tiene 3 pestañas: **Cómo se hace** (pasos en español, errores
  comunes, "Ver video" en YouTube y "Mi video" con tu propio link),
  **Historial** (última vez, mejor serie, 1RM estimado, gráficos y
  últimas sesiones) y **Récords** (1RM a 12RM y tu rango). Debajo, tus
  notas y alternativas con los mismos músculos.
- Se abre desde el entreno, las rutinas (también el editor), el buscador,
  Rangos y el detalle de una sesión.
- Pasos en español para 114 ejercicios (los destacados y los de Manolo);
  el resto, por lotes. Errores comunes para los 592.
- En el editor de rutinas el nombre del ejercicio ya no se corta.
- Pruebas: `tests/ej-historial.test.js` (8) y el E2E `ejercicio.js` con la
  ficha completa a 390 y 1280 px.

## 2026-11-05 · Ejercicio: demos de cada ejercicio (fase 1)
- 557 ejercicios con demo: las 2 fotos (inicio y final) en WebP, que se
  alternan con un fundido como un video corto; botón de pausa y, con
  "reducir movimiento", quietas.
- Tocar el nombre de un ejercicio (en el entreno o en una rutina) abre su
  ficha: demo, músculos en el mapa, equipo y créditos.
- Las imágenes no se bajan al instalar la app: se guardan al verlas (con
  límite) y las de tus rutinas quedan en el teléfono para el gimnasio sin
  señal.
- Pruebas: `tests/ej-demos.test.js` (6) y E2E nuevo `scripts/e2e/ejercicio.js`.

## 2026-11-05 · Ejercicio inteligente: auditoría y diseño (fase 0)
- Revisión a 390 px con 9 semanas de entrenos de prueba: 7 problemas
  (empezar la rutina de hoy cuesta 4 toques, kg viejos precargados, el
  descanso no avisa en el iPhone, sin resumen al terminar, sin ficha del
  ejercicio…). Bocetos de la ficha, el entreno en vivo, el resumen y "¿Qué
  entreno hoy?" en `docs/EJERCICIO_INTELIGENTE.md` (D-090).
- Datos de prueba nuevos: `scripts/e2e/ejercicio-semilla.js`.

## 2026-11-05 · Hábitos: revisión de pantallas
- Se compararon, captura por captura (390 y 1280 px), todas las pantallas
  de antes y después de los cambios de Hábitos. Running, Bici, Movilidad,
  Libros, Biblia, Finanzas, Ejercicio y Scalping quedaron idénticos.
- Arreglos: el botón "+1" de los hábitos medibles volvió a su lugar (un
  nombre de estilo repetido lo había movido); el aviso "Te faltan N" ya no
  tiene huecos; la tarjeta de Hábitos en Inicio vuelve a ocupar dos líneas;
  "🛡 salvada ayer" va junto a la racha; el día perdonado del calendario
  ya no se confunde con "hoy"; títulos de "Asignar categorías" con estilo;
  la página de categoría muestra "8 semanas" en una línea; el reloj del
  campo Hora se ve; las pestañas de Logros caben en pantallas de 320 px.

## 2026-11-05 · Hábitos: la racha perdona
- Si fallas un día o dos, la racha no se pierde: cada racha empieza con 1
  perdón y ganas otro por cada semana cumplida (guardas hasta 2). Si fallas
  seguido, se acaban y se corta. No cambia tu rango ni tu cumplimiento.
- En el detalle ves tus perdones; en Hoy, "🛡 salvada ayer"; en
  el calendario, el día perdonado. Las rachas del pasado se recalcularon
  sin celebraciones.
- Pruebas: `habitos-racha.test.js` (6) y 7 pruebas viejas al día.

## 2026-11-05 · Hábitos: Fe, Lectura, Cuidado personal y Hogar
- Las 4 categorías que elegiste ya vienen en Manolo, con su emoji y color.
  Pasa tus hábitos con Ajustes › Categorías › Asignar categorías.
- Hasta 16 categorías activas. El radar de equilibrio muestra solo las que
  tienen hábitos en el periodo.

## 2026-11-05 · Hábitos: QA final (fase 8)
- Regresión de todo Manolo (todas las E2E) en verde; E2E `habitos.js`
  completo a 390 y 1280 px, también exportar e importar con categorías.
- `docs/HABITOS.md` terminado y lista de pruebas para el iPhone en
  `docs/TESTING.md`.

## 2026-11-05 · Hábitos: plantillas, hora y aviso de pendientes (fase 7)
- "Nuevo hábito" › Plantillas: 39 hábitos comunes por categoría (agua,
  leer, correr, anotar gastos, orar…) con tipo, meta, frecuencia, momento,
  versión mínima y "se marca solo" sugeridos. Se busca sin tildes; al
  tocar una se llena el formulario y se puede cambiar antes de crear.
- Al escribir el nombre de un hábito nuevo, Manolo sugiere la categoría
  (por palabras y emoji, sin IA).
- Hora opcional por hábito: ordena dentro de su momento (y elige el
  momento solo); la fila la muestra.
- Inicio y Hoy avisan lo pendiente del momento: "Te faltan 2 de la mañana".
- Push con la app cerrada y recordatorios en el Calendario: investigados en
  `docs/NOTIFICATIONS.md`, sin implementar (esperan el OK).
- Pruebas: `habitos-plantillas.test.js` (4); E2E `habitos.js`.

## 2026-11-05 · Hábitos: se marca solo (fase 6)
- "Se marca solo" (en Más opciones del hábito): Running, Bici, Movilidad
  (eligiendo la rutina), Libros, Biblia, Finanzas y Gimnasio. Un Sí/No se
  marca si hubo algo ese día; un Medible suma los km, minutos o páginas del
  día. Un hábito Evitar puede ligarse a una categoría de gasto: gastar en
  ella es una recaída.
- Si borras la actividad, se desmarca (salvo que lo hayas cambiado a mano:
  lo manual siempre manda). La fila muestra "⚡ Running".
- Al vincular, ofrece rellenar los días del historial del módulo (sin XP).
- Motor nuevo `js/habitos-auto.js` (7 pruebas); E2E `habitos.js`.

## 2026-11-05 · Hábitos: página de cada categoría y estadísticas (fase 5)
- Página de categoría (`#hab-categoria/id`): nivel y XP con lo que falta a
  tu ritmo, esta semana y los últimos 30 días contra el periodo anterior,
  racha activa y mejor racha, mapa de calor, tendencia, sus hábitos por
  fuerza, en riesgo y sus logros (niveles 5, 10, 15 y 20). Se abre desde
  Hoy (grupo o filtro), Logros › Categorías y Estadísticas.
- Estadísticas: filtro de categoría arriba que cambia todas las tarjetas;
  tarjeta nueva "Por categoría" (cumplimiento y tendencia, ordenadas);
  "Equilibrio entre categorías": radar con 3 a 8, barras con más.
- "Lo que dicen tus datos", el resumen del domingo y Manolo Wrapped
  nombran tu mejor categoría. Una semana de cada dos, una misión apunta a
  una categoría ("🧠 3 días de Mente").
- Pruebas: 413 unitarias; E2E `habitos.js`: 133.

## 2026-11-05 · Hábitos: Hoy por categoría (fase 4)
- Arriba de Hoy: Todas · cada categoría con cuántos le quedan hoy (se
  recuerda la última). "Momento | Categoría" para agrupar (las cadenas van
  con su primer eslabón) y "Ocultar hechos".
- Cada fila lleva el color de su categoría y cada grupo su progreso
  ("Mañana 1/3" con una barrita).
- Mantener presionado un hábito (o clic derecho en la compu) abre parcial,
  mínima, saltar y nota; un toque sigue marcando.
- Arreglos de la auditoría: la sugerencia de Scalping ocupa una línea y el
  pie (Cerrar el día · Ordenar · Ajustes) también.
- Motor nuevo `js/habitos-hoy.js` (7 pruebas); E2E `habitos.js`: 95.

## 2026-11-05 · Hábitos: gestionar categorías (fase 3)
- Ajustes de Hábitos › Categorías: crear (nombre, emoji, color), editar,
  ordenar con flechas, archivar (si tiene historial) o eliminar (si nunca
  se usó). "Sugeridas": Fe, Lectura, Cuidado personal y Hogar, con un toque.
- "Asignar categorías": marcas varios hábitos (vienen marcados los que no
  tienen) y eliges la categoría; solo cambia la categoría.
- Formulario más corto: categoría con chips de color y "+ Nueva" (vuelve al
  formulario con la nueva elegida); nota, dificultad, cadena, se marca solo
  y versión mínima en "Más opciones"; Cancelar y Crear siempre a la vista.
- E2E `habitos.js`: 69 comprobaciones.

## 2026-11-05 · Hábitos: Temporada 2, subir cuesta más (fase 2)
- Rangos: un hábito diario perfecto llega a Bronce al mes, Oro a los 3
  meses, Esmeralda a los 6, Diamante al año y al máximo a los ~1,5 años.
  Un fallo suelto no baja; tres seguidos sí. La versión mínima y los
  parciales suman menos.
- Nivel: ~5 al mes, ~15 al año con 5 hábitos al 80 %. Categorías: ~5 a los
  2–3 meses. Comodín: 350 monedas. Logros nuevos: Especialista y Maestría
  (categoría al nivel 5 y 10).
- La primera vez, la hoja "Temporada 2" muestra tu nivel y rangos de antes
  y de ahora; tu Temporada 1 queda en Logros y los logros ganados se
  quedan. El detalle explica tu techo y cuánto falta; Logros, el XP que
  falta y cuánto tardarías.
- Pruebas: `habitos-dificultad.test.js` (9 simulaciones) reemplaza las dos
  de calibración viejas; E2E nuevo `habitos.js`.

## 2026-11-05 · Hábitos: categorías (fases 0 y 1)
- Las áreas de vida ahora son categorías con emoji y color (las 6 de
  siempre, con los nombres que les pusiste). Se ven en el formulario, en
  Logros › Categorías y se renombran en Ajustes.
- Motor nuevo `js/habitos-categorias.js` (crear, editar, ordenar, archivar,
  asignar en lote, sugerir por nombre) con 9 pruebas; la copia de seguridad
  también trae las categorías (importar solo agrega las que faltan).

## 2026-11-05 · Arreglo: la app no se actualizaba en el teléfono
- La copia sin internet intentaba guardar imágenes de Leaflet que no
  existen y eso cancelaba la actualización: el iPhone seguía con la versión
  vieja. Ahora se instala y aparece "Nueva versión disponible · Actualizar".
- Pruebas: una nueva en `sw-version.test.js` y la E2E `sw-instala.js`, que
  instala y actualiza el service worker de verdad.

## 2026-11-04 · Running: QA final (fase 8)
- Ajustes de Running › "Exportar todo (ZIP)": un GPX por carrera o rodada
  con ruta y un JSON con todo lo demás (copia de seguridad).
- Revisión completa en teléfono y computadora, sin internet y con 500
  carreras. E2E nuevo `run-qa.js` (46); 382 unitarias.

## 2026-11-04 · Running: Compartir (fase 7)
- En el detalle, "Compartir": una imagen para historias con tu ruta y
  Distancia · Ritmo · Tiempo, con fondo oscuro o transparente. Se abre el
  menú de compartir del iPhone (o se descarga la imagen).
- Pruebas: 381 unitarias (nuevo `run-compartir.test.js`); E2E nuevo
  `run-compartir.js` (13).

## 2026-11-04 · Running: Segmentos y mapa de calor (fase 6)
- Segmentos: desde una carrera (⋯ → Crear segmento) eliges inicio y fin;
  Manolo lo busca en todas tus carreras y en las que importes después.
  Cada segmento tiene su página con tu tabla y medallas; en el detalle de
  una carrera se ve su puesto. Renombrar, buscar de nuevo y eliminar.
- Mapa de calor en Progreso: todas tus rutas en un mapa (sin internet, un
  dibujo propio; con internet, con calles).
- Pruebas: 378 unitarias (nuevo `run-segmentos.test.js`); E2E nuevo
  `run-segmentos.js` (29).

## 2026-11-04 · Running: Resumen inteligente y Mismo recorrido (fase 5)
- En el detalle de cada carrera: un "Resumen inteligente" de 2 a 4 frases
  con datos reales (marcas, recorrido repetido, ritmo contra tu promedio,
  parciales, desnivel, zonas, semana) y "Mismo recorrido" con tus vueltas
  por el mismo camino y tu puesto.
- Pruebas: 374 unitarias (nuevo `run-inteligencia.test.js`); E2E nuevo
  `run-inteligencia.js` (14).

## 2026-11-04 · Running: Progreso y Ajustes (fase 4)
- Progreso: totales de semana, mes, año y todo contra el período anterior,
  racha de semanas, metas con anillos, diario con círculos por km, mejores
  marcas (top 3 y evolución), predicciones de 5K a maratón, forma y fatiga
  de 90 días y zapatillas con aviso de cambio.
- Ajustes (engranaje): FC máxima y en reposo, ritmo umbral, metas y
  zapatillas (predeterminada, retirar).
- Pruebas: 371 unitarias (nuevo `run-analisis.test.js`); E2E nuevo
  `run-progreso.js` (36).

## 2026-11-04 · Running: Actividades y barra propia (fase 3)
- Running tiene su barra: Actividades · Progreso · (+) · Segmentos ·
  Rutinas. El "+" abre Importar · Anotar a mano · Rutina guiada.
- Actividades: tarjetas con título, fecha, lugar, distancia, ritmo,
  tiempo, el trazo de la ruta y medallas; filtros y separadores por mes;
  carga de a 20.
- El resumen semanal pasó a Progreso y las rutinas guiadas a Rutinas (con
  un acceso a estirar). La tarjeta de Inicio resume la semana.
- Pruebas: 365 unitarias; E2E nuevo `run-feed.js` (47); `running.js`,
  `run-detalle.js`, `run-importar.js`, `regresion.js` y `movilidad.js`
  adaptados a la navegación nueva.

## 2026-11-04 · Running: detalle de cada actividad (fase 2)
- Tocar una carrera (o rodada) del historial abre su detalle: mapa con
  inicio y fin (se amplía), cifras, logros con medallas, perfil de ritmo,
  FC y altura con un cursor que se mueve en el mapa, parciales con barras
  (el más rápido marcado), vueltas del reloj, zonas de FC, clima, rutina,
  zapatillas, RPE y notas.
- Menú ⋯: editar (título, descripción, tipo, zapatillas, RPE), exportar GPX,
  corregir desnivel con el mapa de altura y eliminar (también su ruta).
- Sin internet se ve el trazo propio en vez del mapa. Leaflet vuelve (D-068).
- Pruebas: 364 unitarias; E2E nuevo `run-detalle.js` (42).

## 2026-11-04 · Running: importar carreras (fase 1)
- Botón **Importar** en Running: GPX, TCX, FIT (también .gz), varios a la
  vez, el ZIP completo de Strava y ZIPs con GPX (Apple Salud y otros).
  Vista previa con duplicadas, fusiones con rutinas o carreras a mano, otros
  deportes y errores; guardado con avance; "Cómo traer mis carreras".
- Motor de métricas: distancia, tiempo total y en movimiento, desnivel,
  parciales por km con ritmo ajustado por pendiente, mejores marcas, zonas,
  carga, calorías solo con datos reales. Clima y lugar en segundo plano.
- El historial muestra el título, la etiqueta "Ruta" y el lugar.
- Pruebas: 356 unitarias; E2E nuevo `run-importar.js` (70).

## 2026-11-04 · Running al nivel de Strava: diseño (fase 0)
- Plan por fases, pantallas con bocetos, esquema y decisiones D-060 a
  D-069 (`docs/RUNNING.md`, `docs/DATABASE.md`). Nueva regla: imitar de
  cerca la experiencia de Strava sin su marca (`.claude/RULES.md`).
- Sin cambios en la app todavía.

## 2026-10-27 · Sin rebote en las hojas ni en la pantalla
- El formulario de hábito (tipo Medible) y Ajustes de Hábitos tenían campos
  más anchos que la hoja (71–85 px): la hoja se podía arrastrar de lado y
  rebotaba. Ahora los campos caben en su columna.
- Las hojas solo se desplazan de arriba abajo (`overflow-x: hidden`) y, como
  la pantalla, sin el rebote elástico del iPhone (`overscroll-behavior: none`).
- E2E `hojas.js` (21) mide que ninguna hoja se salga de ancho.

## 2026-10-23 · Scalping: avanza solo con días completos
- El día del plan sube solo cuando completas mañana y noche; si no, al día
  siguiente sigues en el mismo día (`js/scalping-avance.js`). El módulo
  original no cambia.
- Scalping volvió al día 1 (una sola vez, al abrir esta versión) y en
  Ajustes hay "Reiniciar desde el día 1". Las sesiones viejas no se borran.
- Pruebas: 221 unitarias (7 nuevas de la regla); E2E `scalping.js` (75).

## 2026-10-21 · Scalping también desde el botón +
- El formulario de nuevo hábito muestra "Plan guiado: Scalping" con
  Agregar (o Abrir si ya existe), aunque se haya descartado la sugerencia.

## 2026-10-21 · Hábitos: más emojis
- El formulario de hábitos pasa de 28 a 167 emojis en 11 categorías (Salud,
  Ejercicio, Comida, Mente, Calma, Trabajo, Hogar, Dinero, Social, Hobbies,
  Dejar), con vista previa del elegido y un campo para escribir cualquier
  emoji del teclado. Se conservan todos los de antes. E2E nuevo `emojis.js`.

## 2026-10-21 · Hábitos: Scalping, plan de 180 días
- Nuevo hábito **Scalping** (masaje del cuero cabelludo): sesión de mañana y
  de noche, plan de 180 días con fases, zonas por día, fotos de control,
  hitos de horas, guía y ajustes. Contenido y lógica en
  `js/scalping-habit.js` (sin cambios); pantallas en `js/habito-scalping.js`.
- Tarjeta con botones rápidos, vista con 5 pestañas (Hoy, Progreso, Semana,
  Guía, Ajustes) y temporizador guiado a pantalla completa.
- Integrado al sistema de Hábitos (Medible de 2 sesiones: rachas, XP,
  estadísticas, Inicio) y 3 logros nuevos (36, 50 y 65 horas).
- Pruebas: 214 unitarias (incluye el `selfTest` del módulo y la tabla de
  verificación); E2E nuevo `scalping.js` (59). El Firestore de prueba ahora
  avisa también los documentos modificados y borrados, como el real.

## 2026-10-01 · Deslizar hacia abajo para cerrar las hojas
- Todas las hojas que suben desde abajo (nueva transacción, filtros,
  presupuesto, categorías, hábitos, gimnasio, rutinas, récords, avisos…) se
  pueden bajar con el dedo: siguen al dedo, se cierran si se bajan lo
  suficiente o con un tirón, y si no vuelven a su lugar (D-038).
- Barrita arriba de las hojas en el teléfono. Nuevo `js/hoja-deslizar.js`;
  E2E nuevo `hojas.js` (16).

## 2026-10-01 · Running y Bici sin GPS, resumen semanal y planes de varios días
- **GPS retirado** (pedido del dueño, D-033): sin "Iniciar carrera/rodada",
  sin permiso de ubicación, sin mapas ni Leaflet. Las actividades viejas con
  GPS siguen en el historial.
- **Resumen semanal** en Running y Bici (D-035): semana elegida con
  Distancia y Tiempo y línea de las últimas 12 semanas; tocar un punto elige
  la semana; sin desnivel.
- **Rutinas guiadas de varios días** (D-034): columna `dia` en el CSV; cada
  día es una rutina en una cola ("Siguiente" arriba); al completar una pasa
  al final (D-036). Pantalla de la rutina sin GPS (intervalo, Tiempo, Quedan,
  lista, pitidos y voz, pausa, recuperación) y resumen con km opcionales
  (D-037). Borrar una rutina o un plan entero no borra el historial.
- Historial: cada actividad se puede eliminar; las de rutina muestran su
  nombre ("Plan 5K · Día 2") y los intervalos hechos.
- Nuevos: `js/rutina-guiada.js`; reescritos `actividad-analisis.js` y
  `actividad-registro.js`; `intervalos-motor.js` con su propio reloj; wake
  lock en `avisos.js`. Borrados: `actividad-motor.js`, `actividad-vista.js`,
  `actividad-gps.js`, `actividad-ui.js`, `vendor/leaflet-1.9.4/` y sus
  pruebas. Pruebas: 209 unitarias; E2E nuevo `running.js` (64).

## 2026-10-01 · Fase 8 (QA final)
- Regresión ampliada: las 15 pantallas en teléfono (390 px) y computadora
  (1280 px), sin errores ni scroll de lado; acciones de todos los días
  (hábito, gasto, Running/Bici a mano, serie de gimnasio) y aviso "Sin
  conexión".
- El Firestore de prueba ahora entiende `FieldPath`, `increment` y
  `arrayUnion`/`arrayRemove` como el real (antes no se podía probar marcar
  un hábito).
- Lista de pruebas para el iPhone del dueño en `docs/TESTING.md`.
- Sin cambios en la app ni en la base de datos.

## 2026-10-01 · Fase 7 (optimización)
- Mediciones de carga y de Firestore documentadas (`PERFORMANCE.md`,
  `COST_OPTIMIZATION.md`).
- Batería: trazo en vivo como mucho cada 3 s, borrador cada 30 s en
  actividades largas, GPS apagado tras 3 min en pausa.
- Mapas: se liberan al cerrarse (sin fuga de memoria).
- Gráficos con escala mínima (sin "serrucho" por diferencias de 1 s).
- Escritorio: actividad y resumen con ancho máximo.
- Revisión de seguridad de las plantillas nuevas (sin hallazgos de
  inyección). README actualizado.

## 2026-10-01 · Fase 6 (historial y análisis)
- Running y Bici: "Tu progreso" con barras de 12 semanas (distancia,
  tiempo, cantidad), tendencia de 4 semanas con ritmo/velocidad medio y
  mejores marcas GPS (tocar abre la actividad); lista separada por meses.
- Detalle: gráfico de ritmo (o velocidad) a lo largo del recorrido, altitud
  aproximada y parciales con el mejor y el peor resaltados.
- Nuevo `js/actividad-analisis.js`. Pruebas: 224 unitarias; E2E `fase6.js` (15).

## 2026-10-01 · Fase 5 (Bicicleta con GPS)
- Bicicleta con las pantallas de Running: velocidad como número grande,
  parciales de 5 km, velocidad máxima, sin calorías; sin versículo; lista
  "Tus rodadas" (abrir/eliminar GPS) y registro a mano en desplegable; aviso
  en Inicio de rodada sin terminar; una actividad a la vez.
- `js/actividad-registro.js`: lista/totales/registro a mano comunes a
  Running y Bici (antes duplicados). E2E `fase5.js` (22 comprobaciones).

## 2026-10-01 · Fase 4 (rutinas de Running con avisos)
- Importar rutinas desde CSV o Excel con vista previa y errores por fila;
  plantilla descargable; lista y eliminación en el inicio de Running.
- Carrera con rutina: tarjeta del intervalo (restante, siguiente, progreso),
  cuenta 3-2-1 con pitidos, aviso grande y voz local en cada cambio y al
  terminar; Sonido/Voz apagables; sigue sin GPS; recuperación; la carrera
  guarda la rutina usada.
- Nuevos: `rutina-running.js`, `rutinas-running-ui.js`, `avisos.js`.
  Pruebas: 215 unitarias; E2E `fase4.js` (32 comprobaciones).

## 2026-10-01 · Fase 3 (Running con GPS)
- Running sin versículo; carrera con GPS: inicio con estado del permiso,
  pantalla en vivo (distancia, tiempo, ritmo, trazo, estado del GPS),
  pausar/reanudar/finalizar, resumen con mapa (Leaflet + OpenStreetMap),
  parciales, desnivel aprox. y calorías estimadas; RPE y notas; guardado en
  un lote (resumen + ruta); recuperación tras cierre; aviso en Inicio.
- Lista "Tus carreras": abrir y eliminar carreras GPS; registro a mano en un
  desplegable. Tarjeta de Inicio actualizada.
- Nuevos: `actividad-vista.js`, `actividad-gps.js`, `actividad-ui.js`,
  `vendor/leaflet-1.9.4/`. Pruebas: 206 unitarias; E2E `fase3.js` (47) y
  `scripts/e2e/comun.js`.

## 2026-10-01 · Fase 2 (arquitectura deportiva)
- `js/actividad-motor.js`: estados, filtros GPS, distancia (Haversine),
  tiempos total/activo/en movimiento, ritmo y velocidad, desnivel,
  parciales, huecos estimados, resumen para Firestore y ruta codificada.
- `js/intervalos-motor.js`: rutina por intervalos con reloj por marcas de
  tiempo, cuenta atrás, cambios, fin y textos de voz.
- +20 pruebas (201). Diseño cerrado en `SPORTS.md`, `GPS.md`, `DATABASE.md`
  y decisiones D-009, D-015 a D-017. Sin cambios visibles en la app.

## 2026-10-01 · Fase 1 (login, hábitos, accesos)
- Login: contraseña con teclado numérico, botón "Usar teclado de letras"
  (se recuerda), botón ver/ocultar; campos a 16 px.
- Hábitos: nota/descripción opcional (crear, editar, vaciar), una línea en
  la lista de Hoy y completa en el detalle. Hábitos viejos intactos.
- Accesos: evento único por inicio de sesión real, campana y bandeja del
  administrador en tiempo real (leído / no leído, marcar todo, historial
  de 50 en 50, aviso flotante). `firestore.rules` versionado.
- Pruebas: +6 unitarias (181) y `scripts/e2e/` (fase1: 39 comprobaciones;
  regresión de 15 pantallas).

## 2026-10-01 · Fase 0 (auditoría)
- Documentación persistente creada (`docs/*.md`, `.claude/*.md`). Sin
  cambios en la app.

## 2026-10-01 · Antes del prompt maestro
- Ejercicio › Perfil con cabecera y gráfico semanal estilo apps de gimnasio.
- Ejercicio › registro de entreno estilo apps de gimnasio (✓ por serie,
  Anterior, descanso, deslizar para borrar) y espacio bajo la barra inferior.
- Mapa muscular, Rangos, Feed, rutinas, importador: ver `docs/mapa-muscular.md`
  y el historial de git.
