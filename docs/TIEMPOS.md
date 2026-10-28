# Medir tiempos (sección provisoria)

Pedido del dueño (2026-10-29): una sección "no muy bien hecha, ya que la
borraremos más adelante" para medir cuánto tarda cada día en:

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
- **Promedio final**: cada actividad cuenta hasta **30 registros** (uno por
  día). Al llegar a 30 se cierra: en días nuevos ya no aparece el campo,
  sino "✅ 30 de 30 · promedio final …". Los 30 que cuentan se pueden
  corregir. Si por dos aparatos sin conexión llegara un registro 31, no
  cuenta (se toman los 30 primeros por fecha).
- **Tus días**: lista del más nuevo al más viejo; tocar uno lo abre arriba.

Datos: `users/{uid}/tiempos/{AAAA-MM-DD}` (ver `docs/DATABASE.md`). Las
reglas de Firestore ya cubren `users/{uid}/**`: no hubo que tocar la consola.

## Archivos

| Archivo | Qué hace |
|---|---|
| `js/tiempos-motor.js` | UMD sin DOM: actividades, leer minutos/segundos, promedios por semana y mes, cierre a los 30. Pruebas: `tests/tiempos-motor.test.js` |
| `js/tiempos.js` | Pantalla (formulario, promedios, promedio final, tus días) y Firestore |
| `css/tiempos.css` | Estilos propios (clases `.tmp-`); reutiliza `.lib-input`, `.lib-btn`, `.bib-item`, `.fin-tabs` |
| `scripts/e2e/tiempos.js` | Prueba de pantalla (53 comprobaciones) |

## Cómo borrarla

1. Borrar los 6 archivos de arriba y este documento.
2. `index.html`: quitar la tarjeta `<a class="card" href="#tiempos">`, la
   `<section id="panel-tiempos">`, el `<link>` de `css/tiempos.css` y los
   dos `<script>` de `js/tiempos-motor.js` y `js/tiempos.js`.
3. `js/modules.js`: quitar `{ hash: "tiempos", parent: "inicio" }` de
   `SUB_PANELS` y `"tiempos"` de la lista del versículo en `showPanel()`.
4. `scripts/e2e/lectura.js` no depende de esta tarjeta.
5. Subir `?v=` de lo tocado y `npm run sw`.
6. Los datos (`users/{uid}/tiempos`) quedan en Firestore: borrarlos solo
   si el dueño lo pide (o exportarlos antes desde la consola).

## Cómo probar en el iPhone

1. Inicio › Medir tiempos (última tarjeta). Arriba no hay versículo.
2. Escribe los minutos (y segundos, si quieres) de **una sola** actividad
   y toca el **Guardar** de esa fila: sale "✓ Guardado" y, junto al nombre,
   "✓ 25 min". Las demás pueden quedar vacías. Más tarde, guarda otra.
3. Baja a **Promedios**: "Esta semana" con tus tiempos; toca **Mes** y las
   flechas ‹ › para ver otros meses.
4. **Promedio final**: cada actividad muestra "N de 30".
5. En **Tus días**, toca un día para corregirlo.
