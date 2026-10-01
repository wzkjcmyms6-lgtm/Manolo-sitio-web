# Fase actual

**Fase 6 — Historial y análisis: COMPLETADA** (2026-10-01).

## Fase 7 — Optimización (siguiente, espera OK)
Revisar con mediciones, sin cambiar comportamiento:
1. Carga inicial: peso de los scripts de deporte (¿cargar el análisis y las
   rutinas solo al abrir Running/Bici?), service worker (Leaflet en caché
   tras el primer uso).
2. Firestore: lecturas por apertura (listeners de colecciones completas),
   rutas solo bajo demanda (ya), límites en accesos (ya), índices.
3. GPS/batería: frecuencia de redibujo, tamaño del borrador local en
   actividades largas (¿aligerar puntos guardados cada 10 s?), wake lock.
4. Seguridad: escapes de texto, validación de entradas, reglas
   (`firestore.rules`), nada sensible en logs.
5. Responsive (390 px y escritorio) de las pantallas nuevas.
