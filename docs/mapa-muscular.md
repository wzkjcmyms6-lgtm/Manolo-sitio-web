# Mapa muscular inteligente — bitácora

Objetivo: cada ejercicio registrado sabe qué músculos trabaja (primarios y
secundarios) y hace reaccionar al instante el mapa corporal y el radar de la
semana, al estilo Hevy pero con el arte y la paleta de Manolo.

## Estado

- [x] **Fase 1 — Base de ejercicios + cálculo + tests** (29 sept 2026)
- [x] **Fase 2 — Mapa corporal** (29 sept 2026)
- [x] **Fase 3 — Radar + tarjetas + top 5** (29 sept 2026)
- [ ] Fase 4 — Integración (registro, respaldo, no reconocidos, offline) y prueba piernas → pecho
- [ ] Fase 5 — Documentación final (agregar ejercicios, ajustar constantes)

## Archivos

| Archivo | Qué es |
|---|---|
| `scripts/build-exercises.mjs` | Genera la base a partir del dataset abierto (glosario, refinamientos, ajustes). |
| `data/ejercicios.json` | Base generada (569 ejercicios). **No editar a mano**: regenerar con el script. |
| `js/muscle-engine.js` | Cálculo puro: volumen, series efectivas, músculos, grupos, niveles, resumen. |
| `js/exercise-search.js` | Búsqueda sin tildes/mayúsculas, tolerante a errores, y `resolver()` para nombres guardados. |
| `tests/*.test.js` | Tests (`npm test`, usa `node --test`, sin dependencias). |
| `js/body-figures.js` | Arte del maniquí (frente/espalda): una pieza por región, lado izquierdo; el mapa la refleja. |
| `js/ejercicio-datos.js` | Centro de datos en el navegador: base + propios + asignaciones + ajustes + entrenos (Firestore) → `EjercicioDatos.onCambio`. |
| `js/body-map.js` | Mapa: niveles por región, fila L–D, pulso al encender, hoja de detalle al tocar. |
| `js/muscle-radar.js` | Radar de 6 ejes (semana vs anterior), selector Volumen/Series, barras por músculo, tarjetas y top 5. |

Ambos `js/` funcionan en el navegador (`window.MuscleEngine`,
`window.ExerciseSearch`) y en Node (tests, script).

## Fuente de la base de ejercicios

