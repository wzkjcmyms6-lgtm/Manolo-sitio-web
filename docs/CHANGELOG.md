# Cambios

## 2026-10-01 · Fase 1 (login, hábitos, accesos)
- Login: contraseña con teclado numérico, botón "Usar teclado de letras"
  (se recuerda), botón ver/ocultar; campos a 16 px.
- Hábitos: nota/descripción opcional (crear, editar, vaciar), una línea en
  la lista de Hoy y completa en el detalle. Hábitos viejos intactos.
- Accesos: evento único por inicio de sesión real, campana y bandeja del
  administrador en tiempo real (leído / no leído, marcar todo, historial
  de 50 en 50, aviso flotante). `firestore.rules` versionado.
- Pruebas: +6 unitarias (181) y `scripts/e2e/` (fase1: 39 comprobaciones;
  regresión de 15 pantallas).

## 2026-10-01 · Fase 0 (auditoría)
- Documentación persistente creada (`docs/*.md`, `.claude/*.md`). Sin
  cambios en la app.

## 2026-10-01 · Antes del prompt maestro
- Ejercicio › Perfil con cabecera y gráfico semanal estilo apps de gimnasio.
- Ejercicio › registro de entreno estilo apps de gimnasio (✓ por serie,
  Anterior, descanso, deslizar para borrar) y espacio bajo la barra inferior.
- Mapa muscular, Rangos, Feed, rutinas, importador: ver `docs/mapa-muscular.md`
  y el historial de git.
