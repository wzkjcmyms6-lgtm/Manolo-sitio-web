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
- **Línea base** (hasta la fase 6 se llamaba "Promedio final"): los
  primeros **30 registros** de cada actividad (uno por día, por fecha) dan
  su línea base ("✅ Línea base: 25 min"). Hasta la fase 5 la actividad se
  cerraba ahí; **desde la fase 6 se sigue midiendo** (la línea base no
  cambia; los promedios por semana, mes y día usan todos los registros).
  Para comparar un cambio en tu rutina contra ella: **Experimentos** (fase
  7).
- **Tus días**: lista del más nuevo al más viejo; tocar uno lo abre arriba.
  Cada día muestra su **total** (la suma de todo lo anotado ese día) y,
  arriba de la lista, cuántos **días registrados** hay y **tu día en
  promedio** (el promedio de esos totales). En **Promedios**, la última fila
  "Tu día (todo junto)" da el promedio de los totales de esa semana o mes.
  Pedido del dueño 2026-10-30 ("que se registren los días y se haga un
  promedio de los días"); se calcula, no se guarda nada nuevo. Muestra los
  90 días más nuevos; "Ver 90 días más" trae los anteriores (QA final,
  D-115: con años de datos, pintarlos todos era lento).

Datos (detalle en `docs/DATABASE.md`):
- `users/{uid}/tiempos/{AAAA-MM-DD}`: `fecha`, `seg: { actividad: segundos }`,
  `actualizado`; desde la fase 6 también `auto` (llegó solo) y `noAuto` (lo
  quitaste: no vuelve). Tus días de siempre quedaron tal cual.
- `users/{uid}/meta/tiempos_ajustes`: `actividades` (fase 6), `plan` y
  `experimentos` (fase 7).
- En el teléfono (`localStorage`): `manolo.tiempos.medir` y
  `manolo.tiempos.manana` (el cronómetro y "Mi mañana" en curso; así siguen
  aunque cierres la app).

Las reglas de Firestore ya cubren `users/{uid}/**`: no hubo que tocar la
consola.

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
- **Exportar** (abajo): JSON (actividades y días; desde el QA final
  también el plan de la mañana y los experimentos) y CSV para Excel
  (separado con ";", decimales con coma, con la columna "automatico").

## Fase 7 (2026-11-15, D-114): plan, estadísticas, línea base y experimentos

- **Plan de la mañana** (arriba): pones a qué hora te levantas y a qué hora
  tienes que estar listo. Con la mediana de tus últimos 30 registros de cada
  paso arma la línea de tiempo del día que elijas (Lu…Do: los pasos que
  sueles hacer ese día). Dice si te sobra o te falta tiempo, dónde se te va
  más y dónde podrías ahorrar.
- **Mi mañana contra tu plan**: en vivo "vas 4 min atrasado / adelantado / a
  tiempo"; al final, "Terminaste a las 7:52: 8 min antes de tu hora".
- **Estadísticas** (después de Promedios): por actividad, promedio,
  mediana, mejor y peor, tendencia (últimos 30 días contra los 30
  anteriores), lunes a viernes contra fin de semana; y el total de tu mañana
  por día (barras).
- **Línea base** (antes "Promedio final"): tus primeros 30 registros.
- **Experimentos**: "¿Qué cambiaste?" desde un día; sus 30 registros se
  comparan con la línea base (− = más rápido). "Terminarlo hoy" o "Quitar".
- **Mi día** (Inicio): tu mañana (en curso, lista o "Empieza tu mañana"),
  el libro que lees y el repaso de hoy; como mucho 5 filas.
- **Hábitos**: "Se marca solo" › "Medir tiempos": un hábito Sí/No o Tiempo
  se llena con una actividad (o todo el día). Así un paso de tu mañana marca
  su hábito al cerrarlo.

## QA final (fase 8, 2026-11-15, D-115)

- Con tus días guardados como antes, usar todo lo nuevo (Mi mañana, se
  llena sola, plan, experimento) no cambia ni un dato de tus días de antes:
  lo comprueba `scripts/e2e/lectura-qa.js` documento por documento.
- Con 3 años de datos, Medir tiempos y «Mi mañana» abren rápido (menos de
  0,1 s en la prueba); a 320 px nada se mueve de lado.
- Arreglado en el QA: las estadísticas calculaban fechas dentro del bucle
  de cada registro (≈ 160 ms con 3 años; ahora ≈ 5 ms, mismos números);
  "Tus días" pintaba todos los días en cada cambio (ahora los 90 más nuevos
  y "Ver 90 días más"); y «Exportar (JSON)» no llevaba el plan ni los
  experimentos (ahora sí).
- **Queda opcional (espera tu OK)**: que suene un pitido o una voz cuando un
  paso de "Mi mañana" pasa tu promedio. Hoy el reloj se pone naranja.

## Archivos

| Archivo | Qué hace |
|---|---|
| `js/tiempos-motor.js` | UMD sin DOM: leer minutos/segundos, promedios por semana, mes y día, línea base (primeros 30), tu promedio (últimos 30); con tus actividades. Pruebas: `tests/tiempos-motor.test.js` |
| `js/tiempos-actividades.js` | UMD: tus actividades (las 6 de siempre y las tuyas), validar, ordenar, archivar, de dónde se llenan solas. Pruebas: `tests/tiempos-actividades.test.js` |
| `js/tiempos-crono.js` | UMD: cronómetro por marcas de tiempo y "Mi mañana" (siguiente, pausar, saltar, terminar, resumen). Pruebas: `tests/tiempos-crono.test.js` |
| `js/tiempos-auto.js` | UMD: qué se llena solo (Running, Ejercicio, Libros, Movilidad) con las reglas de Hábitos. Pruebas: `tests/tiempos-auto.test.js` |
| `js/tiempos.js` | Pantalla (anotar, promedios, línea base, tus días, exportar), Firestore y `window.TiemposDatos` para las otras piezas |
| `js/tiempos-manana.js` | "Mi mañana" y "⏱ Medir" (hojas, reloj, pantalla encendida) |
| `js/tiempos-actividades-ui.js` | Hoja "Tus actividades" |
| `js/tiempos-llenar.js` | Escucha a Running, Ejercicio, Libros y Movilidad y escribe lo automático |
| `js/tiempos-plan.js` | UMD: plan de la mañana (medianas, pasos de cada día, sobra o falta, contra tu plan). Pruebas: `tests/tiempos-plan.test.js` |
| `js/tiempos-stats.js` | UMD: estadísticas, línea base y experimentos. Pruebas: `tests/tiempos-stats.test.js` |
| `js/tiempos-plan-ui.js` | Sección "Plan de la mañana" |
| `js/tiempos-stats-ui.js` | Secciones "Estadísticas" y "Experimentos" |
| `css/tiempos.css` | Estilos propios (clases `.tmp-`, `.tman-`, `.tact-`, `.tpl-`, `.tst-`, `.tex-`); reutiliza `.lib-input`, `.lib-btn`, `.bib-item`, `.fin-tabs` |
| `scripts/e2e/tiempos.js` (+ `tiempos-n2.js`) | Prueba de pantalla (`SOLO=fase6` o `SOLO=fase7` corre solo lo de esa fase) |
| `scripts/e2e/lectura-qa.js` | QA final (D-115): tus días de siempre idénticos después de usar todo lo nuevo, 3 años de datos y 320 px |

## Cómo probar en el iPhone

1. Inicio › Medir tiempos (última tarjeta). Arriba no hay versículo.
2. Escribe los minutos (y segundos, si quieres) de **una sola** actividad
   y toca el **Guardar** de esa fila: sale "✓ Guardado" y, junto al nombre,
   "✓ 25 min". Las demás pueden quedar vacías. Más tarde, guarda otra.
3. Baja a **Promedios**: "Esta semana" con tus tiempos; toca **Mes** y las
   flechas ‹ › para ver otros meses.
4. **Línea base**: cada actividad muestra "N de 30" hasta juntar sus
   primeros 30; después, "✅ Línea base".
5. En **Tus días**, toca un día para corregirlo.
6. (Fase 6) Arriba, **▶ Empezar mi mañana**: haz tu rutina con "Siguiente";
   al final mira el resumen contra tu promedio.
7. Toca **⏱ Medir** en una actividad, bloquea el teléfono un rato y vuelve:
   el reloj siguió. "Terminar y guardar".
8. **⚙️ Tus actividades**: crea una (por ejemplo "Orar" 🙏), súbela con ↑ y
   mírala en "Mi mañana".
9. Corre o entrena con Manolo: en Medir tiempos, Correr o Ejercicio de ese
   día aparecen solos con "⚡".
10. (Fase 7) **Plan de la mañana**: pon a qué hora te levantas y a qué hora
    tienes que estar listo; mira si te sobra tiempo y toca otro día (Sá).
11. **🧪 Experimentos › ＋ Nuevo**: "Dejo la ropa lista la noche anterior".
    En unas semanas verás si tu mañana bajó.
