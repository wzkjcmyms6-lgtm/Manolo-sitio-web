# Fase actual

**Fase 4 — Running avanzado: COMPLETADA** (2026-10-01). Pendiente: prueba
real del dueño (rutina corta con música y con el teléfono en silencio).

## Fase 5 — Bicicleta (siguiente, espera OK)
1. `bicicleta.js` como `running.js`: `ActividadUI.crear({ deporte:
   "bicicleta", panel: "bicicleta", coleccion: "bicicleta", nombre:
   "rodada", titulo: "Bicicleta" })` — velocidad como métrica principal,
   parciales de 5 km, sin calorías (D-016).
2. Panel: quitar versículo, inicio, lista "Tus rodadas" (abrir/eliminar GPS),
   registro a mano en desplegable, aviso en Inicio de rodada sin terminar.
3. Una sola actividad a la vez entre Running y Bici (ya contemplado).
4. Pruebas E2E `fase5.js` (velocidad, parciales, guardar) + regresión.
