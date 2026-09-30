# Mapa muscular inteligente — bitácora

Objetivo: cada ejercicio registrado sabe qué músculos trabaja (primarios y
secundarios) y hace reaccionar al instante el mapa corporal y el radar de la
semana, al estilo Hevy pero con el arte y la paleta de Manolo.

## Estado

- [x] **Cuello como región 22** (30 sept 2026): se pinta en frente y nuca,
  suma al eje Espalda del radar y tiene 7 ejercicios (isométricos, con disco,
  con arnés, en máquina y puente de luchador).

- [x] **Fase 1 — Base de ejercicios + cálculo + tests** (29 sept 2026)
- [x] **Fase 2 — Mapa corporal** (29 sept 2026)
- [x] **Fase 3 — Radar + tarjetas + top 5** (29 sept 2026)
- [x] **Fase 4 — Integración y prueba piernas → pecho** (29 sept 2026)
- [x] **Fase 5 — Documentación final** (29 sept 2026)

## Archivos

| Archivo | Qué es |
|---|---|
| `scripts/build-exercises.mjs` | Genera la base a partir del dataset abierto (glosario, refinamientos, ajustes). |
| `data/ejercicios.json` | Base generada (576 ejercicios). **No editar a mano**: regenerar con el script. |
| `js/muscle-engine.js` | Cálculo puro: volumen, series efectivas, músculos, grupos, niveles, resumen. |
| `js/exercise-search.js` | Búsqueda sin tildes/mayúsculas, tolerante a errores, y `resolver()` para nombres guardados. |
| `tests/*.test.js` | Tests (`npm test`, usa `node --test`, sin dependencias). |
| `js/body-figures.js` | Arte del maniquí (frente/espalda): una pieza por región, lado izquierdo; el mapa la refleja. |
| `js/ejercicio-datos.js` | Centro de datos en el navegador: base + propios + asignaciones + ajustes + entrenos (Firestore) → `EjercicioDatos.onCambio`. |
| `js/body-map.js` | Mapa: niveles por región, fila L–D, pulso al encender, hoja de detalle al tocar. |
| `js/muscle-radar.js` | Radar de 6 ejes (semana vs anterior), selector Volumen/Series, barras por músculo, tarjetas y top 5. |
| `js/exercise-picker.js` | Autocompletado de ejercicios (con sus músculos) y creador de ejercicios propios tocando el maniquí. |
| `js/gimnasio.js` | Registro: autocompletado, columnas según tipo, RPE, notas, fecha, edición de entrenos guardados. |
| `js/ejercicio-ajustes.js` | Lista de no reconocidos, ajustes (peso corporal y constantes), mis ejercicios y respaldo. |
| `sw.js` + `js/offline.js` | Modo sin conexión: guarda la app en el teléfono. |

Ambos `js/` funcionan en el navegador (`window.MuscleEngine`,
`window.ExerciseSearch`) y en Node (tests, script).

## Fuente de la base de ejercicios

