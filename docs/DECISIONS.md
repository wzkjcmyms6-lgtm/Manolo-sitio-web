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
