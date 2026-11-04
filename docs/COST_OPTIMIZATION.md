# Costos (nube, APIs, tokens)

## Revisión de la fase 7

| Recurso | Estado |
|---|---|
| Running importado (2026-11) | 2 escrituras por actividad (resumen + ruta) en lotes de ≤ 400; 500 carreras ≈ 1000 escrituras (cuota gratis: 20 000/día). Sin Storage ni Cloud Functions; los archivos originales no se suben. La ruta completa (≤ 1 MiB) se lee solo en el detalle; listas y tarjetas usan la mini ruta del resumen. Clima y lugar: 1–2 pedidos por actividad, una sola vez, con caché |
| Running: lecturas extra | El detalle lee su ruta una vez (se guardan las 3 últimas en memoria); "Mismo recorrido", logros, Progreso y el mapa de calor usan las listas que ya se escuchan (mini rutas). Crear un segmento lee solo las rutas de las carreras que pasan cerca; "Exportar todo" lee todas las rutas una vez (lo pide el dueño). Segmentos: 1 escucha más (documentos chicos) |
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
