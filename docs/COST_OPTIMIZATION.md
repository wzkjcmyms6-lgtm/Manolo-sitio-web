# Costos (nube, APIs, tokens)

## Revisión de la fase 7

| Recurso | Estado |
|---|---|
| Firestore: lecturas al abrir | Escuchas de colecciones propias (como antes). `running`/`bicicleta` las escuchan dos módulos (Ejercicio y Running/Bici), pero el SDK comparte una sola conexión por consulta: no se duplican lecturas |
| Firestore: rutas GPS | Nunca se escuchan: se leen una a una solo al abrir una actividad (`get`) |
| Firestore: escrituras | Una actividad = un lote de 2 documentos al terminar. Ningún punto GPS se sube suelto |
| Firestore: accesos | Una escritura por inicio de sesión (id fijo, sin duplicados); el admin escucha solo los últimos 50 |
| Cloud Functions / FCM | No se usan |
| Voz | `speechSynthesis` local; ninguna API de IA ni de nube |
| Mapas | Teselas de OpenStreetMap solo al abrir un resumen; sin precarga ni descargas masivas; el service worker no guarda teselas de otros dominios |
| CSV / Excel | Se procesan en el teléfono |
| Logs | Solo errores; sin puntos GPS, contraseñas ni tokens |
| Tokens del agente | Leer `.claude/PROJECT_STATE.md` y los docs del tema; búsquedas dirigidas |

Plan gratuito de Firebase (Spark): con el uso actual (pocos usuarios, una
escritura por actividad) queda muy lejos de los límites diarios.
