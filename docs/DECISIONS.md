# Decisiones

Formato: DECISIÓN · Motivo · Alternativas · Consecuencia. "Propuesta" =
se confirma al implementar la fase indicada.

**D-001 · Seguir como PWA estática + Firebase, sin servidor propio.**
Motivo: funciona, es gratis y offline. Alternativas: backend propio, app
nativa. Consecuencia: la seguridad va en reglas de Firestore; GPS solo en
primer plano.

**D-002 (implementada F1) · Evento de login escrito por el cliente, validado
por reglas, id `uid_loginMs`.** Motivo: no hay servidor; las reglas impiden
falsificar eventos de otros y el id evita duplicados. Alternativas: Cloud
Functions / Identity Platform (costo, facturación). Consecuencia: un
usuario solo podría "falsificar" sus propios accesos.

**D-003 (implementada F1) · Admin = existe `admins/{uid}` (creado en consola).**
Motivo: no hay roles; no se exponen uids en el repo público. Alternativa:
uid fijo en reglas. Consecuencia: el dueño crea el documento a mano.

**D-004 (implementada F1) · Notificaciones internas en tiempo real con
`onSnapshot`, sin push.** Motivo: reutiliza Firestore; sin polling; sin
servidor. Alternativa: FCM + Functions. Consecuencia: el admin ve los avisos
al abrir MANOLO (o al instante si está abierta).

**D-005 (implementada F1) · Contraseña con `inputmode="numeric"` + botón para
cambiar a teclado de letras + mostrar/ocultar.** Motivo: en iPhone el
teclado numérico no permite letras; no se sabe si todas las contraseñas son
numéricas. Alternativa: `pattern="[0-9]*"` (bloquearía contraseñas con
letras). Consecuencia: ninguna cuenta queda sin poder entrar.

**D-006 (propuesta F3) · Actividades GPS en las colecciones existentes
`running`/`bicicleta` (campos nuevos) + rutas en `users/{uid}/rutas`.**
Motivo: compatibilidad total con listas, mapa muscular y respaldo; listas
livianas. Alternativa: colección `actividades` nueva (exigiría migrar).

**D-007 (implementada F2) · Motores puros UMD (`actividad-motor.js`,
`intervalos-motor.js`) basados en marcas de tiempo.** Motivo: probables en
Node y correctos tras suspensión de iOS. Consecuencia: la UI solo dibuja.

**D-008 (implementada F4) · Voz con `speechSynthesis` local; pitidos Web
Audio.** Motivo: sin costo ni red. Consecuencia: depende de las voces del
sistema; se prueba en el iPhone.

**D-009 (decidida F2, implementada F3) · Mapa.** Durante la actividad: trazo **SVG local**
(sin red, gasta menos batería). En resumen e historial: **Leaflet
vendorizado y cargado solo al abrir el mapa**, con teselas gratuitas con
atribución; sin conexión o si fallan, vuelve al trazo SVG. Teselas: servidor
estándar de **OpenStreetMap** (`tile.openstreetmap.org`) con atribución
visible, solo al abrir un resumen (uso personal y liviano, sin descargas
masivas ni precarga); un filtro CSS las oscurece para el tema de Manolo.
Leaflet 1.9.4 (BSD-2) vendorizado en `vendor/leaflet-1.9.4/`. Si el uso
creciera mucho, cambiar a un proveedor con cuenta (una sola línea en
`js/actividad-ui.js`). Alternativas: solo SVG (sin
contexto de calles), mapa con teselas también en vivo (más batería y datos).

**D-010 (implementada F4) · CSV con `EjImportar.leerCsv` existente.** Motivo:
ya maneja `,`/`;`, comillas y BOM; está probado.

**D-011 (implementada F1) · Versionar `firestore.rules` en el repo como
referencia.** Motivo: hoy las reglas solo viven en la consola.
Consecuencia: cada cambio se publica a mano y se anota aquí.

**D-012 (F1) · El evento de acceso se dispara solo tras
`signInWithEmailAndPassword` correcto (no al restaurar la sesión).**
Motivo: las sesiones viejas restauradas no deben avisar como "ingresó
ahora". Alternativa: usar solo `onAuthStateChanged` + antigüedad de
`lastSignInTime`. Consecuencia: si el envío queda pendiente sin conexión,
Firestore lo guarda y lo sube al volver la red.

**D-013 (F1) · Pruebas de pantalla en el repo: `scripts/e2e/`** (doble de
Firebase en memoria con reglas mínimas simuladas + scripts por fase y de
regresión). No entran en `npm test` porque requieren Playwright.
Limitación: no prueban las reglas reales; eso se verifica al publicarlas.

