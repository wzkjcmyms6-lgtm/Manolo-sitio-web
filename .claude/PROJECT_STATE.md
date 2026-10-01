# Estado del proyecto

Actualizado: 2026-10-01 (fin de fase 0).

- **App**: PWA estática + Firebase (Auth + Firestore), una sola página,
  JS puro sin build. Ver `docs/ARCHITECTURE.md`.
- **Funciona y se preserva**: Hábitos, Ejercicio (Feed, Entrenamiento con
  registro estilo apps de gimnasio, Rangos, Perfil con gráfico), Finanzas,
  Inversiones, offline.
- **No existe aún**: roles/admin, auditoría de accesos, notificaciones,
  GPS, voz, motor deportivo, rutinas de Running.
- **Running/Bicicleta**: registro manual simple (`running.js`,
  `bicicleta.js`).
- **Tests**: 175/175 (`npm test`).
- **Reglas de Firestore**: solo en la consola; referencia en
  `docs/feed-reglas.md`; los cambios de F1 están en `docs/ADMIN.md`.
- **Pendiente del dueño para F1**: decir qué usuario es el administrador,
  crear `admins/{uid}` y publicar las reglas nuevas (se le guiará paso a paso).
