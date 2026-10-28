# Inversiones

Sección para llevar el DCA mensual (núcleo QQQ, VOO, SCHD, VT, VIG, MSFT
y un satélite chico), con lo que cuesta llevar los Bs al broker.

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Datos y movimientos: compra, venta, dividendo, fondeo, depósito/retiro, interés, ronda DCA, editar, borrar, completar aportes viejos, ajustes | ✅ 2026-10-28 |
| 2 | Posiciones a costo promedio, precios diarios (`data/precios.json` con un workflow), precio a mano, valor y G/P de la cartera | ✅ 2026-10-28 |
| 3 | Gráficos: valor vs aportado, rendimiento en US$ y Bs (TCO y AirTM), distribución contra objetivo, aportes por mes, dividendos, comisiones; objetivos en Ajustes | ✅ 2026-10-28 |
| 4 | Indicador de la ronda del mes, exportar JSON y CSV | pendiente |

## Archivos

| Archivo | Qué hace |
|---|---|
| `js/inversiones-motor.js` | UMD sin DOM: leer documentos (viejos y nuevos), validar, fondeo, ronda DCA, resumen. Pruebas: `tests/inversiones-motor.test.js` |
| `js/inversiones.js` | Pantallas: pestañas Resumen · Posiciones · Movimientos · Gráficos · Ajustes, hojas de movimiento, ronda DCA y precio |
| `js/inversiones-series.js` | UMD sin DOM: serie diaria (valor y aportado), aportes por mes, distribución, TCO y tipo AirTM, rendimiento. Pruebas: `tests/inversiones-series.test.js` |
| `js/inversiones-graficos.js` | Dibujo SVG (líneas, columnas) sin DOM + "toca y desliza para leer". Pruebas: `tests/inversiones-graficos.test.js` |
| `css/inversiones.css` | Estilos propios (solo clases `.inv-`). Reutiliza `.fin-tabs` y `.budget-sheet` |
| `tests/inversiones-posiciones.test.js` | Pruebas de posiciones, precios y cartera |
| `tests/inversiones-dividendos.test.js` | Pruebas de la agenda y los avisos de dividendos |
| `scripts/e2e/inversiones.js` | Prueba de pantalla (118 comprobaciones, con precios, dividendos y tipo de cambio fijos de prueba) |
| `data/tickers.json` | Tickers con precio diario y desde qué fecha guardar historial |
| `scripts/precios.py` | Lee los cierres (sin claves) y actualiza `data/precios.json` |
| `.github/workflows/precios.yml` | Corre el script de lunes a viernes 21:40 y 23:40 UTC (17:40 y 19:40 en La Paz) y a mano |
| `data/precios.json` | Cierres diarios por ticker (lo escribe el bot `precios-bot`) |

No se tocan otras secciones, `style.css` ni `finanzas.css`. En `sw.js` el
único cambio a mano es que `data/precios.json` va primero a la red (con
copia para sin conexión), igual que `data/tipo-cambio.json`.

## Datos (Firestore, solo aditivo)

### `users/{uid}/inversiones/{id}`

**Registros viejos** (antes de esta versión): `{ date, name, amount, notes }`
con `amount` en US$. Se muestran como **Aporte** y **nunca se reescriben**:

- *Completar* (ticker, cantidad, precio) **agrega** `tipo: "compra"`,
  `ticker, cantidad, precio, comision, broker, fecha, nota` al mismo
  documento. `date`, `name`, `amount` y `notes` quedan igual.
- Editar un viejo ya completado también escribe solo esos campos nuevos;
  `fecha` y `nota`, si existen, mandan sobre `date` y `notes`.
- Un viejo no recibe `v`. Se reconoce por tener `amount` numérico y no `v`.

**Movimientos nuevos** (`v: 1`, `creado` en ms para ordenar el mismo día):

| `tipo` | Campos |
|---|---|
| `compra` / `venta` | `fecha, ticker, cantidad, precio, comision, broker, nota`, opcional `ronda: "AAAA-MM"` |
| `dividendo` | `fecha, ticker, monto` (lo recibido, en US$), `broker, nota` |
| `fondeo` | `fecha, bs, tasa` (Bs por US$), `usdEnviado, comisionAirtm, comisionTransferencia` (US$), `usd` (lo que llegó al broker), `broker, nota` |
| `efectivo` | `fecha, sentido: "deposito"\|"retiro", monto, broker, nota` |
| `interes` | `fecha, monto, broker, nota` |

Montos en US$. Lo calculado (monto de una compra, total con comisión) no se
guarda: sale de `cantidad × precio ± comision`.

### `users/{uid}/meta/inversiones_ajustes`

`{ v: 1, broker, comisionTicker, comisionAirtm, comisionTransferencia,
tasaEfectivo, objetivoSatelite, tickers: { QQQ: { grupo: "nucleo", dca,
objetivo, orden }, … }, preciosManuales: { NVDA: { precio, fecha }, … } }`.
Los precios manuales se guardan con `merge` y se quitan con
`FieldValue.delete()`; guardar Ajustes los conserva. Si no existe, se usan los de por defecto (D-044).
Un ticker que no está en `tickers` con `grupo: "nucleo"` es satélite.

