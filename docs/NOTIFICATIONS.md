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
