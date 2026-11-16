# Bicicleta

> **Plan 2026-11 · Bici al nivel de Running** (D-136; pedido del dueño
> 2026-11-16, junto con "Tu semana" y "Tu año", ver `docs/RESUMENES.md`).
> Terminado (fases 5 a 8, D-141 a D-144); estado en
> `.claude/CURRENT_PHASE.md`. Lo de abajo de "Lo que ya existe" es lo de
> antes y sigue funcionando donde no se reemplazó.

## Auditoría (fase 0)

Bici ya comparte mucho con Running (`docs/RUNNING.md`):
- **Importar** (GPX, TCX, FIT, ZIP de Strava): las rodadas se reconocen por
  el deporte del archivo o por la velocidad y se guardan en `bicicleta/` con
  su recorrido en `rutas/` (`js/run-guardar.js`).
- **Detalle** `#run-actividad/bicicleta/{id}`: mapa, velocidad (km/h),
  perfil, parciales, editar, GPX y compartir ya funcionan con bici.
- **Exportar todo (ZIP)** ya incluye las rodadas.

Lo que faltaba (todo estaba hecho solo para Running):
- La página de Bici es la de siempre (resumen semanal, anotar a mano,
  lista simple): sin tarjetas con mapa, sin filtros, sin barra propia.
- En el detalle de una rodada, el "Resumen inteligente" y "Mismo recorrido"
  comparan contra las **carreras**; no hay récords de bici.
- Progreso, metas, racha, mapa de calor y segmentos solo miran Running.
- Las mejores marcas guardadas son de distancias de correr (400 m a 50K).
- No hay "tus bicis" (como las zapatillas) ni mantenimiento.

## Diseño

### Navegación
Barra propia como Running: **Actividades · Progreso · (+) · Segmentos ·
Bicis**; el "+" abre **Importar** · **Anotar a mano**. Engranaje arriba →
Ajustes de Bici (metas).

### Fase 5 · Actividades
- Tarjetas como las de Running: título, fecha, hora y lugar, **Distancia ·
  Velocidad · Tiempo** (y desnivel si lo hay), trazo del recorrido, medallas
  de récords de bici; separadores por mes; de a 20.
- Filtros: Todas · Con mapa · A mano · Largas (≥ 50 km).
- Tarjeta de Bici en Inicio (km de la semana y la última rodada).
- Detalle: "Resumen inteligente" y "Mismo recorrido" contra tus rodadas;
  medallas con los récords de bici.

### Fase 6 · Progreso
- Esta semana / mes / año / total contra el período anterior; las últimas
  12 semanas (el resumen semanal de siempre); calendario del mes.
- **Récords de bici**: la más larga, la de más desnivel, la más rápida (≥ 20
  km), velocidad máxima y **mejores tiempos** en 5, 10, 20, 30, 40, 50, 80,
  100 y 160 km. Se calculan una vez por rodada con su recorrido y se
  guardan (`mejoresBici`), así no se vuelve a bajar nada.
- **Número de Eddington**: el número E más grande con E días de al menos E
  km (y cuánto falta para el siguiente).
- Metas de km (semana, mes, año) con anillos; racha de semanas; forma y
  fatiga (la misma carga que Running).
- Mapa de calor de tus rodadas.

### Fase 7 · Tus bicis, mantenimiento y segmentos
- **Tus bicis** (como las zapatillas): nombre, tipo (ruta, montaña, urbana,
  gravel, fija), km iniciales, la predeterminada para lo que importes,
  cambiarla en cada rodada, retirar.
- **Mantenimiento** por bici: cadena (cada 3.000 km), cubiertas (4.000 km),
  pastillas de freno (2.000 km) y service general (cada 6 meses o 5.000
  km), con aviso "Toca cambiar la cadena: 3.120 km" y "Hecho hoy" (vuelve
  a contar desde ahí). Los intervalos se pueden cambiar.
- **Segmentos de bici** (los de Running ya guardan el deporte) y compartir
  la rodada (imagen tipo historia, ya existe).

### Hecho en la fase 5 (D-141)
`js/bici-analisis.js` (velocidad, filtros, récords y medallas, resumen
inteligente, Inicio) y `js/bici-feed.js` (Actividades, "+", Inicio); en
`js/run-metricas.js`, `DISTANCIAS_BICI` y `mejoresBici` al importar; en
`js/run-detalle.js`, lo de bici contra tus rodadas; barra propia en
`js/modules.js`; estilos en `css/bici.css`.

### Hecho en la fase 6 (D-142)
`js/bici-progreso.js` (Progreso y completar los récords con las rutas),
`js/bici-ajustes.js` (metas); en `js/bici-analisis.js`, `evolucion`,
`mejoresDeRuta` y `sinRecords`; en `js/run-datos.js`, `ajustesBici()`
(`meta/bici_ajustes`); `js/run-calor.js` con el mapa de calor de Bici.

### Hecho en la fase 7 (D-143)
`js/bici-bicis.js` (tus bicis y su mantenimiento); en `js/bici-analisis.js`,
`bicis`, `mantenimiento`, `avisos`; la bici en Editar e Importar
(`js/run-detalle.js`, `js/run-importar.js`, `js/run-guardar.js`) y al
anotar a mano (`js/actividad-registro.js` con `extra`); segmentos de bici en
`js/run-segmentos.js` y `js/run-segmentos-ui.js`.

### Control final (D-144)
Al importar, cada actividad nueva se compara con los segmentos de su
deporte: las rodadas con los de bici y las carreras con los de Running
(`js/run-importar.js`; antes solo las carreras).

### Datos (solo se suman campos)
- `users/{uid}/bicicleta/{id}`: `mejoresBici` ({ "5000": segundos, … }),
  `biciId` (la bici con la que saliste). Las rodadas a mano siguen igual.
- `users/{uid}/meta/bici_ajustes`: `metas` ({ semanaKm, mesKm, anioKm }),
  `bicis` ([{ id, nombre, tipo, kmInicial, predeterminada, retirada }]),
  `mantenimiento` ({ biciId: { pieza: { cadaKm, cadaDias, desdeKm,
  desde (fecha) } } }).
- `users/{uid}/run_segmentos/{id}.deporte` ya existe ("running"); los de
  bici llevan "bicicleta".

---

## Lo que ya existe (desde 2026-10-01)

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