## Precios (fase 2)

- **Fuente**: gráfico público de Yahoo Finance (verificado desde GitHub
  Actions el 2026-10-28, D-045); si falla, el CSV de Stooq. Sin claves y
  nada se pide desde el teléfono: la app solo lee `data/precios.json`.
- **Formato**: `{ fuente, actualizado, tickers: { QQQ: { fuente, ultimo:
  { fecha, cierre }, historial: { "AAAA-MM-DD": cierre } } } }`. Cierre
  normal en US$ (no ajustado por dividendos), desde `desde` de
  `data/tickers.json` (2026-09-01). Cada corrida repasa los últimos 10 días.
- Si Yahoo todavía no trae la barra del día, se usa su último precio
  cuando es de las 16:00 de Nueva York o después (cierre oficial).
- **Agregar un ticker** con precio diario: sumarlo a `data/tickers.json`
  (la próxima corrida trae su historial). Para uno que no está, la app
  deja poner el precio a mano y avisa que no se actualiza solo.
- **Precio que se usa**: el más reciente entre el diario y el manual (si
  son del mismo día, el diario). Si el diario tiene más de 4 días, avisa.
- **Sin conexión**: el service worker devuelve la última copia y, si no
  hay, se usa la guardada en el teléfono (`localStorage`).
- Riesgo conocido: un *split* cambiaría el precio sin cambiar tu cantidad
  registrada; habría que corregir las compras a mano.

## Cuentas

- **Aportado** = US$ que llegaron al broker (fondeos + depósitos − retiros).
  Si compraste más de lo que entró (compras sin fondeo anotado), esa
  diferencia también cuenta. Los aportes viejos sin completar suman su monto.
- **Efectivo en el broker** = entradas + ventas + dividendos + intereses −
  compras (nunca negativo). Interés estimado = efectivo × tasa anual / 12.
- **Comisiones** = de compras/ventas + AirTM + transferencia. El % es sobre
  lo que salió de tu bolsillo (aportado + comisiones de fondeo).
- **Fondeo**: con Bs y tipo de cambio se calcula US$ comprados; AirTM cobra
  su % sobre eso y la transferencia su % sobre lo que queda. Lo que escribes
  a mano manda (por ejemplo, el monto real que muestra Hapi).
- **Ronda DCA**: una compra por ticker del núcleo, misma fecha y broker,
  `ronda` = mes de la fecha. Cantidad = monto ÷ precio (6 decimales, hacia
  abajo), corregible. Filas vacías se saltan.
- Números: acepta coma o punto decimal; el punto también como miles al
  estilo boliviano ("8.020" = 8020). No se permiten fechas futuras.
- Vender más de lo registrado avisa pero deja guardar (puede faltar anotar
  compras viejas).
- **Posiciones** (costo promedio): cada compra suma cantidad y costo (con
  comisión); una venta saca costo en proporción a lo vendido y la
  diferencia con lo recibido es la ganancia realizada. Valor = cantidad ×
  precio; G/P = valor − invertido. Sin precio, cuenta a su costo (sin G/P).
  Peso = valor de cada una sobre el total.
- **Valor de la cartera** = posiciones + efectivo + aportes viejos sin
  completar (a su monto). **G/P** = valor − aportado.

## Dividendos: fechas y avisos (pedido 2026-10-28)

- **De dónde salen** (mismo workflow de precios, en `data/precios.json` bajo
  `dividendos`): historial de Yahoo (fecha ex y monto, 3 años), calendario
  de Yahoo y tabla de Nasdaq (fechas anunciadas, con pago). Verificado
  desde GitHub Actions (D-048): MSFT anunciado por las dos (ex 19 nov, pago
  10 dic 2026); los ETF anuncian pocos días antes, así que hasta entonces
  la próxima fecha se **estima** con el intervalo típico de los últimos
  pagos (y la demora típica del pago, si se conoce).
- **Formato**: `dividendos: { MSFT: { frecuencia, fuentes, historial: [{ ex,
  pago?, registro?, anuncio?, monto }], proximo: { ex, pago?, monto?,
  estimado, montoEstimado?, pagoEstimado? } } }`.
- **En la app** (Resumen): solo los tickers que tienes. Aviso desde 3 días
  antes hasta 3 días después de la fecha ex o del pago; explica que hay que
  tener la acción **antes** de la fecha ex; monto ≈ acciones que tenías
  antes de la fecha ex × último monto (bruto, antes de la retención de EE.
  UU.). Después del pago, botón "Anotar dividendo" (ticker, fecha y monto
  ya puestos); cuando lo anotas, el aviso se va. Tarjeta "Próximos
  dividendos" con fechas anunciadas o estimadas.
- No se tocó Finanzas (fuera del alcance de esta tarea).

## Gráficos (fase 3)

