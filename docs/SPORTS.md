# Lógica deportiva (Running y Bicicleta)

Lógica pura UMD (sin DOM ni Firebase), probada con `node --test`. Desde
D-033 no hay GPS: quedan el motor de intervalos (rutinas guiadas), la
lectura de rutinas CSV y el resumen semanal.

```text
reloj (Date.now) ──► intervalos-motor.js ──► info() / avisos() ──► pantalla + avisos.js (pitidos, voz)
CSV / Excel ───────► rutina-running.js ────► rutinas (una por día) ──► cola (orden)
running/ · bicicleta/ ──► actividad-analisis.js ──► semanas ──► resumen semanal (SVG)
```

## `IntervalosMotor` (`js/intervalos-motor.js`, `tests/intervalos-motor.test.js`)

| Función | Qué hace |
|---|---|
| `crear({nombre, intervalos:[{tipo, seg, texto?}]})` | Tipos: caminar · trotar · correr · descanso |
| `iniciar / pausar / reanudar / finalizar(st, t)` | `listo → activo ⇄ pausado → finalizado`, con marcas de tiempo |
| `info(st, t)` | actual, siguiente, restante, transcurrido, %, completados, restantes, terminado |
| `avisos(st, t0, t1)` | Avisos en (t0, t1]: `cambio`, `cuenta` (3-2-1, intervalos > 5 s), `fin`; tras un salto > 5 s (app congelada) solo `estado` (dónde va) |
| `textoAviso(st, aviso)` | Frase para la voz: "Siguiente intervalo: correr durante 2 minutos." |
| `activoMs / totalMs` | Tiempo activo (sin pausas) y duración total de la rutina |

Tiempo activo = fin (o ahora) − inicio − pausas. El reloj vive en este
archivo (antes lo compartía con el motor GPS, ya retirado).

## `RutinaRunning` (`js/rutina-running.js`, `tests/rutina-running.test.js`)

| Función | Qué hace |
|---|---|
| `interpretar(filas, {nombre})` / `desdeTexto(csv, …)` | → `{ ok, nombre, dias:[{dia, intervalos, totalSeg}], rutina (si es de un día), errores }` |
| `ordenarCola(rutinas)` | Por `orden` (sin orden = 0), luego día y creación |
| `ordenAlFinal(rutinas)` | Mayor `orden` + 1 (la completada pasa al final) |
| `titulo(r)` / `nombreCompleto(r)` | "Día 2" / "Plan 5K · Día 2" (lo que queda en el historial) |
| `resumen(r)` | "7 intervalos · 16 min" ("· 20 s" si dura menos de un minuto) |

Formato del CSV en `docs/CSV_ROUTINES.md`.

## `ActividadAnalisis` (`js/actividad-analisis.js`, `tests/actividad-analisis.test.js`)

| Función | Qué hace |
|---|---|
| `porSemana(acts, hoy, n)` | km, minutos y cantidad por semana (lunes a domingo); la última es la de hoy |
| `rangoSemana(desde)` | "14 sept - 20 sept 2026" (con año en los dos lados si cambia) |
| `textoKm(km)` / `textoTiempo(min)` | "13,58 km" / "5h 3min" |
| `escala(max, metrica)` | 0 · paso · tope con números redondos y algo de aire (13,6 km → 8 / 16) |
| `mesesEje(semanas)` | AGO, SEP, OCT bajo la semana que trae el día 1 |
| `svgSemanas(semanas, {metrica, sel, id, ancho, alto})` | Línea con un punto por semana, la elegida resaltada (línea vertical, halo) y zonas de toque por semana con su texto |

## Recuperación
El estado de la rutina es JSON: se guarda en `localStorage`
(`manolo.rutina.{uid}`) cada ~10 s, al pausar y al ocultarse la app; al
abrir vuelve en pausa (máx. 12 h). El borrador viejo de la pantalla con GPS
(`manolo.actividad.{uid}`) se borra al entrar.
