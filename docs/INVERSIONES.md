# Inversiones

Sección para llevar el DCA mensual (núcleo QQQ, VOO, SCHD, VT, VIG, MSFT
y un satélite chico), con lo que cuesta llevar los Bs al broker.

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Datos y movimientos: compra, venta, dividendo, fondeo, depósito/retiro, interés, ronda DCA, editar, borrar, completar aportes viejos, ajustes | ✅ 2026-10-28 |
| 2 | Posiciones y precios diarios (`data/precios.json` con un workflow) | pendiente |
| 3 | Gráficos | pendiente |
| 4 | Indicador de la ronda del mes, exportar JSON y CSV | pendiente |

## Archivos

| Archivo | Qué hace |
|---|---|
| `js/inversiones-motor.js` | UMD sin DOM: leer documentos (viejos y nuevos), validar, fondeo, ronda DCA, resumen. Pruebas: `tests/inversiones-motor.test.js` |
| `js/inversiones.js` | Pantallas: pestañas Resumen · Movimientos · Ajustes, hoja de movimiento, hoja de ronda DCA |
| `css/inversiones.css` | Estilos propios (solo clases `.inv-`). Reutiliza `.fin-tabs` y `.budget-sheet` |
| `scripts/e2e/inversiones.js` | Prueba de pantalla de la fase (67 comprobaciones) |

No se tocan otras secciones, `style.css` ni `finanzas.css`.

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
objetivo, orden }, … } }`. Si no existe, se usan los de por defecto (D-044).
Un ticker que no está en `tickers` con `grupo: "nucleo"` es satélite.

## Cuentas (fase 1)

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
  estilo venezolano ("8.020" = 8020). No se permiten fechas futuras.
- Vender más de lo registrado avisa pero deja guardar (puede faltar anotar
  compras viejas).

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
