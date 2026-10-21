# Hábito Scalping (masaje del cuero cabelludo, plan de 180 días)

Sesión de mañana y de noche todos los días durante 180 días; después,
mantenimiento. Contenido y lógica: `js/scalping-habit.js` (lo entregó el
dueño; **no se modifica**: textos, números y reglas están verificados con
`ScalpingHabit.selfTest()` → 142 comprobaciones). Pantallas:
`js/habito-scalping.js`.

## Cómo se usa
- Para agregarlo: en **Hábitos › Hoy**, la sugerencia "Scalping · Agregar"
  (se puede descartar con "Ahora no"), o siempre desde el botón **+** →
  "Plan guiado: Scalping · Agregar" (si ya lo tienes dice "Abrir"). Al
  agregarlo, la fecha de inicio es **hoy** (se cambia en Ajustes).
- Una vez agregado, su tarjeta está en Hábitos › Hoy, grupo "Cualquier
  momento".
- **Tarjeta** en la lista: `Día N/180 · Fase · Noche: zona`, botones
  **Mañana · X min** y **Noche · Y min** (marcan o desmarcan con los minutos
  del plan), barra del plan y horas acumuladas. Tocar la tarjeta abre la vista.
- **Vista `#hab-scalping`** con 5 pestañas:
  - **Hoy**: día, fase, fecha y progreso; aviso de sesión pendiente
    (mañana 5:00–11:59, noche desde las 19:00); fotos de control cuando toca
    (±3 días; "Fotos tomadas" solo marca, las fotos quedan en la galería);
    las dos sesiones con sus pasos (nombre, minutos, zona, instrucciones),
    **Iniciar guiado** y **Marcar hecha** (minutos editables); aceite de
    romero si está activado ("Usé aceite hoy"); "Qué esperar"; decisión del
    día 180; nota del día (se guarda sola).
  - **Progreso**: horas hechas contra las del plan, hitos de 36, 50 y 65 h
    (animación al alcanzar uno nuevo), racha, mejor racha, días completos,
    cumplimiento, calendario de los 180 días, controles de fotos y fechas en
    que el plan llega a cada hito.
  - **Semana**: los próximos 7 días (zona de la noche, minutos, fotos).
  - **Guía**: todo el contenido en secciones plegables.
  - **Ajustes**: fecha de inicio, zona prioritaria del domingo, aceite,
    noche extendida (20 min, desde la fase 3) y archivar el hábito.
- **Temporizador guiado** a pantalla completa: paso, zona, instrucciones,
  cuenta regresiva, "Paso X de N", siguiente paso y barra total; Pausar /
  Reanudar, Siguiente paso, Terminar. Pitido y vibración en cada paso,
  pantalla encendida (Wake Lock). Completo → marca con los minutos del plan;
  antes → pregunta y marca con los minutos hechos (mínimo 1). Va por marcas
  de tiempo: sigue exacto si se bloquea la pantalla.

## Datos
Un hábito más: `users/{uid}/habitos/scalping` (id fijo).
- Para el motor de Hábitos es **Medible con meta 2 "sesiones"**:
  `registros.AAAA-MM-DD.v` = sesiones hechas ese día (2 = cumplido,
  1 = parcial). Así entra solo en rachas, XP, nivel, jefe semanal, días
  perfectos, estadísticas e Inicio ("Hoy: X de N").
- El estado del plan va en el campo `scalping` (la forma que define el
  módulo): `{ version, habitId, settings: { startDate, zonaPrioritaria,
  usarAceite, nocheExtendida }, logs: { fecha: { manana, noche, aceite,
  nota } }, fotos: { "1": fecha } }`. `especial: "scalping"` marca el
  documento; `inicio` = `settings.startDate`.
- Cada cambio sale de `markSession`, `setOil`, `setNote`, `markPhotos` o
  `updateSettings` y se guarda por ruta de campo (solo el día, la foto o los
  ajustes que cambiaron), junto con `registros` del día.
- Logros nuevos `scalping_36`, `scalping_50`, `scalping_65` (minutos reales
  2178, 3000 y 3900); solo aparecen si tienes el hábito.
- "Hoy" es siempre `ScalpingHabit.todayISO()` (fecha local; nunca
  `toISOString()`, que en La Paz cambia de día a las 20:00).

## Límites
- Inicio muestra solo el resumen de hábitos (no una lista), así que las dos
  sesiones cuentan ahí como un hábito (cumplido con las dos).
- Si en Ajustes de Hábitos el día termina después de medianoche (por
  ejemplo a las 3:00), Scalping igual usa la fecha del calendario.
- En el iPhone, con la pantalla bloqueada la app se congela: el pitido de un
  paso suena al volver (el tiempo sí queda exacto). `navigator.vibrate` no
  existe en iPhone.