[free-exercise-db](https://github.com/yuhonas/free-exercise-db) — licencia
**Unlicense** (dominio público). Fijada al commit
`f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5`. El script:

1. Descarta estiramientos, rodillo de espuma, strongman y ejercicios de
   técnica/pliometría muy específicos (lista `EXCLUIR_NOMBRE`).
2. Traduce el nombre: movimiento (`CORES`) + modificadores (`MODS`) + equipo
   entre paréntesis. Formato: `Press de banca inclinado (Barra)`.
3. Agrega alias: el nombre original en inglés y sinónimos (`SINONIMOS`), p. ej.
   "press plano", "bench press", "estocada", "polea al pecho".
4. Pasa los músculos del dataset a las 22 regiones y refina lo que no separa:
   inclinado → pecho superior; declinado/fondos → pecho inferior; laterales y
   remo al mentón → deltoide lateral; face pull/pájaros/remos → deltoide
   posterior; press → deltoide anterior (+ lateral secundario); giros/laterales
   de tronco → oblicuos. En sentadillas, zancadas, prensas y pesos muertos no
   cuenta las pantorrillas (solo estabilizan).
5. `AJUSTES`: correcciones puntuales por nombre en inglés (nombre, músculos,
   tipo, `destacado` = gana los empates en la búsqueda).
6. `EXTRA`: 17 ejercicios que el dataset no trae (Correr, Caminar, Natación,
   Burpees, Hip thrust en máquina, Remo Pendlay…).

Regenerar: `npm run ejercicios` (o `node scripts/build-exercises.mjs --report`
para ver avisos). Si la descarga falla por proxy:
`NODE_USE_ENV_PROXY=1 node scripts/build-exercises.mjs`, o bajar el JSON con
curl y usar `--local archivo.json`. El resultado es determinista.

Campos de cada ejercicio: `id, nombre, alias[], tipo (carga | peso_corporal |
cardio | isometrico), equipo, primarios[], secundarios[], factorPesoCorporal`.

## Músculos (22 regiones → 6 grupos)

- Pecho: `pecho_superior`, `pecho_medio`, `pecho_inferior`
- Espalda: `dorsales`, `espalda_media`, `trapecio`, `cuello`, `lumbares`
  (el cuello suma al eje Espalda del radar)
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
- **Fila L–D**: solo informa: punto en los días con entreno. El mapa se
  ilumina siempre por la semana completa (lunes a domingo), no por día.
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

## Integración (Fase 4)

### Registro (Gimnasio)
- El buscador de "Agregar" usa la base: ignora tildes, tolera errores y
  muestra los músculos de cada opción. "Agregar" sin elegir: si el nombre
  coincide con seguridad se usa ese ejercicio; si no, abre el creador.
- Cada ejercicio guarda `exerciseId`. Columnas según tipo: carga (KG × REPS),
  peso corporal (+KG de lastre × REPS), isométrico (SEG), cardio (minutos).
  Además RPE 1–10 y notas por ejercicio, y la fecha del entreno.
- Historial: botón ✎ para editar (ejercicios, series, fecha, duración) y 🗑
  para borrar. El mapa y el radar se recalculan al instante.
- Running y Bicicleta: RPE opcional (si falta se usa `rpePorDefecto`).
- Arreglo: las fechas nuevas se guardan en hora local (antes, de noche, la
  fecha UTC marcaba el día siguiente). Los entrenos viejos no se tocaron.

### Ejercicios propios
- Si buscas un ejercicio que no existe: "+ Crear «…»" abre el maniquí. Tocar
  un músculo 1 vez = primario, 2 = secundario, 3 = quitar. También tipo,
  equipo y (si es de peso corporal) la parte del peso que mueves.
- Se guardan en `users/{uid}/meta/ejercicios_propios` (un mapa id → ficha) y
  se listan en Ajustes → Mis ejercicios (se pueden borrar).

### Entrenos ya registrados
- No se modifican: cada nombre guardado se resuelve contra la base al leerlo
  (`ExerciseSearch.resolver`). Lo que no se reconoce aparece en Ejercicio →
  "Ejercicios sin reconocer", con **Asignar** (buscar en la base) o **Crear
  nuevo**. La elección se guarda en `meta/asignaciones_ejercicios`
  (nombre normalizado → id).
- **Respaldo**: la primera vez que la app abre con conexión copia todos los
  entrenos (gimnasio, running, bici) en `meta/respaldo_entrenamientos_AAAA-MM-DD`
  y lo anota en `meta/ajustes_ejercicio.respaldo`. Solo con datos confirmados
  por el servidor (no del caché). En Ajustes → "Descargar respaldo (JSON)".

### Ajustes
- `meta/ajustes_ejercicio`: `pesoCorporal`, las constantes de la tabla de
  arriba (en pantalla los % se muestran ×100) y `umbrales`.

### Sin conexión
- `js/firebase-init.js` activa el caché offline de Firestore
  (`enablePersistence`): sin red se ven los últimos datos y lo que registres se
  guarda en el teléfono y se sube solo al volver la conexión.
- `sw.js`: archivos con `?v=` (y Firebase SDK / Google Fonts) se sirven desde
  la copia; `index.html` y archivos sin versión, primero de la red. La página
  (`js/offline.js`) le pasa al service worker la lista de archivos que cargó.
- **Al publicar cambios**: subir el `?v=` del archivo modificado en
  `index.html` (y `RUTA_BASE` en `js/ejercicio-datos.js` si cambia
  `data/ejercicios.json`). Si cambia `sw.js`, subir `CACHE`.

### Pruebas hechas
- Con un Firebase simulado en memoria y Chromium tamaño iPhone: día de
  piernas → se encienden cuádriceps, isquios, glúteos…; luego día de pecho →
  el mapa acumula (pecho superior/medio + tríceps y deltoide anterior suaves).
- "Press inclinado con barra 4×10×60" desde el buscador → pecho superior
  nivel 2 (primario), tríceps y deltoide anterior suaves; radar actualizado
  sin recargar.
- Creador (roles 1/2/3 toques), asignación de no reconocidos, ajustes,
  edición, respaldo automático y recarga sin conexión.

## Datos del usuario (Firestore)

- Entrenos: `users/{uid}/entrenamientos` (mismo formato; se agregan
  opcionalmente `exerciseId`, `rpe`, `notas`, `minutos` por ejercicio y `seg`
  por serie).
- Running/Bici: `users/{uid}/running`, `users/{uid}/bicicleta` (+ `rpe` opcional).
- `users/{uid}/meta/`: `ejercicios_propios`, `asignaciones_ejercicios`,
  `ajustes_ejercicio`, `respaldo_entrenamientos_AAAA-MM-DD`.

## Cómo agregar ejercicios

**Desde la app (solo para ti, recomendado):** en Gimnasio escribe el nombre
en "Buscar ejercicio"; si no aparece, toca **+ Crear «…»**, elige tipo y
equipo y toca los músculos en el maniquí (1 = primario, 2 = secundario,
3 = quitar). Queda guardado y se puede borrar en Ejercicio → Ajustes → Mis
ejercicios.

**En la base (para siempre, en el código):** editar
`scripts/build-exercises.mjs` y regenerar.

- Ejercicio que el dataset no trae → agregarlo a `EXTRA`:
  ```js
  { id: "manolo-remo-meadows", nombre: "Remo Meadows (Barra)", alias: ["meadows row"],
    tipo: "carga", equipo: "barra", primarios: ["dorsales", "espalda_media"],
    secundarios: ["biceps", "deltoide_posterior"] },
  ```
  El `id` no se debe cambiar después (los entrenos lo guardan).
- Corregir nombre, músculos o tipo de uno del dataset → `AJUSTES`, con el
  nombre en inglés como clave:
  ```js
  "Barbell Shrug": { nombre: "Encogimientos (Barra)", secundarios: ["antebrazos"], destacado: true },
  ```
  `destacado: true` lo pone primero cuando la búsqueda empata.
- Nuevo sinónimo de búsqueda para todo un movimiento → `SINONIMOS`
  (ej. `"zancada": ["estocada", …]`).
- Excluir uno → `AJUSTES["Nombre"] = { excluir: true }`.

Después: `npm run ejercicios` (regenera `data/ejercicios.json`), `npm test`, y
subir el `?v=` de `RUTA_BASE` en `js/ejercicio-datos.js` para que el
teléfono descargue la base nueva.

## Cómo ajustar las constantes

**Desde la app:** Ejercicio → Ajustes del mapa muscular → Constantes del
cálculo. Cambia al instante el mapa, el radar y las tarjetas (solo para tu
cuenta). "Valores por defecto" las restablece (tu peso se mantiene).

**En el código (valores por defecto):** `DEFAULTS` en `js/muscle-engine.js`
(subir su `?v=` en `index.html` y correr `npm test`). Qué mueve cada una:

- `pesoSecundario` / `serieSecundaria`: cuánto cuentan los secundarios. Más
  alto = el mapa se enciende más en los músculos que solo acompañan.
- `umbrales` [4, 10]: series efectivas semanales para pasar a naranja (nivel
  2) y a intenso (nivel 3). Subirlos si todo se ve demasiado encendido.
- `cardioK`, `rpePorDefecto`, `minutosPorSerieCardio`: peso del cardio y los
  isométricos frente a las pesas. Ej.: con `cardioK = 10`, 30 min a RPE 7 =
  2100 kg equivalentes y 3 series efectivas.
- Factor de peso corporal de un ejercicio: tabla `FACTORES` del script (para
  todos) o en el creador (para los propios).

## Otros cambios frecuentes

- **Colores del mapa**: tokens `--musculo-1/2/3` y `--musculo-suave` en
  `:root` de `css/style.css`.
- **Formas del maniquí**: `js/body-figures.js` (coordenadas del lado
  izquierdo en un lienzo de 140 × 300; el derecho es su espejo).
- **Nueva fuente de cardio (ej. Strava)**: guardar cada actividad con fecha,
  minutos y RPE, y sumarla en `desdeRegistros()` de `js/muscle-engine.js`
  igual que `running` (id `manolo-correr`) y `bicicleta` (id `bicycling`); para
  otros deportes, agregar su ficha en `EXTRA` (ej. natación ya existe:
  `manolo-natacion`).
- **Running y Bicicleta hoy no cuentan en el mapa**: `js/ejercicio-datos.js`
  solo le pasa `gimnasio` a `desdeRegistros()`. Para volver a sumarlos, pasarle
  también `running` y `bicicleta` desde `estado.registros`.
- **Tests**: `npm test` (Node 18+ sin instalar nada).

## Ejercicios de la rutina (30 sept 2026)

Agregados en `EXTRA` / `AJUSTES` del script con los músculos que indicó Juan
(primario = lo que mueve el ejercicio; secundario = lo que ayuda o estabiliza):
Flexión normal, de rodillas y con pausa (pecho; tríceps, deltoide anterior),
Plancha alta, Plancha en rodillas, Colgado activo, Negativa controlada,
Sentadilla al aire (antes "Sentadilla libre"; alias "asistida"), Zancada
asistida, Elevación de talones (sin peso), Puente de glúteos isométrico/con
marcha, Balance a una pierna, Flexión / extensión cervical; y se ajustaron
Dominadas (+ trapecio), Dead bug (+ lumbares), Puente de glúteo y los
isométricos de cuello (alias).

**Movilidad y estiramientos** (`movilidad: true`: Círculos de tobillo,
Movilidad de rodilla adelante, Estiramiento de isquios, Estocada baja): solo
tienen músculos secundarios, así que el mapa los pinta en tono suave.
