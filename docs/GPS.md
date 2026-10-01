# GPS, audio y segundo plano — capacidades reales

MANOLO es una **PWA**. En iPhone (uso principal) corre en WebKit, también
instalada en la pantalla de inicio. Esto define lo que se puede prometer.

| Capacidad | iPhone (PWA / Safari) | Consecuencia en MANOLO |
|---|---|---|
| `navigator.geolocation.watchPosition` | Sí, **solo con la app visible** | Se registra GPS con la pantalla encendida y MANOLO al frente |
| GPS con pantalla bloqueada / app en segundo plano | **No** (WebKit suspende el JS) | Habrá huecos en la ruta; se marcan como "sin señal", **no se inventan puntos** |
| Wake Lock (pantalla encendida) | Safari 16.4+; en apps de pantalla de inicio funciona de forma fiable desde iOS 18.4 | Se pide al iniciar; si falla, se avisa "mantén la pantalla encendida" |
| Temporizadores en segundo plano | Se congelan | Todo se calcula con **marcas de tiempo** (`Date.now()`), no contando ticks: al volver, el tiempo es correcto |
| `speechSynthesis` (voz local, sin nube) | Sí, tras un toque del usuario; voces en español del sistema | Avisos de voz en primer plano (fase 4). Se habilita en el toque de Iniciar/Reanudar. Pendiente confirmar en el iPhone del dueño |
| Web Audio (pitidos) | Sí, tras un toque; respeta el interruptor de silencio | Pitidos + aviso visual siempre (si el teléfono está en silencio, queda lo visual y la voz según iOS). `navigator.audioSession.type = "transient"` (iOS 17+) para mezclarse con la música |
| `navigator.vibrate` | **No** en iPhone | No se depende de vibración |
| Notificaciones locales programadas | No | No se usan para avisos de intervalos |
| Precisión / altitud | `coords.accuracy` siempre; `altitude` y `speed` a veces `null` | Desnivel y velocidad del sensor solo si existen; si no, "no disponible" |

## Estrategia de registro (motor hecho en fase 2; GPS real en fase 3)

- `watchPosition({ enableHighAccuracy: true, maximumAge: 0, timeout: 20000 })`.
- **Filtros** (en el motor, probados): descartar `accuracy > 30 m` (aviso
  "GPS impreciso"), duplicados (mismo timestamp), saltos imposibles
  (velocidad implícita > 12 m/s corriendo, > 25 m/s en bici), y movimiento
  menor que la incertidumbre (no suma distancia parado).
- **Distancia** con fórmula de Haversine entre puntos aceptados.
- **Tiempo en movimiento**: suma de intervalos con velocidad > umbral
  (0,5 m/s correr; 1,0 m/s bici), excluye pausas.
- **Pérdida de señal**: si no llegan puntos en > 15 s se muestra "Buscando
  GPS"; al volver se reanuda el tramo sin unir con una recta falsa.
- **Permiso denegado / GPS apagado**: mensaje claro y opción de registrar
  sin GPS (tiempo) o volver al formulario manual existente.
- **Consumo**: puntos en memoria + copia en `localStorage` cada ~10 s
  (recuperación); **una sola escritura** a Firestore al finalizar.
- **Valores exactos** de los filtros: tabla de perfiles en `docs/SPORTS.md`
  (constantes en `js/actividad-motor.js`, cubiertas por pruebas).
- **Pantalla encendida**: `navigator.wakeLock.request("screen")` al iniciar;
  se vuelve a pedir al volver a primer plano; se libera al pausar o terminar.
- **Segundo plano**: al ocultarse la app se guarda el estado; al volver, los
  tiempos se recalculan con el reloj y el GPS reanuda en un tramo nuevo.

## Evolución posible (solo si hiciera falta)

GPS real con pantalla bloqueada exige app nativa o híbrida (p. ej.
Capacitor con plugin de ubicación en segundo plano). Es un cambio grande de
arquitectura y distribución (App Store); **no se propone ahora**.
