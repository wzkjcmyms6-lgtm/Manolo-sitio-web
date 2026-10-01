# Fase actual

**Fase 0 — Auditoría: COMPLETADA** (2026-10-01). Esperando OK del dueño
para empezar la Fase 1.

## Fase 1 — Login + Hábitos + Auditoría de acceso (siguiente)
1. Contraseña: `inputmode="numeric"`, botón ABC/123, mostrar/ocultar (D-005).
2. Hábitos: campo `descripcion` opcional en crear/editar y visible en la
   tarjeta/detalle; `leerCampos()` debe aceptar `textarea`.
3. `js/accesos.js`: evento de login idempotente (D-002), campana y
   bandeja del admin con `onSnapshot` + `limit(50)` (D-004).
4. `firestore.rules` de referencia en el repo (D-011) + guía para publicar.
5. Pruebas: módulo puro para la clave del evento y validaciones; E2E con el
   doble de Firebase; regresión.

Bloqueante solo para el punto 3 en producción: admin definido y reglas
publicadas por el dueño. Lo demás se puede implementar y probar antes.