| Tarjeta | Qué muestra | Forma |
|---|---|---|
| Valor vs aportado | Valor de la cartera y lo aportado, día por día desde el primer movimiento | 2 líneas (aportado en escalones, gris de contexto) |
| Rendimiento | Valor − aportado en US$, en Bs al TCO del BCB y en Bs al tipo de AirTM; por ticker en US$ y tabla con las 3 monedas | 3 cifras + barras a ambos lados de cero |
| Distribución | Núcleo vs satélite y cada ticker contra su % objetivo | barra apilada + barras con raya de objetivo |
| Aportes por mes | Lo que subió lo aportado cada mes, con la ronda DCA como línea | columnas |
| Dividendos acumulados | Total cobrado en el tiempo y por ticker | línea en escalones |
| Comisiones | Total y % de lo que pusiste; broker, AirTM y transferencia | cifras |

- **Valor de cada día**: posiciones a su cierre de ese día (o el manual si
  ya existía; sin precio, a su costo) + efectivo + aportes viejos. El último
  día coincide con "Valor de tu cartera" (probado).
- **Bs al TCO del BCB** (`data/tipo-cambio.json`): lo aportado se convierte
  al TCO del día en que entró; el valor de hoy, al TCO de hoy. Antes del
  inicio del historial se usa el primer TCO guardado.
- **Bs al tipo de AirTM**: los fondeos con Bs cuentan sus Bs exactos (con
  comisiones incluidas); lo aportado sin Bs se convierte al promedio de Bs
  por US$ que llegó al broker hasta esa fecha. El valor de hoy se convierte
  al tipo de cambio de tu último fondeo.
- **Por ticker**: G/P abierta + ganancia realizada + dividendos, con el
  mismo criterio de tasas; el % es sobre todo lo que se puso en ese ticker.
- **Objetivos**: % por ticker del núcleo y uno para todo el satélite, en
  Ajustes (avisa si no suman 100 %). De fábrica: 15,83 % × 6 y 5 %.
- **Diseño** (guía de visualización): marcas finas (líneas de 2 px,
  columnas de hasta 24 px con punta redondeada), rejilla de 1 px, el texto
  nunca va del color de la serie, leyenda cuando hay 2 o más series y
  "Ver tabla" con los mismos números. Colores validados sobre el fondo
  oscuro `#161616` (franja de luminosidad, daltonismo, contraste):
  principal `#e8651f`, satélite `#3987e5`, ganancia `#2fa37a`, pérdida
  `#e2593f` (siempre con signo + / −), contexto gris `#9a978f`.
- **Toca y desliza** sobre una línea o columna para ver el día o mes; con
  teclado, flechas izquierda/derecha. Los gráficos se dibujan al ancho real
  y se rehacen si cambia (girar el teléfono, ventana de la compu).

## Cómo probar en el iPhone (fase 3)

1. Inversiones ya no muestra la frase de la Biblia arriba.
2. Pestaña Gráficos (desliza la barra de pestañas si no la ves).
3. En "Valor vs aportado", apoya el dedo y deslízalo: aparece el día con
   valor, aportado y ganancia.
4. Rendimiento: revisa las tres cifras (US$, Bs BCB, Bs AirTM) y abre
   "Ver tabla".
5. Ajustes: cambia el objetivo de un ticker, mira el aviso de la suma y
   guarda; en Gráficos › Distribución la raya blanca se mueve.

## Cómo probar en el iPhone (fase 2)

1. Inversiones › Resumen: arriba dice "Valor de tu cartera" con la
   ganancia o pérdida en verde o rojo y "Precios al cierre del …".
2. Pestaña Posiciones: una tarjeta por ticker con cantidad, costo
   promedio, valor, G/P y peso. Los aportes sin completar van aparte.
3. Toca un ticker del núcleo: muestra su precio diario.
4. Anota una compra de un ticker que no esté en la lista (por ejemplo
   NVDA): sale "Sin precio diario"; tócalo, pon un precio y guarda.
5. Con modo avión, abre Manolo: las posiciones siguen con sus valores.

## Cómo probar en el iPhone (fase 1)

1. Abre Manolo › Inversiones. Arriba: Resumen · Movimientos · Ajustes.
2. Si tenías aportes viejos, verás "Tienes N aportes anteriores": toca
   *Completar aportes*, elige uno, escribe el precio y revisa la cantidad.
   *Guardar como compra*. El cuadro "Registro original" no cambia.
3. *＋ Movimiento* › Fondeo: Bs enviados y tipo de cambio; mira las
   comisiones calculadas y corrige "US$ que llegaron al broker" si Hapi dice
   otro número.
4. *Ronda DCA*: escribe el precio de cada ticker y guarda. Vuelve a abrirla:
   debe avisar que ya hay ronda este mes.
5. Toca un movimiento para editarlo o eliminarlo. Prueba poner una fecha
   del mes pasado.
6. En Ajustes cambia el broker a IBKR y guarda: los movimientos nuevos lo
   usan.
7. Con datos móviles apagados, anota algo: debe aparecer igual y subirse
   al volver la conexión.
