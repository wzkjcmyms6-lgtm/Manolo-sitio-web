# Running

> **Plan 2026-11 · Running al nivel de Strava** (D-060 a D-069). Se hace por
> fases (estado en `.claude/CURRENT_PHASE.md`). Lo de abajo de "Lo que ya
> existe" sigue funcionando igual.

## Diseño (fase 0)

### Navegación (D-061)
Barra inferior propia: **Actividades · Progreso · (+) · Segmentos ·
Rutinas**; engranaje arriba → Ajustes de Running. El "+" abre una hoja con
**Importar** · **Anotar a mano** · **Rutina guiada**.

```text
┌ ← Inicio      Running            ⚙ ┐
│ [Todas] [Con ruta] [Rutinas] [Mes ▾]│
│ ┌──────────────────────────────────┐│
│ │ Carrera por la mañana            ││
│ │ mar 4 nov · 06:42 · Sopocachi    ││
│ │ Distancia   Ritmo      Tiempo    ││
│ │ 10,02 km    5:32 /km   55:29     ││
│ │ ╭─────── trazo SVG ───────╮      ││
│ │ 🏅 2 mejores marcas · Rutina     ││
│ └──────────────────────────────────┘│
├─────────────────────────────────────┤
│ Actividades  Progreso (+) Segmentos Rutinas │
└─────────────────────────────────────┘
```

### Detalle de una actividad (`#run-actividad/{id}`)
```text
← Carrera por la mañana                ⋯ (Editar · GPX · Compartir · Eliminar)
[ mapa: inicio ● fin ■, cursor del gráfico ]
mar 4 nov 2026 · 06:42 · Sopocachi, La Paz · ☁ 9 °C
Distancia 10,02 km │ Ritmo 5:32 /km │ En movimiento 55:29
Desnivel 123 m     │ Tiempo total 58:10 │ Calorías 640
FC media 152       │ Cadencia 172     │ Carga 78
Resumen inteligente: 2–4 frases con datos reales.
[ gráfico Ritmo / Altura / FC; cursor sincronizado con el mapa;
  intervalos de la rutina sombreados ]
Parciales  Km │ Ritmo │ ▬▬▬ │ Desn. │ FC   (más rápido y más lento marcados)
Vueltas del reloj · Zonas de FC · Mejores marcas · Segmentos
Clima · Zapatillas · RPE · Notas · Mismo recorrido (n veces)
```

### Progreso (`#run-progreso`)
```text
Esta semana 24,3 km · 2:15 h · 3 carreras   (semana pasada 18,1 km)
[Semana │ Mes │ Año │ Total]  totales vs período anterior
Últimas 12 semanas (el resumen semanal de siempre, D-035)
Diario: calendario del mes con círculos según km
Mejores marcas: 1 km · 5K · 10K · 21K… top 3 y su evolución
Predicciones 5K · 10K · 21K · 42K (o "Faltan datos")
Forma y fatiga: estado físico (42 d), fatiga (7 d), forma
Metas semana/mes/año con anillos · racha de semanas
Zapatillas (km, aviso de cambio, retirar) · Mapa de calor
```

### Importar (`+` → Importar)
1. Elegir archivos (GPX, TCX, FIT, `.gz`, el ZIP de Strava o de Apple Salud;
   el selector no filtra para que el iPhone no los deje en gris).
2. Vista previa: cuántas, fechas, km, deporte (cambiable si no se sabe),
   duplicadas (se saltan), a fusionar con una rutina o carrera a mano,
   errores en español simple.
3. Guardar con barra de avance; después, en segundo plano, clima y lugar.
4. "Cómo traer mis carreras": pasos para pedir el archivo a Strava (web:
   Ajustes → Mi cuenta → descargar o eliminar la cuenta → solicitar el
   archivo; llega un correo con el ZIP), a Apple Salud (perfil → Exportar
   todos los datos de salud) y a otras apps (exportar GPX).

