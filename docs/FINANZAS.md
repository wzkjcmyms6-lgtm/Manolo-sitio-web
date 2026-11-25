# Finanzas

Notas de diseño de Finanzas que no están en otro lado. El código vive en
`js/finanzas/` (pantallas en `app.js`; lógica sin pantalla en `datos.js`,
`presupuesto.js`, `tarjetas.js`, `analisis.js` y `diario.js`). Los datos, en
`users/{uid}/finanzas`, `ahorros`, `carteras_movimientos` y `meta/…` (ver
`docs/DATABASE.md`).

## Seguros y mantenimiento de las tarjetas (2026-11-25, D-165)

Reemplaza al pago mínimo (D-121): el dueño paga siempre todo, para no pagar
intereses.

- **Dónde:** Finanzas › Tarjetas de crédito › editar una tarjeta ›
  "Seguros y mantenimiento · cada mes". Una fila por cargo (qué es y cuánto
  por mes; hasta 6) y en qué categoría se anotan como gasto. Si la tarjeta
  tenía un pago mínimo de antes, el formulario avisa que ya no se usa.
- **Lo que pagas antes del día de pago** (`aPagar`):
  - Todo lo que debes + los cargos de este ciclo que todavía no se anotaron.
    El ciclo va del día de pago anterior (sin incluirlo) al próximo.
  - Un saldo a favor se descuenta; sin gastos, igual se pagan los cargos.
  - Si en este ciclo un pago dejó la deuda en cero, la tarjeta está **al
    día**: lo que gastes después va al pago siguiente.
- **Al pagar** (la transferencia a la tarjeta, desde "Pagar todo" o a mano):
  la fila "Sumar seguros y mantenimiento" (prendida) anota cada cargo como
  gasto de la tarjeta (`cargoCiclo`, `cargoId`), un instante antes del pago.
  Apagarla baja el monto sugerido. No se anotan dos veces en un ciclo.
- **En pantalla:**
  - "Para no pagar intereses: Bs X", cuándo vence y de qué sale (lo que
    gastaste + seguros y mantenimiento).
  - Rojo y "Urgente" hoy o mañana; ámbar y "Pronto" a 7 días o menos; con
    ícono y texto.
  - "Pagar todo (Bs X)". Al día: "Este mes ya pagaste todo", en verde.
- **También aparece en:** Movimientos (la fila de cada tarjeta), el Resumen
  ("Atención"), Análisis › "Próximos 30 días" y "Mi día" de Inicio (vence en
  3 días o menos).
- **Día de corte (D-166, opcional):** el extracto que pagas el día de pago
  cierra el último día de corte antes de ese día. Con corte, pagas lo del
  extracto (lo que debías al corte + seguros − lo pagado después del corte);
  lo que gastes después va al pago siguiente. Si el corte no llegó, cuenta
  hasta hoy. Los seguros se anotan con la fecha del corte.
- **De qué sale (D-166):** al tocar una tarjeta (o su fila en Movimientos),
  una hoja con los gastos, los seguros y el mantenimiento, el saldo de antes
  ("Extracto anterior" con corte), "Ya pagaste" y el total; aparte, lo que va
  al pago siguiente. Es la misma cuenta que el monto de la tarjeta
  (`cuenta`).
- **Lógica:** `js/finanzas/tarjetas.js` (`cargosPendientes`, `cargosDelPago`,
  `gastosDeCargos`, `categoriaCargos`, `corteDe`, `cuenta`, `aPagar`). Pruebas:
  `tests/finanzas-tarjetas.test.js` y `scripts/e2e/tarjetas-cargos.js`.

## Avance de efectivo (2026-11-25, D-167)

- **El %:** en cada tarjeta (Editar › "Avance de efectivo · comisión (%)").
- **Registrarlo:** en un gasto nuevo con una tarjeta, "¿Sacaste plata con la
  tarjeta? Es un avance de efectivo"; en Transferencia, "Desde" una tarjeta;
  o el botón "Avance de efectivo" de la tarjeta. Va a Efectivo o Débito.
