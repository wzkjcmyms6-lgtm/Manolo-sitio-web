# Bicicleta

## Fase 5 (hecha)
Mismas pantallas y motor que Running (`js/actividad-ui.js`,
`js/actividad-motor.js` con el perfil `bicicleta`), configurado en
`js/bicicleta.js`:

- Sin versículo. Inicio con "Iniciar rodada" y estado del permiso.
- **En vivo: la velocidad actual es el número grande** (km/h); debajo
  distancia, tiempo y velocidad media; trazo SVG; Iniciar · Pausar ·
  Reanudar · Finalizar.
- Resumen: mapa, distancia, tiempo, velocidad media, en movimiento, tiempo
  total, velocidad máxima, desnivel aprox., parciales cada **5 km**; RPE y
  notas. **Sin calorías** (D-016).
- Perfil del motor: "en movimiento" desde 1 m/s, saltos imposibles > 25 m/s
  (90 km/h), velocidad actual con ventana de 10 s.
- Guardado en `users/{uid}/bicicleta` (con `distance`/`duration` de siempre)
  + ruta en `users/{uid}/rutas`. Lista "Tus rodadas" (abrir/eliminar las de
  GPS) y registro a mano (rodillo o sin GPS) en un desplegable — código
  común con Running en `js/actividad-registro.js`.
- Una sola actividad a la vez: con una carrera sin terminar no se puede
  iniciar una rodada (y al revés); Inicio avisa cuál está pendiente.