**D-014 (F1) · Campos del login a 16 px.** Motivo: con menos, el iPhone
hace zoom al tocar el campo.

**D-015 (F2) · Huecos de señal: se suma la recta, marcada como estimada
(`huecoM`) y el trazo se corta.** Motivo: no inventar puntos ni ocultar
distancia recorrida; el resumen puede decir "incluye X m estimados".

**D-016 (F2) · Calorías.** Running: estimación ~1 kcal por kg por km con el
último pesaje (Ejercicio › Perfil), siempre rotulada "estimado"; si no hay
peso, no se muestra. Bicicleta: no se muestran (sin potencia ni pulso no hay
método razonable). Se implementa en fase 3.

**D-017 (F2) · Avisos de voz solo en cambios de intervalo y al terminar;
la cuenta 3-2-1 va con pitidos y en pantalla.** Motivo: no saturar ni tapar
la música.

**D-018 (F3) · Recuperación en pausa.** Si Manolo se cierra con la carrera
activa, al volver queda en pausa desde el último guardado local (cada
10 s). Motivo: no sumar como "activo" un tiempo que no se puede comprobar.
Distinto de que el iPhone congele la app con la pantalla bloqueada: ahí el
reloj sigue y el tramo sin GPS se marca como estimado (D-015).

**D-019 (F3) · Finalizar solo desde la pausa y con "Volver a la carrera".**
Motivo: evitar terminar por un toque accidental; se guarda una copia antes
de finalizar para poder volver.

**D-020 (F3) · Durante la actividad se ocultan las barras de la app** (en el
teléfono). Motivo: pantalla de lectura rápida y evitar toques accidentales.
Se sale con Finalizar o Cancelar.

**D-021 (F4) · CSV v1 lineal (una fila = un intervalo), Excel también.**
Motivo: es el formato del ejemplo del dueño y el más fácil de escribir.
Bloques repetidos (`repetir`) quedan como mejora futura si se piden.

**D-022 (F4) · Un archivo con errores no se guarda.** Motivo: el prompt
pide rechazar datos corruptos; se muestran todos los errores por fila para
corregirlos de una vez.

**D-023 (F4) · Con rutina, el reloj de la pantalla mira 4 veces por
segundo** (sin rutina, 1). Motivo: que la cuenta 3-2-1 caiga a tiempo; el
costo es mínimo (solo textos).

**D-024 (F4) · Sonido y Voz se pueden apagar desde la tarjeta** y la
elección queda en el teléfono (`manolo.avisos`).

**D-025 (F5) · En bici el número grande en vivo es la velocidad.** Motivo:
el prompt pide priorizar velocidad sobre ritmo en ciclismo; distancia,
tiempo y velocidad media van debajo. En Running sigue siendo la distancia.

**D-026 (F5) · Lista, totales y registro a mano comunes
(`js/actividad-registro.js`).** Motivo: Running y Bici tenían el mismo código
duplicado; ahora `running.js` y `bicicleta.js` solo configuran. Se conserva
el comportamiento y el aspecto de antes (y ahora se escapan las notas).

**D-027 (F6) · Mejores marcas solo con actividades GPS.** Running: mejor
1/5/10 km = suma mínima de parciales de 1 km seguidos (medidos, con el cruce
de cada km interpolado) y la más larga; Bici: más larga, mejor velocidad
media (solo rodadas ≥ 5 km, para que un tramo corto no gane) y mejor 5 km.
Las anotadas a mano no cuentan: no se puede saber cómo se midieron.

**D-028 (F6) · Barras por semana de distancia, tiempo y cantidad** (no de
ritmo: una barra más alta "peor" confunde). El ritmo/velocidad medio va en
el texto de tendencia.

**D-029 (F6) · Gráfico de ritmo por tramos de distancia**, con los huecos de
señal vacíos (no se dibuja una velocidad inventada).

**D-030 (F7) · El código de deporte se carga con el resto** (no por
partes): 44 KB comprimidos, 9 % del total; el riesgo de romper el orden de
carga no compensa. Leaflet sí se carga solo al abrir un mapa.

**D-031 (F7) · Ahorros de batería en la actividad**: trazo en vivo cada
3 s como mucho, borrador cada 30 s en actividades largas, GPS apagado tras 3
min en pausa (vuelve al reanudar).

**D-032 (F7) · Escala mínima en los gráficos de línea** (30 s/km, 4 km/h,
10 m) para no dibujar un ritmo parejo como un serrucho.

