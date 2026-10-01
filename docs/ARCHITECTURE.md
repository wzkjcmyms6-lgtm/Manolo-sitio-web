# Arquitectura

## Estado actual (auditoría fase 0, 1 oct 2026)

**Tipo de app:** sitio estático + **PWA** (manifest `display: standalone`,
`sw.js` con caché offline). No es app nativa ni híbrida. En iPhone corre
dentro de WebKit (Safari / pantalla de inicio).

| Capa | Implementación |
|---|---|
| Lenguaje | HTML + CSS + JavaScript puro (ES2018+, sin build, sin TypeScript) |
| Página | **Una sola página** `index.html` (~1.200 líneas); `habitos.html`, `ejercicio.html`, `finanzas.html`, `inversiones.html` solo redirigen a `index.html#…` |
| Navegación | `js/modules.js`: lista `MODULES` + `SUB_PANELS`; cambiar de sección = cambiar el `#hash` y mostrar/ocultar `<section id="panel-…">`. Barra inferior con pestañas propias por módulo (Hábitos, Finanzas, Ejercicio) |
| Estilos | `css/style.css` (general + Ejercicio), `css/habitos.css`, `css/finanzas.css`, `css/fuentes.css` (DM Sans, Fraunces locales). Tema oscuro; móvil ≤768 px |
| Backend | **No hay servidor propio.** Firebase compat 10.7.1 **vendorizado** en `vendor/firebase-10.7.1/` (app, auth, firestore). No se usan Functions, Messaging ni Storage |
| Auth | `js/auth.js`: usuario + contraseña → `usuario@manolo-panel.local` → `signInWithEmailAndPassword`. Persistencia LOCAL. Las cuentas se crean en la consola de Firebase (no hay registro en la app) |
| Datos | Firestore con `enablePersistence` (caché offline y cola de escrituras). Datos privados en `users/{uid}/…`; colección compartida `feed` |
| Autorización | **Solo reglas de Firestore**, publicadas a mano en la consola (texto de referencia en `docs/feed-reglas.md`; no hay `firestore.rules` en el repo) |
| Offline | `sw.js` (precaché con `VERSION`/`HUELLA` generadas por `npm run sw`), `js/offline.js` (aviso de versión nueva, "Sin conexión", almacenamiento persistente) |
| Tests | `npm test` = `node --test` (175 pruebas, módulos UMD sin DOM). Sin pruebas E2E en el repo |
| Despliegue | GitHub Pages desde la rama. Workflow `tipo-cambio.yml` (cron) actualiza el tipo de cambio BCB |
| Patrón de módulos | IIFE por pantalla + módulos de lógica pura **UMD** (navegador y Node) probados con `node --test` |

### Módulos

- **Hábitos** — `habitos.js` (pantallas, Firestore) + `habitos-engine.js`
  (rachas, XP, estados) + `habitos-config.js`. Colección
  `users/{uid}/habitos`, `meta/habitos_juego`, `meta/habitos_dias`.
- **Ejercicio** — Feed (`ej-social.js`, `ej-vistas.js`), Entrenamiento
  (`gimnasio.js`, `entreno-series.js`, `rutinas*.js`, `importar-*.js`,
  `progresion.js`), mapa muscular (`muscle-engine.js`, `body-*.js`), Rangos
  (`rangos*.js`), Perfil (`perfil-ejercicio.js`, `ej-vistas.js`). Ver
  `docs/mapa-muscular.md`.
- **Finanzas / Inversiones** — `js/finanzas/*.js` (app.js ~5.250 líneas),
  `inversiones.js`.
- **Running / Bicicleta** — `running.js`, `bicicleta.js`: formulario manual
  (fecha, km, minutos, RPE, notas) y lista. Son sub-paneles de **Inicio**
  (tarjetas en `#inicio`) y hoy muestran el banner de versículo.

### Usuarios, roles, notificaciones, dispositivo

- **Roles:** no existen. Todos los usuarios son iguales; no hay concepto de
  administrador en código ni en reglas.
- **Notificaciones / auditoría de accesos:** no existen (ni push, ni FCM,
  ni registro de logins).
- **APIs del dispositivo en uso:** Web Audio (sonidos de Hábitos),
  `navigator.vibrate` (sin efecto en iPhone). **No** se usa Geolocation,
  Speech Synthesis, Wake Lock ni Notification.

## Riesgos y deuda técnica relevante