- **Cuentas:** es una transferencia desde la tarjeta (`from: "tarjeta"`): la
  cartera sube lo sacado y la tarjeta debe lo mismo; no es ingreso ni gasto.
  La comisión (`round(monto × % / 100)`) es un gasto de la tarjeta, unido al
  avance (se borran juntos). En la tarjeta debes lo sacado + la comisión.
- **Se ve en:** la lista de Movimientos, lo que pagas de la tarjeta y su
  detalle ("Avances de efectivo").
- **Lógica:** `js/finanzas/tarjetas.js` (`comisionAvance`, `gastoComision`,
  `esAvance`, `efectoDeuda`) y `js/finanzas/datos.js` (`saldos`). Pruebas:
  `tests/finanzas-tarjetas.test.js` y `scripts/e2e/tarjetas-avance.js`.

## Disponible por día (2026-11-15, D-116)

Pedido del dueño: "el monto diario sale del presupuesto que escribo, no de lo
que realmente recibí. Si pongo presupuesto 5000 me dice ~170 por día, pero si
solo registré 3000 de ingresos reales debe decir 100 por día."

**Antes**: cada ingreso contaba lo mayor entre lo presupuestado y lo
recibido (el sueldo "contaba" antes de llegar), y además se descontaban por
adelantado los ahorros y gastos fijos presupuestados.

**Ahora** (`js/finanzas/diario.js`, función pura en centavos, con pruebas en
`tests/finanzas-diario.test.js`):

| Dato | Cómo se calcula |
|---|---|
| Ingresos del mes | La suma de los ingresos **registrados** en el mes (todas las categorías) |
| Gastos del mes | La suma de los gastos del mes |
| Días del mes | Los días reales del periodo (28 a 31) |
| Días que faltan | Desde hoy hasta el último día, **contando hoy** (el último día queda 1: nunca se divide entre cero) |
| **Disponible por día** (el número grande) | Ingresos ÷ días del mes |
| Te queda por día desde hoy | (Ingresos − gastos) ÷ días que faltan |
| Recibido vs. presupuestado | Ingresos ÷ lo presupuestado de ingresos (la meta) |

- **Estado** (color + ícono + texto): verde "Vas bien" si te queda por día
  igual o más que el disponible; ámbar "Vas gastando más rápido de lo
  ideal" si te queda menos; rojo "Gastaste más de lo que entró" si lo que
  te queda es negativo; "Mes cerrado" al mirar un mes que ya terminó.
- **Sin ingresos este mes**: mensaje claro y botón "Registrar ingreso" (abre
  la hoja de siempre ya en Ingreso). Nunca un número inventado.
- **ⓘ ¿Cómo se calcula?**: la fórmula con tus números de este mes.
- El "mes" es el **periodo del presupuesto**: empieza el día 1 salvo que lo
  cambies en Herramientas › Periodo del presupuesto (entonces va, por
  ejemplo, del 25 al 24).
- No cuentan las transferencias, los pagos de tarjeta ni lo marcado
  "Excluido del presupuesto". Los montos se redondean hacia abajo al
  centavo (nunca promete más de lo que hay) y se muestran como en el resto
  de la app (`Bs 1.234,5`). La fecha es la del teléfono.
- **Dónde se ve**: Resumen (la tarjeta de arriba), Presupuesto (el anillo
  "Restante para gastar" = ingresos − gastos, y la línea "Disponible … · te
  queda … por día"), Información (Presupuesto diario) y "Mi día" en Inicio
  ("Para gastar hoy" = lo que te queda por día; sin ingresos no aparece).
  Todo se recalcula al instante al agregar, editar o borrar un movimiento.
- **No cambió**: la "Proyección" de Información (un estimado que sí usa lo
  presupuestado) ni nada de cómo se guardan los datos.
- Prueba de pantalla: `scripts/e2e/finanzas-diario.js` (375 y 1280 px).
