# Fase actual

**Fase 3 — Running básico: COMPLETADA** (2026-10-01). Pendiente: prueba
real del dueño en su iPhone (carrera corta al aire libre).

## Fase 4 — Running avanzado (siguiente, espera OK)
1. Rutinas por CSV: formato final (`docs/CSV_ROUTINES.md`), parser con
   `EjImportar.leerCsv`, validación y errores por fila, vista previa,
   plantilla, guardar en `users/{uid}/rutinas_running`.
2. Elegir rutina en el inicio de Running → carrera con rutina:
   `IntervalosMotor` junto al motor de actividad (separados), pantalla con
   intervalo actual, siguiente, restante y progreso.
3. `js/avisos.js`: cuenta 3-2-1 en pantalla + pitidos (Web Audio), voz
   local (`speechSynthesis`) en cambios y fin; desbloqueo con el toque de
   Iniciar; prueba en el iPhone (modo silencio, música).
4. Recuperación de la rutina con la carrera (mismo guardado local).
5. Guardar con `rutina: { id, nombre }` e intervalos completados.