## 2026-10-01 · Pedido del dueño: sin GPS, resumen semanal y planes de varios días

**D-033 · Se retira el GPS de Running y Bicicleta.** Pedido explícito del
dueño ("lo del GPS quítalo"). Se borran la pantalla en vivo, el motor, el
acceso a la ubicación, las vistas, los mapas y Leaflet (≈ 51 KB menos de
código cargado). Se conservan los datos: las actividades viejas con GPS
siguen en el historial y en el resumen (usan `distance`/`duration`); sus
recorridos quedan sin uso y se borran solo si se elimina la actividad. El
código vuelve con git si se pide (commit `a66de91`). Sustituye a D-016 a
D-032 en lo que tocaba al GPS.

**D-034 · Plan de varios días = una rutina por día, en una cola.** Columna
opcional `dia` en el CSV. Cada día se guarda como su propia rutina (mismo
`plan`, su `dia`) con un `orden`; la lista se ordena por `orden` y la de
arriba es la siguiente. Alternativa descartada: un documento por plan con
los días dentro (no permite que cada día rote solo, ni borrar un día). La
cola es una sola lista para todas las rutinas, como pidió el dueño ("que se
vaya al final de la lista").

**D-035 · Resumen semanal tipo Strava: distancia y tiempo, sin desnivel.**
Semana elegida arriba (rango, Distancia, Tiempo) y línea de 12 semanas con
un punto por semana; tocar un punto la elige; tocar Distancia o Tiempo
cambia el gráfico. Reemplaza los totales, las barras, la tendencia y las
mejores marcas (estas eran solo GPS). El SVG se dibuja al ancho real de su
caja para que el texto tenga el mismo tamaño en teléfono y compu. Mismo
componente en Running y Bici. Sin desnivel por pedido del dueño (y sin GPS
ya no hay de dónde sacarlo).

**D-036 · Solo una rutina completada pasa al final.** Si se finaliza antes,
queda primera (no se hizo) pero igual se guarda en el historial con
"N de M intervalos". Toda rutina guardada va al historial con su nombre
completo ("Plan 5K · Día 2"); borrar rutinas nunca toca el historial.

**D-037 · Km opcionales al guardar una rutina.** Sin GPS, la rutina sabe el
tiempo pero no la distancia: el resumen ofrece anotar los km (por ejemplo
del reloj) para que cuenten en el resumen semanal; si no, se guarda con
`distance: 0` y suma solo tiempo.

**D-038 · Deslizar hacia abajo para cerrar, en todas las hojas**
(`js/hoja-deslizar.js`). Pedido del dueño, con Buddy de referencia (solo el
gesto; nada copiado). Un solo módulo para las tres familias de hojas
(`budget-sheet`, `muscle-sheet`, `cat-sheet`): la hoja sigue al dedo y el
fondo se aclara; al soltar se cierra si bajó un 30 % de su alto o con un
tirón rápido (> 0,6 px/ms), si no vuelve. Cierra "tocando" el fondo (o la ✕),
así cada hoja ejecuta su propio cierre; si una hoja no se deja cerrar así,
vuelve a su lugar. Con el contenido desplazado, primero sube el contenido.
Reemplaza el gesto propio que tenía solo la hoja del mapa muscular.
Solo táctil (en la compu siguen la ✕, el fondo y Escape).

## 2026-10-21 · Hábito Scalping

**D-039 · Scalping es un hábito más en Firestore, no un almacenamiento
aparte.** Pedido: guardarlo "con el mismo mecanismo que los demás hábitos";
en Manolo eso es `users/{uid}/habitos` (con caché offline), no localStorage.
Documento con id fijo `scalping`; el estado del módulo del dueño va en el
campo `scalping` con la forma que él definió, y se guarda por ruta de campo
(día, foto o ajustes) para no pisar otros días si hay dos pestañas.

**D-040 · Para el motor, Medible con meta 2 sesiones.** Así "cumplido = mañana
y noche" y "parcial = una sola" salen del motor existente, y Scalping entra
sin código extra en rachas, XP, nivel, jefe, días perfectos, estadísticas e
Inicio. (El motor deja que un parcial ≥ 50 % mantenga *su* racha; la vista
de Scalping muestra además la racha del módulo, que exige las dos.) Los
hitos de horas son logros nuevos que solo aparecen si tienes el hábito.

**D-041 · Se agrega desde una sugerencia, no automáticamente.** Manolo tiene
varios usuarios; crear Scalping para todos sería invasivo. Mientras no
exista, Hábitos › Hoy muestra "Scalping · Agregar" (descartable). La fecha
de inicio es el día en que se agrega. Archivar está en Ajustes de la vista
(restaurar, en Ajustes de Hábitos, como cualquier hábito).

**D-042 (2026-10-23) · Scalping avanza solo con días completos.** Pedido del
dueño: "si no marco completo, que se quede en el mismo día". Día del plan =
días completos antes de hoy + 1. Se implementa en `js/scalping-avance.js`
pasándole al módulo del dueño un inicio corrido, así su contenido, sus
reglas y su `selfTest` quedan intactos; la zona de la noche sigue el día de
la semana real. Las estadísticas siguen por fecha. El reinicio al día 1 se
hizo una vez automáticamente (marca `scalpingReinicio`) y queda un botón en
Ajustes; no borra sesiones, solo mueve el inicio y desmarca las fotos.

**D-043 (2026-10-27) · Sin rebote elástico.** Pedido del dueño. `html`,
`body` y las hojas usan `overscroll-behavior: none` (iOS 16+ respeta la
regla); las hojas además `overflow-x: hidden` para que un contenido ancho
nunca permita arrastrarlas de lado. La causa visible era un campo de
formulario más ancho que su columna; se corrigió en el origen
(`.hb-campo { min-width: 0 }` y campos al 100 % de su columna).

## 2026-10-28 · Inversiones (detalle en `docs/INVERSIONES.md`)

**D-044 · Datos de Inversiones.** Se sigue usando
`users/{uid}/inversiones`; los registros viejos (`date, name, amount, notes`)
se muestran como *Aporte* y completarlos solo agrega campos (`tipo`,
`ticker`, `cantidad`, `precio`, `comision`, `broker`, `fecha`, `nota`), nunca
reescribe los originales. Movimientos nuevos con `v: 1` y `tipo`. Ajustes en
`meta/inversiones_ajustes`; por defecto: broker Hapi, US$ 0,15 por ticker,
AirTM 1,40 %, transferencia 0,65 %, efectivo al 6,5 % anual, núcleo QQQ,
VOO, SCHD, VT, VIG, MSFT con US$ 33,18 cada uno (la ronda entra en US$ 200
con comisiones), objetivo 95 % núcleo en partes iguales y 5 % satélite.
"Aportado" = US$ que llegaron al broker; si se compró sin fondeo anotado,
la diferencia también cuenta. Números con coma o punto; el punto con grupos
de 3 cifras es de miles (estilo boliviano).

**D-045 (2026-10-28) · Precios diarios desde Yahoo Finance, verificados en
GitHub Actions.** Como el tipo de cambio: un workflow
(`.github/workflows/precios.yml`) corre `scripts/precios.py` de lunes a
viernes después del cierre de Nueva York y guarda `data/precios.json`; el
teléfono no llama a ninguna API ni lleva claves. Verificado el 2026-10-28
con dos corridas a mano: el gráfico público de Yahoo
(`query1.finance.yahoo.com/v8/finance/chart`) respondió 200 para los 6
tickers desde un runner de GitHub (39 cierres desde 2026-09-01). Stooq queda
como respaldo (no verificado: no hizo falta). Yahoo a veces no trae aún la
barra del día; se toma su último precio si es de las 16:00 de Nueva York o
después. Los tickers seguidos viven en `data/tickers.json`; uno que no está
se puede valuar a mano en la app (con aviso). En `sw.js`,
`data/precios.json` va primero a la red con copia para sin conexión (mismo
trato que `data/tipo-cambio.json`).

**D-046 (2026-10-28) · Inversiones sin versículo.** Pedido del dueño: es
una sección aparte. Se agregó Inversiones a la condición que ya ocultaba el
versículo en Finanzas y Hábitos (`showPanel()` en `js/modules.js`; único
cambio fuera del alcance de Inversiones, hecho a pedido).

**D-047 (2026-10-28) · Gráficos de Inversiones.** SVG propio, sin
librerías (la app no usa ninguna y debe andar sin conexión), dibujado al
ancho real de la caja. Rendimiento en Bs de dos formas: al TCO del BCB (lo
aportado al TCO de su día, el valor al de hoy) y al tipo real de AirTM (los
Bs de los fondeos tal cual; lo demás al promedio de Bs por US$ recibido; el
valor al tipo del último fondeo). Paleta validada con la guía de
visualización sobre `#161616`: el naranja de la app bajado un paso
(`#e8651f`) porque `#ff7a30` queda fuera de la franja de luminosidad para
marcas en fondo oscuro. Detalle en `docs/INVERSIONES.md`.

**D-048 (2026-10-28) · Fechas de dividendos y avisos.** Pedido del dueño:
saber cuándo pagan dividendos sus acciones e índices, con aviso unos 3 días
antes y después. El workflow de precios guarda también las fechas
(`data/precios.json` › `dividendos`), así no hace falta otro archivo ni
tocar `sw.js`. Fuentes verificadas desde GitHub Actions el 2026-10-28:
historial de Yahoo (los 6), calendario de Yahoo con *crumb* y Nasdaq
(fechas anunciadas; hoy solo MSFT, los ETF anuncian pocos días antes). Sin
anuncio, la próxima fecha se estima y se marca "estimada". Los avisos van en
Inversiones › Resumen (la app no puede mandar notificaciones al teléfono);
no se marcó en Finanzas por el alcance de la tarea.

**D-049 (2026-10-28) · Ronda del mes y exportar.** La ronda cuenta como
hecha para un ticker del núcleo si tiene cualquier compra ese mes (de la
ronda o suelta). Exportar: JSON con los documentos tal como están (respaldo
fiel, incluidos los registros viejos sin tocar) y CSV pensado para Excel o
Numbers en español (`;`, coma decimal, BOM). En iPhone se usa el menú de
compartir (Web Share con archivos), porque la descarga directa en una PWA
de pantalla de inicio no siempre deja guardar el archivo.

## 2026-10-29 · Libros y Biblia (detalle en `docs/LIBROS_BIBLIA.md`)

**D-050 · Dos sub-paneles de Inicio y portadas sin servicios pagos.**
Libros y Biblia solo se abren desde dos tarjetas de Inicio (como Running y
Bicicleta: `SUB_PANELS`), no en la barra ni en el menú. Íconos registrados
desde sus propios archivos (sin tocar `js/icons.js`). Colecciones nuevas
bajo `users/{uid}/…` (las reglas ya las cubren: no hay que cambiar nada en
Firebase). Portadas: Open Library (verificado desde GitHub Actions el
2026-10-29: 200, CORS abierto, portadas en español e inglés; Google Books
sin clave dio "cuota excedida") guardando solo la URL; fotos achicadas a
400 × 600 y comprimidas (~50 KB) en `libros_portadas`, sin Firebase Storage.
La comprobación se hizo con un workflow temporal que luego se borró.

**D-051 (2026-10-29) · Calendario anual de entrenamientos (Ejercicio ›
Perfil).** Pedido del dueño con una captura de Hevy como referencia.
"Entrenamientos de AAAA": los 12 meses en cuadritos, en azul de Ejercicio
los días con entrenamiento de Gimnasio (los mismos datos de
`EjercicioDatos`; no se guarda nada nuevo). Semanas de lunes a domingo, como
el resto de Manolo (Hevy empieza en domingo). Flechas por año (desde el
primer entrenamiento), tocar un día dice qué entrenaste y "Compartir imagen"
dibuja un PNG de 1080 × 1350 (MANOLO + tu usuario) que en el iPhone abre el
menú de compartir. Archivos nuevos: `js/ej-calendario.js` (lógica, pruebas),
`js/ej-anual.js`, `css/ej-calendario.css`, `scripts/e2e/ej-calendario.js`;
en `index.html`, una `<section>` en Perfil y sus `<script>`/`<link>`.

**D-052 (2026-10-29) · Inversiones, sección aparte; Libros y Biblia sin
versículo.** Pedido del dueño: "que inversiones sea algo aparte, como lo es
ejercicio, hábitos o finanzas" y "en libros y biblia, ya no aparezca el
versículo arriba". Inversiones pasa de pestañas dentro del panel a un
módulo con barra inferior propia, copiando a Finanzas: Resumen
(`#inversiones`), Posiciones, Movimientos y Gráficos abajo (`INV_TABS` en
`TAB_BARS`), y Ajustes (`#inv-ajustes`) en el engranaje de arriba, con
"‹ Resumen" para volver. Cuatro pestañas y no cinco para que quepan a
320 px, igual que Finanzas. Arriba, la casita vuelve a Inicio. En la compu,
pills arriba de cada pantalla (`crearPillsEscritorio`, ahora con el
engranaje también para Inversiones). Cada pantalla es su `<section
id="panel-inv-…" class="inv-panel">`; los `id` de las vistas
(`#inv-resumen`…) no cambian. El engranaje de arriba se elige con
`data-engranaje` porque `data-ajustes` ya lo escucha Hábitos (abriría su
hoja). No cambia ningún dato. Libros y Biblia se suman a la lista de
`showPanel()` que oculta el versículo; Inicio lo sigue mostrando.
