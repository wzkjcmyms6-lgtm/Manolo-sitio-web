# Finanzas

Notas de diseño de Finanzas que no están en otro lado. El código vive en
`js/finanzas/` (pantallas en `app.js`; lógica sin pantalla en `datos.js`,
`presupuesto.js`, `tarjetas.js`, `analisis.js` y `diario.js`). Los datos, en
`users/{uid}/finanzas`, `ahorros`, `carteras_movimientos` y `meta/…` (ver
`docs/DATABASE.md`).

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
