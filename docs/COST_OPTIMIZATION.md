# Costos (nube, APIs, tokens)

| Recurso | Regla |
|---|---|
| Firestore | Rutas GPS en documento aparte; **una escritura** por actividad; listas sin rutas; bandeja admin con `limit(50)`; nada de polling |
| Cloud Functions / FCM | No se usan (requieren plan con facturación). Solo si un requisito lo exige y el dueño lo aprueba |
| Voz | `speechSynthesis` local; **ninguna API de IA ni de nube** por aviso |
| Mapas | Ruta dibujada localmente (SVG) siempre disponible y offline; fondo de mapa opcional con teselas gratuitas con atribución, cargado bajo demanda y sin descargas masivas |
| CSV | Se procesa en el teléfono; nunca se sube el archivo |
| Logs | Sin logs por punto GPS; nunca contraseñas ni tokens |
| Tokens del agente | Leer primero `.claude/PROJECT_STATE.md` y los docs; búsquedas dirigidas; no re-auditar todo |
