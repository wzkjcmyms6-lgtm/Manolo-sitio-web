# Rendimiento y batería

- Hoy: todo el JS se carga al abrir (defer); `data/ejercicios.json` se pide
  tras iniciar sesión; Firestore con caché offline.
- Deporte: actualizar la pantalla a ~1 vez por segundo (no por cada punto),
  dibujar la ruta incremental, sin re-render completo.
- GPS de alta precisión y pantalla encendida son el mayor gasto de batería:
  solo durante la actividad, se liberan al pausar/terminar.
- Mapa: librería y teselas solo al abrir una vista con mapa (carga diferida).
- Persistencia local cada ~10 s, no en cada punto.
