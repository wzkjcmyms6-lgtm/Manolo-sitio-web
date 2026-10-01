# Costos (nube, APIs, tokens)

## Revisión de la fase 7

| Recurso | Estado |
|---|---|
| Firestore: lecturas al abrir | Escuchas de colecciones propias (como antes). `running`/`bicicleta` las escuchan dos módulos (Ejercicio y Running/Bici), pero el SDK comparte una sola conexión por consulta: no se duplican lecturas |
| Firestore: rutas GPS (históricas) | Ya no se leen ni se crean (D-033) |
| Firestore: escrituras | Una rutina guiada = un lote al guardar (la actividad y, si se completó, el `orden` de la rutina). Importar un plan = un lote |
| Firestore: accesos | Una escritura por inicio de sesión (id fijo, sin duplicados); el admin escucha solo los últimos 50 |
| Cloud Functions / FCM | No se usan |
| Voz | `speechSynthesis` local; ninguna API de IA ni de nube |
| Mapas | No se usan (D-033) |
| CSV / Excel | Se procesan en el teléfono |
| Logs | Solo errores; sin contraseñas ni tokens |
| Tokens del agente | Leer `.claude/PROJECT_STATE.md` y los docs del tema; búsquedas dirigidas |

Plan gratuito de Firebase (Spark): con el uso actual (pocos usuarios, una
escritura por actividad) queda muy lejos de los límites diarios.
