# Running

## Hoy
`js/running.js` + `#panel-running`: formulario manual (fecha, km, minutos,
RPE, notas), lista y totales. Colección `users/{uid}/running`. Muestra el
banner de versículo (por ser sub-panel de Inicio).

## Fase 3 (hecha)
- Sin versículo (`showPanel()` en `modules.js`).
- `js/actividad-ui.js` (común con Bici): **Inicio** (botón, estado del
  permiso de ubicación, aviso de pantalla encendida) → **en vivo**
  (DISTANCIA grande, tiempo, ritmo actual y medio, trazo SVG, estado del
  GPS; Iniciar · Pausar · Reanudar · Finalizar; sin barras de la app) →
  **resumen** (mapa Leaflet + OpenStreetMap o trazo sin conexión, distancia,
  tiempo, ritmo medio, en movimiento, total, velocidad media, desnivel
  aprox., calorías estimadas con tu peso, parciales por km; RPE y notas;
  Guardar · Volver a la carrera · Descartar).
- Recuperación: si Manolo se cierra, al volver la carrera aparece **en
  pausa** desde el último guardado local (cada 10 s); aviso en Inicio.
- Guardado: un lote con el resumen en `running` y la ruta en `rutas`.
  Lista "Tus carreras": las de GPS se abren (resumen + mapa) y se eliminan
  con su ruta. El registro a mano sigue en un desplegable.
## Fase 4 (hecha)
- Inicio: sección "Con rutina de intervalos" (lista, importar CSV/Excel,
  plantilla, eliminar). Formato en `docs/CSV_ROUTINES.md`.
- Carrera con rutina: tarjeta con el intervalo actual (color por tipo),
  tiempo restante grande, descripción, barra de progreso, siguiente
  intervalo y "N de M"; botones Sonido y Voz (se recuerdan).
- Avisos (`js/avisos.js`): cuenta 3-2-1 en pantalla con pitidos (Web Audio)
  y, en cada cambio y al terminar, aviso grande + voz del sistema
  (`speechSynthesis`, sin nube): "Siguiente intervalo: correr durante 2
  minutos." Se habilitan con el toque de Iniciar/Reanudar.
- La rutina va con su propio motor (`intervalos-motor.js`): sigue aunque se
  pierda el GPS; con la carrera en pausa, se pausa. Si la app estuvo
  congelada, al volver no recita avisos viejos: dice "Ahora: …".
- Recuperación junto con la carrera; la carrera guarda
  `rutina: {id, nombre, completados, total}` y el resumen lo muestra.
- Fase 6: historial y detalle.

## Fase 6 (hecha)
- "Tu progreso" (arriba de la lista): distancia de las últimas 4 semanas con
  ritmo medio y cambio frente a las 4 anteriores; barras de 12 semanas
  (Distancia · Tiempo · Salidas); **mejores marcas solo con GPS**: mejor 1 km,
  5 km y 10 km (mejores parciales seguidos) y carrera más larga. Tocar una
  marca abre esa carrera.
- Lista separada por meses.
- Detalle: gráfico de ritmo a lo largo del recorrido (por tramos de
  distancia; los huecos de señal quedan vacíos), altitud aproximada si hay, y
  parciales con el mejor y el peor resaltados.
