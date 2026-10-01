# Motor de actividades deportivas

Implementado en la **fase 2** (sin pantallas todavía). Lógica pura UMD,
probada con `node --test` (`tests/actividad-motor.test.js`,
`tests/intervalos-motor.test.js`).

```text
GPS (fase 3: actividad-gps.js) ──► actividad-motor.js ──► metricas() ──► pantalla
                                     estados · filtros · tiempos · parciales · ruta
reloj (Date.now) ──► intervalos-motor.js ──► info() / avisos() ──► avisos visual/sonido/voz
                     (no depende del GPS; comparte el reloj con pausas)
```

## `ActividadMotor` (`js/actividad-motor.js`)

| Función | Qué hace |
|---|---|
| `crear(deporte)` | `"running"` o `"bicicleta"` (perfiles en `PERFILES`) → estado `listo` |
| `iniciar / pausar / reanudar / finalizar(st, t)` | `listo → activo ⇄ pausado → finalizado` |
| `punto(st, {lat, lon, t, acc, alt?, altAcc?})` | Devuelve `aceptado`, `quieto`, `impreciso`, `duplicado`, `salto`, `ignorado` o `invalido` |
| `metricas(st, t)` | distancia, `huecoM` (estimada), tiempo total / activo / en movimiento, velocidad y ritmo actual y medio, vel. máx., desnivel (o `null`), parciales, parcial en curso, estado del GPS |
| `resumen(st, extra)` | `{ documento, ruta }` listos para Firestore (ver `docs/DATABASE.md`) |
| `leerRuta(ruta)` | Ruta guardada → tramos de puntos `{lat, lon, t, alt}` |
| `codificar / decodificar` | Polilínea multicolumna (números grandes y negativos) |
| `reloj.*` | Pausas y tiempo activo; lo reutiliza el motor de intervalos |

Perfiles:

| | Running | Bicicleta |
|---|---|---|
| Precisión mínima | 30 m | 30 m |
| Velocidad imposible | > 12 m/s (43 km/h) | > 25 m/s (90 km/h) |
| "En movimiento" desde | 0,5 m/s | 1,0 m/s |
| Avance mínimo entre puntos | 3 m (o ½ de la precisión) | 4 m (o ½ de la precisión) |
| Parciales | cada 1 km | cada 5 km |
| Ventana del valor actual | 20 s | 10 s |
| Métrica principal | ritmo (min/km) | velocidad (km/h) |

Tiempos: **total** = fin − inicio; **activo** = total − pausas (el
cronómetro); **en movimiento** = tramos con velocidad ≥ umbral. Ritmo y
velocidad medios se calculan sobre el tiempo en movimiento.

## `IntervalosMotor` (`js/intervalos-motor.js`)

| Función | Qué hace |
|---|---|
| `crear({nombre, intervalos:[{tipo, seg, texto?}]})` | Tipos: caminar · trotar · correr · descanso |
| `iniciar / pausar / reanudar / finalizar` | Mismo reloj que la actividad |
| `info(st, t)` | actual, siguiente, restante, transcurrido, %, completados, restantes, terminado |
| `avisos(st, t0, t1)` | Avisos en (t0, t1]: `cambio`, `cuenta` (3-2-1, intervalos > 5 s), `fin`; tras un salto > 5 s (app congelada) solo `estado` (dónde va) |
| `textoAviso(st, aviso)` | Frase para la voz: "Siguiente intervalo: correr durante 2 minutos." |

## Recuperación (fase 3/4)

El estado de ambos motores es JSON: se guarda en `localStorage`
(`manolo.actividad.{uid}`) cada ~10 s, al pausar y cuando la app pasa a
segundo plano (`visibilitychange`). Al abrir: "Tienes una actividad sin
terminar" → Continuar / Terminar y guardar / Descartar (máx. 12 h).
