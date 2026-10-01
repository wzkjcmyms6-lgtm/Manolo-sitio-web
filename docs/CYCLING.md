# Bicicleta

Desde 2026-10-01 (D-033) Bicicleta **no usa GPS**. La página tiene:

1. **Resumen semanal**: igual que Running (`docs/RUNNING.md`): semana
   elegida con Distancia y Tiempo y gráfico de las últimas 12 semanas.
2. **Registrar rodada** a mano (desplegable): fecha, km, minutos, RPE,
   notas.
3. **Tus rodadas**: historial por meses con la velocidad media (km/h); cada
   una se puede eliminar (las viejas con GPS borran también su recorrido).

Código: `js/bicicleta.js` (configuración) + `js/actividad-registro.js`
(común con Running). Datos en `users/{uid}/bicicleta`, como siempre.

Historia: fases 5–7 tuvieron rodada con GPS (velocidad en vivo, parciales de
5 km, mapa, marcas); retirada en D-033.
