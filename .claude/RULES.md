# Reglas de trabajo en MANOLO

- Dueño: Juan, no programa. Hablarle en **español simple y corto**; decidir
  lo técnico y documentarlo; preguntar solo lo bloqueante o de aspecto/uso.
  Decirle siempre cómo probar en el iPhone.
- **Leer primero** este archivo, `PROJECT_STATE.md`, `CURRENT_PHASE.md` y
  los docs del tema. No re-auditar todo el repo; búsquedas dirigidas.
- Preservar Ejercicio, Finanzas y Hábitos. Esquema de datos **solo aditivo**;
  nunca borrar ni reescribir datos del usuario.
- Strava es solo referencia de UX: no copiar textos, marca ni diseño.
- No inventar capacidades del dispositivo (ver `docs/GPS.md`). El GPS se
  retiró a pedido del dueño (D-033): no volver a agregarlo sin que lo pida.
- Tras cambiar cualquier archivo que carga `index.html`: subir `?v=` del
  archivo y correr `npm run sw` (si no, falla `tests/sw-version.test.js`).
- Lógica nueva en módulos UMD sin DOM con pruebas `node --test`.
- Antes de subir: `npm test` verde, revisar el diff, `git pull --rebase`
  (otras sesiones y un bot suben a la misma rama), luego
  `git push -u origin claude/responsive-website-de4hi0`.
- Commits terminan con las líneas `Co-Authored-By` / `Claude-Session` que
  indica la sesión. Sin identificadores de modelo en el repo. No abrir PRs
  salvo pedido.
- No enviar el correo del dueño a servicios externos.
- Checkpoint al cerrar cada fase con el formato del prompt maestro (§43).
