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

**D-008 (propuesta F4) · Voz con `speechSynthesis` local; pitidos Web
Audio.** Motivo: sin costo ni red. Consecuencia: depende de las voces del
sistema; se prueba en el iPhone.

**D-009 (decidida F2) · Mapa.** Durante la actividad: trazo **SVG local**
(sin red, gasta menos batería). En resumen e historial: **Leaflet
vendorizado y cargado solo al abrir el mapa**, con teselas gratuitas con
atribución; sin conexión o si fallan, vuelve al trazo SVG. Proveedor de
teselas y sus condiciones de uso se verifican al integrarlo (fase 3); el
service worker no guarda teselas en masa. Alternativas: solo SVG (sin
contexto de calles), mapa con teselas también en vivo (más batería y datos).

**D-010 (propuesta F4) · CSV con `EjImportar.leerCsv` existente.** Motivo:
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
