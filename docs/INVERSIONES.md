# Inversiones

Sección para llevar el DCA mensual (núcleo QQQ, VOO, SCHD, VT, VIG, MSFT
y un satélite chico), con lo que cuesta llevar los Bs al broker.

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Datos y movimientos: compra, venta, dividendo, fondeo, depósito/retiro, interés, ronda DCA, editar, borrar, completar aportes viejos, ajustes | ✅ 2026-10-28 |
| 2 | Posiciones a costo promedio, precios diarios (`data/precios.json` con un workflow), precio a mano, valor y G/P de la cartera | ✅ 2026-10-28 |
| 3 | Gráficos | pendiente |
| 4 | Indicador de la ronda del mes, exportar JSON y CSV | pendiente |

## Archivos

| Archivo | Qué hace |
|---|---|
| `js/inversiones-motor.js` | UMD sin DOM: leer documentos (viejos y nuevos), validar, fondeo, ronda DCA, resumen. Pruebas: `tests/inversiones-motor.test.js` |
| `js/inversiones.js` | Pantallas: pestañas Resumen · Posiciones · Movimientos · Ajustes, hojas de movimiento, ronda DCA y precio |
| `css/inversiones.css` | Estilos propios (solo clases `.inv-`). Reutiliza `.fin-tabs` y `.budget-sheet` |
| `tests/inversiones-posiciones.test.js` | Pruebas de posiciones, precios y cartera |
| `scripts/e2e/inversiones.js` | Prueba de pantalla (88 comprobaciones, con precios fijos de prueba) |
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
