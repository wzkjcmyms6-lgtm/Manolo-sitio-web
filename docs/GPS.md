# GPS (retirado), audio y segundo plano — capacidades reales

## GPS: retirado (D-033, 2026-10-01)
El dueño pidió quitar el GPS de Running y Bicicleta. Se borraron la pantalla
en vivo, el motor (`actividad-motor.js`), el acceso a la ubicación
(`actividad-gps.js`), las vistas (`actividad-vista.js`, `actividad-ui.js`) y
Leaflet. Manolo **ya no pide permiso de ubicación**.

Los datos viejos se conservan: las carreras/rodadas grabadas con GPS siguen
en el historial y en el resumen semanal (usan `distance` y `duration` como
todas). Sus recorridos (`users/{uid}/rutas`) quedan guardados sin uso; si se
elimina la actividad, se borra también su recorrido. Para volver a tener GPS:
el código está en git (commit `a66de91` y anteriores) y la tabla de límites
de abajo sigue valiendo.

## Lo que sigue usándose (rutinas guiadas)

| Capacidad | iPhone (PWA / Safari) | Consecuencia en MANOLO |
|---|---|---|
| Temporizadores en segundo plano | Se congelan | Todo se calcula con **marcas de tiempo** (`Date.now()`), no contando ticks: al volver, el tiempo es correcto |
| `speechSynthesis` (voz local, sin nube) | Sí, tras un toque del usuario; voces en español del sistema | Se habilita en el toque de Iniciar/Reanudar. Pendiente confirmar en el iPhone del dueño |
| Web Audio (pitidos) | Sí, tras un toque; respeta el interruptor de silencio | Pitidos + aviso visual siempre |
| Wake Lock (pantalla encendida) | Safari 16.4+; en apps de pantalla de inicio fiable desde iOS 18.4 | Se pide al iniciar/reanudar; se suelta al pausar o terminar; se vuelve a pedir al volver a la app |
| App en segundo plano / teléfono bloqueado | El JS se suspende | Los avisos no suenan mientras está bloqueado; al volver dice "Ahora: …" sin recitar los perdidos |
| `navigator.vibrate` | **No** en iPhone | No se depende de vibración |
| Notificaciones locales programadas | No | No se usan para avisos de intervalos |

Avisos con la pantalla bloqueada exigirían app nativa o híbrida (p. ej.
Capacitor): cambio grande de arquitectura y distribución; **no se propone**.