[free-exercise-db](https://github.com/yuhonas/free-exercise-db) — licencia
**Unlicense** (dominio público). Fijada al commit
`f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5`. El script:

1. Descarta estiramientos, rodillo de espuma, cuello, strongman y ejercicios de
   técnica/pliometría muy específicos (lista `EXCLUIR_NOMBRE`).
2. Traduce el nombre: movimiento (`CORES`) + modificadores (`MODS`) + equipo
   entre paréntesis. Formato: `Press de banca inclinado (Barra)`.
3. Agrega alias: el nombre original en inglés y sinónimos (`SINONIMOS`), p. ej.
   "press plano", "bench press", "estocada", "polea al pecho".
4. Pasa los músculos del dataset a las 21 regiones y refina lo que no separa:
   inclinado → pecho superior; declinado/fondos → pecho inferior; laterales y
   remo al mentón → deltoide lateral; face pull/pájaros/remos → deltoide
   posterior; press → deltoide anterior (+ lateral secundario); giros/laterales
   de tronco → oblicuos. En sentadillas, zancadas, prensas y pesos muertos no
   cuenta las pantorrillas (solo estabilizan).
5. `AJUSTES`: correcciones puntuales por nombre en inglés (nombre, músculos,
   tipo, `destacado` = gana los empates en la búsqueda).
6. `EXTRA`: 15 ejercicios que el dataset no trae (Correr, Caminar, Natación,
   Burpees, Hip thrust en máquina, Remo Pendlay…).

Regenerar: `npm run ejercicios` (o `node scripts/build-exercises.mjs --report`
para ver avisos). Si la descarga falla por proxy:
`NODE_USE_ENV_PROXY=1 node scripts/build-exercises.mjs`, o bajar el JSON con
curl y usar `--local archivo.json`. El resultado es determinista.

Campos de cada ejercicio: `id, nombre, alias[], tipo (carga | peso_corporal |
cardio | isometrico), equipo, primarios[], secundarios[], factorPesoCorporal`.

## Músculos (21 regiones → 6 grupos)

- Pecho: `pecho_superior`, `pecho_medio`, `pecho_inferior`
- Espalda: `dorsales`, `espalda_media`, `trapecio`, `lumbares`
- Hombros: `deltoide_anterior`, `deltoide_lateral`, `deltoide_posterior`
- Brazos: `biceps`, `triceps`, `antebrazos`
- Core: `abdominales`, `oblicuos`
- Piernas: `cuadriceps`, `isquiotibiales`, `gluteos`, `aductores`, `abductores`, `pantorrillas`

## Fórmulas (js/muscle-engine.js)

- **Carga**: volumen = Σ series (kg × reps).
- **Peso corporal**: volumen = Σ (pesoCorporal × factor + lastre) × reps. El
  lastre se anota en la columna de kg. Factores estimados (fracción del peso
  que se mueve): flexiones 0,64; dominadas 1; fondos 0,92; sentadilla/zancada
  0,7; abdominales 0,3; etc. (tabla `FACTORES` del script).
- **Cardio**: volumen = minutos × RPE × `cardioK`; series efectivas =
  minutos ÷ `minutosPorSerieCardio`. Ej.: 30 min a RPE 7 = 30 × 7 × 10 = 2100.
- **Isométrico** (y cualquier serie anotada solo con segundos): volumen por
  serie = (segundos ÷ 60) × RPE × `cardioK`; cada serie cuenta 1.
- Sin RPE se usa `rpePorDefecto`.
- **Por músculo**: primarios reciben `pesoPrimario` (100 %) del volumen y
  `seriePrimaria` (1) serie efectiva por serie; secundarios `pesoSecundario`
  (50 %) y `serieSecundaria` (0,5).
- **Por grupo (radar)**: cada ejercicio suma a cada grupo una sola vez, con el
  mayor peso entre sus músculos de ese grupo (una sentadilla cuenta 1 vez para
  Piernas, no 3).
- **Nivel del mapa** por series efectivas de la semana: 0 · 1–3 · 4–9 · 10+
  (`umbrales: [4, 10]`). Si el músculo solo trabajó como secundario se pinta
  más suave.

## Constantes (DEFAULTS)

| Constante | Valor | Significado |
|---|---|---|
| `pesoCorporal` | 70 | kg (se editará en Ajustes) |
| `pesoPrimario` / `pesoSecundario` | 1 / 0,5 | % del volumen |
| `seriePrimaria` / `serieSecundaria` | 1 / 0,5 | series efectivas por serie |
| `cardioK` | 10 | constante de cardio/isométricos |
| `rpePorDefecto` | 6 | si no se anotó RPE |
| `minutosPorSerieCardio` | 10 | 1 serie efectiva cada 10 min |
| `umbrales` | [4, 10] | inicio de nivel 2 y 3 |

## Búsqueda (js/exercise-search.js)

- Ignora tildes, mayúsculas, plurales simples y "de/con/al/…".
- Tolera 1 error en palabras de 4–7 letras y 2 en las de 8+; también
  coincide mientras escribes ("sentad", "press incl").
- `resolver(nombre)` para entrenos ya guardados: asignación manual → nombre o
  alias exacto → búsqueda con todas las palabras encontradas y ≥ 60 % del
  nombre cubierto. Si es ambiguo ("Remo", "Pecho") devuelve `null` y la app lo
  pedirá en la lista de no reconocidos. Los 22 nombres que sugería la versión
  anterior se reconocen todos (test).

## Mapa corporal (Fase 2)

- **Arte**: SVG propio, evolución del maniquí marfil original de Manolo (no
  usa ilustraciones de terceros). `js/body-figures.js` define cada región del
  lado izquierdo con coordenadas en un viewBox 140 × 300; el lado derecho se
  dibuja reflejado (`matrix(-1 0 0 1 140 0)`). Para retocar una forma basta
  cambiar su `d`.
- Cada región es `<g class="mz" data-muscle data-lado>` con dos capas: base
  marfil (degradado `#bodyGrad`) y tinte de color que aparece con transición
  de opacidad. `data-nivel` = 1/2/3 y `data-suave` si solo fue secundario.
- **Colores** (tokens en `:root` de `css/style.css`): `--musculo-1` `#F6C177`
  (1–3 series), `--musculo-2` `#FF9A3C` (4–9), `--musculo-3` `#FF5A1F` (10+),
  `--musculo-suave` 0,5 = opacidad del tinte si solo fue secundario. Radar
  (Fase 3): actual `#FF7A30` (`--accent-1`), anterior `--radar-anterior` `#9A978F`.
- **Fila L–D**: punto en días con cualquier entreno (gimnasio, running, bici);
  por defecto se ve la semana completa; tocar un día filtra y tocarlo otra vez
  vuelve a la semana.
- **Pulso**: cuando llegan datos nuevos (no al cambiar de semana/día), los
  músculos que suben de nivel muestran un brillo (filtro `#muscleGlow`). Si
  guardaste desde Gimnasio, el brillo se ve al volver al mapa.
- **Hoja de detalle** (`#muscle-sheet`): series efectivas, volumen, días,
  RPE promedio y ejercicios con su rol. Se cierra con la X, tocando afuera o
  deslizando hacia abajo.
- Pruebas visuales: se hicieron con un Firebase simulado en memoria y
  Chromium (capturas de iPhone 390 px y escritorio).

## Radar (Fase 3)

- Está en Ejercicio, debajo de las tarjetas Gimnasio/Running/Bicicleta, y
  sigue la semana que se ve en el mapa (evento `bodymap:semana`).
- Ejes en orden horario desde arriba a la izquierda: Espalda, Pecho, Core,
  Hombros, Brazos, Piernas. Semana actual en acento (`--accent-1`), anterior en
  gris punteado (`--radar-anterior`). Escala: el mayor valor de las dos semanas
  llega al 89 % del radio.
- Selector Volumen | Series (por defecto Volumen). Tocar un eje (o su
  etiqueta) muestra barras de sus músculos: color = esta semana, gris = anterior.
- Tarjetas: entrenamientos, duración, volumen y series, con ↑/↓ respecto de la
  semana anterior. Top 5 por volumen (el cardio muestra minutos).

## Datos del usuario (Firestore, pendiente Fase 4)

- Entrenos: `users/{uid}/entrenamientos` (sin cambios de formato; se agregan
  `exerciseId`, `rpe`, `notas`, `minutos` por ejercicio, opcionales).
- Running/Bici: `users/{uid}/running`, `users/{uid}/bicicleta` (+ `rpe` opcional).
- Nuevos: ejercicios propios, asignaciones de nombres no reconocidos, ajustes
  (peso corporal y constantes) y respaldo previo a la migración.
