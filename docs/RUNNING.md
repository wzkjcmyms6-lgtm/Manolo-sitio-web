# Running

Desde 2026-10-01 (D-033) Running **no usa GPS**. La página tiene, de arriba
abajo:

1. **Resumen semanal** (`js/actividad-registro.js` + `js/actividad-analisis.js`,
   común con Bici): la semana elegida (lunes a domingo) con **Distancia** y
   **Tiempo**, y "Últimas 12 semanas" en un gráfico de línea. Tocar un punto
   (o pasar el mouse, o flechas con el teclado) elige esa semana; tocar
   Distancia o Tiempo cambia lo que dibuja el gráfico. Sin desnivel (D-035).
   Suma todo: anotado a mano, rutinas guiadas y carreras viejas con GPS.
2. **Rutinas guiadas** (`js/rutina-guiada.js`): la lista es una **cola**; la
   de arriba dice "Siguiente". Importar CSV/Excel de uno o varios días
   (`docs/CSV_ROUTINES.md`), plantilla de 3 días, eliminar (un día o el plan
   entero). Al **completar** una rutina pasa al final de la lista (D-034,
   D-036).
3. **Registrar carrera** a mano (desplegable): fecha, km, minutos, RPE, notas.
4. **Tus carreras**: historial por meses; cada una se puede eliminar. Las
   hechas con rutina muestran la etiqueta "Rutina" y su nombre
   ("Plan 5K · Día 2"), aunque la rutina ya no exista.

## Pantalla de la rutina
- Antes de empezar: intervalo inicial, lista de intervalos, Cancelar /
  Iniciar. Pantalla completa (sin barras de la app).
- En curso: tarjeta del intervalo (color por tipo, tiempo restante grande,
  descripción, barra, siguiente, "Intervalo N de M"), Tiempo y Quedan, la
  lista con lo hecho atenuado y el actual resaltado; Sonido y Voz apagables
  (se recuerdan).
- Avisos (`js/avisos.js`): cuenta 3-2-1 con pitidos (Web Audio) y, en cada
  cambio y al terminar, aviso grande + voz del sistema (`speechSynthesis`,
  sin nube). Se habilitan con el toque de Iniciar/Reanudar. Pantalla
  encendida con Wake Lock mientras corre.
- Pausar / Reanudar / Finalizar. Al terminar el último intervalo dice
  "Rutina terminada. ¡Buen trabajo!" y pasa solo al resumen.
- Si la app estuvo congelada (pantalla bloqueada), al volver no recita
  avisos viejos: dice "Ahora: …" (motor `js/intervalos-motor.js`).
- Recuperación: el estado se guarda en el teléfono
  (`manolo.rutina.{uid}`) cada 10 s, al pausar y al salir; si Manolo se
  cierra, vuelve **en pausa** y Inicio avisa "Tienes una rutina sin terminar".

## Resumen y guardado
"¡Rutina completada!" o "Rutina terminada" (si se finalizó antes), tiempo e
intervalos hechos; **km opcionales** (si los mediste con otro reloj o app),
RPE y notas. Guardar escribe en `users/{uid}/running` (con `fuente:"rutina"`,
ver `docs/DATABASE.md`) y, si se completó, en el mismo lote mueve la rutina
al final de la cola. "Volver a la rutina" solo si no se completó.

## Límites del iPhone
Ver `docs/GPS.md` (ahora: audio, voz y segundo plano): con el teléfono
bloqueado la app se congela y los avisos no suenan; al volver, el tiempo es
correcto porque se calcula con marcas de tiempo.

## Historia
Fases 3–7 tuvieron carrera con GPS (mapa, parciales, ritmo en vivo, marcas).
Se retiró a pedido del dueño (D-033); el código queda en el historial de git
(commit `a66de91` y anteriores).
