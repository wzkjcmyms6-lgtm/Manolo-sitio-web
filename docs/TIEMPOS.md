# Medir tiempos

Empezó provisoria (pedido del dueño 2026-10-29: "no muy bien hecha, ya que
la borraremos más adelante"); desde la **fase 6 de "Libros, Biblia y Medir
tiempos: siguiente nivel" (2026-11-15, D-113) es definitiva**. Tus datos de
siempre (`users/{uid}/tiempos`) quedaron tal cual. Mide cuánto tardas cada
día en tus actividades; las 6 de siempre conservan su id:

| id | Actividad |
|---|---|
| `manana` | Rutina de la mañana: levantarse, lavarse los dientes, scalping, rezar, decretar y tender la cama |
| `ejercicio` | Ejercicio |
| `correr` | Correr |
| `desayunar` | Desayunar |
| `banarse` | Bañarse y alistarse |
| `leer` | Leer 30 páginas |

## Cómo funciona

- Tarjeta **Medir tiempos** en Inicio (después de Biblia). Sub-panel de
  `inicio` (`#tiempos`), con "‹ Inicio" para volver y sin versículo.
- **Anotar tiempos**: el día (hoy por defecto; se puede elegir uno pasado,
  nunca futuro) y, por actividad, minutos y segundos (teclado numérico).
  **Cada actividad tiene su propio botón Guardar** (2026-10-29: no todos los
  días se hace todo): se guarda solo esa, las demás quedan vacías o como
  estaban, y lo escrito en otras filas no se pierde. Lo guardado muestra
  "✓ 25 min", el botón pasa a "Cambiar" y aparece "Quitar de este día"
  (pide confirmar; si no queda ninguna actividad, se borra el día). La
  tecla "Ir" del teclado guarda esa fila.
- **Promedios**: por semana (lunes a domingo, como el resto de Manolo) o
  por mes, con flechas para ver las anteriores. Columna "Días" = cuántos
  registros entraron en el promedio. La semana o el mes en curso dicen que
  el promedio todavía se está armando.
- **Por día** (tercera pestaña de Promedios; pedido del dueño 2026-11-06:
  "que tome un promedio de lo registrado en lunes y así"): siete barras de
  lunes a domingo con tu día todo junto en promedio (todos tus lunes, todos
  tus martes…); al tocar un día (o con ‹ ›) la tabla muestra el promedio de
  cada actividad en ese día de la semana y cuántos días entran. Abajo, cuál
  es tu día más largo y el más corto. Usa todo lo registrado; no guarda
  nada nuevo (`TiemposMotor.porDiaSemana`).
- **Promedio final**: los primeros **30 registros** de cada actividad (uno
  por día, por fecha) dan su promedio final ("✅ 30 de 30 · promedio final
  …"). Hasta la fase 5 la actividad se cerraba ahí; **desde la fase 6 se
  sigue midiendo** (el promedio final no cambia; los promedios por semana,
  mes y día usan todos los registros). En la fase 7 pasa a llamarse "Línea
  base" y se suman los experimentos.
- **Tus días**: lista del más nuevo al más viejo; tocar uno lo abre arriba.
  Cada día muestra su **total** (la suma de todo lo anotado ese día) y,
  arriba de la lista, cuántos **días registrados** hay y **tu día en
  promedio** (el promedio de esos totales). En **Promedios**, la última fila
  "Tu día (todo junto)" da el promedio de los totales de esa semana o mes.
  Pedido del dueño 2026-10-30 ("que se registren los días y se haga un
  promedio de los días"); se calcula, no se guarda nada nuevo.

Datos: `users/{uid}/tiempos/{AAAA-MM-DD}` (ver `docs/DATABASE.md`). Las
reglas de Firestore ya cubren `users/{uid}/**`: no hubo que tocar la consola.

## Fase 6 (2026-11-15, D-113): definitiva

- **Tus actividades** (⚙️ en "Anotar tiempos"): crear (con emoji),
  renombrar, ordenar con ↑ ↓ (ese es el orden de "Mi mañana"), sacar o poner
  en la mañana, elegir de dónde se llena sola y archivar (sus tiempos
  quedan; "Volver a usar" la trae). Las 6 de siempre conservan su id.
- **⏱ Medir** (en cada actividad): cronómetro grande por marcas de tiempo
  (sigue bien si el iPhone se bloquea o cierras la app; la pantalla no se
  apaga mientras mides). Al terminar guarda los segundos en el día; si ya
  había un tiempo, eliges **reemplazar** o **sumar**.
- **Mi mañana** (arriba): tus pasos en tu orden. "Siguiente" cierra un paso
  (y lo anota) y abre el otro; "Pausar", "Saltar (hoy no)" y "Terminar la
  mañana aquí". En vivo ves tu promedio y cuánto te queda; si te pasas, el
  reloj se pone naranja. Al final, el resumen: cada paso y el total contra
  tu promedio (el de tus últimos 30 registros, sin contar el día que mides).
  Si cierras la hoja, la tarjeta dice en qué paso vas.
- **Se llena sola**: Correr con tus carreras (Running), Ejercicio con tus
  entrenos, Leer con los minutos de «Leer ahora» (Libros); Movilidad, para
  la actividad que elijas. Mismas reglas que "se marca solo" de Hábitos:
  lo que anotas a mano manda; si quitas un tiempo que llegó solo, no vuelve
  ese día; si la carrera desaparece, el tiempo automático también (solo con
  datos del servidor); y solo desde el día en que empezó a llenarse sola
  (tus días de antes no cambian). En la fila se ve "⚡ de Running".
- **Exportar** (abajo): JSON (actividades y días) y CSV para Excel
  (separado con ";", decimales con coma, con la columna "automatico").

## Archivos

| Archivo | Qué hace |
|---|---|
| `js/tiempos-motor.js` | UMD sin DOM: leer minutos/segundos, promedios por semana, mes y día, promedio final (primeros 30), tu promedio (últimos 30); con tus actividades. Pruebas: `tests/tiempos-motor.test.js` |
| `js/tiempos-actividades.js` | UMD: tus actividades (las 6 de siempre y las tuyas), validar, ordenar, archivar, de dónde se llenan solas. Pruebas: `tests/tiempos-actividades.test.js` |
| `js/tiempos-crono.js` | UMD: cronómetro por marcas de tiempo y "Mi mañana" (siguiente, pausar, saltar, terminar, resumen). Pruebas: `tests/tiempos-crono.test.js` |
| `js/tiempos-auto.js` | UMD: qué se llena solo (Running, Ejercicio, Libros, Movilidad) con las reglas de Hábitos. Pruebas: `tests/tiempos-auto.test.js` |
| `js/tiempos.js` | Pantalla (anotar, promedios, promedio final, tus días, exportar), Firestore y `window.TiemposDatos` para las otras piezas |
| `js/tiempos-manana.js` | "Mi mañana" y "⏱ Medir" (hojas, reloj, pantalla encendida) |
| `js/tiempos-actividades-ui.js` | Hoja "Tus actividades" |
| `js/tiempos-llenar.js` | Escucha a Running, Ejercicio, Libros y Movilidad y escribe lo automático |
| `css/tiempos.css` | Estilos propios (clases `.tmp-`, `.tman-`, `.tact-`); reutiliza `.lib-input`, `.lib-btn`, `.bib-item`, `.fin-tabs` |
| `scripts/e2e/tiempos.js` (+ `tiempos-n2.js`) | Prueba de pantalla (`SOLO=fase6` corre solo lo de la fase 6) |

## Cómo probar en el iPhone

1. Inicio › Medir tiempos (última tarjeta). Arriba no hay versículo.
2. Escribe los minutos (y segundos, si quieres) de **una sola** actividad
   y toca el **Guardar** de esa fila: sale "✓ Guardado" y, junto al nombre,
   "✓ 25 min". Las demás pueden quedar vacías. Más tarde, guarda otra.
3. Baja a **Promedios**: "Esta semana" con tus tiempos; toca **Mes** y las
   flechas ‹ › para ver otros meses.
4. **Promedio final**: cada actividad muestra "N de 30".
5. En **Tus días**, toca un día para corregirlo.
6. (Fase 6) Arriba, **▶ Empezar mi mañana**: haz tu rutina con "Siguiente";
   al final mira el resumen contra tu promedio.
7. Toca **⏱ Medir** en una actividad, bloquea el teléfono un rato y vuelve:
   el reloj siguió. "Terminar y guardar".
8. **⚙️ Tus actividades**: crea una (por ejemplo "Orar" 🙏), súbela con ↑ y
   mírala en "Mi mañana".
9. Corre o entrena con Manolo: en Medir tiempos, Correr o Ejercicio de ese
   día aparecen solos con "⚡".