1. **Reglas fuera del repo**: la seguridad real vive en la consola; riesgo
   de desincronización. Propuesta: versionar `firestore.rules` como
   referencia y pedir al dueño que publique cada cambio.
2. **Sin servidor**: todo evento "de servidor" (login, notificación) debe
   apoyarse en reglas de Firestore o en Cloud Functions (plan Blaze, costo).
3. **Página única grande**: todo el JS se carga al abrir (defer). Para el
   módulo deportivo conviene cargar el mapa solo cuando se usa.
4. **Listeners de colecciones completas** (`onSnapshot` sin límite): bien
   con pocos datos; con rutas GPS dentro de cada documento crecería el
   tráfico → guardar rutas aparte (ver `docs/DATABASE.md`).
5. **README desactualizado** (menciona archivos que ya no existen).
6. **Varias sesiones/bots escriben en la misma rama** → siempre
   `git pull --rebase` antes de subir.
7. **PWA en iOS**: sin GPS ni temporizadores en segundo plano (ver
   `docs/GPS.md`).

## Seguridad y privacidad (revisión fase 7)

- Autorización: todo en reglas (`firestore.rules`); datos privados aislados
  por usuario (`users/{uid}/**`); accesos y admins protegidos (ver
  `docs/ADMIN.md`).
- Textos del usuario (notas, nombres de rutinas, descripciones de hábitos,
  nombres en accesos) se escapan antes de mostrarse; se revisaron todas las
  plantillas nuevas.
- CSV/Excel: límites de tamaño y filas; un archivo con errores no se guarda.
  Riesgo menor conocido: un .xlsx de 1 MB muy comprimido podría ocupar mucha
  memoria al abrirse (lector compartido con el importador del gimnasio).
- Ubicación: las rutas solo se guardan en tu carpeta; al ver un mapa, el
  servidor de teselas de OpenStreetMap recibe qué zona se mira (como
  cualquier mapa web). Sin conexión se usa el trazo propio.
- Sin secretos en el código ni en los logs (la configuración de Firebase no
  es secreta).

## Oportunidades de reutilización

| Necesidad nueva | Se reutiliza |
|---|---|
| Recuperar actividad tras cierre | patrón *borrador* de `gimnasio.js` (localStorage + reanudar) |
| Cuenta regresiva / barra flotante | barra de descanso de `gimnasio.js` |
| CSV de rutinas | `EjImportar.leerCsv` (y `leerXlsx`) de `js/importar-rutinas.js`, hoja de vista previa de `importar-ui.js` |
| Sonidos | tonos Web Audio de `habitos.js` |
| Gráficos semanales | `EjSesiones.porSemana` / `escalaY` y el gráfico de Perfil |
| Hojas, pestañas, tarjetas | `budget-sheet`, `fin-tabs`, `stat-box`, tarjetas de sesión |
| Ocultar el versículo | `showPanel()` en `modules.js` |

## Arquitectura deportiva (✅ = hecho)

```text
js/actividad-motor.js   ✅ (UMD, sin DOM)  estados, tiempos, distancia, filtros GPS, parciales
js/intervalos-motor.js  ✅ (UMD, sin DOM)  rutina por intervalos basada en timestamps
js/actividad-vista.js   ✅ (UMD, sin DOM)  formatos, calorías estimadas, trazo SVG
js/actividad-gps.js     ✅ (DOM)           watchPosition, permisos, wake lock
js/actividad-ui.js      ✅ (DOM)           inicio / en vivo / resumen, guardado, recuperación, mapa Leaflet
js/actividad-registro.js ✅ (DOM)          lista por meses, totales, "Tu progreso" y registro a mano (común)
js/actividad-analisis.js ✅ (UMD, sin DOM)  ritmo/velocidad y altitud por distancia, semanas, tendencia, marcas
js/running.js ✅ · js/bicicleta.js ✅     solo configuración de cada deporte
js/avisos.js            ✅ (DOM)           pitidos (Web Audio) + voz (speechSynthesis), preferencias
js/rutina-running.js    ✅ (UMD, sin DOM)  lectura y validación de rutinas CSV/Excel
js/rutinas-running-ui.js ✅ (DOM)          importar, vista previa, guardar y listar rutinas
js/accesos.js           ✅ (DOM)           evento de login y bandeja del administrador
vendor/leaflet-1.9.4/   ✅                  mapa, cargado solo en el resumen
```
