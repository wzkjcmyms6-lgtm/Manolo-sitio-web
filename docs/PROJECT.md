# MANOLO — Proyecto

Panel personal (PWA) de **Hábitos, Ejercicio, Finanzas e Inversiones**, más
Running y Bicicleta. Lo usa su dueño (Juan) y algunos usuarios más, sobre
todo en **iPhone, instalada en la pantalla de inicio** (modo standalone).

- Repositorio público, rama de trabajo `claude/responsive-website-de4hi0`,
  publicada con **GitHub Pages** (sitio estático).
- Datos en **Firebase** (Auth + Firestore) del proyecto `manolo-4c57b`.
- Sin servidor propio, sin build, sin dependencias npm de producción.

## Mapa de documentación

| Tema | Archivo |
|---|---|
| Requisitos del prompt maestro (fases 0–8) | `docs/REQUIREMENTS.md` |
| Arquitectura actual y propuesta | `docs/ARCHITECTURE.md` |
| Modelo de datos Firestore | `docs/DATABASE.md` |
| Lógica deportiva (rutinas, resumen semanal; GPS retirado) | `docs/SPORTS.md` · `docs/GPS.md` · `docs/RUNNING.md` · `docs/CYCLING.md` |
| Running / Bicicleta | `docs/RUNNING.md` · `docs/CYCLING.md` |
| Rutinas de Running por CSV | `docs/CSV_ROUTINES.md` |
| Notificaciones y administrador | `docs/NOTIFICATIONS.md` · `docs/ADMIN.md` |
| Pruebas | `docs/TESTING.md` |
| Rendimiento y costos | `docs/PERFORMANCE.md` · `docs/COST_OPTIMIZATION.md` |
| Decisiones y cambios | `docs/DECISIONS.md` · `docs/CHANGELOG.md` |
| Módulos ya documentados | `docs/mapa-muscular.md` (Ejercicio), `docs/rangos.md`, `docs/feed-reglas.md` (reglas Firestore actuales) |
| Reglas de Firestore (copia de referencia) | `firestore.rules` |
| Pruebas de pantalla | `scripts/e2e/` |
| Estado para el agente | `.claude/PROJECT_STATE.md` · `.claude/CURRENT_PHASE.md` · `.claude/RULES.md` |
