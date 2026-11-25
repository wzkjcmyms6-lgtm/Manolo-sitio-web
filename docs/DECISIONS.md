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

**D-053 (2026-10-29) · Medir tiempos (sección provisoria).** Pedido del
dueño: registrar por día cuánto tarda en la rutina de la mañana (levantarse,
lavarse los dientes, scalping, rezar, decretar y tender la cama), ejercicio,
correr, desayunar, bañarse y alistarse, y leer 30 páginas; promedio por
semana y por mes; con 30 registros, ya no registrar más y ese es el
promedio. "No muy bien hecha, la borraremos más adelante": tarjeta en Inicio
y sub-panel `#tiempos`, como Libros y Biblia, todo en archivos propios
(`js/tiempos*.js`, `css/tiempos.css`) para quitarla fácil (pasos en
`docs/TIEMPOS.md`). Decisiones: el tope de 30 es **por actividad** (no todas
se hacen todos los días; si se anotan todas a diario, es lo mismo que 30
días); un registro = un día; los que ya cuentan se pueden corregir. Tiempo
en minutos y segundos con dos campos numéricos (el teclado numérico del
iPhone no tiene ":"). Semana de lunes a domingo. Sin versículo arriba,
igual que Libros y Biblia. Nada se calcula guardado: promedios y cierre
salen de los días anotados (`users/{uid}/tiempos/{fecha}`).

**D-054 (2026-10-29) · Medir tiempos: guardar cada actividad por
separado.** El dueño: "no todos los días hago todo eso… actualmente tengo
que registrar todo para guardarlo". El formulario tenía un solo "Guardar"
al final (y 0 min daba error), así que parecía obligatorio llenar todo.
Ahora cada actividad es su propio formulario con su botón (en pantallas de
menos de 360 px baja a su línea): guarda con `set` + `merge` solo esa
actividad del día, muestra "✓ tiempo" y "Cambiar", y "Quitar de este día"
borra solo esa (o el día, si era la última). Lo escrito y no guardado en
otras filas se conserva al repintar. Los datos no cambian de forma.

**D-055 (2026-10-29) · Finanzas: varias tarjetas de crédito con su límite.**
Pedido del dueño ("creo que tendré más de una"). Antes había una sola
cartera "Tarjeta de crédito" (deuda total y un día de pago en Ajustes). Ahora
se registran tarjetas en `meta/finanzas_tarjetas` (nombre, límite en Bs, día
de pago propio u "el de Ajustes"), y cada gasto con tarjeta y cada pago
guardan `tarjetaId` (campo nuevo). Decisiones: la cartera `tarjeta` sigue
siendo **una** (la suma), así Disponible, colchón, transferencias, filtros,
CSV y copias no cambian; la deuda por tarjeta se reparte en
`js/finanzas/tarjetas.js` (UMD, pruebas) y siempre suma la deuda total. Lo
anotado antes, sin `tarjetaId`, cuenta para la primera tarjeta, la
"principal" (se puede cambiar con "Hacer principal"); eliminar una tarjeta
no toca movimientos: su deuda pasa a la principal (con "Deshacer"). Sin
tarjetas registradas, todo se ve como antes. Dónde se ve: Finanzas ›
Ajustes › Tarjetas de crédito (`#fin-tarjetas`, también al tocar una
tarjeta en Movimientos): por tarjeta, cuánto debes, disponible (límite −
deuda), barra de uso (verde, ámbar desde 50 %, roja desde 80 %), aviso
al pasar del 80 % o del límite, próximo pago y "Pagar" (transferencia
Débito → esa tarjeta). En Movimientos, una cartera por tarjeta; en
"¿Con qué pagaste?" y en pagos recurrentes, cada tarjeta por su nombre (la
hoja recuerda la última usada); "Atención" y "Próximos 30 días" avisan el
pago de cada una. Límite en Bs, aceptando "5.000" (punto de miles).

