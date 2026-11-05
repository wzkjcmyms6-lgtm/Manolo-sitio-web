# Notificaciones (implementado en fase 1)

Antes de la fase 1 no existía ningún sistema de notificaciones (ni push,
ni FCM, ni bandeja interna). Ahora: `js/accesos.js` + `js/accesos-logica.js`. Tampoco hay WebSocket/SSE propios; lo que sí hay es el
canal en tiempo real de Firestore (`onSnapshot`), que ya usa toda la app.

## Propuesta

```text
Login real (Firebase Auth)
  → accesos/{uid}_{loginMs} (una vez por inicio de sesión; id determinista)
  → reglas: solo el admin puede leer / marcar leído
  → app del admin: onSnapshot(accesos, orderBy creado desc, limit 50)
  → campana con contador de no leídos + historial
```

- **Tiempo real sin polling**: el listener de Firestore empuja los
  cambios mientras MANOLO está abierta. Al abrir la app se sincroniza.
- **Sin push con la app cerrada** por ahora: necesitaría un servidor que
  envíe (Cloud Functions + FCM, plan Blaze con facturación) y en iPhone
  solo funciona con la app instalada (iOS 16.4+). Queda como evolución.
- **Sin índices compuestos**: se ordena por `creado` y el filtro de no
  leídos se hace en el teléfono sobre esos 50.
- **Contenido**: "Nuevo inicio de sesión · Lentina ingresó a MANOLO ·
  30/09/2026 22:15". Nunca contraseñas, tokens ni correos internos.

## Recordatorios de hábitos (investigación, 2026-11-05 — sin implementar)
Pedido: avisos de hábitos pendientes. **Hecho (fase 7):** dentro de Manolo,
Inicio y Hoy dicen "Te faltan 2 de la mañana" y cada hábito puede tener
hora. Lo de abajo **espera el OK del dueño**.

### 1. Push real con la app cerrada (Web Push)
- **Cómo**: el service worker recibe `push` y muestra la notificación; un
  servidor la manda a la hora de cada hábito. En Firebase: Cloud Functions
  programadas (Cloud Scheduler) + Firebase Cloud Messaging, o Web Push con
  claves VAPID desde una función.
- **iPhone**: solo con Manolo instalado en la pantalla de inicio (iOS 16.4
  o más) y después de que el dueño acepte el permiso desde un botón (no se
  puede pedir solo).
- **Pros**: avisos de verdad, aunque Manolo esté cerrado; se pueden saltar
  los hábitos ya hechos (la función lee Firestore).
- **Contras**: hay que pasar Firebase al plan **Blaze** (con tarjeta), escribir
  y desplegar funciones (Manolo hoy no tiene servidor), guardar el token de
  cada teléfono, y en iPhone la entrega a veces se retrasa o se pierde si
  el sistema ahorra batería.
- **Costo estimado** (uso personal: ~10 avisos al día): FCM gratis; Cloud
  Functions dentro de la cuota gratis (2 M invocaciones/mes); Cloud
  Scheduler 3 trabajos gratis (luego ~0,10 USD por trabajo al mes); lecturas
  de Firestore ~300/día (cuota gratis 50 000/día). En la práctica, **0 USD**,
  pero con tarjeta registrada y riesgo de cobro si algo se repite en bucle
  (conviene poner un tope de presupuesto).

### 2. Recordatorios en el Calendario del iPhone (.ics con alarmas)
- **Cómo**: un botón "Agregar al Calendario" genera un archivo `.ics` con un
  evento repetido por hábito con hora (`RRULE` según su frecuencia) y una
  alarma (`VALARM`). El iPhone lo abre con la hoja de compartir y lo suma a
  Calendario (o a uno nuevo, "Hábitos").
- **Pros**: gratis, sin servidor ni permisos; las alarmas suenan aunque el
  teléfono no tenga internet ni Manolo abierto; se hace todo en el teléfono.
- **Contras**: es una foto fija: si cambias la hora o borras el hábito hay
  que volver a importar (y borrar los viejos a mano o usar un calendario
  aparte para borrarlo entero); no sabe si ya cumpliste (avisa igual);
  "X veces por semana" no tiene días fijos (se pondría un aviso diario o se
  elegirían días).
- **Costo**: 0. Esfuerzo: chico (un módulo puro que arma el `.ics` + pruebas).

### 3. Alternativa sin código: Atajos del iPhone
Una automatización personal en la app Atajos ("A las 7:30 → Abrir URL
manolo…/#habitos") avisa y abre Manolo. Gratis, pero se configura a mano
en el teléfono.

**Recomendación**: empezar por el `.ics` (gratis, sin servidor) y dejar el
push para cuando Manolo tenga un servidor por otra razón.

**Decisión del dueño (2026-11-05):** por ahora no (D-088). Queda anotado en
"Para después" de `.claude/CURRENT_PHASE.md`.