### Módulos
| Archivo | Qué hace |
|---|---|
| `js/run-formatos.js` | Lee GPX, TCX y FIT (y gzip) → actividad normalizada |
| `js/run-zip.js` | Lee ZIP por partes (directorio central, ZIP64) |
| `js/run-csv.js` | `activities.csv` del export (columnas repetidas, UTC) |
| `js/run-metricas.js` | Limpieza, tiempos, desnivel, parciales, GAP, mejores marcas, zonas, carga, mini ruta |
| `js/run-guardar.js` | Documento + ruta, duplicados, fusión, lotes |
| `js/run-importar.js` | Pantalla de importación (vista previa, avance) |
| `js/run-analisis.js` | Progreso: períodos, calendario, predicciones, forma y fatiga, metas, racha, zapatillas |
| `js/run-detalle.js`, `js/run-feed.js`, `js/run-mapa.js` | Pantallas |

Todo lo que no es pantalla es UMD sin DOM con pruebas `node --test`.
Esquema en `docs/DATABASE.md`.

### Hecho en la fase 1 (2026-11-04)
- Botón **Importar** en la cabecera de Running (hasta que llegue la barra
  propia en la fase 3) → hoja `#ri-hoja` (`js/run-importar.js`,
  `css/run.css`).
- ZIP de Strava: la vista previa sale de `activities.csv`; al guardar se lee
  cada archivo. Si un archivo falta o no se puede leer, se guarda con los
  datos del CSV y se avisa. Título y descripción del CSV.
