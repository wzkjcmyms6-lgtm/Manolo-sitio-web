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
