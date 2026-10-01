# Motor de actividades deportivas (diseño, fase 2)

Un único motor para Running, Bicicleta y futuras actividades. Lógica pura
(UMD, sin DOM) para poder probarla con `node --test`.

```text
actividad-motor.js  ← puntos GPS, pausa/reanuda, reloj (timestamps)
     │  estado: listo → activo ⇄ pausado → finalizado
     ├─ running.js     métricas: ritmo actual/medio (min/km), parciales por km
     └─ bicicleta.js   métricas: velocidad actual/media/máx (km/h), parciales
intervalos-motor.js ← independiente del GPS (sigue aunque no haya señal)
```

- **Estado serializable** (JSON) → se guarda en `localStorage` y se
  recupera al reabrir ("Tienes una actividad sin terminar").
- **Tiempos**: transcurrido (fin − inicio − 0), en movimiento (ver
  `GPS.md`), pausas registradas como tramos.
- **Datos medidos vs estimados**: distancia/tiempos = medidos; calorías no
  se muestran salvo que haya un método razonable (decisión en fase 3).
- **Perfil por deporte**: umbrales de filtrado y de movimiento, métrica
  principal (ritmo o velocidad), tamaño de parcial.
- **UI común** (`actividad-ui.js`): previa (estado del GPS, libre o rutina),
  activa (métrica grande + tiempo + ritmo/velocidad + mapa; botones
  grandes), resumen (tarjetas + parciales + ruta) → guardar.