- Otros ZIP (Apple Salud, adidas Running u otros): se leen los GPX/TCX/FIT
  que traigan. Si el archivo no dice el deporte, se adivina por la
  velocidad (> 6,5 m/s bici, ≥ 1,9 m/s carrera; más lento queda como "No
  importar") y se puede cambiar en la vista previa.
- FC máx para zonas y carga: la de Ajustes (fase 4); mientras no exista, la
  más alta vista hasta ahora (≥ 150), como estimación.
- Clima y lugar: al guardar y cada vez que llega la lista de carreras, para
  las importadas que no los tienen (una vez por sesión, máx. 60 por vez).

### Hecho en la fase 2 (2026-11-04)
- `#run-actividad/{running|bicicleta}/{id}` (`js/run-detalle.js`): se abre
  tocando una actividad del historial. Lee el documento (escucha) y la ruta
  (`rutas/{id}`, una vez; se guardan las 3 últimas en memoria).
- Módulos sin pantalla: `js/run-vista.js` (formatos es-BO, trazo SVG, GPX),
  `js/run-graficos.js` (perfil, cursor, parciales, zonas),
  `js/run-analisis.js` (logros). Pantalla: `js/run-mapa.js` (Leaflet) y
  `js/run-datos.js` (listas y ajustes compartidos, sin lecturas extra).
- Decisión D-070.

### Hecho en la fase 3 (2026-11-04)
- Barra propia y pestañas (D-071). `js/run-feed.js`: feed, filtros, carga
  de a 20, tarjeta de Inicio, hoja del "+" (`#run-mas-hoja`), hoja de
  anotar a mano (`#run-manual-hoja`, el formulario `#running-form` de
  siempre) y la sugerencia de estirar.
- `ActividadRegistro` sigue guardando y dibujando el resumen semanal; si no
  hay lista (Running), solo avisa los datos al feed.

### Hecho en la fase 4 (2026-11-04)
- Progreso (`#run-progreso`, `js/run-progreso.js`) y Ajustes
  (`#run-ajustes`, `js/run-ajustes.js`, engranaje arriba y en las pills de
  la computadora). D-072. El mapa de calor va con los segmentos (fase 6).

### Hecho en la fase 5 (2026-11-04)
- `js/run-inteligencia.js` (sin pantalla): `mismoRecorrido` y `resumen`
  (D-073). En el detalle, debajo de las cifras y antes del perfil; se
  actualiza cuando llega la lista de carreras sin redibujar el mapa.

### Hecho en la fase 6 (2026-11-04)
- `js/run-segmentos.js` (lógica), `js/run-segmentos-ui.js` (lista,
  `#run-segmento/{id}`, hoja de crear, búsqueda), `js/run-calor.js`
  (`#run-calor`). `RunDatos.segmentos()` escucha `run_segmentos`. D-074,
  D-075.

### Hecho en la fase 7 (2026-11-04)
- `js/run-compartir.js`: `plan()` (sin pantalla), `dibujar()`, `compartir()`.
  Botón "Compartir" en el detalle y en el menú ⋯. D-076. Publicar en el
  Feed de Ejercicio espera el OK del dueño.

### Hecho en la fase 8 (2026-11-04)
- "Exportar todo (ZIP)" en Ajustes de Running (`RunZip.crearZip`). QA en
  `scripts/e2e/run-qa.js`. D-077. **El plan está completo**; falta validar
  con el export real del dueño.

---

## Lo que ya existe (desde 2026-10-01)

Desde 2026-10-01 (D-033) Running **no usa GPS**. La página tiene, de arriba
abajo:

1. **Resumen semanal** (`js/actividad-registro.js` + `js/actividad-analisis.js`,
   común con Bici): la semana elegida (lunes a domingo) con **Distancia** y
   **Tiempo**, y "Últimas 12 semanas" en un gráfico de línea. Tocar un punto
   (o pasar el mouse, o flechas con el teclado) elige esa semana; tocar
   Distancia o Tiempo cambia lo que dibuja el gráfico. Sin desnivel (D-035).
   Suma todo: anotado a mano, rutinas guiadas y carreras viejas con GPS.
2. **Rutinas guiadas** (`js/rutina-guiada.js`): la lista es una **cola**; la
   de arriba dice "Siguiente". Importar CSV/Excel de uno o varios días
   (`docs/CSV_ROUTINES.md`), plantilla de 3 días, eliminar (un día o el plan
   entero). Al **completar** una rutina pasa al final de la lista (D-034,
   D-036).
3. **Registrar carrera** a mano (desplegable): fecha, km, minutos, RPE, notas.
4. **Tus carreras**: historial por meses; cada una se puede eliminar. Las
   hechas con rutina muestran la etiqueta "Rutina" y su nombre
   ("Plan 5K · Día 2"), aunque la rutina ya no exista.

## Pantalla de la rutina
- Antes de empezar: intervalo inicial, lista de intervalos, Cancelar /
  Iniciar. Pantalla completa (sin barras de la app).
- En curso: tarjeta del intervalo (color por tipo, tiempo restante grande,
  descripción, barra, siguiente, "Intervalo N de M"), Tiempo y Quedan, la
  lista con lo hecho atenuado y el actual resaltado; Sonido y Voz apagables
  (se recuerdan).
- Avisos (`js/avisos.js`): cuenta 3-2-1 con pitidos (Web Audio) y, en cada
  cambio y al terminar, aviso grande + voz del sistema (`speechSynthesis`,
  sin nube). Se habilitan con el toque de Iniciar/Reanudar. Pantalla
  encendida con Wake Lock mientras corre.
- Pausar / Reanudar / Finalizar. Al terminar el último intervalo dice
  "Rutina terminada. ¡Buen trabajo!" y pasa solo al resumen.
- Si la app estuvo congelada (pantalla bloqueada), al volver no recita
  avisos viejos: dice "Ahora: …" (motor `js/intervalos-motor.js`).
- Recuperación: el estado se guarda en el teléfono
  (`manolo.rutina.{uid}`) cada 10 s, al pausar y al salir; si Manolo se
  cierra, vuelve **en pausa** y Inicio avisa "Tienes una rutina sin terminar".

## Resumen y guardado
"¡Rutina completada!" o "Rutina terminada" (si se finalizó antes), tiempo e
intervalos hechos; **km opcionales** (si los mediste con otro reloj o app),
RPE y notas. Guardar escribe en `users/{uid}/running` (con `fuente:"rutina"`,
ver `docs/DATABASE.md`) y, si se completó, en el mismo lote mueve la rutina
al final de la cola. "Volver a la rutina" solo si no se completó.

## Límites del iPhone
Ver `docs/GPS.md` (ahora: audio, voz y segundo plano): con el teléfono
bloqueado la app se congela y los avisos no suenan; al volver, el tiempo es
correcto porque se calcula con marcas de tiempo.

## Historia
Fases 3–7 tuvieron carrera con GPS (mapa, parciales, ritmo en vivo, marcas).
Se retiró a pedido del dueño (D-033); el código queda en el historial de git
(commit `a66de91` y anteriores).
