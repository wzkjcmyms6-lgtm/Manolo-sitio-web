# Rutinas listas (Ejercicio)

Rutinas predefinidas que cualquiera con cuenta en Manolo puede abrir y
seguir desde su teléfono (pedido del dueño, 2026-11-08: "una rutina que mi
novia pueda ver y seguir desde su celular"). Decisión D-104.

## Dónde está

- **Ejercicio › Entrenamiento › Rutinas listas**: una tarjeta por rutina
  (nombre, nivel, días, minutos, los días hechos esta semana y "Hoy: Día A").
- Al tocarla, su página (`#rutina-lista/{id}`, "‹ Entrenamiento" para
  volver): datos (equipo, descanso), los días como pestañas (el de hoy
  destacado: Lun = A, Mié = B, Vie = C, según `dia_sugerido`), el
  calentamiento y los ejercicios con series, reps, músculos y la clave
  técnica, y una casilla por serie. Abajo, **Cómo progresar** y
  **Consejos**.
- **Terminar el día y guardar** guarda la sesión en
  `users/{uid}/entrenamientos` con el formato de siempre (el historial,
  Perfil, el mapa muscular, el volumen y la recuperación la usan sin
  cambios), más `plantilla: { id, dia, v }`. Avisa `entreno:guardado`
  (Hábitos vinculados a Gimnasio, Rangos).
- Las casillas marcadas se guardan en el teléfono (`localStorage`,
  `manolo-rl:{uid}:{rutina}`) hasta terminar: cerrar la app no las borra.
  Si quedaron de otro día, se pueden guardar con esa fecha o borrar.

## Formato del archivo (data/rutinas/{id}.json)

El de la primera rutina (`casa-gluteo-full-body.json`), con estos campos:

| Campo | Qué es |
|---|---|
| `id` | Identificador fijo (minúsculas y guiones). No cambiarlo: los entrenos lo guardan |
| `version` | Número; subirlo si se cambia la rutina |
| `nombre`, `nivel`, `dias_por_semana`, `duracion_min`, `equipo` [ ], `descanso_entre_series` | Datos de arriba |
| `dias` [ ] | `id` ("A"), `dia_sugerido` ("Lunes"…), `titulo`, `calentamiento`, `ejercicios` [ ] |
| ejercicio | `id` (fijo, único en todas las rutinas), `nombre`, `series`, `reps` (texto: "10-12 por pierna", "40 s", "20 s trabajo / 10 s descanso"), `musculos` [ ], `tip` |
| opcionales del ejercicio | `factor` (parte del peso corporal que mueve, 0,05–1; sin él, 0,5) y `mapa: { primarios, secundarios }` con zonas del mapa si las palabras de `musculos` no alcanzan |
| `progresion` [ ] | `semanas`, `que_hacer` |
| `consejos` [ ] | Textos |

**Músculos**: el primero es el principal y los demás secundarios. Palabras
que entiende: Glúteos, Glúteo medio, Cuádriceps, Isquiotibiales, Aductores,
Abductores, Pantorrillas, Piernas, Abdomen, Oblicuos, Lumbares, Pecho,
Tríceps, Bíceps, Hombros, Espalda, Espalda alta, Trapecio… (lista en
`js/rutinas-listas-motor.js`). **Cardio** hace que cuente por minutos
(series × segundos de `reps`). Un `reps` que empieza con segundos ("40 s")
se guarda como serie por tiempo.

Al guardar, cada serie marcada va con las repeticiones del objetivo (el
número más bajo: "10-12" → 10) y 0 kg (peso corporal).

## Agregar otra rutina

1. Copiar el archivo de la rutina en casa a `data/rutinas/{nuevo-id}.json`
   y cambiar todo (ids nuevos en la rutina y en cada ejercicio).
2. Sumar su ruta en `ARCHIVOS` de `js/rutinas-listas-motor.js`
   (`"data/rutinas/{nuevo-id}.json?v=1"`): así el teléfono la guarda para
   usarla sin internet.
3. `npm test` (revisa ids únicos y que todos los músculos se entiendan),
   subir el `?v=` de `js/rutinas-listas-motor.js` en `index.html` y
   `npm run sw`.

## Para que otra persona la use

Cada persona entra con **su propia cuenta** (sus entrenos y su mapa son
suyos). Las cuentas se crean en la consola de Firebase: Authentication ›
Users › Add user, con el correo `nombre@manolo-panel.local` y una
contraseña; en el teléfono entra a Manolo con el usuario `nombre` y esa
contraseña (`docs/ARCHITECTURE.md`). La rutina viene con la app: no hay
que copiar nada.

## Archivos

| Archivo | Qué hace |
|---|---|
| `data/rutinas/casa-gluteo-full-body.json` | La rutina en casa |
| `js/rutinas-listas-motor.js` | UMD sin DOM: leer, músculos, día de hoy, entreno a guardar, días hechos. Pruebas: `tests/rutinas-listas.test.js` |
| `js/rutinas-listas.js` | Tarjeta y página |
| `css/rutinas-listas.css` | Estilos (`.rl-`) |
| `js/ejercicio-datos.js` | Carga las rutinas con la base; sus ejercicios se encuentran por id (no salen en el buscador) |
| `scripts/e2e/ejercicio.js` | `SOLO=rutina`: tarjeta, días, marcar, recargar, guardar, mapa, miércoles y domingo, a 390 y 1280 px |