**D-056 (2026-10-29) · Libros más desarrollado e inteligente.** Pedido del
dueño (con una captura del formulario donde escribía el autor a mano).
Decisiones: (1) "Buscar el libro" con una sola búsqueda de texto libre en
Open Library que completa título, autor, páginas, portada y género (antes
solo buscaba portadas y el resto se escribía a mano); se verificó desde
GitHub Actions con un workflow temporal (ya borrado) qué campos da
(`number_of_pages_median`, `first_publish_year`, temas) y que busca sin
tildes y por ISBN. El género sale de los temas con pistas en español e
inglés (las cortas como palabra entera); los resultados sin portada,
páginas ni autor (resúmenes, análisis) van al final. (2) Progreso de
lectura dentro del libro (`paginaActual`, `progreso` por día, `paginaBase`)
en vez de una colección aparte: un documento por libro, sin escrituras
extra; las páginas por día salen de las diferencias entre días. La primera
vez que anotas un libro que ya venías leyendo, lo que llevabas no cuenta
como leído hoy (no infla la meta). Llegar a la última página lo termina y
festeja. (3) Meta diaria de páginas que empieza en 30 (su rutina "Leer 30
páginas") y reto anual opcional, en `meta/libros_ajustes`. (4) Estadísticas
con dos gráficos de una sola serie (sin leyenda, barra naranja #d9732e
validada contra el fondo oscuro, tocar = número, "Ver tabla"). (5) Aviso de
libro repetido y pregunta antes de agregarlo. Todo aditivo: los libros
viejos se ven igual. Pruebas: 13 de lógica nuevas, E2E
`scripts/e2e/libros-progreso.js` (52).

**D-057 (2026-10-30) · Movilidad: rutinas guiadas de estiramiento.** Pedido
del dueño: sección "Movilidad" igual que Libros y Biblia (tarjeta en Inicio,
"‹ Inicio", mismos componentes y colores) con dos rutinas guiadas ("Liberar
el cuerpo", 2 min; "Antes de correr", 5 min) e historial. Decisiones:
(1) las rutinas son datos (`js/movilidad-rutinas.js`, con partes y una nota
por parte) y `MovilidadMotor.problemas` las revisa en `npm test`, para
editarlas sin tocar la lógica; "Antes de correr" reusa la lista de "Liberar
el cuerpo" en vez de copiarla. (2) Motor propio con marcas de tiempo (como
`intervalos-motor.js`, que es de caminar/correr y no tiene "saltar" ni
"por lado"): la cuenta 3-2-1 va dentro (el inicio queda 3 s después) y
`cambios()` dice cuándo vibrar una sola vez. (3) Historial en Firestore
(`users/{uid}/movilidad`), como Libros y Biblia, no en `localStorage`: se
sincroniza y funciona sin internet. (4) Pantalla encendida con
`Avisos.pedirPantalla()` (ya existía para Running). (5) Salir de la app
pausa la rutina; salir de la sección la cierra sin guardar. (6) En el
iPhone no hay vibración web (Apple no lo permite): se documenta. Tarjeta
después de Biblia; Medir tiempos (provisoria) queda al final.

**D-058 (2026-10-30) · Movilidad: rutina "Después de correr".** El dueño
preguntó si el prompt era para estirar después de correr. La segunda rutina
del prompt (balanceos de pierna, zancadas, skipping, talones al glúteo, "en
movimiento continuo, sin sostener posiciones") es un calentamiento dinámico:
corresponde a **antes** de correr y se deja como está. Para después se agrega
una tercera rutina, solo como datos en `js/movilidad-rutinas.js`: 1 min
caminando suave para bajar pulsaciones y estiramientos sostenidos (gemelos,
cuádriceps, isquiotibiales, flexor de cadera y glúteo, 20 s por lado;
postura del niño y rodillas al pecho, 20 s), 5 min en total. No cambia la
lógica ni los datos guardados.

**D-059 (2026-10-30) · Movilidad: dos rutinas de 3 min; Medir tiempos:
total y promedio de los días.** Pedido del dueño: "que en la parte de
estiramiento solo existan 2 estiramientos, uno para todo el cuerpo, que dure
3 min y 1 para cuando correr que dure 3 min" y "que en medir tiempos se
registren los días y se haga un promedio de los días". Movilidad: "Todo el
cuerpo" (los seis ejercicios de "Liberar el cuerpo", ahora 30 s cada uno;
conserva su id) y "Después de correr" (cinco estiramientos sostenidos de 18 s
por lado: gemelos, cuádriceps, isquiotibiales, flexor de cadera y glúteo).
"Para cuando correr" se tomó como **después** (estirar), siguiendo su
pregunta anterior (D-058); el calentamiento dinámico "Antes de correr" sale.
Solo cambian datos (`js/movilidad-rutinas.js`); el historial no se toca.
Medir tiempos: `totalDia` y `promedioDias` en `js/tiempos-motor.js`; cada día
muestra su total, arriba de "Tus días" los días registrados y el promedio de
los totales, y en Promedios la fila "Tu día (todo junto)" por semana o mes.

## Running al nivel de Strava (desde 2026-11-04)

**D-060 (2026-11-04) · Cambio de regla: imitar de cerca, sin marca.** Pedido
del dueño: Strava deja de ser "solo referencia". Running replica la
estructura y el comportamiento de sus pantallas (feed de tarjetas, detalle
con mapa, parciales, gráfico sincronizado, progreso, segmentos), pero sin su
nombre, logo, íconos, ilustraciones, textos literales ni nombres de marca de
funciones. Nombres propios: **Mejores marcas** (no el de la app), **Carga**
del entrenamiento, **Forma y fatiga**, **Mismo recorrido**, **Resumen
inteligente**, **Segmentos**, **Mapa de calor**, **Diario**. El aspecto es el
de Manolo (variables de `css/style.css`). La investigación web de esta sesión
solo pudo usar el buscador (las páginas de ayuda no abren desde el entorno);
lo que no se pudo confirmar se documenta como supuesto y se valida con el
export real del dueño.

**D-061 (2026-11-04) · Navegación de Running.** Running pasa a tener su propia
barra inferior (como Finanzas o Inversiones): **Actividades · Progreso · (+)
· Segmentos · Rutinas**, con el "+" al centro que abre Importar · Anotar a
mano · Rutina guiada. Hashes: `#running` (Actividades), `#run-progreso`,
`#run-segmentos`, `#run-rutinas`, `#run-ajustes` (engranaje: FC máx/reposo,
ritmo umbral, peso, metas, zapatillas) y `#run-actividad/{id}` (detalle; el
id va después de la barra y `currentHash` lo ignora). Se llega igual desde la
tarjeta de Inicio. Hasta la fase 3 la página actual sigue igual, con un botón
"Importar" arriba. Segmentos muestra un estado vacío explicativo hasta la
fase 6.

**D-062 (2026-11-04) · Importación sin servidor.** Formatos: GPX, TCX, FIT
(también `.gz`), varios a la vez, el ZIP del export completo de Strava
(`activities.csv` + carpeta `activities/`) y cualquier ZIP con esos archivos
adentro (Apple Salud trae `apple_health_export/workout-routes/*.gpx`, según
documentación de la comunidad; adidas Running no se pudo confirmar: se leen
los GPX/TCX/FIT que traiga y nada más). El ZIP se lee **por partes**
(`File.slice` + directorio central, con ZIP64), solo las entradas que hacen
falta; se descomprime con `DecompressionStream("deflate-raw")` y, si el
navegador no lo tiene, se envuelve el bloque en un contenedor gzip con el
CRC y el tamaño del directorio central y se usa `"gzip"` (Safari 16.4+).
Sin librerías nuevas. El selector de archivos no filtra por extensión
(el iPhone deja en gris los `.gpx`/`.fit` si se filtra). Con el ZIP de
Strava, la vista previa sale del CSV (rápido) y cada archivo se lee al
guardar; con archivos sueltos se leen todos en la vista previa. El CSV tiene
columnas con el mismo nombre en distintas unidades (la primera "Distance" en
km o millas, la segunda en metros) y fechas en UTC: se usan las de metros y
segundos, se reconocen encabezados en inglés y español y la hora real sale
del archivo. Deportes: carreras → `running`, bici → `bicicleta`, el resto se
ignora con aviso; si el archivo no dice el deporte, se adivina por velocidad
y se puede cambiar en la vista previa. Lotes de Firestore de ≤ 400
operaciones y ≤ 5 MB; nada va a Storage ni se suben los archivos originales.

**D-063 (2026-11-04) · Duplicados y fusión.** Una actividad importada es
duplicada si ya hay otra con inicio a ±2 min y distancia a ±3 % (o el mismo
id de origen); se salta por defecto. Si coincide con una **rutina guiada**
(horarios que se cruzan en más de la mitad) o con una **carrera a mano** del
mismo día (distancia ±3 %, o sin km), se ofrece **fusionar**: se conserva el
documento (rutina, RPE, notas) y se le suman ruta y métricas; los
`distance`/`duration` anteriores quedan en `previo` (nada se pierde).

**D-064 (2026-11-04) · Motor de métricas (`js/run-metricas.js`).** Primero los
valores del archivo (distancia, tiempo, desnivel, calorías y FC del resumen
del reloj); lo que falte se calcula y nunca se inventa (sin FC no hay
sección de FC). Limpieza: puntos (0,0) o sin hora fuera, horas repetidas,
saltos más rápidos que 12 m/s (bici 25), FC fuera de 30–230 y picos aislados
(mediana de 5). Pausas: huecos de más de 30 s. Tiempo en movimiento:
intervalos con velocidad ≥ 0,5 m/s (bici 1 m/s). Desnivel: altitud suavizada
(media móvil de 5 puntos) con histéresis de 4 m (en La Paz, ~3600 m, el
ruido del GPS es grande); botón opcional "Corregir desnivel" con la API de
elevación de Open-Meteo (DEM de 90 m, lotes de 100 puntos, muestreo cada
~20 m, se guarda). Parciales por km (incluido el último parcial) con ritmo
en movimiento, desnivel, FC media y ritmo ajustado por pendiente (GAP) con
el costo energético de Minetti et al. (*J Appl Physiol* 2002;93:1039-1046):
C(i) = 155,4i⁵ − 30,4i⁴ − 43,3i³ + 46,3i² + 19,5i + 3,6 J/kg/m, factor
C(i)/3,6 con la pendiente suavizada en ~50 m y limitada a ±45 %. Mejores
marcas: 400 m, ½ milla, 1 km, 1 milla, 2 millas, 5K, 10K, 15K, 10 millas,
20K, media, 30K, maratón y 50K, con ventana deslizante e interpolación
(O(n) por distancia, tiempo transcurrido dentro de la ventana). Zonas de FC:
5 zonas por FC de reserva si hay FC de reposo (si no, % de la FC máx):
<60, 60–70, 70–80, 80–90, >90 %.

**D-065 (2026-11-04) · Carga, forma y predicciones (una sola escala).**
"Carga" en puntos donde **100 = 1 hora al umbral**. Con FC: TRIMP de
Banister (Σ min × r × 0,64·e^(1,92·r), r = FC de reserva) × 100 / TRIMP de
1 h a r = 0,85. Sin FC y con ruta: rTSS = horas × IF² × 100, IF = velocidad
GAP media / velocidad umbral (ritmo umbral editable; por defecto, el de la
mejor marca de 10K o 5:30 /km). Manual con RPE: RPE × min × 100 / 480 (1 h a
RPE 8 = 100). Sin nada de eso, sin carga. Forma y fatiga: estado físico =
media exponencial de 42 días, fatiga = 7 días, forma = estado − fatiga.
Predicciones 5K/10K/21K/42K: Riegel (T₂ = T₁ × (D₂/D₁)^1,06) desde las mejores
marcas de las últimas 12 semanas de al menos 1 milla y ≥ 1/8 de la
distancia objetivo; se toma la más rápida. Sin datos: "Faltan datos".

**D-066 (2026-11-04) · Clima y lugar.** Clima: Open-Meteo (gratis, sin clave,
CC BY 4.0 con atribución): pronóstico con fecha pasada para los últimos 90
días y el archivo histórico para lo anterior; temperatura, sensación,
humedad, viento y código del tiempo a la hora del inicio. Lugar aproximado:
geocodificación inversa de Nominatim (OpenStreetMap, atribución, máx. 1
pedido por segundo, nivel barrio). Solo se envían coordenadas redondeadas:
2 decimales (~1 km) para el clima y 3 (~100 m) para el lugar, que con 1 km
caía en el barrio vecino; nunca la ruta ni datos del dueño. Verificado el
2026-11-04 desde GitHub Actions (el entorno de trabajo bloquea esos
dominios): las dos APIs responden con CORS abierto; la de elevación admite
hasta 100 puntos por pedido; el pronóstico con fecha pasada funciona a 80
días y el archivo histórico tiene datos hasta 2 días atrás. Se piden después de
guardar, en segundo plano, y se guardan en la actividad (`clima`, `lugar`);
además un caché en el teléfono por coordenada redondeada
(`manolo.run.lugares`). Sin internet, se completan después.

**D-067 (2026-11-04) · Guardado.** La actividad importada va en
`running/{id}` (o `bicicleta/{id}`) con `distance` (km) y `duration` (min en
movimiento) de siempre, más lo caro de calcular: parciales, vueltas, mejores
marcas, zonas, carga y una **mini ruta** simplificada (Douglas-Peucker, ≤ 250
puntos) para las tarjetas, el mapa de calor y "Mismo recorrido" sin leer la
ruta completa. La ruta completa va en `rutas/{mismo id}` con el formato v1
extendido de forma aditiva (`v:2`: FC, cadencia y distancia del reloj por
punto; series sin GPS para cinta), se lee solo en el detalle y nunca pasa de
1 MiB (si hiciera falta, se guarda un punto de cada dos). Ajustes en
`meta/running_ajustes` (FC, umbral, peso, metas, zapatillas); segmentos en
`run_segmentos/{id}`. Todo bajo `users/{uid}`: no hace falta tocar
`firestore.rules`.

**D-068 (2026-11-04) · Mapas.** Se recupera Leaflet 1.9.4 vendorizado (de git,
`a66de91`) y las teselas de OpenStreetMap oscurecidas con CSS (D-009), con
atribución, cargadas solo al abrir un detalle y liberadas al salir; sin
conexión se ve el trazo SVG local. Se reusan del motor GPS viejo la
distancia haversine, la polilínea codificada multicolumna, la histéresis de
desnivel, los parciales por cruce interpolado y la proyección del trazo SVG.

**D-069 (2026-11-04) · Nombres de otras apps.** En la pantalla, los nombres
Strava, Apple Salud y adidas Running aparecen solo como **origen de los
datos** en "Cómo traer mis carreras" y en la vista previa de importación
(uso descriptivo, en texto simple, sin logos). En el resto de Running no
aparecen.

**D-070 (2026-11-04) · Detalle de la actividad.** `#run-actividad/{colección}/{id}`
(`currentHash` ignora lo que va después de la primera barra); sirve para
cualquier actividad: a mano, rutina, GPS viejo o importada, y también para
rodadas (con velocidad en vez de ritmo). Tocar una actividad del historial
la abre. Logros: puesto 1–3 de cada mejor marca **entre las actividades
hasta ese día** (como era cuando se corrió, así una marca vieja no pierde su
medalla). Zonas con la FC máx y de reposo de Ajustes; sin ajustes, con la FC
más alta registrada (se avisa). "Tipo" es un solo campo (`subtipo`):
competencia, fondo largo, series, trail, cinta o pista (rodada: competencia,
rodillo, virtual). "Corregir desnivel" lo pide el dueño con un botón: manda
hasta 1000 puntos de la ruta redondeados a 4 decimales (~10 m) a la API de
elevación de Open-Meteo, en lotes de 100, y guarda el resultado (no se
vuelve a pedir); se avisa antes. Los intervalos de correr de una rutina
guiada unida a un archivo del reloj se sombrean en el perfil usando la hora
de la rutina (`previo.inicio`). El cursor del gráfico mueve un punto en el
mapa; el mapa se amplía a pantalla completa. Exportar GPX 1.1 con FC y
cadencia (extensión de Garmin), que Manolo vuelve a leer igual.

**D-071 (2026-11-04) · Actividades y barra propia (fase 3).** Running se
reparte en pestañas: **Actividades** (`#running`, el feed de tarjetas que
reemplaza la lista "Tus carreras"), **Progreso** (`#run-progreso`, por ahora
el resumen semanal de siempre, D-035), **Segmentos** (`#run-segmentos`,
estado vacío hasta la fase 6) y **Rutinas** (`#run-rutinas`, las rutinas
guiadas y su pantalla; el aviso de Inicio lleva ahí). El "+" del centro es
un botón (no una pestaña) que abre Importar · Anotar a mano (el mismo
formulario de siempre, en una hoja) · Rutina guiada. `modules.js` busca la
barra del primer nivel que la tenga (`grupoTabs`) y admite acciones en la
barra y en las pills de la computadora. Tarjeta: título, fecha, hora y
lugar, Distancia · Ritmo · Tiempo, trazo de la mini ruta, medallas (hasta
3) y etiquetas (Rutina, tipo, A mano); filtros Todas · Con mapa · Rutinas ·
A mano · Competencias (solo los que tienen algo); separadores por mes con
km y cantidad; de a 20 tarjetas, con las siguientes al llegar al final
(cientos de carreras sin trabarse). Medallas de todas las carreras de una
vez (`RunAnalisis.logrosPorId`, O(n) por distancia). La tarjeta de Running
en Inicio dice los km de la semana y la última carrera. Después de anotar
una carrera a mano o guardar una rutina del día, se sugiere estirar con
Movilidad › Después de correr (2 horas, se puede ocultar).

**D-072 (2026-11-04) · Progreso y Ajustes de Running (fase 4).** Progreso
(`js/run-progreso.js`, cálculos en `js/run-analisis.js`): totales de la
semana (lunes a domingo), el mes, el año o todo, contra el período anterior
**completo**; el resumen semanal de siempre debajo; racha = semanas
seguidas con al menos una carrera (si esta semana todavía no hay, sigue
viva desde la pasada); metas de km con anillos; diario (calendario del mes,
círculos con área según los km del día, tocar abre la carrera); mejores
marcas por distancia con el top 3 y su evolución (escalón de la mejor hasta
cada día); predicciones (D-065); forma y fatiga de 90 días con medias
exponenciales k = 1 − e^(−1/42) y 1 − e^(−1/7); la carga de una actividad
sin carga guardada sale del RPE (a mano y rutinas). Zapatillas con km
acumulados (km iniciales + carreras) y aviso al 90 % y al 100 % del límite
(700 km por defecto). Ajustes con el engranaje de arriba (`#run-ajustes`):
FC máx y de reposo, ritmo umbral (sugerido por la mejor marca de 10K; si
no, 5:30), metas y zapatillas (agregar, editar, predeterminada, retirar).
La predeterminada se pone sola al importar carreras **desde que se
agregó** (las viejas no se tocan) y nunca reemplaza la que ya tiene una
carrera unida. Cambiar la FC o el umbral no recalcula las cargas ya
guardadas (haría falta leer todas las rutas); las zonas del detalle sí usan
los ajustes de hoy. El peso sale de Ejercicio › Perfil.

**D-073 (2026-11-04) · Inteligencia por reglas (fase 5).** Sin IA externa ni
servidor: `js/run-inteligencia.js`. **Mismo recorrido**: otra carrera con
inicio y fin a ≤ 200 m, distancia ±5 % y la misma forma (20 puntos a
distancias iguales de cada mini ruta, separación media ≤ 150 m; en el mismo
sentido). Usa solo la mini ruta del resumen: no lee rutas completas. En el
detalle: cuántas veces, el puesto por tiempo en movimiento y la lista (las
10 más nuevas) con barras. **Resumen inteligente**: 2 a 4 frases, en este
orden de prioridad: nueva mejor marca (la distancia más larga) o podio; la
más larga de los últimos 3 meses; recorrido repetido (desde 3 veces); ritmo
contra el promedio del último mes en distancias parecidas (±30 %, desde 3
carreras); parciales (segunda mitad más rápida, ritmo parejo o el último km
más lento); desnivel ≥ 150 m con el ritmo ajustado; zona de FC con ≥ 40 %
del tiempo; y la semana. Mira solo lo que había **hasta esa carrera** (así
una vieja no compara con el futuro). Si hay menos de dos frases, la primera
son las cifras de la carrera. Nunca consejos de salud ni de entrenamiento.

**D-074 (2026-11-04) · Segmentos (fase 6).** Se crean desde una carrera con
ruta (menú ⋯ → Crear segmento) eligiendo inicio y fin con dos controles
deslizantes sobre la distancia (dedo grande, funciona sin internet), con
vista previa en el mapa (tramo verde), en el perfil (banda verde) y en un
trazo propio dentro de la hoja; mínimo 100 m. Se guardan en
`run_segmentos/{id}` con su trazo simplificado (≤ 200 puntos) y una tabla
`esfuerzos` por actividad (el mejor paso de cada carrera). Detección
(`js/run-segmentos.js`): pasar a ≤ 35 m del inicio y después del fin
recorriendo 85–120 % de su distancia y a ≤ 50 m de 10 puntos del trazo, en
el mismo sentido; si pasa varias veces, el mejor tiempo. Retroactiva al
crearlo (solo lee la ruta completa de las carreras cuya mini ruta pasa a
≤ 100 m del inicio y del fin) y automática al importar (con la ruta en
memoria, sin lecturas). "Buscar de nuevo" repite la búsqueda. Borrar una
carrera quita su tiempo de los segmentos; borrar un segmento no toca las
carreras. Tabla personal con medallas 🥇🥈🥉 y el puesto en el detalle de
cada carrera. Sin tablas de otras personas (Manolo es personal).

**D-075 (2026-11-04) · Mapa de calor.** `#run-calor` (tarjeta al final de
Progreso): todas las mini rutas superpuestas en naranja semitransparente.
Primero un SVG propio (sirve sin internet; se centra en donde más corres:
rutas a < 30 km de la mediana de los inicios) y, con "Ver con calles",
Leaflet con un lienzo (canvas) para dibujar cientos de rutas rápido.
Filtros: todas, este año, últimos 90 días. Los mapas forman su propia capa
(`isolation`) para que los controles de Leaflet no queden encima de las
hojas.

**D-076 (2026-11-04) · Compartir (fase 7).** Imagen vertical 1080 × 1920 en
canvas (`js/run-compartir.js`): título, fecha y lugar arriba, la ruta en
degradado naranja con inicio y fin, y Distancia · Ritmo (o Velocidad) ·
Tiempo grandes; "Manolo" chico abajo. Fondo oscuro o **transparente**
(PNG con alfa, para ponerla encima de una foto en las historias; con una
sombra suave para que se lea). Sin ruta, solo las cifras. Se comparte con
el menú del teléfono (`navigator.share` con el archivo, Web Share Level 2,
Safari 15+); si no se puede, se descarga el PNG. Nada sale de Manolo hasta
que el dueño elige dónde. **Publicar en el Feed de Ejercicio** (opcional)
no se hizo: el prompt pide el OK del dueño; quedaría con una zona de
privacidad de ~300 m en el inicio y el fin y sin coordenadas exactas (solo
el trazo ya recortado), y habría que revisar si `firestore.rules` del Feed
admite el campo nuevo.

**D-077 (2026-11-04) · QA final de Running (fase 8).** Respaldo: en Ajustes
de Running, "Exportar todo (ZIP)" arma un ZIP con un GPX por actividad con
ruta (de `rutas/`, una sola consulta) y `manolo-running.json` (resúmenes,
parciales, ajustes, zapatillas y segmentos). El ZIP se escribe sin
librerías (`RunZip.crearZip`, CRC32 propio, "deflate-raw" si el navegador
lo tiene; se verificó con `unzip -t`) y Manolo lo vuelve a leer. La copia
de Ejercicio sigue igual (ya lleva los resúmenes de running y bici).
Rendimiento con 500 carreras: el feed muestra de a 20, todas las pantallas
se refrescan en ~12 ms al llegar datos nuevos, Progreso aparece en < 0,1 s
y el detalle (con resumen y mismo recorrido) en < 0,15 s. Sin internet:
listas, detalle (trazo propio en vez del mapa) y Progreso se ven con los
datos del teléfono; Leaflet queda guardado por el service worker.

**D-078 (2026-11-05) · Arreglo: los teléfonos no se actualizaban.** Desde la
fase 2 (D-068) el service worker guardaba Leaflet (`EXTRAS`) y revisaba su
CSS, que pide imágenes (`images/layers.png`, `marker-icon.png`) que no
están en el repo: esa descarga fallaba y **toda la instalación de la
versión nueva se cancelaba**, así que el iPhone del dueño siguió con la
versión vieja (sin la barra nueva de Running). Arreglo: el CSS de `vendor/`
no se revisa, y solo lo que pide `index.html` (y `EXTRAS`) es obligatorio;
lo que aparece dentro de un CSS o JS ya no frena la instalación. Prueba
nueva `tests/sw-version.test.js` (nada obligatorio falta) y E2E
`scripts/e2e/sw-instala.js`, que instala y actualiza el service worker de
verdad (las demás E2E lo bloquean, por eso no se vio). Con el `sw.js`
publicado antes, esa prueba falla; con el arreglo, pasa.

## 2026-11-05 · Hábitos: categorías y siguiente nivel

**D-079 (2026-11-05) · Las áreas de vida se vuelven categorías, en el mismo
documento.** No se crea un concepto paralelo: los 6 ids de siempre
(`cuerpo … social`) siguen siendo los de `habitos/{id}.area`, así XP,
niveles por área, el radar y el logro "Equilibrio" no cambian. Las
categorías (nombre, emoji, color de una paleta cerrada, orden, archivada)
viven en `meta/habitos_juego.categorias`: ese documento ya se escucha, así
que no hay lecturas ni escuchas nuevas. Sin ese campo se arman al leer
desde `prefs.areas` (los nombres que puso el dueño). Con historial no se
borran: se archivan. Las 2–4 categorías extra propuestas (Fe, Lectura,
Cuidado personal, Hogar) no se crean solas: quedan como "Sugeridas" para
que el dueño las cree con un toque.

**D-080 (2026-11-05) · Dificultad nueva: se endurece la progresión, no el
XP de cada registro.** Simulado con el motor real (`tests/habitos-sim.js`):
un hábito diario perfecto llega a Bronce al mes, Oro a los 3 meses,
Esmeralda a los 6 y Diamante al año; el máximo pide ~1,5 años. Techo por
constancia: 50 % Bronce, 70 % Plata, 80 % Oro, 90 % Rubí, 95 % Esmeralda,
98 % Diamante. El XP por registro y las monedas por XP no cambian, para que
el saldo de monedas que ya tiene el dueño no baje; lo que sube es la curva
de nivel, la fuerza del rango y el precio del comodín.

**D-081 (2026-11-05) · Reglas finas de la dificultad.** (1) `ALFA_BAJA` es
4,6 × `ALFA_SUBE` y no 4 ×: con 4 × exacto, quien cumple el 98 % tocaba
Campeón en sus mejores semanas y la histéresis lo dejaba ahí. (2) La
histéresis es relativa: se baja de división solo si la fuerza cae más de
lo que quita un fallo desde el piso; así ningún fallo suelto baja en ningún
rango (antes eran 2 puntos de percentil, poco en los rangos altos). (3) Tres
fallos seguidos bajan al menos una división y dejan la fuerza donde hacen
falta tres cumplidos seguidos para volver (si no, volvía a subir al día
siguiente). Se quita el "escudo" de 3 días tras subir, que chocaba con
esta regla. (4) En los semanales cada sesión es un paso (3 por semana =
cada 7/3 días): antes una semana de 2 de 3 contaba como un 67 % que
igual subía. (5) La transición conserva los logros (unión con el
snapshot) y muestra los ganados como conseguidos aunque hoy ya no se
cumplan; el nivel y los rangos de antes quedan como Temporada 1.

**D-082 (2026-11-05) · Gestión de categorías y formulario corto.** Las
pantallas nuevas viven en `js/habitos-categorias-ui.js` y usan
`window.HabitosApp` (puente con `js/habitos.js`: estado, hojas, toasts y
"plugins" de clic/envío en la hoja), así `habitos.js` no sigue creciendo.
Archivar una categoría con hábitos activos no se permite: primero se pasan
a otra (botón "Cambiar sus hábitos"), para que ningún hábito activo quede
en una categoría invisible. Eliminar solo si ningún hábito (ni archivado)
la usó: queda `borrada: true` y su id no se reutiliza. Asignar en lote es
un lote de Firestore que solo escribe `area`. En el formulario, lo que se
usa poco (nota, dificultad, "después de", se marca solo, versión mínima)
pasa a "Más opciones", que se abre solo si el hábito ya usa alguna; los
botones Cancelar/Crear quedan fijos abajo.

**D-083 (2026-11-05) · Hoy filtrado y agrupado.** La lógica está en
`js/habitos-hoy.js` (sin DOM, con pruebas). El filtro usa la categoría del
propio hábito; al agrupar por categoría manda la del primer eslabón de su
cadena ("Después de…"), así una cadena nunca se parte. Los de Evitar no
cuentan en el progreso de un grupo ni en los pendientes (se cumplen solos).
Filtro, agrupación y "ocultar hechos" son preferencias del teléfono
(`localStorage hb-hoy-*`), no de la cuenta. Mantener presionado ~0,5 s
(pointer events, se cancela si el dedo se mueve) abre las opciones del día
sin marcar; en la computadora, el clic derecho.

**D-084 (2026-11-05) · Página de categoría y estadísticas por categoría.**
`HE.subconjunto(res, filtro)` repite los cálculos solo con algunos hábitos
(sin misiones ni jefes; los días perfectos del grupo no dan XP extra), así
la página de una categoría y el filtro de Estadísticas reutilizan las
mismas tarjetas que ya existían (`HabitosApp.conRes` cambia el resultado
mientras se dibujan). Con un filtro puesto se ocultan las tarjetas que
comparan categorías (Por categoría y Equilibrio). El radar muestra las
categorías activas más las archivadas con datos en el periodo; con menos de
3 o más de 8, barras (`HCat.equilibrio`). La misión de categoría aparece en
las semanas pares (según la semilla de la semana) en lugar de la de rango o
total, y cuenta días distintos con algo cumplido de esa categoría; meta =
promedio de las 4 semanas anteriores × 1,2 (entre 2 y 7). El filtro de
Estadísticas se recuerda en el teléfono (`hb-stats-filtro`).

**D-085 (2026-11-05) · Se marca solo, sin lecturas nuevas.** Cada módulo ya
escucha su colección; ahora avisa con un evento (`manolo:actividades` de
Running/Bici, ya existía; `manolo:fuente` de Movilidad, Libros con las
páginas por día, Biblia y Finanzas con fecha, tipo y categoría) y Hábitos
decide con `js/habitos-auto.js` (puro, con pruebas). El registro automático
lleva `auto: { f, v }`; editarlo a mano (marcar, sumar, cambiar estado) lo
reemplaza sin `auto`, y desde ahí manda lo manual. Si el día ya no tiene
actividad en el módulo, el registro automático se borra, pero solo con
datos del servidor (una caché vacía en un teléfono nuevo no borra nada).
Se escribe una vez por hábito (todos los días que cambian en un `update`).
`vinculoDesde` marca desde cuándo sincroniza; "rellenar" lo lleva al primer
día del historial (hasta un año) y esos registros no dan XP porque su hora
es la de hoy (ventana de 48 h). Gimnasio sigue con su evento
`entreno:guardado` (sin deshacer: no hay lista). Los hábitos nuevos se
crean con id del teléfono (`doc().set`) para poder ofrecer rellenar sin
esperar al servidor.

**D-086 (2026-11-05) · Plantillas, hora y avisos.** Las plantillas son
datos en `js/habitos-plantillas.js` (39, con pruebas de que cada una es
válida para el motor y para "se marca solo"); la categoría sugerida (Fe,
Lectura, Cuidado personal, Hogar) cae en su alternativa (Bienestar, Mente,
Cuerpo) si no existe. Tocar una plantilla llena el formulario: no crea nada
sin "Crear hábito". La sugerencia de categoría usa `HCat.sugerir` (palabras
y emoji) y desaparece si eliges una a mano. La hora (`hora: "HH:MM"`) es
opcional; al elegirla se acomoda el momento del día y dentro del grupo se
ordena por hora (las cadenas siguen juntas). El aviso "Te faltan N de la
mañana" cuenta solo lo del momento actual, sin los de Evitar. Push y
Calendario quedan investigados en `docs/NOTIFICATIONS.md`, sin implementar.

**D-087 (2026-11-05) · QA final de Hábitos.** Se cerró el plan con la
regresión completa (todas las E2E de Manolo en verde) y la E2E de Hábitos
a 390 y 1280 px sin errores de consola, incluido exportar e importar con
categorías (la copia ya llevaba `meta/habitos_juego` entero; importar suma
solo las categorías que faltan). Los ocho problemas de la auditoría quedan
resueltos (tabla en `docs/HABITOS.md`). Scalping no se tocó
(`js/scalping-habit.js` igual; su E2E de 75 comprobaciones pasa).

**D-088 (2026-11-05) · Fe, Lectura, Cuidado personal y Hogar vienen de
fábrica; sin recordatorios por ahora.** El dueño eligió las 4 categorías
propuestas. En vez de escribirlas en su cuenta, se suman a las 6 de siempre
al leer (`js/habitos-categorias.js`, igual que la migración desde
`prefs.areas`): aparecen en todos los teléfonos sin escrituras, y solo se
guarda lo que cambie. Si alguien ya tenía una propia con el mismo nombre,
no sale repetida; si la elimina, queda `borrada` y no vuelve. Como ahora
son 10 de fábrica, el límite sube a 16 activas. El radar de equilibrio usa
solo las categorías con algo que hacer en el periodo (si no, 10 ejes casi
vacíos lo volvían barras). Al sugerir, Fe, Lectura, Cuidado personal y
Hogar (y las propias) ganan a las generales en un empate. Sobre los
recordatorios fuera de Manolo (push o Calendario) el dueño dijo que no por
ahora: quedan en "Para después".

**D-089 (2026-11-05) · Racha que perdona.** Pedido: "si falló un día o dos,
que no se pierda la racha; que sea inteligente según cómo me comporto".
Regla (`CFG.RACHA`, `perdonar()` en el motor): cada racha empieza con 1
perdón y gana otro por cada 7 días cumplidos (guarda hasta 2). Un día
fallado usa uno y la racha sigue (ese día no suma); sin perdones se corta y
se vuelven a juntar desde cero. Así se adapta al comportamiento: con ~1
fallo por semana cumplida la racha no se corta nunca; fallando 1 de cada 4
días se corta seguido; 1 o 2 fallos seguidos se salvan y 3 no (igual que
el rango). Semanales: 1 perdón por cada 4 semanas cumplidas (hasta 1).
Evitar no perdona (una recaída corta los días limpios). El día perdonado
sigue siendo un fallo para el rango, el cumplimiento, el XP y los días
perfectos: solo la racha lo trata como neutral. Va antes que los
comodines (un día salvado por un perdón no gasta comodín). Como alarga
rachas del pasado, `CFG.RECALCULO` guarda el resultado en el snapshot sin
celebrar (sin tocar la Temporada 1). Se ve en el detalle ("Racha que
perdona" con 2 escudos), en el calendario (día perdonado, borde ámbar sólido)
y en Hoy ("🔥 9 días · 🛡 salvada ayer", junto a la racha).

**D-090 (2026-11-05) · Ejercicio inteligente: plan y reglas de juego.**
Pedido del dueño: ficha con demo de cada ejercicio, entreno que dice qué
peso usar y por qué, estancamiento, descarga, volumen por músculo,
generador de rutinas, recuperación y "¿Qué entreno hoy?" con Running.
Reglas: (1) **sin IA de pago**: todo por reglas y fórmulas con su fuente
(cada fórmula de la literatura se cita aquí al implementarla); (2) **solo
aditivo**: `rir` por serie, `grupo` de superserie, `rpeSesion`, perfiles
de equipo, meta y nivel en `meta/ajustes_ejercicio`, videos y notas en
`meta/ejercicio_fichas`; los entrenos guardados no se reescriben y los
Rangos no cambian de calibración; (3) **lógica nueva en módulos UMD sin
DOM** con pruebas y pantallas nuevas en archivos nuevos (`gimnasio.js` ya
pesa ~43 KB); (4) **arranque igual**: demos e instrucciones se cargan al
abrir una ficha; todo se calcula en el teléfono con los entrenos que ya se
escuchan (sin lecturas nuevas por ficha); (5) demos: las 2 fotos de
free-exercise-db (dominio público, commit `f00c92c`) en WebP de ~480 px
dentro del repo, fuera del precache del service worker, en una caché con
límite; se precargan las de las rutinas. La base trae además
`mechanic` (compuesto/aislamiento), `force` (empuje/tirón) y `level`: se
agregan a `data/ejercicios.json` como campos nuevos para el descanso
sugerido, el equilibrio y el generador. Auditoría y bocetos en
`docs/EJERCICIO_INTELIGENTE.md`.

**D-091 (2026-11-05) · Demos de los ejercicios.** Las 2 fotos (inicio y
final) de cada ejercicio de free-exercise-db, en el mismo commit fijado
que la base, pasan a WebP de 480 px, calidad 75 (ffmpeg/libwebp; 1114
imágenes, 15,4 MB, ~14 KB cada una) en `img/ejercicios/{id}/0.webp` y
`1.webp` (`scripts/build-demos.mjs`, incremental). Se ven una sobre otra y
se alternan con un fundido de CSS (2,8 s en bucle) con botón de pausa; con
"reducir movimiento" quedan quietas, una al lado de la otra. **No van en
el precache**: el service worker las guarda al verlas en `manolo-demos`
(máx. 240 imágenes ≈ 3,4 MB; se borran las más viejas) y las de los
ejercicios de tus rutinas en `manolo-demos-rutinas` (se reemplaza en cada
precarga; no se precarga con "ahorro de datos"). Las URL llevan `?v=1`
(`EjDemos.VERSION`): si se regeneran, se sube y el teléfono baja las
nuevas. Sin conexión y sin copia, la ficha dice "La demo se verá cuando
haya conexión". Los 35 ejercicios sin fotos (casi todos agregados por Manolo) muestran en la
ficha el mapa con sus músculos. Para el descanso sugerido, el
equilibrio y el generador, `data/ejercicios.json` suma `mec`, `fz`, `niv`
y `demo` (solo aditivo; el resto de cada ficha queda idéntico).

**D-092 (2026-11-05) · Ficha del ejercicio.** (1) **Técnica sin IA**: los
pasos (3 a 5) los escribe el equipo traduciendo y resumiendo las
instrucciones de free-exercise-db; los errores comunes no se escriben por
ejercicio sino por tipo de movimiento (25 tipos, generales y prudentes,
sin consejos médicos), así los 592 ejercicios los tienen desde el primer
día. Lote 1: 114 ejercicios con pasos (85 destacados + los de Manolo); el
resto llega por lotes. Archivo aparte (`data/ejercicios-tecnica.json`),
pedido al abrir la primera ficha; como lo nombra un JS con `?v=`, el
service worker lo guarda y funciona sin señal. (2) **1RM estimado con
Epley** (Epley, 1985), reps topadas en 12 como en Rangos; con RIR se usan
reps + RIR, que es lo que propone la escala de esfuerzo por reps en
reserva (Zourdos et al., 2016, *J Strength Cond Res* 30(1):267-275).
(3) **Videos**: no hay fuente libre para todos, así que "Ver video" abre la
búsqueda de YouTube (sin peso) y "Mi video" guarda solo el id de 11
caracteres de un link de YouTube validado; el reproductor es
`youtube-nocookie.com` y carga solo al tocar la miniatura. (4) Notas y
videos en `meta/ejercicio_fichas` (un documento, una escucha que empieza
al abrir la primera ficha); historial y récords salen de los entrenos ya
cargados (sin lecturas por ficha). (5) La ficha va por encima de las otras
hojas (z-index 950) para poder abrirla desde Rangos o un entreno sin
cerrarlos. (6) En el editor de rutinas el nombre pasa a su propia línea
(antes se cortaba).

**D-093 (2026-11-05) · Entreno en vivo más inteligente.** (1) Al empezar
una rutina, cada serie ya trae el peso de la progresión y las reps
objetivo (antes había que tocar "Usar" y, si no, ✓ guardaba el peso viejo
de la rutina) y una sola línea explica el porqué. (2) RIR opcional por
serie (0–4+), con la escala de reps en reserva (Zourdos et al., 2016); se
guarda `rir` solo si se elige. (3) Calentamiento 40/60/80 % y descanso
sugerido por tipo de ejercicio siguiendo la recomendación del ACSM para
entrenamiento de fuerza (2009, *Med Sci Sports Exerc* 41(3):687-708: 2–3
min en ejercicios multiarticulares pesados, 1–2 min en los demás).
(4) Superseries por letra (`grupo`) en el entreno y en las rutinas: el
descanso va al final de la ronda (el mayor de la ronda). (5) El descanso
avisa con los pitidos y la voz de `js/avisos.js` (los de las rutinas de
Running) y mantiene la pantalla encendida; el iPhone solo suena con la
app abierta (no hay notificaciones push, D-086). El primer ✓ desbloquea el
audio (el iPhone lo exige tras un toque). (6) Récord en vivo por 1RM
estimado o por mejor peso para esas reps, contra el historial y lo ya
marcado hoy. (7) Resumen al terminar con comparación contra la última vez
de la misma rutina y el esfuerzo de la sesión (`rpeSesion`); carga =
RPE × minutos × 100 / 480 (session RPE, Foster et al., 2001, *J Strength
Cond Res* 15(1):109-115), en la escala de Running (D-065). El entreno se
guarda con un id elegido antes (`doc().set`) para poder sumar el esfuerzo
aunque no haya conexión. (8) "Hoy toca" también arriba de la pestaña
Entrenamiento (2 toques para empezar) y "✓ Hecho" si ya la hiciste.
(9) Barra, discos y mancuernas vienen de un perfil de equipo
(`js/ej-equipo.js`, por defecto 20 kg y discos de 25 a 1,25); su
pantalla de ajustes llega en la fase 4. `js/gimnasio.js` creció a ~53 KB
por la integración; la lógica nueva está en módulos aparte.

**D-094 (2026-11-05) · Progresión v2, estancamiento, descarga y equipo.**
(1) La progresión sigue siendo doble progresión (la de siempre, mismas
pruebas) y suma, solo si hay datos: el peso redondeado a tu equipo y una
subida de al menos la microcarga posible, el RIR (con reps de sobra sube
más) y la tendencia del 1RM estimado. (2) Estancamiento por ejercicio con
una regla propia y simple (3 sesiones o 4 semanas sin superar el mejor
1RM estimado); se sugiere cambiar el rango de reps, una variante con tu
equipo (alternativas de la ficha) o una descarga. (3) La descarga se
sugiere solo cuando coinciden 2 o más señales (rendimiento que cae en 2+
ejercicios, esfuerzo que sube, 6+ semanas seguidas sin descarga) y se
aplica con un toque: ~40 % menos series y ~10 % menos peso durante 7
días. Va en la línea del consenso Delphi sobre descargas en deportes de
fuerza (Bell et al., 2023, *Sports Med Open* 9:87: bajar sobre todo el
volumen y algo la intensidad, ~1 semana, cada 4–8 semanas o por señales
de fatiga). Se guarda en `meta/ajustes_ejercicio.descargas`
(`{ desde: hasta }`); "Terminar" la acorta a ayer (o la borra si empezó
hoy); "Ahora no" se recuerda 7 días en el teléfono. (4) Ajustes del
gimnasio: perfiles de equipo, meta (fuerza, músculo, general) y nivel en
`meta/ajustes_ejercicio` (`equipo`, `meta`, `nivel`), con `merge` para no
tocar el peso corporal ni las constantes del mapa. Los perfiles borrados
se quitan con `FieldValue.delete()`.

**D-095 (2026-11-05) · Volumen por músculo, equilibrio y generador de rutinas.**
(1) El volumen se mide en series efectivas por músculo (principal 1,
ayuda 0,5; cada ejercicio una vez por músculo) contra un rango semanal
según meta y nivel: músculo 10–20 (Schoenfeld, Ogborn y Krieger, 2017,
*J Sports Sci* 35(11):1073-1082: ≥ 10 series por músculo a la semana dan
más hipertrofia), fuerza 6–15 y general 6–12 (ACSM, 2009, *Med Sci Sports
Exerc* 41(3):687-708); ajustado por nivel y más bajo para músculos chicos.
(2) Con plan semanal se juzga la semana en curso más lo que queda del
plan (si no, un jueves sin la pierna hecha diría "faltan 10" aunque la
tengas hoy); sin plan, los últimos 7 días. (3) Equilibrio en 4 semanas con
límites conservadores (empuje/tirón 1,5:1, cuádriceps/isquios 2:1,
deltoide anterior/posterior 3:1): son guías prácticas de entrenadores, no
un número de un estudio; solo avisan con qué sumar. (4) El generador es
por reglas, sin IA: splits clásicos según días (la frecuencia de 2 veces
por músculo a la semana rinde más que 1; Schoenfeld et al., 2016, *Sports
Med* 46(11):1689-1697), huecos de movimiento y dosis de ACSM 2009, ajuste
al tiempo disponible y una revisión de la semana para que la propuesta no
quede desequilibrada ni fuera del rango que la misma app recomienda.
(5) Nunca pisa rutinas: se guardan como nuevas (con "(nueva)" si el nombre
existe), el plan solo se completa en días libres y nada se borra. (6) El
bloque de 4–6 semanas reutiliza la descarga de la fase 4: se agenda en
`descargas` y se guarda `bloque` (aditivo, entra en el respaldo). Una
descarga agendada en los próximos 14 días evita que se sugiera otra.

**D-096 (2026-11-05) · Recuperación por músculo y "¿Qué entreno hoy?".**
(1) La recuperación es un modelo simple y explicable, no una medición:
series efectivas de los últimos días que bajan con el tiempo (τ 30 h en
músculos grandes, 22 h en chicos), calibrado para que un músculo grande
con ~9 series duras quede "cansado" al día siguiente, "recuperándose" a
las 48 h y listo a las ~72 h, en línea con las 48–72 h entre sesiones del
mismo grupo que recomienda el ACSM (2009, *Med Sci Sports Exerc*
41(3):687-708). (2) Correr y pedalear cargan las piernas en proporción a
la carga de la actividad (la misma de Running, D-065), así que una
carrera larga ayer deja los cuádriceps cansados hoy. (3) "¿Qué entreno
hoy?" reemplaza la tarjeta "Hoy toca": nunca cambia el plan ni borra nada;
solo sugiere otra rutina tuya (con "Hacer X igual" siempre a mano),
Movilidad o descanso, y dice por qué. (4) Running no tiene días fijos
(sus planes son "Día 1, 2…"), así que "mañana sueles correr" se deduce de
tu costumbre (3+ de las últimas 6 semanas ese día). (5) Carga del
gimnasio con session RPE (Foster et al., 2001, *J Strength Cond Res*
15(1):109-115) en la escala de Running; si no anotaste el esfuerzo se
estima (7) y se avisa. (6) Sin lecturas nuevas: usa los entrenos, carreras
y salidas en bici que la app ya tiene cargados; sin campos nuevos.

**D-097 (2026-11-05) · Resumen inteligente, gráficos del Perfil y compartir.**
(1) El resumen del entreno y de la semana sale de reglas fijas con un
orden de prioridad (récords → comparación → estancamiento → recuperación
→ plan) y como mucho 4 frases: lo útil primero y sin frases que se
contradigan (con récords y menos volumen: "pero con más fuerza"; entreno a
medias: no se compara el volumen). Nada de IA paga. (2) Los gráficos del
Perfil se dibujan solo con Perfil abierto (no suman al arranque) y con lo
que la app ya tiene cargado. La frecuencia marca 2 días por semana, la
que mejor resultado dio frente a 1 (Schoenfeld, Ogborn y Krieger, 2016,
*Sports Med* 46(11):1689-1697). La fuerza relativa usa el mejor 1RM
estimado de 12 semanas y el peso de ese día. (3) La imagen para compartir
se arma en el teléfono (canvas 1080 × 1350) y se ofrece con el menú del
sistema (Web Share con archivo); si el navegador no puede, se descarga.
No se sube a ningún lado ni se guarda nada nuevo.

**D-098 (2026-11-05) · Cierre de Ejercicio inteligente.** (1) El
generador excluye los ejercicios "tras nuca": piden mucha rotación externa
del hombro y no suman nada que el press por delante no dé; quedan en la
base, en la ficha (con el aviso en sus pasos) y en el registro. (2) Los
pasos en español se escriben por lotes priorizados por uso: lote 1 los
destacados, lote 2 todo lo que el generador puede proponer; los demás
muestran demo, errores comunes y "Ver video" hasta su lote. (3) Al cerrar,
regresión completa de las pruebas de pantalla de toda la app.

**D-099 (2026-11-05) · Predicciones también con carreras anotadas a mano.**
Pedido del dueño: que las predicciones salgan solo con lo que anota.
Además de los mejores tramos de las carreras con ruta, cada carrera de
las últimas 12 semanas cuenta entera (distancia y tiempo en movimiento, o
la duración anotada) en la fórmula de Riegel (T2 = T1 × (D2/D1)^1,06),
con las mismas reglas: al menos 1 milla y al menos 1/8 de la distancia a
predecir; no cuentan las de más de 20 min por km (caminatas). Gana la
predicción más rápida. La nota avisa que si todas fueron suaves la
predicción sale más lenta de lo que se puede. Para tener mapas sin
Strava: importar el GPX/FIT de cualquier app o reloj, o el ZIP que
exporta la app Salud del iPhone (sus `workout-routes/*.gpx` ya se leen);
Manolo sigue sin GPS propio (D-033).

**D-100 (2026-11-05) · "Mi día" en Inicio.** Pedido del dueño: una
pantalla que junte lo de hoy. (1) Una tarjeta arriba de Inicio con hasta 5
filas, cada una lleva a su sección: entrenar (la recomendación de
"¿Qué entreno hoy?", D-096), hábitos (cuántos van y cuáles faltan),
Biblia (versículo de hoy y racha), para gastar hoy (el presupuesto diario
de Finanzas, la misma cuenta de Presupuesto › Información, siempre del
periodo de hoy) y Running (km de la semana, meta, carrera de mañana o la
última). Una fila sin datos no aparece; sin nada, la tarjeta tampoco.
(2) Sin lecturas nuevas: usa lo que cada sección ya carga (Hábitos y
Finanzas exponen `Habitos.resumenHoy()` y `FinanzasResumen.hoy()`, que
solo leen; Biblia llega por el aviso `manolo:fuente`). (3) Fácil de
quitar: "Ocultar «Mi día»" la esconde (se recuerda en el teléfono) y
"Mostrar «Mi día»" al pie de Inicio la trae; no guarda nada en la cuenta
ni cambia datos. Quitarla del todo es borrar `js/mi-dia*.js` y su
`<section>`.

**D-101 (2026-11-06) · Reconocer y buscar ejercicios "por cualquier nombre".**
Pedido del dueño: que la app reconozca la mayor cantidad de ejercicios.
(1) Se armó una lista de 331 nombres reales (gimnasio en español de varios
países, nombres de Strong/Hevy en inglés con el equipo entre paréntesis,
abreviaturas como DB/BB/KB/OHP/RDL y errores de tipeo) con el ejercicio que
les corresponde: `tests/nombres-ejercicios.js`. El motor anterior acertaba
79 % (17 equivocados, 51 sin reconocer); el nuevo, 100 %, sin equivocados.
(2) Cómo: el nombre se lleva a una "forma común" (frases y sinónimos de
gimnasio e inglés → una sola palabra: "cristos" = aperturas, "multipower" =
Smith, "gemelos" = talones, "Hip Thrust" = hipthrust…); el equipo se separa
y se respeta ("con mancuernas", "(Barbell)", "en polea"); si no se dice
equipo, va la variante de siempre (barra recta antes que EZ o hexagonal;
sin banda antes que con banda). Tolera ortografía (ll/y, v/b, z/s, c/s, h)
y tipeos; las palabras raras pesan más que las comunes ("femoral" más que
"curl"). Alias extra por ejercicio en `js/ejercicios-alias.js` (solo para
buscar; no se guardan). (3) Seguridad: un nombre vago ("Remo", "Press",
"Pecho", "Máquina") sigue sin adivinarse; una palabra que ya existe no se
"corrige" a otra ("cadera" no es "carrera"). `clave()` no cambió, así que
las asignaciones guardadas siguen valiendo, y los entrenos con
`exerciseId` no se tocan. Comparado con el motor anterior sobre los 1828
nombres y alias de la base: 0 que se dejen de reconocer, 41 nuevos, 10 que
cambian y todos para bien (p. ej. "peso muerto" iba a barra hexagonal,
"press militar" a mancuerna). (4) En "Ejercicios sin reconocer" aparecen
hasta 2 botones «¿Es …?» para asignar con un toque (`sugerir()`). (5) En el
buscador, lo que empieza como lo que escribes sube ("hip th" → Hip thrust),
la última palabra a medio escribir puede ser el equipo ("remo maq") y los
típicos van antes. Rápido: ~0,5 ms por nombre (las palabras se comparan
una vez por búsqueda y se recuerdan).

**D-102 (2026-11-06) · La Biblia se lee dentro de Manolo (RV1909).** Pedido
del dueño ("Libros, Biblia y Medir tiempos: siguiente nivel", diseño en
`docs/LECTURA_NIVEL2.md`). (1) Texto completo de la Reina-Valera 1909
(dominio público) de `seven1m/open-bibles`, archivo
`spa-rv1909.usfx.xml` en el commit fijo `008faa9f…`, convertido por
`scripts/build-biblia.mjs` (`npm run biblia -- archivo.xml`) a un JSON por
libro en `data/biblia/rv1909/` (66 libros, 1.189 capítulos, 31.102
versículos, 3,8 MB; 1,26 MB comprimido), sin notas al pie; 18 versículos
quedan vacíos porque esa edición los une al anterior o al siguiente (p. ej.
Jonás 1:17 está en 2:1) y el lector no los muestra. (2) **No va en el
precache**: cada libro se baja al abrirlo y queda en la caché
`manolo-biblia` (no se borra al actualizar la app); "Descargar la Biblia"
guarda los 66 y pide almacenamiento persistente; "Quitar la descarga" la
borra. El arranque no crece (solo ~36 KB de código y estilos nuevos). (3)
**Ortografía actual** (activada por defecto, se apaga en «Aa»): al mostrar,
"á/é/ó/ú" sueltas, "fué, dió, vió, fuí, dí, sólo, éste…" pasan a la forma
de hoy y la primera palabra en mayúsculas del capítulo ("EN el principio")
se escribe normal; el texto guardado no cambia. (4) La RVR1960 y otras
versiones modernas tienen derechos: no se incluyen; "Abrir en otra versión"
es solo un link a BibleGateway con la versión elegida (RVR1960 por
defecto). (5) Lector a pantalla completa con selector de libro y capítulo
(buscador, capítulos leídos marcados), tamaño de letra, deslizar o ‹ › para
cambiar de capítulo, "Marcar como leído" y "seguir donde quedé" (también
entre aparatos). Datos nuevos: `meta/biblia_lector` y `meta/biblia_leidos`
(capítulos leídos por día). El "Fake Firebase" de las pruebas ahora
resuelve `arrayUnion` dentro de un mapa nuevo, como Firestore.

**D-103 (2026-11-06) · "¿Que se marque solo?" para hábitos sin vínculo.**
El dueño preguntó por qué "Correr" no se marcaba solo al ir a correr. El
mecanismo (D-085) solo marca hábitos **vinculados** a un módulo, y un
hábito creado antes del 5 de noviembre (o sin plantilla) no lo está. Se
revisó también el orden de carga (las carreras pueden llegar antes que los
hábitos): está cubierto, porque al llegar los hábitos se vuelve a revisar.
Solución: si el nombre del hábito dice claramente de qué módulo es,
Hábitos › Hoy lo sugiere arriba y un toque lo vincula (desde hoy; la
carrera de hoy lo marca al instante y se ofrece marcar los días
anteriores, sin XP como siempre). "No, gracias" guarda `vinculoNo` en el
hábito (aditivo). No se vincula nada sin el toque del dueño.

**D-104 (2026-11-08) · Rutinas listas en Ejercicio ("Rutina en casa —
Glúteo & Full Body").** Pedido del dueño: una rutina predefinida que su
novia pueda ver y seguir desde su celular. (1) Cada rutina es un archivo
JSON en `data/rutinas/` con el formato que mandó el dueño, más un `id`
fijo por rutina y por ejercicio (para que el historial no dependa del
nombre) y, opcionales, `factor` y `mapa`; agregar otra = otro archivo y
una línea en `ARCHIVOS` (`docs/RUTINAS_LISTAS.md`). (2) Va en
Entrenamiento › "Rutinas listas" y abre su página con los días como
pestañas; el de hoy se destaca según `dia_sugerido`. (3) Una casilla por
serie; lo marcado vive en el teléfono hasta "Terminar el día y guardar",
que guarda un entreno **con el formato de siempre** en
`users/{uid}/entrenamientos` (más `plantilla`, aditivo). (4) Mapa muscular
con los músculos de la rutina: sus ejercicios se cargan como fichas propias
(el primer músculo es el principal) que se encuentran por id, así el mapa,
el volumen, la recuperación, los gráficos y editar desde Perfil funcionan
sin cambios; no entran en el buscador para no cambiar cómo se reconocen
los nombres de siempre. (5) Sin internet: el archivo entra en el precache
(el service worker ahora también encuentra datos en subcarpetas de
`data/`). Nada de lo guardado cambia de estructura.

**D-105 (2026-11-14) · Biblia fase 2: tocar versículos, anotar, buscar y
compartir.** (1) En el lector, tocar uno o varios versículos los elige y
aparece una barra: 5 colores para resaltar (y ⊘ para quitar), ★ Favorito,
✎ Nota, ＋ Anotar, Compartir (imagen) y Copiar. (2) Datos: un documento
por libro en `users/{uid}/biblia_marcas/{libro}` (máximo 66: nunca se
acerca al límite de 1 MB, y se escuchan ≤ 66 documentos): `col` (color por
versículo) e `it` (favorito y nota en el primer versículo de lo elegido,
con `r` = los versículos y `t` = el texto original para listarlos sin
abrir el libro). Claves `cap_v` (sin puntos, por Firestore). Se guarda con
`merge`; quitar usa `FieldValue.delete()`. (3) "Anotar" abre el formulario
de siempre con la cita y el texto puestos; el registro lleva `version`
(aditivo: "RV1909", la que elijas o ninguna en los viejos). En el
formulario, al poner libro, capítulo y versículo el texto se completa solo
con la RV1909 (si el campo está vacío o tiene el automático); si pegas tu
texto, propone tu versión de "Abrir en otra versión" (RVR1960 por
defecto). (4) Búsqueda en toda la Biblia en un Worker
(`js/biblia-buscar-worker.js`, en el precache): la primera vez lee los 66
libros (de la caché o de internet, y quedan guardados) y sus textos sin
tildes; cada palabra cuenta desde el comienzo de una palabra ("amo" está
en "amó", no en "digamos"); con varias palabras, primero la frase exacta;
máximo 200 resultados a la vista; filtros AT, NT o el libro abierto. (5)
Compartir: imagen 1080 × 1350 estilo Manolo (canvas; Web Share en el
iPhone, descarga en la compu). (6) Pestaña "Marcados" en Biblia con
filtros (favoritos, notas, colores); "Exportar (JSON)" suma marcas,
capítulos leídos y ajustes del lector. Sin respuesta del dueño a las
preguntas de la fase 0: no hay diario de oración y "Abrir en otra versión"
sigue en RVR1960.

**D-106 (2026-11-14) · Biblia fase 3: planes, progreso, memorizar, temas y
racha con lo leído.** (1) Planes de lectura en
`users/{uid}/meta/biblia_planes` (`planes: { id: { tipo, inicio, activo,
creado, porDia?, desde?, alDia?: { hasta }, corrimiento?, quitado? } }`,
con `merge`): Biblia en un año (365 días), Nuevo Testamento en 90,
Evangelios en 30, Salmos en 30, Proverbios del día (el capítulo del día del
mes; no termina) y "A mi ritmo" (capítulos por día desde el libro que
elijas). Los capítulos se reparten parejo entre los días; cuenta lo
marcado "leído" desde que empezó el plan. (2) Atrasado: "Ponerme al día"
reparte lo atrasado en 7 días (la parte de cada día se fija con lo que
faltaba al empezar ese día: leer una no hace aparecer otra) y "Mover el
plan" corre las fechas para que hoy sea el primer día con algo sin leer
(lo leído queda). "Quitar este plan" lo apaga (`activo: false`), no lo
borra. (3) Arriba de Biblia, una tarjeta por plan con la lectura de hoy
("Leer" abre el primer capítulo que falta); en el lector, al final del
capítulo, "Plan: 1 de 3 de hoy" y "Seguir con …" cuando lo que sigue del
plan no es el capítulo de al lado. (4) Progreso (`#biblia-progreso`): % de
la Biblia, AT y NT, libros completos, capítulos de este año y el mapa de
los 66 libros (tocar uno muestra sus capítulos; tocar un capítulo lo
abre). (5) Memorizar (`meta/biblia_memoria.items`, id `Libro_cap_vers`):
cajas tipo Leitner del 1 al 6 que vuelven en 1, 2, 4, 8, 16 y 32 días;
"¡Lo sabía!" sube de caja, "Me costó" repite mañana y "No lo sabía" vuelve
a la 1. Practicar: primeras letras, ocultar palabras (pocas, muchas,
todas) o escribirlo (palabra por palabra, sin tildes, mayúsculas ni
puntuación; 90 % o más = lo sabías, 60 % o más = te costó). Se agrega
desde el lector (barra › 🧠) o desde un versículo anotado. (6) Temas
(`biblia/{id}.temas`, aditivo): 12 de fábrica más los tuyos (hasta 8 por
versículo) y filtro en la lista; al quitarlos todos se borra el campo.
(7) La racha cuenta los días con un versículo anotado o un capítulo
marcado como leído; el calendario marca los días leídos; "Mi día" dice
"Biblia leída hoy" o la lectura del plan que falta; los hábitos vinculados
a Biblia también se marcan al marcar un capítulo leído (solo se deshace
algo con datos del servidor). (8) ⚙ Ajustes de Biblia: "Versículo de
arriba: también de tus favoritos" (`meta/biblia_lector.favArriba`); los
favoritos se guardan en el teléfono (`localStorage`
`manolo.biblia.favoritosArriba`) y en Inicio sale uno un día sí y otro no.
(9) Pantalla: siguen las pestañas Lista · Calendario · Marcados; Planes,
Progreso y Memorizar son páginas aparte con accesos debajo de "Anotar
versículo" (cuatro pestañas no entraban bien en 320 px).

**D-107 (2026-11-15) · Libros fase 4: "Leer ahora", velocidad, Abandonado,
releer y audiolibros.** (1) "▶ Leer ahora" en "Sigue leyendo" y en la
ficha: un cronómetro por marcas de tiempo (empezó, pausas) guardado en el
teléfono (`localStorage manolo.libros.sesion`, con el uid): sigue con el
teléfono bloqueado o la app cerrada y no gasta Firestore mientras corre.
Pausa, "Mantener la pantalla encendida" (Screen Wake Lock, opcional, solo
mientras la hoja está abierta y corriendo) y "Descartar". Al terminar:
minutos (editables, de 1 a 720) y "¿A qué página llegaste?" → en el libro
`sesiones.{id} = { fecha, ini, fin, min, desde, hasta, unidad, lectura }`
y el avance de hoy (como "Anotar página"), en un solo `update`. (2)
Velocidad = avance ÷ minutos de las sesiones que avanzaron (con 5 minutos
o más); "te faltan unas 4 h 50 min de lectura" a esa velocidad; "lo
terminas el …" sigue siendo a tu ritmo de páginas por día. (3) Estado
Abandonado (`fechaDejado`): "Dejar de leerlo" y "Retomar" (sigue en la
misma página); anotar avance en uno abandonado lo vuelve a Leyendo. (4)
"📖 Leer de nuevo" en uno terminado: la lectura de ahora se guarda en
`lecturas.N` (estado, fechas, formato, páginas, calificación y su avance)
y empieza otra desde 0; las páginas por día, el reto y las estadísticas
cuentan todas las lecturas (cada vez que lo terminaste suma). Nada se
borra. (5) Formato: Papel, Digital o Audiolibro (`formato`,
`duracionMin` opcional). El audiolibro avanza en % (`pctActual`,
`pctBase`, `progresoPct`, con un decimal; con su duración se anota en
horas y minutos y se convierte) y no suma a la meta de páginas; sí suma
minutos. (6) Hábitos: Libros manda `{ fecha: { paginas, min } }`; un
hábito de Tiempo "Leer" ahora puede marcarse solo con las sesiones.

**D-108 (2026-11-15) · Libros fase 5a: "¿Qué leo después?", sagas,
prioridad y notas.** (1) "¿Qué leo después?" ordena tus "Por leer" con
reglas y puntos, sin IA (`js/libros-siguiente.js`): prioridad Alta +30 /
Baja −15; el siguiente de una saga cuyo anterior terminaste +25 (si falta
uno anterior, −20 y lo avisa: "Antes va el 2 de «…»"); el n.º 1 de una saga
+3; un género que no está entre tus últimos 6 terminados +12 (para
equilibrar) y −8 si vienes de dos seguidos del mismo; el largo contra tu
ritmo real (páginas por día de los últimos 30 días, o tu meta si casi no
anotaste): hasta 14 días +8, más de 60 −5; con el reto atrasado, los que
terminas en 3 semanas +6; 6 meses o más en la lista, hasta +5. Se muestran
las 2 razones que más suman y los avisos. (2) En Libros, debajo de "Sigue
leyendo", los 3 primeros; "Ver los N" abre la lista con razones, la
prioridad (Baja · Normal · Alta, se cambia ahí) y "Empezar" (pasa a
Leyendo desde hoy). (3) Saga: nombre (con sugerencias de las que ya
usaste) y número (acepta 1,5); `saga`, `sagaN`, `prioridad` en el libro
(aditivo). (4) Notas por libro aparte de "Mi opinión": "Lo que aprendí",
"Para aplicar" o "Nota", con fecha (`notas: { id: { texto, tipo, fecha,
creado } }` en el libro; se agregan, editan y borran de a una con
`update` por campo).

**D-109 (2026-11-15) · Libros fase 5b: frases favoritas, etiquetas,
compartir y repaso.** (1) Cada frase suma `fav`, `etiquetas` (minúsculas,
hasta 8 de 24 letras, también "#fe") y `repaso: { n, int, ultimo, proximo,
nota }` (aditivo; `validarFrase` siempre escribe `fav` y `etiquetas`). (2)
"Repaso de frases": de 1 a 3 por día (`meta/libros_ajustes.frasesDia`, 3 si
no está). Las de hoy son las que ya repasaste hoy más las que tocan hasta
completar el número, así que no cambian durante el día. Orden: favoritas
(+3), las que te encantan (+2), nunca vistas (+1); los empates se mezclan
con el día como semilla. Calificar: ❤️ "Me encanta" vuelve en 3 días (las
buenas vuelven más), 👍 "Bien" 7, 14, 28… hasta 60 días, 👎 "Menos" 90
días. (3) Compartir una frase: imagen JPEG 1080 × 1350 con
`js/biblia-imagen.js`, que ahora acepta título y pie (`dibujar(g, plan,
{ titulo, pie })`) y achica o corta la cita si no entra; JPEG porque el
PNG pesaba 1,2 MB y tardaba segundos en armarse. (4) Pestaña Frases:
filtros Todas · ★ Favoritas · #etiquetas; en el formulario, ★ Favorita,
etiquetas (las tuyas como botones y una nueva) y el consejo de copiar el
texto con la cámara del iPhone (Texto en vivo).

**D-110 (2026-11-15) · Libros fase 5c: importar de Goodreads, StoryGraph y
Kindle.** (1) "Importar" (abajo de Libros) lee el archivo en el teléfono
(nada sale de Manolo), reconoce de qué app es por su contenido y muestra la
vista previa con casillas; "Agregar" guarda en lotes de hasta 400
escrituras. (2) Goodreads (CSV de "Export Library"): estante → estado
(read, currently-reading, to-read), "My Rating" (0 = sin calificar),
páginas, "Date Read"/"Date Added", Binding → formato (Kindle = digital,
Audible = audiolibro), ISBN (viene como `="…"`), año de la primera
edición, reseña (sin HTML) y la saga del título "(Saga, #2)". StoryGraph
(CSV): "Read Status" (did-not-finish y paused → Abandonado), formato,
estrellas con decimales (4,5 → 5), "Dates Read" (inicio y fin) y reseña.
Kindle ("My Clippings.txt", en español o inglés): subrayados → frases con
página y fecha, notas → notas del libro, marcadores no; un subrayado que
amplía otro deja solo el más largo; los libros que no tienes se crean
como digitales, con el estado que elijas (Terminado por defecto). (3) Sin
duplicar: un libro ya está si coincide el ISBN o el título (sin
tildes, sin subtítulo ni saga entre paréntesis) y el apellido del primer
autor; dos veces en el archivo entra una; una frase, si su texto ya está
en ese libro. (4) Datos nuevos, aditivos: `isbn` e `importado: { de, id }`
en el libro y `importado: { de: "kindle", ubicacion }` en la frase.

**D-111 (2026-11-15) · Libros fase 5d: escanear el código de barras
(ISBN).** (1) Lector propio y sin librerías, `js/libros-isbn.js` (unos 14
KB, muy por debajo de los 200 KB pedidos): se carga recién al tocar
"Escanear" (script que se agrega a la página) y el service worker lo
guarda (EXTRAS) para usarlo sin internet. Las librerías conocidas (ZXing,
Quagga) pesan bastante más y leen muchos formatos que no hacen falta: un
libro siempre usa EAN-13. (2) Cómo lee: recorre líneas a lo largo de la foto
(filas; si no encuentra, columnas y diagonales), en los dos sentidos; cada
línea se pasa a barras de cuatro maneras (por los bordes, umbral de toda la
línea, umbral local por sombras y una versión más nítida por si está
movida), con el cruce entre píxeles para barras de 1 o 2 px; cada dígito se
compara por anchos y, si la foto está borrosa, por la distancia entre
bordes del mismo tipo. Pide guardas al inicio, en el medio y al final,
blanco antes y después, el dígito de control y que los 12 dígitos se
parezcan bien en promedio: en 1.200 imágenes sin código (ruido, barras al
azar) no inventó ninguno. Gana el código que más líneas leyeron; con una
sola línea vale solo si empieza con 978/979. (3) En el iPhone, lo más
confiable es la foto: la cámara del sistema enfoca de cerca (macro) y la
foto se lee en el teléfono a 2.000 px (y si no, a 1.100). La cámara en
vivo (getUserMedia, cámara de atrás, sin micrófono) lee una franja del
medio unas 6 veces por segundo y pide el mismo código dos veces; se apaga
al leer, al cerrar la hoja o al salir de la app. Si el navegador trae
BarcodeDetector (Chrome, Android), se usa primero. (4) Al leer un ISBN se
cierra la hoja y el libro se busca en Open Library como si lo hubieras
escrito. El ISBN buscado (escrito o escaneado) se guarda en el libro
aunque Open Library no lo tenga: campo `isbn` (aditivo, el mismo de la
fase 5c); vacío no borra el que había. Un código que no es de libro lo
dice («no es de un libro»).

**D-112 (2026-11-15) · Libros fase 5e: estadísticas nuevas y "Tu año en
libros".** (1) Lógica nueva en `js/libros-estadisticas.js` (UMD); la
pantalla, en `js/libros-estadisticas-ui.js`, que llena huecos que deja
`renderStats()` (`data-lest="…"`) y usa los mismos gráficos de barras
(`LibrosDatos.grafico`, tocar una barra dice su valor). (2) Un día cuenta
como leído si anotaste páginas, % de un audiolibro o una sesión de «Leer
ahora». Calendario por mes (lunes a domingo, ‹ › hasta el mes de hoy):
cinco tonos según tu meta de páginas (algo, la mitad, la meta, el doble);
los minutos se comparan con lo que te lleva la meta a tu velocidad (30 min
si todavía no se sabe); tocar un día dice qué libros y cuánto. Elegimos
calendario por mes y no el "mapa del año" de 53 columnas porque en el
iPhone cada día quedaría de 5 px, imposible de tocar. (3) Tiempo leyendo:
solo lo medido con «Leer ahora» (año, mes, promedio por sesión, minutos
por semana de las últimas 12, la sesión más larga); lo anotado sin
cronómetro se muestra aparte como estimado con tu velocidad. (4)
Velocidad: páginas por hora de cada mes (con 10 minutos o más) y la
tendencia: los últimos 3 meses contra los 3 anteriores, con 30 minutos o
más en cada lado (±5 % = "se mantiene"). (5) Autores (y géneros): libros
distintos terminados; un releído cuenta una vez, con las páginas de las
dos lecturas. (6) "Tu año en libros": tarjeta arriba de Libros del 15 de
diciembre al 31 de enero (el año que se cierra) y botón en Estadísticas
(cualquier año con libros, ‹ ›): terminados, páginas, tiempo, días con
lectura, mejor racha, comparación con el año anterior, las tapas, tus 5
estrellas (el releído una vez), el más largo, el más rápido, mejor mes
(con 2 libros o más), género, autor del año (2 libros distintos o más),
audiolibros, relecturas, frases y la frase del año (tu favorita más
reciente). Se comparte como imagen JPEG de 1080 × 1350 (sin emojis en la
imagen: no todos los teléfonos los dibujan igual en un lienzo). Nada nuevo
se guarda: todo sale de los datos que ya había.

**D-113 (2026-11-15) · Medir tiempos fase 6: definitiva, tus actividades,
⏱ Medir, "Mi mañana" y se llena sola.** (1) Deja de ser provisoria (fuera
"Cómo borrarla"); los datos de `tiempos/{fecha}` quedan tal cual. (2) Tus
actividades en `meta/tiempos_ajustes.actividades` ({ nombre, emoji, orden,
archivada, manana, fuente, desde }); sin ese documento valen las 6 de
siempre, que conservan su id. El primer día con la versión nueva se crea el
documento y las que se llenan solas (Correr ← Running, Ejercicio ←
Ejercicio, Leer ← Libros) empiezan **desde ese día**: los días de antes no
cambian (si no, el promedio final de los primeros 30 se movería). (3) Se
sigue midiendo después de los 30: el promedio final (primeros 30) no
cambia; los promedios por semana, mes y día de la semana usan todos los
registros. (4) ⏱ Medir y Mi mañana por marcas de tiempo guardadas en el
teléfono (`manolo.tiempos.medir`, `manolo.tiempos.manana`), como "Leer
ahora": sobreviven al bloqueo y a cerrar la app (hasta 12 h). Cada paso de
Mi mañana se anota al cerrarlo (un tiempo medido manda como uno escrito);
"tu promedio" = el de tus últimos 30 registros sin contar el día que mides.
El orden de la mañana es el de tus actividades (un solo orden, más simple
que dos listas). (5) Se llena sola con las reglas de Hábitos (D-085):
`auto: { id: { f, s } }` en el día; lo manual manda; quitar uno automático
deja `noAuto: { id: true }`; si la fuente desaparece se quita (solo con
datos del servidor). Running avisa con `manolo:actividades`; Libros y
Movilidad con `manolo:fuente`; Ejercicio ahora también (`fuente:
"gimnasio"`, la duración de cada entreno; Hábitos lo ignora porque Gimnasio
es "solo evento"). Sin lecturas nuevas de Firestore: usa los datos que cada
sección ya carga. (6) Exportar JSON y CSV (";" y coma decimal, para Excel en
español). (7) Opcional, sin hacer hasta que el dueño diga: pitido o voz si
un paso pasa tu promedio (por ahora el reloj se pone naranja).

**D-114 (2026-11-15) · Medir tiempos fase 7: plan de la mañana,
estadísticas, línea base y experimentos; "Mi día" y Hábitos.** (1) Plan de
la mañana (`meta/tiempos_ajustes.plan = { levantarse, listo }`): la línea de
tiempo usa la **mediana** de tus últimos 30 registros de cada paso (una
mañana rara no la mueve como un promedio) y solo los pasos que **sueles
hacer ese día de la semana** (los anotados en al menos la mitad de esos
días; así Ejercicio y Correr no se suman el mismo día). Dice si te sobra o
te falta tiempo, dónde se te va más (el paso más largo y su %) y dónde
podrías ahorrar (mediana contra tu mejor tiempo). (2) Mi mañana contra tu
plan: en vivo, si el paso actual va antes de su hora (adelantado), en ella
(a tiempo) o después (atrasado); al final, a qué hora terminaste contra tu
hora de estar listo. (3) Estadísticas por actividad: promedio, mediana,
mejor y peor (con fecha), tendencia (últimos 30 días contra los 30
anteriores, con 3 registros o más en cada lado; ±5 % = igual; menos tiempo =
mejor), lunes a viernes contra fin de semana, y el total de tu mañana por
día. (4) El "promedio final" pasa a llamarse **Línea base** (tus primeros
30). Un **experimento** (`meta/tiempos_ajustes.experimentos.{id} = {
nombre, desde, nota, hasta, creado }`) toma los 30 registros siguientes a
su fecha y compara su mediana con la línea base (solo días de antes del
experimento); "Terminarlo hoy" y "Quitar" (tus tiempos no se tocan). (5)
"Mi día": suma tu mañana (en curso y contra tu plan, lista, o "Empieza tu
mañana" si tienes plan), el libro que lees (páginas de hoy contra tu meta)
y el repaso de hoy (frases y versículos); como mucho 5 filas: primero lo que
hay que hacer hoy, después avisos, lo hecho y lo libre, en su orden de
siempre. (6) Hábitos: "Medir tiempos" es una fuente más de "se marca solo"
(una actividad o todo el día; Sí/No o Tiempo en minutos). Con eso, vincular
un paso de tu mañana a un hábito (el opcional de la fase 7) sale con el
mismo mecanismo: al cerrar el paso, el hábito se marca. Sin lecturas nuevas
de Firestore.

**D-115 (2026-11-15) · QA final de "Libros, Biblia y Medir tiempos:
siguiente nivel".** (1) Regresión de todo Manolo: `npm test` (610) y las 26
pruebas de pantalla de `scripts/e2e/` (2.498 comprobaciones, 0
fallas). (2) Prueba nueva `scripts/e2e/lectura-qa.js`: con versículos,
libros, frases y tiempos guardados como antes, usar todo lo nuevo (lector,
plan, memorizar, editar un versículo y dos libros, Leer ahora, repaso de
frases, importar de Goodreads y Kindle, Mi mañana, se llena sola, plan de
la mañana, experimento) no cambia ni pierde ningún dato de antes: se
compara documento por documento (lo nuevo solo suma campos; los días de
Medir tiempos de antes quedan idénticos). Con muchos datos (3 años de
tiempos, 1.500 versículos, 400 libros, 3.000 frases) cada pantalla abre en
menos de 1,5 s y sin pausas de más de 0,5 s; a 320 px nada se mueve de lado.
(3) Lo que encontró: con muchos datos, las estadísticas de Medir tiempos
calculaban fechas dentro del bucle de cada registro y «Frases de hoy»
recalculaba la mezcla del día en cada comparación del orden (≈ 160 ms cada
una); ahora una vez por registro (≈ 5 ms, mismos resultados, con pruebas que
lo comparan). "Tus días" muestra los 90 más nuevos con "Ver 90 días más"
(antes pintaba todos en cada cambio). Biblia con 1.500 versículos pasó de
0,9 s a 0,4 s. La medición es pesimista: el Firestore de prueba avisa a
todas las pantallas en cada guardado (el de verdad, solo a las que cambian).
Respaldos ("todo lo nuevo entra en el exportar de cada sección"): el de
Medir tiempos no llevaba el plan ni los experimentos y el de Libros no
llevaba tus ajustes (meta de páginas, retos, frases por día); ahora sí (el
de Biblia ya llevaba marcas, leídos, planes y memorizar). La regresión
completa encontró una comprobación vieja de `libros-progreso.js` (no estaba
en la lista corta de cada fase): con un ISBN escrito esperaba el aviso
general "No encontré ese libro", pero desde D-111 el aviso es el del ISBN
("No encontré ese ISBN…", correcto). Se ajustó la prueba: ahora revisa los
dos avisos. Desde ahora, la regresión de cada fase corre las 26 suites. (4)
Queda opcional, esperando OK del dueño: pitido o voz cuando un paso de "Mi
mañana" pasa tu promedio (hoy el reloj se pone naranja).

**D-116 (2026-11-15) · Finanzas: el disponible por día sale de lo que
realmente entró.** Pedido del dueño: con presupuesto 5000 y 3000 recibidos
debe decir 100 por día, no ~170. (1) Cálculo nuevo en
`js/finanzas/diario.js` (función pura, en centavos, con pruebas):
disponible por día = ingresos registrados del mes ÷ días del mes; te queda
por día desde hoy = (ingresos − gastos) ÷ días que faltan contando hoy. El
presupuesto de ingresos queda solo como meta ("Recibido vs. presupuestado").
Antes contaba lo mayor entre lo presupuestado y lo recibido y descontaba
por adelantado los ahorros y fijos presupuestados; ahora solo cuenta lo
que ya entró y lo que ya gastaste (el dueño aceptó la fórmula tal cual).
(2) El "mes" es el periodo del presupuesto (día 1 salvo que se cambie). No
cuentan transferencias, pagos de tarjeta ni lo "Excluido del presupuesto".
Redondeo hacia abajo al centavo. (3) Estados con color, ícono y texto:
verde (te queda ≥ disponible), ámbar (menos), rojo (negativo), "Mes
cerrado"; sin ingresos, estado vacío con "Registrar ingreso" (nunca un
número inventado). ⓘ "¿Cómo se calcula?" con los números reales. (4) Se
usa en Resumen, Presupuesto (anillo y línea por día), Información y "Mi
día"; la "Proyección" de Información no cambia. Nada cambia en cómo se
guardan los datos. (5) Variables nuevas en `:root` para lo nuevo: estados
(`--estado-ok`, `--estado-aviso`, `--estado-mal` y sus fondos), radios
(`--radio-tarjeta`, `--radio-caja`, `--radio-pildora`), sombra flotante y
la duración de las animaciones. Detalle en `docs/FINANZAS.md`.

**D-117 (2026-11-15) · Lugares: tu guía de dónde comer.** Pedido del
dueño. (1) Sub-panel `#lugares` de Inicio (como Libros y Biblia), con
pestañas Visitados / Quiero ir, buscador (con espera de 0,2 s), chips
deslizables (orden, tipo, zona, precio, volvería, calificación mínima),
"¿Dónde como hoy?" (al azar entre los que volverías, sin repetir el último,
animación corta que respeta "reducir movimiento") y estadísticas. (2) Datos
en `users/{uid}/lugares` (en la nube, como lo demás), esquema `v: 1`; montos
en centavos. Registrar pide solo nombre, estrellas y ¿volverías? ("Fui hoy"
marcado anota la visita); lo demás en "Más detalles". "Ya fui" abre la
calificación y recién al guardar pasa a Visitados. (3) Fotos: la completa
en IndexedDB del teléfono (≤ 1200 px, JPEG 0,75), nunca en localStorage;
en el documento, una miniatura de ~200 px por foto (aprobado por el dueño),
hasta 6 por lugar; "Exportar (JSON)" lleva las completas. Las fotos de un
lugar borrado se borran recién cuando vence el "Deshacer". (4) Borrar
(lugar, plato o visita): al instante con "Deshacer" 5 s, sin confirm().
Formularios en hojas de abajo con borrador (solo texto e ids de fotos) que
vuelve si cierras sin querer. (5) Un gasto de visita se ofrece a Finanzas:
"Agregar a Finanzas" abre la hoja de gasto de siempre ya llena (Comida,
fecha, nombre del lugar) vía `window.FinanzasNuevo.gasto`; se anota solo si
tocas Guardar. (6) Accesibilidad: estrellas y opciones como grupos de
radio con teclado, nombres para lector de pantalla, foco al abrir y al
cerrar hojas, Escape cierra, áreas de 44 px (también pestañas, "‹ Inicio"
y Exportar dentro de Lugares), estado con ícono + texto. Detalle en
`docs/LUGARES.md`.

**D-118 (2026-11-15) · Copia de seguridad de todo Manolo.** Pedido del
dueño ("exportar/importar JSON que incluya TODO, también Lugares; al
importar, valida y haz un respaldo antes de reemplazar"). (1) Una hoja
desde Inicio (abajo, junto a "Estado de la cuenta") y el menú ☰ del
teléfono (en la compu no, para no amontonar la barra de arriba). (2) El
archivo (`app: "Manolo", tipo: "copia-completa", version: 1`) lleva las 21
colecciones de `users/{uid}` y las fotos completas de Lugares del teléfono;
no lleva `finanzas_respaldos` ni lo compartido (`feed`, `comentarios`,
`accesos`, `admins`). Una prueba revisa `js/` y falla si una colección
nueva queda afuera. Timestamps como `{__tipo: "timestamp", ms}`. (3)
Descargar en dos toques (preparar → "Guardar archivo") porque el iPhone
solo abre "Compartir" justo después de un toque. (4) Restaurar **nunca
reemplaza**: con el dueño se decidió que importar solo agrega lo que falta
(un documento que ya existe se deja como está, aunque en la copia esté
distinto). Antes de escribir, se lee de la nube lo que ya tienes (hace falta
internet: sin eso se podría pisar algo que el teléfono no tiene guardado) y
se guarda una copia automática de lo actual en el teléfono (IndexedDB
`manolo-respaldos`, las últimas 3, descargables); si esa copia falla, no se
cambia nada. "Deshacer" quita exactamente lo agregado. (5) Acepta también
el "Exportar (JSON)" de Lugares (trae los documentos tal cual y las
fotos); la copia de Hábitos o de Finanzas se importa en su sección (la hoja
dice dónde); los resúmenes de Libros, Biblia, Inversiones y Medir tiempos
no se restauran. (6) Lotes de hasta 400 escrituras y 4 MB; si no hay
respuesta en 20 s, lo escrito queda en el teléfono y Firestore lo sube
solo; restaurar la misma copia otra vez completa lo que falte sin
duplicar. Detalle en `docs/RESPALDO.md`.

**D-119 (2026-11-15) · QA final de Finanzas, Lugares y la copia de
seguridad.** (1) Lighthouse (Accesibilidad y Buenas prácticas, 375 px, con
el Firebase de prueba) en Inicio, la hoja de la copia de seguridad,
Lugares (lista, detalle y nuevo lugar) y Finanzas: 100 y 100 en todo,
menos "Nuevo lugar" con Accesibilidad 97: avisa que dos botones de "Tipo"
quedan debajo del botón fijo "Guardar" de la hoja; miden 44 px y se tocan
al deslizar (el botón fijo es a propósito: la acción principal al alcance
del pulgar). (2) Arreglos que salieron de esa revisión: el menú ☰
cerrado del teléfono ya no recibe el foco (`visibility: hidden` al
terminar de deslizarse); el zoom de la pantalla se fija solo al escribir
en campos de letra menor a 16 px (con 16 px o más el iPhone no acerca, así
que el zoom con dos dedos queda libre); Lugares tiene un título "Tus
lugares" para el lector de pantalla, así los títulos van en orden. (3)
Sin internet: prueba nueva `scripts/e2e/sin-internet.js` con el service
worker de verdad (la app se guarda completa, también lo nuevo, y en modo
avión abren Inicio, Lugares, la copia de seguridad y el disponible por
día). (4) Datos de antes intactos: abrir las pantallas y guardar una copia
no cambia ni un dato (comprobado en la prueba de la copia), y lo nuevo
solo agrega (el disponible por día solo lee; Lugares es una colección
nueva; restaurar nunca pisa). (5) Modo claro: la app es solo oscura (su
identidad visual); no se agregó un modo claro solo en las pantallas
nuevas, que usan las variables de `:root`, así un modo claro futuro sería
cambiar esas variables en un solo lugar. (6) Revisión de código: las
miniaturas de fotos de Lugares solo se aceptan si son una imagen en base64
(`miniOk`: JPEG, PNG o WebP; sin SVG) y siempre se escapan al ponerlas en
la pantalla; así un archivo de copia armado a mano no puede meter código.

**D-120 (2026-11-15) · Fallas de pantalla de las capturas del dueño.** (1)
La barra de abajo, el ＋ y el aviso de versión nueva aparecían a media
pantalla, la barra de arriba se escondía (el texto pasaba bajo la hora y
la batería) y el lector de la Biblia no cubría abajo. Causa: el iPhone, al
cerrar el teclado o el selector de hora, a veces deja la parte visible
"corrida" de la que usa para lo fijo. Dos arreglos: (a) evitar lo que lo
dispara: todos los campos con letra de 16 px o más (eran 3 reglas: ajustes
de ejercicio, formularios de running/carteras y el entreno en vivo), así
el iPhone no acerca la pantalla al escribir (y `js/main.js` no cambia el
zoom); (b) si igual pasa, `js/viewport-ajuste.js` lo mide con
`window.visualViewport` y `css/viewport.css` devuelve lo fijo a su lugar
(barra de arriba y de abajo, ＋, avisos, hojas y pantallas completas). Sin
el error no cambia nada; mientras escribes, tampoco. (2) Medir tiempos ›
Plan de la mañana: los campos de hora se salían de la tarjeta en el iPhone
(ancho propio del campo de hora): `appearance: none` como los de fecha.
(3) Biblia › Progreso: "Lamentacione-s" → corte por sílabas
(`hyphens: auto`). (4) La letra con serifa de Finanzas es a propósito
(Fraunces en toda la sección, decisión de antes). Pruebas:
`tests/viewport-ajuste.test.js`, `scripts/e2e/pantalla.js`.

**D-121 (2026-11-15) · Tarjetas: pago mínimo por tarjeta.** Pedido del
dueño: "lo que sí o sí tengo que pagar para no ir a buró, por tarjeta".
(1) Campo opcional "Pago mínimo (Bs)" en cada tarjeta
(`meta/finanzas_tarjetas.list[].pagoMinimoCent`, `pagoMinimo` en Bs y
`pagoMinimoActualizado`; aditivo: las tarjetas viejas siguen igual). (2) Lo
pagado cuenta desde el día de pago anterior (sin incluirlo) hasta hoy:
pagos y transferencias a esa tarjeta (no ajustes). Falta = mínimo −
pagado, nunca más de lo que debes; sin deuda, nada. (3) En la tarjeta:
"Pago mínimo: Bs X" con cuándo vence, lo ya pagado y "para no caer en el
buró"; rojo ("Urgente") a 3 días o menos, ámbar a 7, con ícono y texto;
botones "Pagar el mínimo" y "Pagar todo". Cubierto: "✓ Pago mínimo
cubierto". (4) También en el Resumen (fila de la tarjeta y "Atención") y en
"Mi día" de Inicio cuando vence en 3 días o menos (hoy o mañana: "por
hacer"). (5) Arreglado de paso un error de antes: Análisis › "Próximos 30
días" fallaba en cuanto había un pago por venir (usaba una variable sin
definir). Pruebas: `tests/finanzas-tarjetas.test.js`,
`tests/mi-dia.test.js`, `scripts/e2e/tarjetas-minimo.js`.

**D-122 (2026-11-15) · Biblia: marcar lo leído en tu Biblia de papel.**
Pedido del dueño: casi siempre lee en papel; marcar capítulos tenía que ser
más sencillo (antes: abrir el lector, elegir libro y capítulo, bajar hasta
el final y "Marcar como leído"). (1) Tarjeta "Leí en mi Biblia" arriba de
Biblia (antes que el lector): un toque en "✓ Leí Génesis 4" (el que sigue
al último que marcaste, saltando lo ya leído) o, con un plan, "✓ Ya leí lo
de hoy: Mateo 1–2". Dice lo marcado hoy y ofrece el siguiente. (2) "Elegir
otros capítulos": libros (los recientes arriba, buscador) → números; tocar
uno lo marca como leído hoy y tocarlo otra vez lo quita (solo lo de hoy:
lo de otros días no se borra). (3) Progreso › un libro abre la misma hoja
(con "Leer en la app"). (4) Cada marca con "Deshacer" (5 s). Se guarda en
lo de siempre (`meta/biblia_leidos`, `arrayUnion` por día): cuenta para
racha, planes, Hábitos y "Mi día". Lógica en `js/biblia-marcar.js`
(`tests/biblia-marcar.test.js`); pantalla `js/biblia-marcar-ui.js`
(`scripts/e2e/biblia-marcar.js`).

**D-123 (2026-11-16) · Biblia en audio: escuchar el capítulo con las voces
del iPhone.** Pedido del dueño (mejoras sin servidor). (1) En el lector, un
botón de audífonos arriba lee el capítulo en voz alta con `speechSynthesis`:
las voces del propio teléfono, sin internet ni servicios de nube (nada sale
del teléfono). Dice "Juan, capítulo 3." ("Salmo 23."; "1 Corintios" →
"Primera de Corintios") y luego cada versículo, sin los números. (2) Barra
abajo: ▶/⏸, versículo anterior y siguiente, velocidad (0,8× a 1,25×), voz y
opciones, ✕. Resalta el versículo que suena y lo trae a la vista, salvo si
moviste el texto hace menos de 5 s. (3) Al terminar sigue con el siguiente
capítulo y, si sonó al menos el 80 % de los versículos, lo marca como leído
hoy con "Deshacer" (lo de siempre: `meta/biblia_leidos`; cuenta para racha,
planes y Hábitos). Las dos cosas se pueden apagar. (4) Elegir versículos ›
"Escuchar" lee desde el primero. Si cambias de capítulo mientras suena,
suena el nuevo desde el comienzo. (5) Fuera de la app o con la pantalla
bloqueada se pausa (el iPhone congela la página); mientras suena, la
pantalla queda encendida (Wake Lock de `Avisos`, pedido una sola vez).
(6) Para que no falle en el iPhone: pausar = cancelar y recordar el trozo
(pausa y reanudar de iOS no son confiables); después de cancelar espera
140 ms antes de hablar (iOS a veces se traga lo pedido justo después);
vigía: si la voz se calla 3 s sin avisar, repite el trozo una vez y si no,
pausa con aviso; tres errores seguidos también pausan; lo que falló nunca
cuenta como escuchado. Los versículos de más de 240 letras se parten en
frases y las palabras en MAYÚSCULAS se dicen como palabras. (7) Voces: solo
en español, la mejor primero (premium, mejorada, normal; las "de juguete"
al final), Latinoamérica antes que España; se elige y se prueba en ⚙️.
Preferencias solo en el teléfono (`localStorage` "manolo-biblia-audio":
`vel`, `voz`, `seguir`, `marcar`), porque las voces cambian de un aparato a
otro; ningún dato nuevo en la nube. (8) Arreglado de paso: mientras se abría
otro libro, un cambio en "leídos" pintaba el texto del libro anterior con
el nombre del nuevo; `pintar()` ahora espera al libro correcto. Lógica en
`js/biblia-audio.js` (`tests/biblia-audio.test.js`); pantalla en
`js/biblia-audio-ui.js` (`scripts/e2e/biblia-audio.js`, con una voz falsa
que avisa al terminar cada trozo).

**D-124 (2026-11-16) · Running: crear y editar rutinas guiadas en la app.**
Pedido del dueño ("mejorar las rutinas desde la app"): antes solo se podían
importar de un CSV. (1) Running › Rutinas: "＋ Nueva" y, en cada rutina, un
menú ⋯ (Editar, Duplicar, Hacer la siguiente, Eliminar) en lugar del tacho
suelto; "Importar CSV" y la plantilla siguen abajo. (2) El editor arma la
rutina con pasos: intervalos (tipo, minutos y segundos, nota) y series que
se repiten (1 a 50 veces, hasta 10 intervalos). La forma más común de una
rutina por intervalos ("4 × correr 1:00 + caminar 1:30") se escribe con una
serie en vez de 8 filas. Una rutina nueva trae un ejemplo de 20 min para
cambiar lo que haga falta. (3) Se guarda lo de siempre (`intervalos`,
`totalSeg`: la pantalla en vivo, el historial y la cola no cambian) más los
pasos en `bloques` (opcional, aditivo) para volver a editarla igual, y
`editado`. Si `bloques` no coincide con los intervalos (o no está, como en
las importadas), los pasos se arman agrupando lo que se repite seguido:
siempre da exactamente los mismos intervalos. (4) Un día de un plan: el
nombre es del plan (cambia en todos sus días) y "Duplicar" agrega un día al
final del plan; una rutina suelta se copia como "(copia)" justo debajo
(orden entre las dos, con decimales). (5) Mismos límites y mensajes que el
CSV, con el paso que falla marcado y el cursor en su duración. Duración en
dos casillas (min y s) con teclado numérico; letra de 16 px. Lógica en
`js/rutina-running-editor.js` (`tests/rutina-running-editor.test.js`);
pantalla en `js/rutina-running-editor-ui.js` y `css/rr-editor.css`
(`scripts/e2e/rr-editor.js`); `scripts/e2e/running.js` borra desde el menú
⋯.

**D-125 (2026-11-16) · Gimnasio: guardar en la rutina lo que cambiaste al
entrenar.** Pedido del dueño ("mejorar las rutinas desde la app"). El editor
ya era completo; faltaba no tener que repetir en él lo hecho entrenando.
(1) Al terminar un entreno de una rutina, si hoy agregaste o quitaste
ejercicios, cambiaste las series de trabajo o el orden, el resumen lo lista
(todo marcado) y "Guardar en la rutina" guarda lo marcado. Pesos, reps,
descanso, notas y subida de lo que ya estaba no se tocan (la progresión
manda, D-094); un ejercicio nuevo entra con lo de hoy (series de trabajo,
reps mín. y máx., peso más alto). Emparejado por ficha (`exerciseId`) o,
sin ficha, por nombre sin mayúsculas ni tildes; dos veces el mismo
ejercicio se empareja en orden. Lo que no hiciste y se queda sigue después
del ejercicio que tenía antes; lo agregado va después del que hiciste antes
que él. (2) Un entreno libre se puede guardar como rutina nueva (al final;
nombre del entreno, "Entreno del 16 nov" si era "Entrenamiento", o
"(copia)" si ya existe). (3) Las dos con "Deshacer" (se vuelve a guardar la
rutina de antes, o se borra la nueva). Se guarda con `aGuardar` y merge,
como el editor. (4) Editor de rutinas: con cambios sin guardar, cerrar
pregunta "¿Salir sin guardar?" (también al deslizar: la hoja usa la misma
✕). Lógica en `js/rutina-desde-entreno.js`
(`tests/rutina-desde-entreno.test.js`); pantalla en
`js/rutina-desde-entreno-ui.js`; E2E `scripts/e2e/rutina-entreno.js`.

**D-126 (2026-11-16) · Modo claro: automático (como el iPhone), claro u
oscuro.** Pedido del dueño (mejoras sin servidor). (1) Inicio (abajo) y el
menú ☰ › "Apariencia": Automático (sigue al iPhone, y cambia solo si el
iPhone cambia), Claro u Oscuro. Se aplica al tocar y queda en este teléfono
(`localStorage` "manolo.tema"); al principio, Automático. (2) El modo oscuro
queda idéntico: los estilos de siempre no se tocan. `css/tema-claro.css` se
GENERA con `npm run tema` (`scripts/tema-claro.js`): lee los CSS que carga
index.html y, por cada color escrito a mano, según para qué se usa, calcula
el claro: fondos oscuros → tonos claros de la paleta (página #f4f2ec,
tarjetas blancas, campos #f1eee7); textos claros → tinta; textos de color
pastel → el mismo tono más oscuro hasta 4,5:1 sobre la superficie clara más
oscura; bordes y líneas → beige claro; sombras más suaves; el velo detrás
de una hoja sigue oscuro; un fondo de color (botón naranja) deja su texto
como está; una "pastilla" sobre var(--ink) pasa a texto blanco. Dibujos
(figuras del cuerpo, insignias, la escena del personaje de Hábitos) no se
tocan: la escena queda como "isla oscura" (su paleta adentro). Lo que no
sale solo está en `scripts/tema-claro-manual.css`. (3) Cada regla clara usa
`:where(html[data-modo="claro"])`: pesa lo mismo que la original, y como la
hoja va al final, gana a la original; entre ellas manda el orden de siempre.
Para no romper ese orden, una regla posterior del mismo componente (prefijo
de clase, p. ej. `txn-`) que pone la misma propiedad con variables se repite
tal cual (así `.txn-save-otro` sigue ganando a `.txn-save`). (4)
`js/tema.js` va al final de `<head>`, sin defer, después de la hoja clara:
pone `html[data-modo]` antes de pintar (sin parpadeo), apaga la hoja clara
en oscuro (no cuesta nada) y cambia `theme-color`. (5) En la app instalada,
la barra de la hora y la batería es "black-translucent" (el iPhone escribe
en blanco): en claro, esa franja (`env(safe-area-inset-top)`) queda oscura
para que se lea. (6) Las pestañas de abajo traen su color en el HTML; en
claro usan una versión más oscura (`--tab-claro`). (7) Verificado: prueba
de contraste de cada texto visible (como Lighthouse) en 19 pantallas y 6
hojas, sin fallas; en oscuro, 13 de 14 pantallas idénticas píxel a píxel y
la otra por un error de antes que se arregló (sin hábitos, el ícono de la
moneda del personaje a veces no se dibujaba). Las pruebas E2E corren con el
teléfono en oscuro (`comun.js · esquema`). Pruebas:
`tests/tema-claro.test.js` (incluye que `css/tema-claro.css` esté al día) y
`scripts/e2e/tema-claro.js`.

**D-127 (2026-11-16) · La app abre más rápido: los módulos van en un
paquete.** Pedido del dueño (mejoras sin servidor). (1) Medido con la app
instalada (service worker activo) y la CPU 4 veces más lenta, como un
teléfono: index.html cargaba 170 módulos .js y 16 .css, y cada archivo
pasaba por el service worker uno por uno; esa fila era casi la mitad del
arranque. (2) `npm run paquete` (`scripts/paquete.js`) junta los módulos de
`js/paquete.json`, en el mismo orden, en `js/app.paquete.js`, y los estilos
en `css/app.paquete.css` (`css/viewport.css` sigue al final, D-120). Cada
módulo corre como su propio `<script>`: un error en uno no frena a los
demás, como antes, y en los errores conserva su nombre (`sourceURL`).
También se probó correrlos todos como un solo script: abría apenas más
rápido (unos 65 ms) pero un error en un módulo frenaba a todos los
siguientes; se eligió lo seguro. (3) Siguen aparte: Firebase (vendor),
`css/fuentes.css`, el modo claro (`css/tema-claro.css` y `js/tema.js`, que
va antes de pintar) y lo que se carga al usarlo (importar rutinas, ISBN y
el Worker de la búsqueda de la Biblia, que carga `biblia-motor.js` y
`biblia-texto.js` sueltos: el service worker los guarda aparte). (4)
Resultado (mediana de 7 aperturas): pedidos al abrir 198 → 14;
DOMContentLoaded 560 → 330 ms; Inicio con contenido 640 → 400 ms. El
service worker guarda 29 archivos en vez de unos 200. (5) Cambia la regla
de trabajo: se edita el archivo de cada módulo y después `npm run listo`
(= paquete + tema + sw), en vez de subir el `?v=` en index.html. Un módulo
nuevo se agrega en `js/paquete.json`, no en index.html. El `?v=` de cada
paquete es su huella. El service worker y su huella siguen viendo los datos
que pide el código (`data/…json?v=`) dentro del paquete, y `npm run tema`
lee el paquete de estilos como su lista (el modo claro sale idéntico).
`tests/paquete.test.js` falla si los paquetes no están al día, si un
módulo falta o se repite, si index.html vuelve a cargar módulos sueltos o
si cambia el orden de los estilos; `scripts/e2e/sin-internet.js` revisa
que la búsqueda de la Biblia arranque en modo avión.

**D-128 (2026-11-16) · Libros nivel 3: datos de verdad de cada libro
(plan).** Pedido del dueño: que al poner un libro se traigan bien el autor,
el género y las páginas ("los libros tienen distintas páginas"). Auditoría
con 20 libros reales (`docs/LIBROS_NIVEL3.md`): 10 de 20 títulos se
guardaban en otro idioma, las páginas eran la mediana de todas las
ediciones del mundo (en español varían hasta el doble: Padre rico 200–416),
autores en otro alfabeto o equivocados y nada del autor. Fuentes elegidas,
todas gratis, sin clave y probadas: Open Library con `lang=es` (edición en
español), sus ediciones (páginas de cada una) e `/isbn/` (la edición
exacta); el autor por su ficha de Open Library y su página de Wikipedia en
español, emparejada por Wikidata para no confundirlo con otro del mismo
nombre. Google Books (sin clave) solo como extra para la sinopsis: desde
servidores respondió "cuota excedida". Siete fases: buscar bien, páginas
de tu edición, ficha del autor, género y temas, completar la biblioteca,
recomendaciones y control final. Solo se suman campos al libro.

**D-129 (2026-11-16) · Libros nivel 3, fase 1: buscar bien.** "Buscar el
libro" usa `js/libros-fuentes.js` (UMD, pruebas con respuestas reales de
Open Library en `tests/fixtures/libros/`). (1) Se busca con `lang=es`: el
título que se llena es el de la edición en español ("Hábitos atómicos", no
"Atomic Habits") y el original queda aparte (`tituloOriginal`, se ve en la
ficha). La portada es la de esa edición. (2) Orden: parecido a lo que
escribiste (×4) + ediciones (log, ×1,6) + portada y autor; resúmenes,
análisis, guías de estudio y "libros de trabajo" restan y van al final
marcados "Resumen o guía de otro libro" (salvo que busques un resumen).
Así "El hombre más rico de Babilonia" trae primero a George S. Clason (262
ediciones) y no un librito de 2. (3) Sin repetidos: misma obra = mismo
título y mismo apellido (un nombre en otro alfabeto puede ser el mismo);
la que queda toma de sus repetidas el autor en nuestro alfabeto, la
portada o el género que le falte. (4) Lo que no se parece en nada (ni
título ni autor) no se muestra si hay otra cosa; un ISBN no se compara.
(5) Un autor que Open Library tiene en otro alfabeto se corrige con su
ficha (`/authors/{key}.json`: "Fiódor Dostoievski"). (6) Si escribes un
autor, "Libros de Paulo Coelho, los más leídos primero". (7) Se guarda
`autorKey` (el autor en Open Library, para su ficha en la fase 3); si
cambias el autor a mano, se borra (ya no es ese). Los resultados dicen
"N ediciones" en vez de páginas: las páginas de tu edición son la fase 2.

**D-130 (2026-11-16) · Libros nivel 3, fase 2: las páginas de tu
edición.** Lo que más pedía el dueño ("los libros tienen distintas
páginas"). (1) Al elegir un libro en "Buscar el libro" se piden sus
ediciones (`/works/…/editions.json`, de a 100; si casi no hay en español,
hasta 300) y, debajo de "Páginas", aparece "¿Cuántas páginas tiene tu
libro? Cambia según la edición": las ediciones en español agrupadas por
largo parecido (cada grupo llega hasta 6 % más que su más corta: "De 326 a
338 págs. · 4 ediciones"; las especiales se marcan), sin audiolibros ni
digitales. (2) La **recomendada** queda puesta: con el código de barras
(o el ISBN escrito) es **tu edición exacta** (`/isbn/…`); si no, el grupo
con más ediciones (en empate, el de la edición más nueva), con el número de
su edición más nueva; si no hay en español, la edición en español que trajo
la búsqueda (`/books/…`); si no, la mediana de todas, avisando que es
aproximada (también sin internet). (3) Tocar otra cambia las páginas y la
portada (si la había puesto la búsqueda; una foto o una portada elegida a
mano se respetan). Si escribes las páginas, mandan las tuyas (y la
edición se borra: ya no es esa). (4) Se guarda `edicion` ({ key,
editorial, anio, formato }); la ficha la muestra ("Editorial Planeta ·
2023"). (5) **"¿Para cuándo lo quieres terminar?"** en la ficha de un libro
que lees: tres sugerencias con las páginas por día (1 semana, 2 semanas, 1
mes; hoy cuenta) u otra fecha; se guarda `metaFin` y "Sigue leyendo" dice
"🎯 Para el dom 29 nov: 15 páginas por día". Un audiolibro va en %. (6) Al
editar, no se puede poner menos páginas que la página en la que vas.
Lógica en `js/libros-fuentes.js` (ediciones) y `js/libros-progreso.js`
(`paraTerminar`, `sugerenciasFin`); pantalla en `js/libros-ediciones-ui.js`.

**D-131 (2026-11-16) · Libros nivel 3, fase 3: la ficha del autor.** En
la ficha de un libro, el autor se toca ("Paulo Coelho ›") y abre su ficha.
(1) Quién es: su ficha de Open Library (`/authors/{key}.json`: nombre en
nuestro alfabeto, años, foto, biografía) y su página de **Wikipedia en
español** (búsqueda + `pageprops.wikibase_item`): se toma la página cuyo
Wikidata es el que Open Library tiene para ese autor, así no se confunde
con otro del mismo nombre. Sin Wikidata, solo si el título lleva su
apellido y la descripción dice que escribe ("escritor", "psicóloga",
"pastor"…): "George Hill" no trae al basquetbolista. Se muestran foto,
"Escritor brasileño", años y tres frases (sin "[cita requerida]"), con
"Leer más en Wikipedia". (2) **Tus libros de él**: los tuyos con su
`autorKey` o el mismo nombre ("Robert T. Kiyosaki" = "Robert Kiyosaki" =
"R. Kiyosaki"); tocar uno abre su ficha. (3) **Sus libros más leídos**
(`author_key:` con `lang=es`, por ediciones): primero los que tienen
edición en español, con el título en español; sin resúmenes ni los que ya
tienes. "＋ Quiero leer" abre "Agregar libro" con todo lleno (y sus
ediciones, D-130), en "Por leer". (4) Un libro sin `autorKey` busca al
autor por su nombre (`/search/authors.json`): de los que se llaman igual,
el que más obras tiene ("Paulo Coelho", 767, y no "Paulo Coelho Netto").
(5) Lo bajado se guarda en el teléfono (`localStorage`
"manolo.libros.autores", 30 días, hasta 40 autores): la segunda vez abre
al instante y sin internet. Sin internet y sin nada guardado, lo dice y
muestra igual tus libros de él. Lógica en `js/libros-fuentes.js`;
pantalla en `js/libros-autor-ui.js`.

**D-132 (2026-11-16) · Libros nivel 3, fase 4: temas en español y "De qué
trata".** (1) **Temas**: los temas de Open Library (casi todos en inglés)
se traducen con una lista de unos 60 ("Habit" → hábitos, "Personal
Finance" → finanzas personales, "Concentration camps" → Holocausto, "Magic
realism" → realismo mágico…); cada tema va al primero que coincide (los
más específicos antes), hasta 5, sin repetir el género. Una pista corta
tiene que empezar una palabra ("sport" no es "transport"). Lo que no está
en la lista (premios, listas de ventas, "Accessible book") no se muestra.
Se guardan con el libro al elegirlo (`temas`); la ficha los muestra y
tocar uno filtra tu lista por ese tema (el buscador de la lista también
busca por tema). (2) **"De qué trata"** en la ficha: primero la página del
libro en **Wikipedia en español** (la descripción tiene que decir que es un
libro, novela, ensayo…, el título parecerse y el apellido del autor
aparecer: así no sale la serie de televisión ni la película con el mismo
nombre); si no hay, la descripción de **Open Library** solo si está en
español; si no, **Google Books** (sin clave: si no responde, nada). Se
limpia ("[cita requerida]", la pronunciación, markdown), se corta en una
frase (≤ 700) y se muestra con su fuente y enlace; largo, con "Ver más".
Nada se inventa: sin fuente, no se muestra. Lo encontrado queda en el
teléfono (90 días; "no hay", 7). (3) Estadísticas: "Lo que más lees"
también dice las páginas de cada género. Lógica en `js/libros-fuentes.js`;
pantalla en `js/libros-trata-ui.js`.

**D-133 (2026-11-16) · Libros nivel 3, fase 5: "Completar mi biblioteca".**
Arriba de tu lista, si hay libros sin obra de Open Library o sin autor,
género, temas, portada o páginas (los audiolibros no necesitan páginas),
una tarjeta "Completar mi biblioteca · N libros con datos por completar"
abre un asistente. Revisa tus libros **de a uno, con una pausa** (Open
Library es gratis para todos), buscando el título y el apellido del autor.
Empareja solo si es el mismo libro: **seguro** si el título es casi igual
(el tuyo o el original) y el autor coincide; **con duda** si se parece
(dice "revisa que sea el mismo"); con otro autor, o si es un resumen, no
propone nada. De cada uno muestra lo que le sumaría: el **título en
español** (solo si el tuyo es el original de una edición en español:
"Atomic Habits" → "Hábitos atómicos", y el tuyo queda como título
original), el autor (si no tenía), género, temas, portada, año y las
**páginas** (a los que no tienen: las de la edición en español más común,
como al agregar un libro, D-130; la mediana de todos los idiomas no, y
nunca menos que la página en la que vas). También se guardan la clave de
la obra y la del autor. Tocas **"Usar"** o **"Dejar como está"**; "Usar los
N seguros" aplica los seguros de una vez; cada uno tiene **"Deshacer"**
(vuelve cada campo a como estaba). **Nada cambia sin tu OK y solo se suma lo
que falta**: tus páginas, estrellas, estado, fechas, tu género o tu portada
no se tocan (`update` solo de esos campos). Lo que dejaste como está o no
encontré no vuelve a aparecer (queda anotado en el teléfono), salvo que
cambies el título o el autor; lo que no se pudo buscar (sin internet), sí.
Lógica en `js/libros-completar.js`; pantalla en `js/libros-completar-ui.js`.

**D-134 (2026-11-16) · Libros nivel 3, fase 6: "Si te gustó…".** En la
pantalla de Libros, debajo de "¿Qué leo después?", **ideas de libros que no
tienes**, a partir de tus **últimos 3 libros de 4 y 5 estrellas**: (1) del
**mismo autor** (sus libros más leídos en Open Library) y (2) de los
**mismos temas**: se busca en Open Library el tema más específico del libro
(una lista de temas que dan buenos resultados, como "finanzas personales",
"romper hábitos", "realismo mágico", "estoicismo"; los amplios como
"éxito" o "viajes" no, porque traen clásicos que no tienen que ver), y de
lo que vuelve quedan los de **otro autor**, con al menos 2 temas en común
con el tuyo (o el único que tenga), novela con novela, sin infantiles, uno
por autor, los más conocidos primero. Siempre con **edición en español**
(los que dicen serlo pero tienen el título en inglés, no) y sin lo que ya
tienes. Cada idea dice **por qué** ("Como «Padre rico, padre pobre»:
también trata de finanzas personales y riqueza"). Se muestran 2 (intercalando
tema y autor de cada libro, para no empujar tu lista hacia abajo) y "Ver
las N" abre todas (hasta 12). **"＋
Quiero leer"** abre "Agregar libro" con todo puesto (las páginas de tu
edición incluidas, D-130); **"✕"** la quita para siempre. Se busca **solo
con Libros a la vista** (no al abrir la app), de a una con pausas, y lo
encontrado queda en el teléfono **una semana** (o hasta que cambien tus
favoritos); sin internet se muestra lo guardado. Además, **"¿Qué leo
después?"** sube los "Por leer" del mismo autor que uno que te gustó ("Es de
Paulo Coelho, como «El alquimista», que te gustó") o de sus mismos temas.
En las pruebas de pantalla, Open Library, Wikipedia y Google Libros no salen
a internet: cada prueba simula lo que usa. Lógica en
`js/libros-recomendar.js` (y los temas a buscar en `js/libros-fuentes.js`);
pantalla en `js/libros-ideas-ui.js`.

**D-135 (2026-11-16) · Libros nivel 3, fase 7: control final.** Todo el
plan de `docs/LIBROS_NIVEL3.md` está hecho (D-129 a D-134). Control: `npm
test` → 732 pruebas; las 38 pruebas de pantalla (3161
comprobaciones), con `libros-n3` cubriendo las 6 fases a 390 y 320 px;
Lighthouse de las pantallas nuevas (hoja "Si te gustó…", "Completar mi
biblioteca", la ficha con temas y "De qué trata", la ficha del autor y
"Agregar libro" con las ediciones), en oscuro y en claro: 100 en accesibilidad y en buenas prácticas en las 12 pantallas.
Datos: solo se sumaron campos al libro (`tituloOriginal`, `autorKey`,
`edicion`, `metaFin`, `temas`); "De qué trata", la ficha del autor, las
ideas y lo revisado quedan en el teléfono. Las pruebas de pantalla ya no
salen a internet a buscar libros. En el control, Lighthouse encontró que en
modo claro las etiquetas de estado de los libros ("Leyendo", "Terminado"…)
no contrastaban lo suficiente sobre el pie de la tarjeta (venía de antes):
se oscurecieron en `scripts/tema-claro-manual.css`. Queda anotado que la medición "Biblia
con 1.500 versículos < 1,5 s" (de antes de este plan) está al borde en
este entorno (entre 1,1 y 1,8 s según la carga de la máquina): si falla,
se repite sola.

**D-136 (2026-11-16) · "Tu semana", "Tu año en Manolo" y Bici al nivel de
Running: plan.** Pedido del dueño: "Haz el 1, 2 y 4, desarróllalos de la
manera más completa posible". Diseño en `docs/RESUMENES.md` y
`docs/CYCLING.md`; fases en `.claude/CURRENT_PHASE.md`. (1) **Sin lecturas
nuevas**: todas las secciones ya cargan sus datos completos al abrir la
app, así que los resúmenes usan lo que está en memoria (instantáneos, sin
costo, sin internet); un motor sin pantalla (`js/resumen-motor.js`) arma
la semana y el año con pruebas. (2) **La semana es de lunes a domingo**
(como el resto de la app); en Inicio la tarjeta sale lunes y martes y se
oculta con "Listo"; siempre está en el menú. Comparaciones contra la semana
anterior y tu promedio de 4 semanas; "Se quedó atrás" y "Para esta semana"
con reglas simples (sin IA), una sola sugerencia concreta. (3) **Tu año**:
siempre disponible ("hasta hoy" si no terminó); en Inicio del 1 de
diciembre al 31 de enero; diapositivas como el Wrapped de Hábitos (que se
mantiene y se puede abrir desde ahí). (4) **Privacidad**: las imágenes para
compartir no llevan montos de dinero (Finanzas solo en porcentajes y fuera
de la imagen del año). (5) **Bici**: las mismas pantallas que Running con
lo propio de bici (velocidad, desnivel, récords por distancia de bici
calculados una vez por rodada y guardados, número de Eddington, tus bicis
con mantenimiento); datos solo aditivos.

**D-137 (2026-11-16) · Resúmenes, fase 1: el motor.** `js/resumen-motor.js`
(sin pantalla, con pruebas) arma las cifras de cualquier período para las
10 secciones (Hábitos, Gimnasio, Running, Bici, Movilidad, Libros, Biblia,
Finanzas, Mi mañana y Lugares) y la semana: por área contra la semana
anterior (si la semana va por la mitad, contra los mismos días) y contra
tu promedio de las 4 anteriores; **lo mejor** (récords de Running y del
gimnasio, libros terminados, días perfectos, la Biblia los 7 días, la más
larga del año, gastar menos que tu promedio, tu mañana más rápida, un
lugar nuevo que te encantó); **lo que se quedó atrás** (hasta 3, primero lo
que dejaste de hacer y después los gastos: un hábito con la mitad o menos,
no entrenar o correr cuando sueles hacerlo, no leer, la Biblia muchos menos
días, una categoría de gasto un 30 % sobre tu promedio, tu mañana 5 min más
lenta) y **una sola sugerencia** concreta y alcanzable. A mitad de semana no
se reclama lo que falta. `js/resumen-fuentes.js` junta lo que cada sección
ya tiene en memoria (sin lecturas nuevas); Finanzas suma una función de
solo lectura (`FinanzasResumen.movimientos()`, gastos e ingresos en
centavos sin transferencias ni lo excluido, como en Análisis).

**D-138 (2026-11-16) · Resúmenes, fase 2: "Tu semana".** (1) **Inicio**:
lunes y martes, arriba (debajo de "Mi día"), una tarjeta con la semana que
terminó: el titular, 3 cifras (nunca dinero) y "Ver mi semana" / "Listo";
"Listo" la oculta hasta el lunes siguiente (en el teléfono,
"manolo.semana.vista"). Si la semana no tiene nada, no aparece. (2) **La
pantalla `#semana/AAAA-MM-DD`** (también en el menú ☰ y al pie de Inicio):
‹ › para ir a otras semanas (hasta la que va); lunes y martes abre en la
semana pasada y el resto de los días en la que va ("hasta el miércoles").
Titular, "Lo mejor", "Por área" (cada una con su cambio en verde si mejoró
o en ámbar si bajó, y lleva a su sección), "Se quedó atrás" y "Para esta
semana" (solo en la pasada y la que va: para una semana vieja no tiene
sentido). (3) **"Compartir mi semana"**: imagen vertical 1080 × 1920 con
el titular, lo mejor y cada área con lo que mejoró; **sin dinero**
(Finanzas y lo que habla de gastos no entra) y sin lo que no hiciste. En el
iPhone abre el menú de compartir; en la compu se descarga. Pantalla en
`js/resumen-semana-ui.js`, imagen en `js/resumen-imagen.js`, estilos en
`css/resumenes.css`.

**D-139 (2026-11-16) · Resúmenes, fase 3: el contenido de "Tu año".**
`js/resumen-anio.js` (sin pantalla, con pruebas) arma lo de cada
diapositiva con los mismos datos que "Tu semana": por sección las cifras,
lo más destacado y el mejor mes (Hábitos: cumplimiento, hábito estrella y
mejor racha; Gimnasio: entrenos, horas, series, kg, récords, el ejercicio
que más hiciste y tu entreno más pesado; Running y Bici: km, horas,
desnivel, la más larga, las mejores marcas de Running del año y una
equivalencia en distancias de Bolivia, "Como ir corriendo de La Paz a
Cochabamba"; Movilidad; Libros: terminados, páginas, tu libro del año (el
último de 5 ★), autor y frase del año; Biblia: capítulos, cuántos
distintos y qué parte de la Biblia, el libro que más leíste y tu mejor
racha; Finanzas: qué parte de lo que ganaste ahorraste, el mes que más
ahorraste, en qué se fue más y días sin gastar; Mi mañana: cuánto bajó del
primer mes al último; Lugares: nuevos, el mejor y tu zona). Además, el año
en números, tu mejor mes (más días con algo), tu día de la semana, la
comparación con el año anterior **a la misma altura** (si el año no
terminó, contra los mismos meses) y lo destacado para la imagen final (sin
dinero). Si están, usa lo que ya calculan Hábitos (su "Manolo Wrapped") y
Libros ("Tu año en libros"), así las cifras son las mismas que en esas
pantallas.

**D-140 (2026-11-16) · Resúmenes, fase 4: "Tu año en Manolo" en
diapositivas.** (1) **El visor** (`js/resumen-anio-ui.js`): a pantalla
completa, con los mismos estilos y gestos que el "Manolo Wrapped" de
Hábitos (tocar a la derecha avanza, a la izquierda vuelve; flechas y Escape
con teclado; el foco no se sale). Solo aparecen las diapositivas de lo que
usaste ese año (portada, el año en números, Hábitos, Gimnasio, Running,
Bici, Movilidad, Libros con la frase del año, Biblia, Finanzas, Mi mañana,
Lugares, tu ritmo, contra el año anterior y el cierre). Si una no entra en
un teléfono chico, se desliza (y tocarla sigue avanzando). En Hábitos,
"Ver tu año en hábitos" abre el Wrapped completo de Hábitos. (2)
**Compartir**: cada diapositiva tiene "Compartir" (imagen vertical 1080 ×
1920, se ve como la diapositiva); el cierre tiene "Compartir tu año" (lo
más destacado, tu libro y tu mejor mes) y "Verlo otra vez". **Nunca un
monto de dinero**: Finanzas dice "Solo para ti", su imagen lleva solo
porcentajes y no entra en la del año. (3) **Cuándo**: siempre en el menú ☰
y al pie de Inicio ("Tu año"; si el año no terminó dice "hasta hoy"); del
1 de diciembre al 31 de enero, además, una tarjeta en Inicio (en enero, la
del año que terminó); "Ahora no" la cierra para ese año (en el teléfono,
"manolo.anio.visto"). Los años anteriores con datos se eligen al final.
Imágenes en `js/resumen-imagen.js` (`planDiapositiva`, `planAnio`). En
Bici, la equivalencia es con lugares más cerca de La Paz (Tiwanaku, Coroico,
Copacabana y después Oruro, Cochabamba, Santa Cruz), nunca maratones.

**D-141 (2026-11-16) · Bici, fase 5: Actividades.** Bici tiene su barra
propia como Running: **Actividades · "+" · Progreso** (el "+" abre Importar
o Anotar a mano). (1) **Actividades** (`js/bici-feed.js`): una tarjeta por
rodada con Distancia · Velocidad · Tiempo y el desnivel si lo hay, el trazo
de la ruta y medallas con los récords de bici; separadores por mes (km y
rodadas), de a 20, y filtros Todas · Con mapa · A mano · Largas (50 km o
más). (2) **Récords de bici** por distancia (5, 10, 20, 30, 40, 50, 80, 100
y 160 km): al importar se guardan en la rodada (`mejoresBici`, aparte de
los de correr); las medallas son las 3 mejores hasta ese día. (3) **El
detalle** de una rodada usa tus rodadas: medallas de bici, "Resumen
inteligente" (récords, la más larga, la velocidad contra tu promedio del
último mes, desnivel y altura, tu semana) y "Mismo recorrido" con la
velocidad; abajo sigue la barra de Bici. (4) **Inicio**: la tarjeta de Bici
dice los km de la semana y la última rodada. El resumen semanal de siempre
pasa a Progreso y anotar a mano, al "+". Cálculos en `js/bici-analisis.js`
(sin pantalla, con pruebas).

**D-142 (2026-11-16) · Bici, fase 6: Progreso.** `js/bici-progreso.js`,
como Running › Progreso: arriba la semana, el mes, el año o todo (km,
tiempo, rodadas, desnivel y velocidad media) contra el período anterior;
el resumen semanal de siempre; racha de semanas y metas con anillos; el
diario; **tus récords** (la más larga, la de más desnivel, la más rápida de
20 km o más, la velocidad máxima y los mejores tiempos de 5 a 160 km con el
top 3 y cómo fue mejorando); el **número de Eddington** (el E más grande con
E días de al menos E km, y cuántos días faltan para el siguiente); forma y
fatiga (con tus rodadas) y el **mapa de calor** de tus rodadas
(`#bici-calor`, `js/run-calor.js` sirve a los dos). Los récords por
distancia de las rodadas importadas antes se calculan **una sola vez** con
su ruta (`rutas/{id}`) mientras Bici está a la vista, de a una, y se guardan
en la rodada (`mejoresBici`, `{}` si no alcanza): después no se vuelve a
leer nada. **Ajustes de Bici** (engranaje de arriba, `js/bici-ajustes.js`):
metas de km por semana, mes y año en `meta/bici_ajustes` (aparte de las de
Running).

**D-143 (2026-11-16) · Bici, fase 7: tus bicis, mantenimiento y
segmentos.** La barra de Bici queda **Actividades · Progreso · "+" ·
Segmentos · Bicis**. (1) **Tus bicis** (`js/bici-bicis.js`, como las
zapatillas): nombre, tipo (ruta, montaña, urbana, gravel, piñón fijo), km
que ya tenía, la predeterminada (se pone sola en lo que importes o anotes
desde que la agregaste; en cada rodada se cambia con Editar), retirar y
volver a usar, y "ponerle esta bici a las N rodadas sin bici". Sus km son
los iniciales más los de sus rodadas (`biciId`). (2) **Mantenimiento** por
bici: cadena (cada 3.000 km), cubiertas (4.000 km), pastillas de freno
(2.000 km) y service general (cada 5.000 km o 6 meses), contando desde que
agregaste la bici o desde el último "Hecho hoy"; cada cuánto se puede
cambiar. Lo que toca cambiar sale arriba de Actividades ("Toca cambiar la
cadena: 3.120 km") y en rojo en Bicis. Todo en `meta/bici_ajustes`
(`bicis`, `mantenimiento`). (3) **Segmentos de bici**: "Crear segmento"
también en una rodada; se buscan solo en tus rodadas (y en las que importes
después), con su página (`#bici-segmento/{id}`, con la velocidad) y la
pestaña Segmentos de Bici; los de Running siguen aparte
(`run_segmentos/{id}.deporte`). "Compartir imagen" ya servía para las
rodadas.

**D-144 (2026-11-16) · Tu semana, Tu año y Bici: control final.** Todo
junto: `npm test` → 759 pruebas; pruebas de pantalla: 39 de 40 grupos
bien, 3.437 comprobaciones (la única que falla es la medida de tiempo de
la Biblia en `lectura-qa`, 1,7 s contra 1,5 s, por la lentitud de este
entorno; falla igual sin estos cambios). Lighthouse de las pantallas
nuevas en oscuro y en claro a 375 px ("Tu semana", "Tu año" con una
diapositiva, Bici › Actividades, Progreso, Bicis, Segmentos, una rodada y
Ajustes de Bici):
100 en accesibilidad en todas; en buenas prácticas 100 salvo "Tu semana"
abierta de entrada (96: en este entorno sin internet fallan los pedidos de
afuera, que en el teléfono funcionan). Un arreglo del repaso: al importar,
las rodadas nuevas no se comparaban con los segmentos de bici (la ruta solo
se guardaba en memoria para las carreras); ahora cada actividad nueva se
compara con los segmentos de su deporte (`js/run-importar.js`), con su
prueba de pantalla en `scripts/e2e/bici.js` (falla sin el arreglo). Ningún
dato se borra ni se cambia de forma: solo se suman campos (`mejoresBici`,
`biciId`, `meta/bici_ajustes`, `deporte` de los segmentos de bici).

**D-145 (2026-11-22) · Ropa con IA e inspiración de Pinterest: plan.**
Pedido del dueño (completo en `docs/ROPA.md`): su ropero con fotos; una IA
(el mejor modelo de Claude) describe cada prenda, arma con su ropa los looks
de sus inspiraciones de Pinterest, propone qué ponerse cada día y qué
comprar según lo que se repite en sus pines. Fases en
`.claude/CURRENT_PHASE.md`. (1) **Sección colgada de Inicio** con barra
propia (Ropero · Outfits · + · Inspiración · Compras) y engranaje (Ajustes de
Ropa), como Running y Bici. (2) **Fotos como Lugares** (D-117): la grande en
el teléfono, la miniatura en la nube; entran en la copia de seguridad. (3)
**La IA, por un puente en Cloudflare** (plan gratis): el código va en el repo
sin secretos; la clave y el modelo, como secretos y variables de Cloudflare
(nunca en la app ni en el repo); revisa el token de Firebase y que el
usuario esté permitido (solo el dueño; los demás usan Ropa sin IA); no
guarda fotos ni textos; suma el gasto del mes y corta en el tope (8 USD al
empezar). Respuestas con esquema fijo; la app descarta cualquier prenda que
no esté en el ropero. A la IA no le llega el nombre, el correo ni el
usuario. Plan B si el plan gratis no alcanza: Firebase Functions, avisando
antes de cualquier costo. (4) **Pinterest sin la API oficial** (pide
aprobación): el tablero **público** se lee por su RSS desde el puente
(probado desde un servidor: 25 pines por lectura con título, link e imagen
de 736 px; reintentos y última lista buena porque una vez dio 404); un link
de pin se lee por oEmbed; siempre se puede subir la imagen o una captura.
Para ver opciones nuevas se abre la búsqueda de Pinterest (no deja buscar a
otras apps). Nada de Pinterest ni de la ropa se sube al repo (es público).
(5) **Clima** de Open-Meteo para la ciudad elegida (La Paz por defecto), sin
pedir ubicación. (6) **Compras**: lo que se repite en los pines y no está en
el ropero; los outfits nuevos que daría cada compra los cuenta Manolo con
reglas (sin IA, siempre igual). (7) **Datos solo aditivos**: `ropa`,
`ropa_usos`, `ropa_outfits`, `ropa_inspiracion`, `ropa_deseos` y
`meta/ropa_ajustes`; las reglas de Firestore ya los cubren. (8) **Pruebas
sin gastar**: un puente falso con respuestas inventadas; una prueba real
corta al final, con el OK del dueño.

**D-146 (2026-11-22) · Ropa, fase 1: el ropero (sin IA).** Sección Ropa
colgada de Inicio con el ropero y la ficha de cada prenda; agregar varias
fotos seguidas, una prenda por foto. (1) **El color sale de la foto en el
teléfono**, sin IA y sin internet: cada punto de una copia chica (48 px) va
al color más parecido de una paleta de 29 colores con nombre (distancia en
el espacio Lab); lo que domina el borde es el fondo y no cuenta (salvo que
la prenda sea del mismo color); el centro pesa más; las sombras de un mismo
color se juntan. Siempre se puede corregir (hasta 3 colores, el primero es
el principal). (2) **El nombre de la prenda concuerda**: tipo + color en su
forma ("Polera blanca", "Zapatillas negras", "Jean azul"). (3) **Fotos**:
`js/lugares-fotos.js` pasa a ser una fábrica (`FotosLocales.crear`); Lugares
no cambia; Ropa usa su base `manolo-ropa` (registros con `grupoId` y
`clase`) y guarda además una **mediana de 480 px** para la grilla (con 150
prendas, decodificar fotos de 1200 px podría llenar la memoria del iPhone);
si falta (una foto restaurada), se hace sola la primera vez. (4) **"Me la puse hoy"** en la ficha anota el día en
`ropa_usos/{fecha}` (`prendas` con arrayUnion): de ahí salen las veces, la
última y el costo por uso; en la fase 4 lo anotará también "Me lo pongo".
(5) **Estados**: activa, para lavar, ya no la tengo (con su fecha; su
historial queda) y borrar con Deshacer. (6) **Copia de seguridad**: suma
`ropa`, `ropa_usos` y `fotosRopa` (campo nuevo del archivo; las copias
viejas siguen sirviendo). (7) Pruebas: `npm test` → 771; suite
`ropa` (126 comprobaciones: 390 y 320 px, la compu, copia y
restauración); `lugares`, `respaldo` y `regresion` bien; Lighthouse 100 en
accesibilidad y buenas prácticas en el ropero, la ficha, agregar y un
filtro, en oscuro y en claro.

**D-147 (2026-11-22) · Ropa, fase 2: la IA describe (lista para conectar).**
(1) **El puente** (`puente/`, Worker de Cloudflare, plan gratis): la clave
de la IA, el modelo y los usuarios permitidos son secretos de Cloudflare
(nada de eso en la app ni en el repo, que es público). Revisa el token de
Firebase de la sesión con WebCrypto, sin dependencias: firma RS256 contra
las llaves públicas de Google, proyecto `manolo-4c57b`, emisor y
vencimiento; solo pasa quien está en `USUARIOS` (el dueño); CORS solo para
el sitio. No guarda fotos ni textos. (2) **La IA** se llama con la
biblioteca oficial: esfuerzo bajo (describir una prenda es simple), salida
con **esquema fijo** cuyas listas (grupos, tipos, colores, estampados,
estilos, climas) son las de `js/ropa-motor.js` (una prueba revisa que
sigan iguales) y el respaldo del servidor si el modelo se niega
(`fallbacks: "default"`); lo que contesta se limpia antes de volver. (3)
**El gasto**: cada respuesta trae los tokens usados → el costo del mes en
KV (mes de Bolivia, UTC−4); al llegar al tope (8 USD al empezar, de 1 a 100,
se cambia en Ajustes de Ropa) el puente corta con un aviso claro. (4) **En la
app** (`js/ropa-ia.js`): al agregar, la IA mira cada foto (la siguiente
mientras revisas la anterior); "Llenar a mano" no espera y lo que llegue
después no pisa nada; el aviso "Lo llenó la IA: revísalo" y el de varias
prendas; los errores en palabras simples. "Describir con IA" en la ficha
abre Editar; "Describir las que cargaste antes" llena solo lo que falta.
Quien no es el dueño usa Ropa sin IA. Se guarda `ia: { fecha }` (campo
nuevo). (5) Pruebas sin gastar: `npm test` → 778 (7 del puente: token
bueno y malos, usuarios, CORS, costo, mes, tope, esquema e instrucciones,
limpiar la respuesta, la foto); suite `ropa` con un puente de mentira
(159 comprobaciones); Lighthouse 100 en accesibilidad y buenas prácticas
en las 12 pantallas de Ropa (con Ajustes y el formulario llenado por la IA),
en oscuro y en claro. **Falta**: instalar el puente con las cuentas del
dueño (Claude y Cloudflare) y la prueba real corta.

**D-148 (2026-11-23) · Ropa, fase 3: Inspiración de Pinterest.**
(1) **La barra de Ropa** (como Running y Bici, D-061): Ropero · "+" ·
Inspiración; el "+" abre una hoja con dos partes (a tu ropero / inspiración).
Se va el botón flotante y el "Inicio" de arriba (vuelve la casita). Outfits y
Compras entran a la barra en sus fases. (2) **Pinterest lo lee el puente**:
ni el RSS, ni oEmbed, ni las imágenes de `i.pinimg.com` traen permiso CORS.
Rutas nuevas (`puente/src/pinterest.js`, sin red y probado): el tablero por
RSS (reintenta: a veces da 404 un rato), un pin por oEmbed, el link corto
`pin.it` del iPhone (se siguen las redirecciones sin bajar páginas y sin salir
de Pinterest) y la imagen (solo de `i.pinimg.com`, 736 px o la que haya). No
necesitan la clave de la IA. A Pinterest no le llega ni el nombre de la app ni
el usuario. (3) **Cada inspiración** se guarda en `ropa_inspiracion` (los
pines con id `pin-{id}`, así no se repiten); la imagen vive en el teléfono
(como las prendas, clase "inspiracion") y, si no está (otro teléfono), se ve
desde Pinterest. Los pines del tablero que quitas quedan ocultos, para que no
vuelvan al actualizar. El tablero se lee solo si pasaron 6 horas (y una vez
por vez que abres la app); una sola lectura a la vez. (4) **La IA mira cada
imagen sola** (`/inspiracion`, esfuerzo bajo, esquema fijo): lo que se ve, de
arriba abajo (hasta 8 prendas, sin describir a la persona), el estilo, el
clima, la formalidad y la ocasión. Una por una; si en el medio llegan otras,
también; dos fallas en la misma: se deja; si la IA no puede (tope, sin
internet), se pausa 5 minutos. (5) **"Armar este look con mi ropa"**: sin IA,
al toque y gratis, por reglas (`js/ropa-insp-motor.js`: mismo grupo; tipo
igual, de la misma familia u otro; color igual, de la familia o cerca; las
mejores parejas primero, cada prenda una vez; las para lavar valen menos; los
accesorios no se piden). Con la IA (`/look`, esfuerzo medio): el ropero va
sin notas, talla, precio ni fotos, con referencias cortas (p1, p2…) que el
puente vuelve a los ids (la IA nunca ve tus ids y no puede inventar
prendas), primero y en caché; el look de la IA queda guardado. (6) **Mi
estilo**: lo que más se repite, sin IA; con la IA (`/estilo`, desde 3 pines
con ropa), un resumen que se puede corregir (`meta/ropa_ajustes.estilo`).
(7) Las instrucciones a la IA ya no dicen el nombre de la app. (8) Pruebas:
`npm test` → 795 (nuevos `puente-pinterest` y `ropa-insp-motor`, y
inspiración, look y estilo en `puente-logica`); el Worker entero con fetch de
mentira (`cd puente && npm run prueba`, 6 pruebas: el tablero con el link
corto y un 404, el pin y su imagen, la IA con su pedido de verdad —respaldo,
esfuerzo, esquema, caché—, el tope); suite `ropa-insp` (107
comprobaciones) y `ropa` (159); Lighthouse 100 en accesibilidad y buenas
prácticas en las 24 pantallas de Ropa (12 en oscuro y 12 en claro).

**D-149 (2026-11-23) · Ropa, fase 4: Outfits ("¿Qué me pongo hoy?"), con el
clima de cualquier ciudad.** (1) **El clima** (pedido del dueño: "que se pueda
adaptar a otros climas"): Open-Meteo (gratis, sin clave y con CORS;
`js/ropa-clima.js`): el pronóstico de 3 días por hora, en la hora de la
ciudad, y el buscador de ciudades (las de tu país primero). Manolo nunca usa
tu ubicación: la ciudad se elige (La Paz por defecto) y las últimas 5 quedan a
un toque (`meta/ropa_ajustes.ciudad` y `ciudades`). Del día cuenta la
sensación térmica de 7 a 21 h: capas si la mañana es fresca y el mediodía 9 °C
más cálido; abrigo bajo 10 °C (algo liviano bajo 16); lluvia (60 %, o 40 % si
el pronóstico es de lluvia), tormenta, nieve, viento (ráfagas de 60 km/h o 30
sostenido: las de 50 de La Paz son de todos los días) y sol (UV 8 o más).
"Cómo sientes el frío" (friolento, normal o caluroso) corre los límites 3 °C.
Hoy o mañana (después de las 20 h, mañana). Una hora de caché en el teléfono;
sin internet, el último pronóstico; sin nada, se arma como un día templado.
Probado con días de verdad de La Paz (capas y sol) y Santa Cruz (calor,
lluvia, viento y tormenta) del 2026-11-23 (`tests/fixtures/clima`). (2) **Las
reglas** (`js/ropa-outfit-motor.js`; sin IA, gratis y como respaldo): solo
prendas activas. Cada prenda suma o resta por el clima (justo +2, al lado 0,
opuesto −3; en un día extremo —26 °C o más, o menos de 8— también resta 1,5 la
que llega al otro lado: un jean de frío y templado a 30 °C), la formalidad de
la ocasión, su estilo, la lluvia (sin sandalias), tu estilo de Pinterest (el
color de la familia de los que más se repiten en tus inspiraciones +0,4; cada
estilo +0,3: un empujón, el clima sigue mandando) y cuándo te la pusiste (lo
de ayer resta; los zapatos y el abrigo, un cuarto: se repiten siempre). Cada
combinación, por los colores (neutros con un color fuerte es lo mejor), los
estampados, que la formalidad no salte y lo que aprendió de ti: cada par de
prendas que te gustó junto suma (tope de ±3 en total, para que nunca le gane
al clima); cuenta entero en la misma ocasión, la mitad en una parecida (un
punto de formalidad o menos) y nada en una muy distinta (lo casual no dice nada
de un evento formal); lo que no te gustó no vuelve nunca. Salen 5: se ven 3
que cambian al menos dos prendas y 2 quedan para "Otra opción". Accesorios
por el día: con sol, lentes (no de noche) y gorra o sombrero según la
ocasión; con mucho frío, bufanda o guantes; cinturón para el trabajo o lo
formal. (3) **Tus ocasiones**: "+ Otra" con un nombre y a cuál de las 5 se
parece (se arma como esa; hasta 8, en `meta/ropa_ajustes.ocasiones`; se quitan
en Ajustes, con Deshacer). (4) **Con la IA** (`/outfits`, versión 3 del
puente, esfuerzo medio): el ropero (sin lo de lavar, notas, talla, precio ni
fotos; con referencias cortas y en caché), el clima en palabras, lo que pide
el día, la ocasión (la tuya, con la de base), tu estilo, lo que te pusiste
estos días, lo que te gustó, lo que no y lo que ya viste; pide 5, de la mejor a
la menos buena. La app revisa cada una (completa, con zapatos si tienes, sin
repetir grupos, sin lo vetado ni lo ya visto, con la prenda base) y muestra 3;
las otras, para "Otra opción" sin volver a preguntar. Si la IA no puede (tope,
sin internet), salen con reglas y lo dice. (5) **La pantalla**
(`#ropa-outfits`, en la barra: Ropero · Outfits · + · Inspiración): el clima
con sus consejos, hoy o mañana, la ocasión, "¿Qué me pongo?" y cada opción
con sus fotos en una fila, por qué combina, las capas, **a qué inspiración se
parece** (`RopaInspMotor.parecidaA`: si la mitad o más de lo que se ve en un
pin —sin accesorios, 2 prendas o más— está en el outfit igual o parecido, o si
la IA ya armó ese look con 2 o más de esas prendas) y "Me lo pongo" (anota
todo en `ropa_usos` del día, con el outfit), "Guardar" (de noche, "Para
mañana"), "Otra opción" (cambia esa sola) y "No me gusta" (no vuelve; llega
otra), con Deshacer; "Otras opciones" cambia las tres. Abajo, lo de hoy, tus
guardados y el calendario del mes (cada día con una foto). "¿Con qué combino
esto?" desde la ficha: arma solo, con esa prenda en las tres. (6) **Datos**
(solo se suman): `ropa_outfits` (uno por conjunto de prendas),
`ropa_usos.outfitId` y, en `meta/ropa_ajustes`, `ciudad`, `ciudades`,
`sensacion` y `ocasiones`. La copia de seguridad lleva los outfits. (7)
**Arreglos en el camino**: con el clima de hace un rato, la pantalla esperaba
otro dato para mostrarlo (ahora sale al toque); si cambias de ciudad mientras
llega el clima, se descarta y se pide el de la nueva; el "Deshacer" de los
avisos en modo claro, más oscuro (5,7:1; lo encontró Lighthouse). (8)
Pruebas: `npm test` → 813 (nuevos `ropa-clima` y `ropa-outfit-motor`;
`parecidaA` en `ropa-insp-motor`; outfits en `puente-logica`); el Worker
entero (7, con `/outfits` y la versión 3); suite nueva `ropa-outfits` (84
comprobaciones) y 10 suites cercanas sin fallas (485); Lighthouse 100 en accesibilidad y buenas prácticas en las 38 pantallas de Ropa
(19 en oscuro y 19 en claro).

**D-150 (2026-11-23) · Ropa, fase 5: Compras desde Pinterest.** (1) **Sin IA
y sin gastar**: todo sale de lo que la IA ya vio en cada pin (fase 3) y de tu
ropero, con reglas (`js/ropa-compras-motor.js`): siempre igual. (2) **Qué te
falta**: cada cosa que se ve en tus pines se agrupa por grupo, tipo (por
familia: chaqueta y chamarra, jean y pantalón son lo mismo) y color (por
familia: camel y beige); cada pin cuenta una vez; sale si está en 2 pines o
más, no es un accesorio y no tienes nada igual o parecido (lo que está para
lavar cuenta como tuyo; lo que ya no tienes, no). Si la tienes de otro color,
igual falta, pero lo dice. De la que más se repite a la que menos (hasta 8).
(3) **Cuántos outfits nuevos** te daría (sin lo que ya no tienes): lo de
arriba, con cada cosa de abajo con la que va (y al revés); un vestido, con
cada par de zapatos; zapatos o un abrigo, con cada conjunto con el que va.
"Van juntas": hasta dos colores fuertes, un solo estampado, la formalidad sin
saltos de más de 2 y ningún par de climas opuestos (solo frío con solo calor;
los vecinos sí: un abrigo de frío sobre una camisa de templado). El clima y
la formalidad de lo que te falta salen de los pines donde aparece. (4) **"Ver
opciones en Pinterest"**: `pinterest.com/search/pins/?q=` con el nombre y
"outfit" (se abre aparte; Manolo no busca dentro de Pinterest). (5) **Tu lista
de deseos** (`ropa_deseos`): desde "Qué te falta" (con sus pines) o desde "Te
falta" en un pin; lo mismo (la misma clave) no se repite: suma los pines.
"Lo compré" usa el formulario de siempre (`RopaForm.comprar`): con foto o
sin foto, viene lleno con el grupo, el tipo, el color (si hay foto, manda el
de la foto) y la fecha de hoy; al guardarla, el deseo queda comprado con su
prenda. "Ya no lo quiero" la deja descartada (con Deshacer). (6) **Qué no
comprar**: 3 o más del mismo tipo y color (por familia). (7) **El
presupuesto** (`meta/ropa_ajustes.presupuestoMes`, opcional): lo que gastaste
es el precio de la ropa con fecha de compra en el mes (aunque ya no la
tengas); las de este mes sin precio se avisan. Se escribe "500" o "1.000" (el
punto separa los miles). (8) Nunca compra nada. (9) Pruebas: `npm test` →
818 (nuevo `ropa-compras-motor`: qué te falta, cuántos outfits nuevos, las
reglas de "van juntas", qué no comprar, el gasto del mes, el presupuesto y la
lista de deseos); suite nueva `ropa-compras` (50 comprobaciones) y 11
suites cercanas sin fallas (569); Lighthouse 100 en accesibilidad y
buenas prácticas en las 46 pantallas de Ropa.

**D-151 (2026-11-23) · Ropa, fase 6: Extras.** (1) **Sin IA**: reglas en
`js/ropa-numeros-motor.js` (lo mismo cada vez), con lo que ya está en el
teléfono (sin lecturas nuevas de Firestore). (2) **Lo que más te pones**: los
últimos 90 días, desde 2 veces, hasta 5. **Lo que no te pones**: la última vez
hace 90 días o más; si nunca, desde que la agregaste (90 días o más; si esa
fecha no se sabe —antes de 2020—, sale sin decir desde cuándo); hasta 8 y "Y N
más". (3) **Tus colores**: el principal de cada prenda, por familia (con el
nombre y la muestra de la familia); hasta 7 y "Otros" si hay más de 8. El que
más te pones cuenta cada vez que te pusiste algo de ese color en 90 días. El
gráfico: una barra por color, de un solo color (#c98326 en oscuro, #a35200 en
claro, con el contraste revisado), la muestra con borde dice qué color es y
el número va en texto (la lista sirve de tabla; las barras no se leen dos
veces). (4) **Costo por uso**: precio ÷ todas las veces que te la pusiste;
con 4 o más usadas con precio, las 3 que mejor rinden y las 3 que menos (sin
repetir); si no, una sola lista; "Sin estrenar": con precio y nunca puesta
(hasta 5, de la más cara). Lo invertido: el precio de lo que tienes; lo
invertido va a lo ancho (un monto no se parte en dos líneas) y, sin precios,
no va. (5) **Lo que ya no tienes** no cuenta en "Tus números"; en "Tu semana" y
"Tu año" sí (te la pusiste y la compraste igual). (6) **Inicio**: lo de hoy
primero; si no, el outfit guardado para hoy; hasta 4 fotos sin accesorios y
los nombres para el lector de pantalla; cambia solo al anotar. Y un título
invisible, "Tus secciones", antes de las tarjetas: el lector de pantalla tiene
los títulos en orden (h1 › h2 › h3; Lighthouse lo pedía cuando Inicio no
muestra nada arriba). (7) **"Tu semana"** (`resumen-motor`): el área Ropa
sale si anotaste o compraste algo en las últimas 8 semanas; "N de 7 días", lo que más te pusiste (desde 2 veces) y
lo que compraste (por la fecha de compra); compara los días con la semana
anterior; "Anotaste tu ropa los 7 días" entra en lo mejor (con poco peso). Los
días con ropa anotada cuentan como días con algo. (8) **"Tu año"**
(`resumen-anio`): tu prenda del año (desde 2 veces), los días, las prendas
distintas, tu color del año (el que más te pusiste, contando cada vez) y lo
que compraste; sin plata. La diapositiva va después de Lugares; si ninguna
prenda se repite, muestra los días anotados (o lo que compraste). (9) Pruebas:
`npm test` → 823 (nuevo `ropa-numeros-motor`; Ropa en `resumen-motor` y
`resumen-anio`); suite nueva `ropa-numeros` (54 comprobaciones) y 13
suites cercanas sin fallas (742); Lighthouse 100 en accesibilidad y buenas
prácticas en 52 pantallas (Ropa, Inicio y "Tu semana", en oscuro y en claro).

**D-152 (2026-11-23) · Ropa, fase 7: revisión final.** (1) **Todas las
pruebas**: `npm test` → 823; las 46 suites de `scripts/e2e/` sin fallas
sobre la versión final (3.924 comprobaciones); el Worker del puente con fetch
de mentira (`puente/`, `npm run prueba`): 7. (2) **Lighthouse** (accesibilidad
y buenas prácticas, 375 px, oscuro y claro): 100 en las 52 pantallas con Ropa
llena (`correr9`) y en las 12 con Ropa vacía (`correr10`: el ropero, Outfits,
Inspiración, Compras, Tus números y Ajustes sin nada); el clima va guardado
porque Open-Meteo a veces le contesta 429 a este entorno (comparte su IP). (3)
**Arreglo del repaso: la IA sin internet** (el pedido: "sin internet, mi ropero
funciona igual; la IA avisa que necesita conexión"). Antes, con el puente
instalado y sin internet, Ajustes de Ropa se quedaba en "Revisando la conexión
con la IA…" y la IA no volvía hasta recargar. Ahora (`js/ropa-ia.js`,
`js/ropa-ajustes.js`, `js/ropa-form.js`): sin internet dice "Sin internet: la IA
necesita conexión…"; si el puente no contesta, su error con "Reintentar";
con la IA ya conectada, "Sin internet ahora"; al volver internet (`online`),
pregunta de nuevo y se conecta sola; al agregar una foto sin internet, "Sin
internet: la IA no puede mirar la foto. Llénala a mano." (sin pedirle nada al
puente). Para saberlo aunque abras Manolo sin internet, el teléfono recuerda
lo último que dijo el puente (`manolo.ropa.ia`: tu código, si es tuya y si
está lista; sin el gasto); quien no es el dueño no ve avisos de la IA. (4)
**Pruebas nuevas**: `ropa-final` (28 comprobaciones: la IA sin internet con un
puente de mentira —6 de sus comprobaciones fallan con el código de antes— y
las 8 pantallas de Ropa con un ropero lleno a 390 px en oscuro y en claro, a
320 px y en la compu: nada se sale, cada una con su título y lo suyo a la
vista, la barra marca lo que corresponde, el contraste de cada texto y sin
errores); `sin-internet` (con el service worker de verdad, 13
comprobaciones) suma Ropa en modo avión: el ropero, Tus números y Outfits, que
arma con tu ropa sin el clima. (5) **Revisado**: a la IA solo le llegan las
fotos, la lista de tu ropa (sin notas, talla ni precio) y una instrucción que
dice "una app personal" (sin tu nombre, correo ni usuario; el pedido no lleva
`metadata`); el puente no guarda fotos; Pinterest solo se lee. Nada se borra
solo: "Borrar" (una prenda o una inspiración) es tuyo, con Deshacer, y sus
fotos se borran cuando se va el aviso; lo demás suma o cambia el estado. La
copia de seguridad lleva las 5 colecciones de Ropa y sus ajustes. (6) Queda
para cuando el dueño cree las cuentas: instalar el puente y la prueba real
corta de la IA (la guía, en `docs/ROPA.md`).

**D-153 (2026-11-24) · Ropa: el puente de la IA, instalado.** (1) En la
cuenta de Cloudflare del dueño, con un token de API que la sesión usa por el
proxy (nunca en el chat ni en el repositorio): el Worker `manolo-puente` en
`https://manolo-puente.manolo-ropa-482.workers.dev` (el subdominio de
workers.dev se cambió para no usar el nombre del correo del dueño), el KV
`GASTO` (su id en `puente/wrangler.toml`), las variables `FIREBASE_PROJECT` y
`ORIGENES` (solo la app de GitHub Pages) y tres secretos: `MODELO`,
`USUARIOS` (el código de Manolo del dueño: solo él usa la IA; no va en el
repositorio) y `ANTHROPIC_API_KEY` (la pegó el dueño en el panel de
Cloudflare). (2) La app apunta al puente (`PUENTE` en `js/ropa-ia.js`); con
`manolo.puente` = "ninguno" queda sin puente: `scripts/e2e/comun.js` lo pone
por defecto y las pruebas que lo necesitan traen uno de mentira. (3) **Costos,
siendo realista**: US$ 2 a 4 al mes (el primer mes, unos US$ 6 si describe todo
su ropero), con el tope del puente en US$ 8. Lo que la IA hace sola: mirar
cada inspiración nueva (`analizarPendientes`, una por una), mirar la foto al
agregar una prenda y Outfits con la IA (`version` ≥ 3); leer el tablero de
Pinterest (al abrir Inspiración, como mucho cada 6 horas) no usa la IA. Las
recargas automáticas de crédito son de la cuenta de Claude: se ven y se apagan
en su consola (Billing › Auto-reload).

**D-154 (2026-11-24) · Ropa: el corte, las mangas, cambiar los colores y las
mayúsculas.** Pedido del dueño: "que siempre escriba los detalles con
mayúscula y que permita cambiar los colores, igual lo que es si la polera es
pegada, suelta, corte recto, ya sabes, confío en ti". (1) **El corte**
(`corte`, en `js/ropa-motor.js`: `CORTES`, `CORTES_DE`, `nombreCorte`): arriba
y abrigos (pegado, regular, suelto, oversize), abajo (pitillo, pegado, recto,
ancho, acampanado), cuerpo entero (pegado, recto, suelto, acampanado); zapatos
y accesorios, ninguno. Se guarda el id ("" si no lo elegiste) y el nombre
concuerda con la prenda por su género y número (`TIPO_G`): "Polera pegada",
"Falda recta", "Leggings pegados"; "Pitillo", "Regular" (salvo en plural) y
"Oversize" no cambian. **Las mangas** (`manga`: sin, corta, larga; `MANGAS`,
`CON_MANGA`): solo arriba y cuerpo entero. En el formulario, después de "Qué
es": "Corte (cómo te queda)" y "Mangas", que cambian con el grupo y el tipo (lo
que no va con el grupo se borra); tocar otra vez el elegido lo quita (el toque
cae en el círculo invisible que cubre la opción: se recuerda si ya estaba
marcado al empezar el toque y se quita justo después, para que el teléfono no
lo vuelva a marcar). En la ficha, "Corte" y "Mangas"; buscar los encuentra
("pegada" y también "pegado"). (2) **Cambiar los colores**: tocar un color
abre la paleta para cambiarlo ("Elige el color nuevo en lugar de blanco"); el
nuevo queda en el mismo lugar y, si ya estaba en otro, ese se va (sin
repetir); "Que sea el principal" lo pasa adelante; el foco vuelve al color (no
se pierde). La ficha suma "Cambiar los colores" ("Ponerle color" si no tiene),
que abre el formulario con la paleta lista para cambiar el principal. (3)
**Mayúsculas** (`mayus`, `talla`): lo escrito empieza con mayúscula, también
después de "¿", "¡" o un paréntesis (qué es con "Otro", tela, marca, notas,
tus ocasiones, la nota de un deseo, "Mi estilo", y la tela y la ocasión que
dice la IA de una inspiración); la talla en letras, toda en mayúscula ("m" →
"M", "2xl" → "2XL", "s/m" → "S/M", "eu 42" → "EU 42"; "10 años" queda igual). Se
aplica al leer (`normalizar`) y al guardar (`ropa-datos.limpio`): lo de antes
se ve bien y se guarda así al editarlo. (4) **La IA**: el puente (versión 4,
desplegado el 2026-11-24) pide `corte` y `manga` con "" para "no se nota" o
"no va" (enum con vacío; todo obligatorio, como pide el esquema), los revisa
contra el grupo (`limpiarPrenda`, `entradaPrenda`) y los suma a tu ropa en el
texto que lee la IA para el look y Outfits ("Polera · corte pegado · manga
corta"); las listas son las mismas de la app (una prueba lo revisa). "Describir
con IA las que cargaste antes" también los llena si faltan. Con un puente
viejo (sin corte), el formulario queda sin corte: nada se rompe. (5) Solo se
suma: las prendas de antes quedan sin corte ni mangas hasta que las edites. (6)
**Pruebas**: `npm test` → 825; el Worker → 7; E2E nueva `ropa-corte` (69
comprobaciones: el corte con su nombre según la prenda y el grupo, tocar otra
vez para quitarlo, los colores —cambiar, el principal, sin repetir, el foco—,
las mayúsculas al guardar, la ficha y "Cambiar los colores", buscar, la IA con
un puente de mentira, una prenda de antes, y a 320 px en oscuro y en claro:
nada se sale, todo se toca con el dedo y se lee bien); las 47 suites sin
fallas (3.993 comprobaciones). La captura mostró las mangas en "Abajo"
aunque estaban escondidas: el estilo del recuadro (`display: flex`) le ganaba
al atributo `hidden`; arreglado con `.ro-campo[hidden]`, y la prueba ahora
mira lo que de verdad se ve.

**D-155 (2026-11-24) · Ropa, nivel 2: tu estilista con IA: plan.** Pedido
del dueño (completo en `docs/ROPA_ESTILISTA.md`): hablar con la IA como con un
estilista, armar sus outfits él mismo y que la IA opine de su ropero con su
propio criterio, no solo con lo de Pinterest. Fases en
`.claude/CURRENT_PHASE.md`. (1) **Sin pestaña nueva** (la barra de Ropa ya
tiene 5 lugares): "Armar el mío" (`#ropa-armar`) y "Tu estilista"
(`#ropa-estilista`) cuelgan de Outfits; la opinión del ropero va en Compras;
"Lo que recuerda de ti", en Ajustes de Ropa. (2) **Armar el mío va primero y
sin IA**: tu outfit arriba (fotos en capas, con ✕), las partes como fichas,
la grilla de fotos con filtros de color y clima, y abajo la ocasión, "Me lo
pongo", "Guardar", "Para mañana" y, con la IA, "¿Qué opinas?". Los avisos
(para lavar, dos de abajo, sin zapatos, frío sin abrigo, colores…) son reglas
y nunca bloquean. Se guarda en `ropa_outfits` con `origen: "manual"` (ya
existía); editar un guardado arma uno nuevo y el de antes deja de estar
guardado (con Deshacer; su historia queda). (3) **Tres rutas nuevas en el
puente** (versión 5), con el mismo `preguntar()`: `/charla` (respuesta,
0 a 3 outfits por referencia, lo que te falta y lo que recordar), `/opinar`
("¿Qué opinas?": veredicto, qué funciona, hasta 2 cambios y un consejo) y
`/opinion` (el repaso: resumen, comentarios a los números de Manolo,
sugerencias, qué no comprar, qué dejar de lado, colores y consejos). La app
revisa todo (`validas`, prendas que existen y del mismo papel, grupos y
colores de la lista). (4) **Los números los cuenta Manolo** (nuevo
`js/ropa-estilista-motor.js`: cuánto de cada parte, un color que domina, lo
formal, el clima, lo que no te pones, cuántas combinaciones salen) y los
outfits nuevos de cada sugerencia, `outfitsNuevos`; la IA los comenta. (5)
**La conversación va en una sola pregunta por mensaje**: tu ropa y el
contexto (en caché), lo que hablaron antes como texto (los últimos 10
mensajes, también en caché) y el mensaje nuevo; así no se reenvía el
pensamiento de la IA ni se arma un historial que el modelo tenga que revisar.
(6) **Datos solo aditivos**: `ropa_charlas` (cada conversación, hasta 40
mensajes), `ropa_opiniones` (cada repaso queda) y `meta/ropa_ajustes.memoria`
(hasta 30 cosas); los dos primeros se suman a la copia de seguridad. (7)
**Buscar en internet: por ahora no**: la IA ya sabe lo que se usa en 2026;
sumaría unos 3 centavos por repaso y complica la respuesta con esquema; se
agrega después con un límite de 2 búsquedas si el dueño lo quiere. (8)
**Costos** (el modelo de hoy: US$ 4 por millón de tokens de entrada, 20 de
salida, 0,20 de caché): un mensaje, 3 a 5 centavos; "¿Qué opinas?", unos 4; un
repaso, 8 a 15; armar, gratis. Uso normal: unos US$ 2 más al mes (en total US$
4 a 6, debajo del tope de US$ 8); conversando todos los días se llega al tope
(subirlo a 12 es del dueño). Nada corre solo. (9) **Maquetas** de las tres
pantallas (oscuro y claro, 390 px) hechas con la app de verdad, mostradas al
dueño; no van en el repositorio.

**D-156 (2026-11-24) · Ropa, nivel 2, fase 1: ver en grande y armar el mío.**
Pedido del dueño durante la fase 0 (con una captura de Outfits): "quiero que en
los outfits sugeridos pueda entrar para ver cómo se ven". (1) **Ver en grande**
(`js/ropa-outfits.js`: `tableroHTML`, `verOpcion`, `verPrendas`): las fotos en
filas como se ve puesto —lo de arriba (abrigo, arriba y cuerpo entero), lo de
abajo, los pies y los accesorios— y, en cada fila, de afuera hacia adentro
(`js/ropa-armar-motor.js`: `ordenar` pone la chompa sobre la camisa y la camisa
sobre la polera, por el tipo); fotos de 4:5 (la mediana del teléfono) y los
nombres completos debajo. Tocar las fotos de una opción la abre (la tarjeta ya
no lleva a la ficha de cada prenda: eso queda en la grande); "Ver en grande" es
el botón para el teclado y el lector (el foco vuelve a él al cerrar). En la
grande, "‹ ›" entre las opciones y sus 4 botones; "Otra opción" y "No me
gusta" la cambian ahí mismo. Los guardados (con Editar y Duplicar), lo de hoy
y cada día del calendario usan el mismo tablero. (2) **Armar el mío**
(`#ropa-armar`, `js/ropa-armar.js`, hijo de Outfits en la barra): el borrador
en `manolo.ropa.armar` (este teléfono); `AR.tocar` suma o saca y, en las partes
de una sola (abajo, abrigo, zapatos, cuerpo entero), cambia la que había; las
partes y lo elegido en chico quedan fijos al bajar (debajo de la barra de
arriba, que se mide). Los avisos son reglas (`AR.avisos`) y nunca bloquean; el
clima, el de Outfits (`RopaOutfits.contexto`, con su caché). Se guarda en
`ropa_outfits` con `origen: "manual"` (ya existía) por `guardarMio` (si ese
outfit ya existía, con tu nombre y tu ocasión); "Cambiar una prenda" sin cambiar
nada guarda la opción como era. Editar: el nuevo queda guardado y el de antes
no (su historia queda); Deshacer restaura los dos documentos tal cual. (3)
**Sin datos nuevos**: solo `guardarMio` en `js/ropa-outfits-datos.js`; nada se
borra solo. (4) **Pruebas**: `npm test` → 831 (nuevo `ropa-armar-motor`: el
orden de las capas, las filas, elegir y los avisos); E2E nueva `ropa-armar`
(78 comprobaciones: en grande desde una opción, un guardado y lo de hoy; armar,
los avisos, los filtros, la barra fija, el borrador, guardar, me lo pongo, para
mañana y empezar de cero, con Deshacer; cambiar una prenda, editar y duplicar;
sin internet; 320 px en oscuro y en claro: nada se sale, todo se toca con el
dedo y se lee bien); `ropa-outfits` lee las prendas de cada opción por
`data-prenda` (sus fotos ya no son links); las 48 suites sin fallas (4.071
comprobaciones; la medición de la Biblia de `lectura-qa` dio 1.567 ms con la
máquina ocupada y, sola, 1.255 ms, bajo el límite de 1,5 s).

**D-157 (2026-11-24) · Ropa, nivel 2, fase 2: el puente aprende a conversar y
a opinar.** (1) **Puente versión 5** (`puente/src/index.js`): tres rutas, todas
por `preguntar()` (tope, gasto, esquema fijo, respaldo si se niega): `/charla`
(conversar, esfuerzo medio), `/opinar` ("¿Qué opinas?" de un outfit, medio) y
`/opinion` (el repaso del ropero, alto: es de tanto en tanto). Instalado con
wrangler; los secretos (`ANTHROPIC_API_KEY`, `MODELO`, `USUARIOS`) quedan. (2)
**La lógica, sin red** (`puente/src/logica.js`): `entradaCharla` /
`bloquesCharla` / `limpiarCharla`, `entradaOpinar` / `textoOpinar` /
`limpiarOpinar`, `entradaOpinion` / `textoOpinion` / `limpiarOpinion`, con sus
esquemas (`ESQUEMA_CHARLA`, `ESQUEMA_OPINAR`, `ESQUEMA_OPINION`: todo
requerido, sin propiedades de más, partes y colores como listas cerradas) y sus
instrucciones ("el estilista personal de quien usa una app personal de ropa":
ni el nombre de la app ni el de la persona). A la IA le llegan tus prendas
como referencias (p1, p2…; `textoRopero`), nunca tus ids, notas, talla ni
precio. (3) **La caché**: tu ropa primero y en caché (`/charla` y `/opinar`);
en `/charla`, cada mensaje de antes en su propio bloque y el último con
`cache_control`: el prefijo crece y el mensaje siguiente lee todo lo anterior
de la caché (2 puntos de caché por pedido; el límite es 4; el mínimo para
guardar en caché es de 512 tokens en el modelo de hoy y la ropa lo pasa). Van
los últimos 10 mensajes que sirven (se descartan los vacíos o raros antes de
contar); pasados 10, lo más viejo sale y esa parte se vuelve a escribir en la
caché (una fracción de centavo); la ropa sigue leyéndose de la caché. Si cambia
el contexto del día entre mensajes (por ejemplo, lo que te pusiste), lo que
va después también se vuelve a escribir. El repaso no usa caché (se pide pocas
veces). (4) **Lo que vuelve se limpia**:
outfits con al menos 2 prendas que existen y nada para lavar (hasta 3; se
descartan los malos antes de contar), lo que falta con parte y color de la
lista (hasta 2), lo que recordar (hasta 2 frases cortas); si no hay texto ni
outfits, "No te entendí bien: ¿me lo dices de otra forma?". "¿Qué opinas?":
cada cambio saca una prenda del outfit y pone una tuya que no está, de la
misma parte y no para lavar (hasta 2, sin repetir la que sale); el veredicto,
de la lista ("bien" si no). El repaso: comentarios solo de los números que
mandó la app (`h1`… hasta 15, uno por número), sugerencias con parte, tipo y
color válidos y con qué de tu ropa combinan (tus ids), qué no comprar, qué
dejar (prendas tuyas, sin repetir), colores (de la lista) y consejos. (5)
**`veces`** (opcional) en cada prenda: "puesta N veces" o "sin usar", solo si
la app lo manda (el repaso). (6) **En la app**: `RopaIA.estilista()` (el dueño,
la IA lista y el puente 5 o más), `charla`, `opinar` y `opinion`; todavía sin
pantalla (fases 3 y 4). Sin datos nuevos. (7) **Pruebas** (sin gastar: ninguna
llama a la IA de verdad): `npm test` → 836 (5 nuevas en
`puente-logica`: esquemas e instrucciones, las veces, conversar, "¿Qué
opinas?" y el repaso); el puente entero con fetch de mentira (`npm run
prueba`), 9 (2 nuevas: conversar con su caché y su esfuerzo; "¿Qué opinas?" y
el repaso). (8) **Una prueba que fallaba a veces** (`ropa`, "la grilla usa el
ancho" en la compu: 2 de 11 corridas, y 3 de 3 con tres copias a la vez): con
la máquina ocupada, Ropa vuelve a dibujar la lista justo cuando la prueba la
mide, y `$eval` (que busca y después mide, en dos pasos) medía la grilla vieja,
ya fuera de la página (ancho 0, sin estilos). La app estaba bien (cuadro por
cuadro, la grilla siempre tiene 4 columnas). Ahora busca y mide en un solo
`evaluate`: 3 de 3 con la misma carga.

**D-158 (2026-11-24) · Ropa, nivel 2, fase 3: hablar con tu estilista.** (1)
**Dónde**: `#ropa-estilista` (`js/ropa-estilista.js`, hijo de Outfits en la
barra); en Outfits, después del clima, "Tu estilista: Pídelo con tus
palabras" (solo con la IA lista; sin internet lo avisa; no aparece sin ropa ni
al combinar con una prenda): lo que escribes abre una conversación nueva
(`RopaEstilista.pedir`). Lo que escribías ahí queda aunque Outfits se vuelva a
pintar. (2) **La conversación**: el cuadro para escribir se arma una sola vez
(no se vuelve a pintar: lo escrito queda; el borrador también en
`manolo.ropa.charla.borrador`), fijo abajo con `position: sticky` sobre la
barra de pestañas; Enter manda, Mayúscula + Enter, otra línea. La abierta, en
`manolo.ropa.charla`. Tu mensaje se guarda al toque (`crear` da el id en el
momento; `agregar` con `arrayUnion`: nada se reescribe) y se ve de una copia
local hasta que llega de la nube. Hasta 40 mensajes: después, lo que escribas
empieza otra (nada se borra). El título: el comienzo de tu primer mensaje
(`E.titulo`). (3) **Lo que va al puente** (`/charla`): tu ropa con lo que está
para lavar marcado y sin lo que ya no tienes (`E.roperoParaCharla`), lo
hablado antes (los últimos 20; el puente usa 10), el clima de hoy y de mañana
(`RopaOutfits.climaParaIA`, con la caché del clima), tu estilo, lo que te
pusiste en 7 días, lo que te gustó y lo que no, lo que recuerda de ti y tu
presupuesto en palabras (`E.presupuestoTexto`). (4) **Se revisa aquí**: cada
outfit con `RopaOutfitMotor.validas` (completo y con tu ropa; sin descartar lo
que no te gustó: si lo pides, se muestra); los que no pasan se cuentan
(`sinMostrar`) y se dice. Sin texto ni outfits: "No pude armar outfits…". Lo
que falta, con parte y color de la lista. (5) **Cada outfit**: Me lo pongo,
Guardar, No me gusta (con Deshacer, como en Outfits, `origen: "ia"`), Ver en
grande, Cambiar una prenda y "Otra opción", que es un mensaje más ("Dame otra
opción distinta de «…»": se ve y cuesta como cualquiera). Lo que dice la
tarjeta (guardado, te lo pusiste hoy, no te gustó, para lavar, ya no está) se
saca de `ropa_outfits` y de tu ropa: sin datos nuevos. (6) **Lo que recuerda
de ti** (`meta/ropa_ajustes.memoria`, [{ id, texto, fecha }]): se suma lo que
la IA manda en `recordar`, sin repetir (sin mayúsculas, tildes ni signos) y
hasta 30 (se va lo más viejo); "Lo recordé" se ve solo mientras lo siga
recordando ("Olvidar", con Deshacer). Se ve, agrega y borra en una hoja (desde
Tu estilista y desde Ajustes de Ropa). (7) **Deshacer dentro de las hojas**:
el aviso de abajo queda tapado por una hoja abierta (z-index 60 contra 900);
en "Tus conversaciones" y "Lo que recuerda de ti", lo hecho se dice arriba de
la hoja con su "Deshacer" y el foco va ahí. (8) **Los ejemplos** de la
conversación vacía se escriben en el cuadro: no se mandan solos (nada gasta
sin que lo mandes). (9) **Si falla**: tu mensaje queda, dice qué pasó (el
tope, con Ajustes de Ropa) y "Volver a preguntar" lo pregunta de nuevo sin
repetirlo. Sin internet, lo hablado se ve igual; quien no es el dueño lo ve
explicado. (10) **Datos**: `ropa_charlas` (nuevo, en la copia de seguridad:
`js/respaldo-motor.js`); en la lista de deseos, `origen: "estilista"`
(`RopaComprasMotor.ORIGENES`). (11) **Pruebas**: `npm test` → 844 (nuevo
`ropa-estilista-motor`: el título, los mensajes, las conversaciones, lo que va
al puente, tu ropa, el presupuesto, lo que recuerda de ti y cuándo); E2E
nueva `ropa-estilista` (104 comprobaciones, con un puente de mentira); las 49
suites sin fallas (4.175 comprobaciones).

**D-159 (2026-11-24) · Ropa: tu estilista recuerda los outfits del día.**
Pregunta del dueño: "¿Por qué no recuerda los outfits que me hizo para el
día?". Cuatro causas: (a) "Pídelo con tus palabras" empezaba siempre una
conversación nueva; (b) en la misma conversación, a la IA le llegaban los
outfits de antes sin su número ni su nombre ("la opción 2", "el de capas");
(c) las opciones de "¿Qué me pongo?" no le llegaban; (d) Outfits guardaba en el
teléfono solo el último grupo de opciones (al cambiar de ocasión o de día y
volver, se perdían y había que pedirlas de nuevo, gastando otra vez). Arreglos:
(1) "Pídelo con tus palabras" sigue tu conversación de hoy (la última usada
hoy, si no está llena); si no hay, empieza una nueva ("Nueva" sigue a mano).
(2) **Puente versión 6**: lo de antes llega como { prendas, nombre } (la
versión 5, como lista de ids, se sigue aceptando) y se le dice "opción 1
«Capas abrigadas»: p5, p2, p1…"; nuevo `hoy` (hasta 9): "Hoy ya vi estas
opciones (en Outfits o en otra conversación contigo)…", en el contexto del día
(antes de lo hablado: la caché de la conversación no se rompe mientras no
cambie). Regla nueva: si te nombra uno, es ese; si pide otra cosa, distinta de
lo que ya viste. La app manda el formato nuevo solo con el puente 6 o más. (3)
`E.delDia`: los outfits de tu estilista en tus otras conversaciones de hoy (lo
más nuevo primero) y las opciones de Outfits de hoy (`RopaOutfits.opcionesDelDia`,
de cada ocasión), sin repetir. (4) Outfits guarda las opciones de cada día,
ciudad, ocasión y prenda (`manolo.ropa.opciones`, ahora un mapa: las de hoy
en adelante, hasta 12; la de antes se lee igual). Pruebas: `npm test` → 846;
`ropa-estilista` 113 (sigue la de hoy, con los nombres y lo que viste en
Outfits; una de otro día no sigue; en una nueva igual sabe lo de hoy);
`ropa-outfits` 87 (al volver a hoy o a Casual, siguen las opciones). Puente:
18 pruebas de la lógica y 9 del Worker; instalado (versión 6).

**D-160 (2026-11-24) · Ropa, nivel 2, fase 4: lo que opina tu estilista de tu
ropero y "¿Qué opinas?".** (1) **Lo que ve Manolo** (`js/ropa-opinion-motor.js`;
el plan decía `ropa-estilista-motor.js`, pero estos números usan las reglas de
Compras y de Tus números, que se cargan después): frases con números de verdad,
cada una con su referencia (`h1`…, hasta 15), sin lo que ya no tienes: cuánto
de cada parte; si hay mucho más de arriba que de abajo (o al revés); sin
zapatos o sin abrigos (desde 6 prendas); un color que domina una parte (4 o
más y la mitad o más; el color con su forma: "negras", "negros"); los zapatos
todos oscuros o todos claros; todo liso (desde 8); nada muy formal (4 o 5),
nada marcado para el calor o el frío; lo que más te pones y lo que no te
pusiste en 3 meses (de lo que anotaste; si no anotaste nada, lo dice); tus
colores; lo que tienes de sobra; cuántas combinaciones de arriba y abajo van
juntas (`vanJuntas`). (2) **El repaso, en Compras** (`js/ropa-opinion.js`,
antes de "Qué te falta"): sin la IA y sin un repaso guardado, no aparece; con
menos de 3 prendas, lo explica. "Pedir su opinión" (unos 12 centavos; "Tu
estilista está mirando tu ropero…"; si falla, lo dice y no guarda nada). Al
puente (`/opinion`, esfuerzo alto): tu ropa con las veces que te la pusiste
(`roperoParaRepaso`), los números, lo que se repite en tus pines
(`pinesTexto`, de "Qué te falta"), tu estilo, lo que recuerda de ti, tu
presupuesto y tu ciudad. Cada repaso queda en `ropa_opiniones` ({ v, fecha, n,
hechos, ia, creado }; sin el gasto) y se ve el último (al toque, sin esperar a
la nube). Se ve: el resumen; "Lo que ve" (cada número con lo que comenta tu
estilista); "Lo que sumaría" (con qué de tu ropa va, cuántos outfits nuevos te
da —`outfitsNuevos`, lo cuenta Manolo—, si también está en tus pines, "A mi
lista" con `origen: "estilista"` y "Ver opciones en Pinterest"); qué no
comprar más; podrías dejar de lado (solo las que siguen en tu ropero; "es solo
un consejo": nunca toca nada); tus colores; consejos; "Pedirle otra opinión".
(3) **"¿Qué opinas?"** (`RopaOpinion.opinar`, `/opinar`, esfuerzo medio, unos
4 centavos): en Armar el mío (con 2 prendas o más y la IA lista; "Cambiar" lo
aplica ahí mismo con `RopaOpinionMotor.cambiar`, con Deshacer), en un guardado
y en una opción en grande de Outfits ("Cambiar" abre Armar el mío con el cambio
hecho). Le llegan tu outfit, tu ropa (lo que está para lavar, marcado), el clima
de hoy y de mañana, la ocasión, tu estilo y lo que recuerda de ti. La hoja se
arma una vez y solo cambia lo de adentro (se anuncia; el foco queda); la
respuesta de cada outfit queda en esta sesión (no se paga dos veces lo mismo;
"Preguntarle otra vez", sí) y lo que llega tarde de otro outfit no se pinta.
(4) **Datos**: `ropa_opiniones` (nuevo, en la copia de seguridad). (5)
**Pruebas**: `npm test` → 851 (nuevo `ropa-opinion-motor`: lo que ve Manolo, tu
ropa con las veces, tus pines en palabras, cada repaso guardado, el veredicto y
cambiar); E2E nueva `ropa-opinion` (56: pedir, un error, lo que va al puente,
lo guardado, cada parte del repaso, "A mi lista" y Pinterest, lo guardado sin
la IA; "¿Qué opinas?" en Armar el mío con "Cambiar" y Deshacer, sin pagar dos
veces y "Preguntarle otra vez"; desde un guardado; sin la IA no aparece; 320 px
en oscuro y en claro). Las 50 suites sin fallas (4.243 comprobaciones).

**D-161 (2026-11-24) · Ropa, nivel 2, fase 5: tu estilista, conectado con
Outfits, Compras e Inicio.** (1) **El aviso del día en Outfits**
(`RopaOpinionMotor.avisoDelDia`; sin IA, no cuesta nada): de lo que sugirió tu
estilista en su último repaso, lo que le serviría al clima del día elegido
(hoy o mañana) o a la ocasión. Motivos, en este orden: la lluvia o tormenta
(botas, botines, zapatos cerrados, algo impermeable, rompevientos, paraguas),
el frío (un abrigo vale más que una chompa o un buzo, y estos más que unas
botas o una bufanda), ir en capas (un abrigo liviano, cárdigan, sobrecamisa,
chaleco, chompa, camisa), el calor (polera, lino, short, bermuda, falda,
vestido, sandalias), el viento (rompevientos) y el sol fuerte (gorra,
sombrero, lentes); después, la ocasión (trabajo, algo formal, la noche,
deporte). Se mira el tipo de prenda, no su porqué: es texto libre ("menos en
días de lluvia" daría avisos al revés). No sale lo que ya tienes (igual o
parecido, como en "Qué te falta": `RopaInspMotor.parecido`/`cuanto`), lo que
ya compraste o ya no quieres en tu lista de deseos (salvo que lo volviste a
pedir) ni lo que ocultaste. Uno solo y corto, antes de tus opciones: "Para la
lluvia de mañana, tu estilista te sugirió: Botines cafés. Ver en Compras" (si
ya está en tu lista, lo dice). La ✕ (44 px) lo oculta en este teléfono
(`manolo.ropa.avisos`: las claves, hasta 30; es una comodidad del teléfono,
no un dato), con Deshacer, y el foco queda en "¿Qué me pongo?". No sale
combinando una prenda ni sin un repaso guardado. (2) **"Hoy te armó…"** en la
tarjeta de tu estilista (Outfits): los outfits de hoy de todas tus
conversaciones que todavía te puedes poner (`RopaEstilistaMotor.armadoHoy` y
`armadoTexto`: "Hoy te armó «Capas para el frío», «Lluvia» y 1 outfit más."),
con "Verlos" → `#ropa-estilista/{id}`: abre la conversación más nueva donde te
los armó y la dirección vuelve a `#ropa-estilista` (si ya no está, queda la
que tenías abierta). (3) **"Para mañana"** en cada outfit de la conversación
(como en Outfits): queda en tus guardados con la fecha de mañana ("Lo elegiste
para mañana."); Deshacer lo deja como estaba (si era nuevo, lo borra; si ya
estaba guardado, vuelve sin la fecha). "Cambiar una prenda" desde las
conversaciones ya estaba (fase 3). (4) **Compras**: en "Qué te falta", "Tu
estilista también lo sugiere." si coincide con su último repaso (la misma
clave: tipo y color por familia); en lo que opina, "También está en N de tus
pines." (antes, sin el número); en tu lista de deseos, "Te lo sugirió tu
estilista" (`origen: "estilista"`, desde una conversación o desde su repaso).
`RopaOpinion.ultima()` y `RopaOpinionMotor.cosaDe` quedan para los demás. (5)
**Inicio** (la tarjeta de Ropa; corto, por eso sí tiene sentido): si no te
pusiste ni elegiste nada para hoy, lo que te armó hoy tu estilista ("Hoy tu
estilista te armó 2 outfits:" con las fotos del primero; lleva a esa
conversación) o, con tu estilista lista, con internet y 2 prendas o más,
"¿Qué me pongo hoy? Pídeselo a tu estilista." (desde las 20, "mañana"; lleva
a Outfits). Sin el puente, como antes. Arreglo de paso: las fotos de esa
tarjeta ensanchaban las tarjetas de Inicio (a 320 px y un poco a 390 px, ya
con "Hoy te pusiste"); ahora se achican (21 px a 320). (6) "Lo que armo yo
también le enseña mis gustos": ya pasaba (lo que guardas o te pones queda con
gusto "sí" y le llega a tu estilista). (7) Sin cambios en el puente ni en los
datos de la nube. (8) **Pruebas**: `npm test` → 853 (el aviso del día: cada
motivo, el orden, lo que ya tienes, compraste, ya no quieres u ocultaste; lo
que te armó hoy y en palabras); E2E nueva `ropa-conectar` (74: el aviso
de hoy y de mañana, la ✕ con Deshacer, "Ya está en tu lista", lo que ya
tienes no sale, sin aviso combinando una prenda, sale sin el puente; "Hoy te
armó…" y su link; "Para mañana" con Deshacer; los cruces en Compras; Inicio;
320 px en oscuro y en claro, con las tarjetas de Inicio enteras). Las 51
suites sin fallas (4.317 comprobaciones).

**D-162 (2026-11-25) · Ropa, nivel 2, fase 6: la revisión final de tu
estilista (y los latidos).** (1) **Revisado** (fases 1 a 5): a la IA no le
llega el nombre, el correo ni el usuario (solo referencias p1, p2…; ni ids,
notas, talla ni precio); el tope del mes corta antes de llamar a la IA; cada
error de la IA (clave, crédito, ocupada, caída, rechazo, respuesta rara) se
dice en palabras simples; nada corre solo; los datos solo se suman. (2)
**Lighthouse** de las 13 pantallas nuevas en oscuro y en claro
(`scratchpad/lh/correr11.mjs`, fuera del repo, con el Firebase falso y un
puente de mentira): 100 en accesibilidad y en buenas prácticas en las 26,
después de arreglar dos cosas de la fase 1: (a) en una opción en grande, "Se
parece a tu inspiración" era un link `#ropa-pin/…` que quedaba abajo, fuera de
la vista de la hoja, y Lighthouse (axe, regla `skip-link`) lo tomaba por un
"link para saltar" sin destino (en una app con rutas "#", cualquier link así
dentro de una hoja que se desplaza): en la hoja ahora es un botón que cierra
la hoja y va al pin (en la lista sigue siendo un link); (b) en Armar el mío,
las fotos con el nombre escrito al lado llevaban ese mismo nombre de texto
alternativo (el lector de pantalla lo leía dos veces, `image-redundant-alt`):
ahora van con `alt=""`. (3) **Los latidos (puente versión 7, instalado).**
Safari del iPhone corta un pedido si no le llega nada en 60 segundos (el
tiempo de espera por defecto de WebKit; hay reportes de iOS 10 a 16.4), y el
repaso del ropero (esfuerzo alto) puede tardar más: se pagaba y no llegaba.
Ahora, con `?latidos=1`, el puente contesta enseguida (200, con
`Cache-Control: no-store, no-transform`: según Cloudflare, así no comprime ni
toca la respuesta) y, mientras la IA piensa, manda un espacio cada 10 segundos
(el JSON los acepta adelante); al final, el JSON de siempre o, si no se pudo,
`{ error, mensaje, status }` adentro. La app (`RopaIA`) lo pide en todo lo que
usa la IA, entiende el error de adentro igual que antes y, si la respuesta
llega cortada, lo dice ("Se cortó la conexión antes de la respuesta"); el
puente de antes no mira `?latidos`, y sin `?latidos` el puente nuevo contesta
como antes (las dos versiones de la app y del puente se entienden). Se
probó en el Worker con una IA de mentira que tarda (`LATIDO_MS` lo acorta);
la red de esta sesión no llega al Worker instalado, así que la prueba real
del dueño lo confirma. (4) **La prueba real**: la hace el dueño en su iPhone
con la guía de `docs/ROPA_ESTILISTA.md` (unos 25 centavos: dos mensajes,
"¿Qué opinas?" y el repaso; esperar con la pantalla prendida y sin cambiar de
app). (5) **Pruebas**: `npm test` → 853; el puente: 10 del Worker (nueva: los
latidos, los errores adentro, el tope adentro sin llamar a la IA y sin
`?latidos` como antes) y 18 de su lógica; E2E `ropa-estilista` (114, con un
puente de mentira como el 7) y `ropa-outfits` (89: en grande, "Se parece a tu
inspiración" lleva al pin); las demás, con puentes como el de antes.
