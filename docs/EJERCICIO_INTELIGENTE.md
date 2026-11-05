# Ejercicio inteligente — diseño y bitácora

Pedido del dueño (2026-11-05): que Ejercicio pase de registrar bien a
ayudar a entrenar mejor: qué entrenar hoy, cuánto levantar y por qué,
cuándo hay estancamiento o toca descargar, y cómo se hace cada ejercicio.
Sin perder nada de lo que ya tiene (registro, rutinas, plan semanal,
progresión, Rangos, mapa muscular, Feed, Perfil, calendario).

Referencias de experiencia: apps de gimnasio de primer nivel (registro por
series, ficha del ejercicio, recuperación por músculo). Sin copiar marca,
textos ni diseño: el aspecto es el de Manolo. **Nada de IA de pago**: todo
sale de reglas y fórmulas documentadas (§ Fórmulas, con sus fuentes en
`DECISIONS.md`).

## Fases

| Fase | Qué | Estado |
|---|---|---|
| 0 | Auditoría y diseño | ✅ |
| 1 | Demos (WebP en el repo, caché con límite, precarga de rutinas) | ✅ |
| 2 | Ficha del ejercicio (técnica, videos, historial, récords, alternativas) | ✅ |
| 3 | Entreno en vivo (objetivo, RIR, calentamiento, discos, superseries, descanso con aviso, récords, resumen) | ✅ |
| 4 | Progresión v2, estancamiento, descarga + Ajustes del gimnasio | ✅ |
| 5 | Volumen semanal, equilibrio y generador de rutinas | ✅ |
| 6 | Recuperación, "¿Qué entreno hoy?" y carga total con Running | ✅ |
| 7 | Resumen inteligente, Perfil y compartir | |
| 8 | QA final | |

## Auditoría (fase 0)

Con Firebase falso y 9 semanas de entrenos realistas
(`scripts/e2e/ejercicio-semilla.js`: Empuje / Tirón / Pierna con progresión,
banca estancada, rutinas con plan semanal, pesajes y carreras), a 390 px.

| # | Qué estorba | Dónde se arregla |
|---|---|---|
| 1 | Empezar la rutina de hoy cuesta **4 toques**: Ejercicio abre en Feed → pestaña Entrenamiento → tarjeta "Entrenamiento" → Empezar. | Fase 3: "Hoy toca" con Empezar arriba de la pestaña Entrenamiento (luego, fase 6, la recomendación del día) |
| 2 | Los kg que precarga la rutina son **viejos** (la rutina dice 90 kg; la sugerencia, "Sube a 110 kg"). Si tocas ✓ sin "Usar", **se guarda 90 kg**. | Fase 3: cada serie llega con el objetivo de la progresión |
| 3 | "Objetivo: 4 × 5–8 · 90 kg" y la tarjeta "Hoy: Sube a 110 kg · Usar" se contradicen y ocupan 6–7 líneas por ejercicio. | Fase 3: una sola línea con el porqué |
| 4 | El descanso **no avisa en el iPhone**: solo vibra y Safari no vibra. La pantalla se apaga. | Fase 3: pitido y voz (`js/avisos.js`) y pantalla encendida |
| 5 | Al terminar no hay resumen: vuelve a la lista y sigue diciendo "Hoy toca Pierna · Empezar" como si no lo hubieras hecho. | Fase 3: resumen al terminar y "Hecho hoy ✓" |
| 6 | El nombre del ejercicio no lleva a nada: no hay forma de ver cómo se hace ni su historial. | Fase 2: ficha |
| 7 | En el editor de rutinas el nombre del ejercicio se corta ("Press de banca (Barr"). | Fase 2: el nombre en dos líneas y con enlace a la ficha |

Lo que ya está bien y se mantiene: la columna "Anterior" serie por serie,
✓ que completa la serie, deslizar para borrar, la barra de descanso con
−15 / +15 / Saltar, el menú del ejercicio, el plan semanal con días en las
rutinas, Perfil con el gráfico semanal y el calendario anual, Rangos.

## Bocetos

### Ficha del ejercicio (hoja; se abre desde el buscador, el entreno, las rutinas, Rangos y una sesión)

```text
┌──────────────────────────────────────┐
│ ✕          Sentadilla (Barra)        │
│ ┌──────────────────────────────────┐ │
│ │   [foto inicio ⇄ foto final]     │ │  fundido suave en bucle (~1,2 s)
│ │                          ⏸       │ │  pausa; quieta con "reducir movimiento"
│ └──────────────────────────────────┘ │
│ Cuádriceps · Glúteos · Isquios   🧍🧍 │  mapa con primarios/secundarios
│ Barra · Compuesto                    │
│ [Cómo se hace] [Historial] [Récords] │  pestañas
│ 1. Barra sobre la espalda alta…      │
│ 2. Pies al ancho de hombros…         │
│ 3. Baja hasta que el muslo…          │
│ ⚠ Rodillas hacia adentro · Talones…  │
│ [▶ Ver video]  [＋ Mi video]          │  YouTube (búsqueda) · link propio
│ Historial: 1RM estimado ╱╲╱‾ 121 kg  │
│ Mejor serie 110 × 6 · Última vez: hace 7 días │
│ Récords 1RM…12RM · Rango: Rubí II ›  │
│ Notas · Alternativas (mismo músculo, tu equipo) │
│ Imágenes: free-exercise-db (dominio público)    │
└──────────────────────────────────────┘
```

### Entreno en vivo

```text
Sentadilla (Barra)                        ⋮
Hoy 4 × 5 con 110 kg · la última vez 4 × 8 con 105 kg → sube 5 kg
Calentamiento: 45 × 8 · 65 × 5 · 90 × 3      [discos: 20 + 25 + 1,25 por lado]
SERIE  ANTERIOR   KG    REPS   RIR   ✓
 C     45 × 8     45     8            ✓
 1     105 × 8    110    5     ○○●○○ ✓     ← chips 0–4, opcionales
 2     105 × 8    110    5           ✓
A1 Press militar / A2 Dominadas            ← superserie: descanso al final de la ronda
[ Descanso 2:58  −15  +15  Saltar ]       pitido + voz al terminar, pantalla encendida
¡Récord! 1RM estimado 128 kg (antes 122)   aviso breve
```

### Al terminar

```text
Pierna · 58 min · esfuerzo 7 → carga 85
Volumen 12.4 t  (+6 % vs. la última vez) · Series 16 (=) · Reps 128 (+4)
Récords: Sentadilla 1RM est. 128 kg · Prensa 10RM 170 kg
Músculos: 🧍 cuádriceps, glúteos, isquios
"Subiste 5 kg en sentadilla y mantuviste las reps. Esta semana te faltan
 series de isquios (6 de 10)."
[Compartir imagen]  [Listo]
```

### ¿Qué entreno hoy? (arriba de la pestaña Entrenamiento)

```text
Hoy te recomiendo: Empuje                         [Empezar]
Pecho y hombros recuperados · piernas cansadas (ayer corriste 18 km)
Tu plan decía Pierna: mejor mañana.  Otra opción: Movilidad "Cadera" (12 min)
Recuperación 🧍 listo / recuperándose / cansado
```

## Modelo de datos (solo aditivo)

| Dónde | Campo nuevo | Para qué |
|---|---|---|
| `entrenamientos/{id}.exercises[].sets[]` | `rir` (0–4) | Reps en reserva, opcional |
| `entrenamientos/{id}.exercises[]` | `grupo` ("A", "B"…) | Superserie / circuito |
| `entrenamientos/{id}` | `rpeSesion` (1–10) | Esfuerzo de la sesión → carga = RPE × min |
| `rutinas/{id}.items[]` | `grupo` | Superserie en la rutina |
| `meta/ajustes_ejercicio` | `equipo: { activo, perfiles: { id: { nombre, barra, discos[], mancuernas{min,max,paso}, maquinas, poleas } } }`, `meta`, `nivel` | Discos, microcargas, calentamiento, generador, alternativas |
| `meta/ajustes_ejercicio` | `descargas: { desde: hasta }` | Semanas de descarga (aplicadas o del bloque) |
| `meta/ajustes_ejercicio` | `bloque: { desde, semanas, descarga }` | Bloque de 4–6 semanas del generador |
| `meta/ejercicio_fichas` | `{ [exerciseId]: { video, nota } }` | "Mi video" y notas por ejercicio |

Todo entra en "Descargar respaldo (JSON)". Los entrenos guardados no se
reescriben; los Rangos no cambian de calibración.

## Archivos (planeados)

| Archivo | Qué |
|---|---|
| `scripts/build-demos.mjs` | WebP de ~480 px desde el commit fijado de free-exercise-db |
| `img/ejercicios/{id}/0.webp`, `1.webp` | Demos (no van en el precache) |
| `data/ejercicios-tecnica.json` | Pasos y errores en español (carga diferida) |
| `js/ej-demos.js` | Demo animada, caché con límite y precarga |
| `js/ej-ficha.js` | Pantalla de la ficha |
| `js/ej-historial.js` (UMD) | 1RM estimado, récords por reps, volumen por sesión |
| `js/ej-entreno.js` (UMD) | Objetivo con porqué, calentamiento, discos, superseries, récords en vivo, resumen |
| `js/progresion.js` (v2) | Doble progresión + RIR + tendencia + microcargas |
| `js/ej-programa.js` (UMD) | Estancamiento, descarga, volumen objetivo, equilibrio, generador |
| `js/ej-volumen.js` | Tarjeta "Series por músculo" y equilibrio (Entrenamiento) |
| `js/ej-generador.js` | Hoja "Crear rutinas para mí" |
| `js/ej-recuperacion.js` (UMD) | Fatiga por músculo, recomendación del día, carga total |
| `js/ej-hoy.js` | Tarjeta "¿Qué entreno hoy?", mapa de recuperación y carga de la semana |
| `js/ej-inteligencia.js` (UMD) | Resumen por reglas de la sesión y la semana |

## Demos (fase 1, D-091)

- `scripts/build-demos.mjs` baja las 2 fotos de cada ejercicio con
  `demo: 1` desde el commit fijado de free-exercise-db y las pasa a WebP
  de 480 px con ffmpeg (calidad 75). Incremental; `--forzar` las rehace.
  Resultado: 557 ejercicios, 1114 imágenes, 15,4 MB (~14 KB cada una).
- `js/ej-demos.js`: marcado de la demo (fundido en bucle por CSS, pausa,
  quietas con "reducir movimiento", aviso sin conexión) y precarga de las
  demos de tus rutinas (mensaje `demos` al service worker).
- `sw.js`: `img/ejercicios/…` va a `manolo-demos` (máx. 240, se borran las
  más viejas) o sale de `manolo-demos-rutinas`; nunca al precache.
- `js/ej-ficha.js` (primera versión): hoja con la demo, los músculos en el
  mapa (frente y espalda), equipo, mecánica y créditos. Se abre tocando el
  nombre (o la miniatura) en el entreno y el nombre en las rutinas.
- `data/ejercicios.json` suma `mec` (`c` compuesto, `a` aislamiento), `fz`
  (`e` empuje, `t` tirón, `s` estático), `niv` (1–3) y `demo: 1`.

## Ficha del ejercicio (fase 2, D-092)

- `js/ej-ficha.js`: hoja con la demo, los músculos y 3 pestañas: **Cómo se
  hace** (pasos, errores comunes, "Ver video" y "Mi video"), **Historial**
  (última vez, mejor serie, 1RM estimado, gráficos de 1RM y volumen por
  sesión, últimas 6 sesiones) y **Récords** (1RM a 12RM real y estimado,
  y el rango con enlace a Rangos). Debajo: mis notas y 5 alternativas
  (tocar una abre su ficha, con "‹ volver").
- Se abre desde: el entreno en vivo (nombre y miniatura), la lista de
  rutinas (nombre), el editor de rutinas ("?"), el buscador ("?" en cada
  opción, sin agregar el ejercicio), Rangos ("Cómo se hace") y el detalle
  de una sesión (nombre).
- `js/ej-historial.js` (UMD, sin DOM): sesiones del ejercicio, 1RM,
  récords por reps, resumen, alternativas y enlaces de YouTube.
- **Técnica**: `data/ejercicios-tecnica.json` (56 KB) lo arma
  `npm run tecnica` (`scripts/build-tecnica.mjs`) con los pasos de
  `scripts/tecnica/pasos-*.mjs` y los errores por tipo de movimiento de
  `scripts/tecnica/patrones.mjs` (25 tipos; los 592 ejercicios tienen
  tipo y errores). Lote 1: 114 con pasos (los 85 destacados y los
  agregados por Manolo). Los demás muestran "llegan pronto" y el video;
  se completan por lotes en las fases siguientes. La app lo pide al abrir
  la primera ficha; el service worker lo guarda para usarlo sin señal.
- **Videos**: "Ver video" abre YouTube con la búsqueda "cómo hacer
  {ejercicio sin el equipo entre paréntesis} {con el equipo} técnica" (sin
  peso). "Mi video": pegas un link de YouTube (watch, youtu.be, shorts o
  embed); se guarda solo el id en `meta/ejercicio_fichas.{id}.video`; se ve
  la miniatura (`i.ytimg.com`) y el reproductor de
  `youtube-nocookie.com` carga recién al tocarla.
- **Respaldo**: "Descargar respaldo (JSON)" suma `ajustesEjercicio` y
  `fichas` (notas y videos).

## Entreno en vivo (fase 3, D-093)

- **Empezar en 2 toques**: la pestaña Entrenamiento muestra arriba "Hoy
  toca {rutina} · Empezar" (`#ej-hoy`, mismo contenido que `#rut-hoy`);
  si ya la hiciste hoy, "✓ Hecho" con "Repetir".
- **Objetivo cargado**: al empezar una rutina cada serie trae el peso de
  la progresión y las reps objetivo como guía (ya no hay que tocar "Usar"),
  y una línea dice el porqué: "Hoy 4 × 5 con 110 kg · la última vez 4 × 8
  con 105 kg → sube 5 kg". ✓ completa la serie con ese objetivo.
- **Calentamiento**: "Calentamiento: 20 × 10 · 45 × 8 · 65 × 5 · 87,5 × 3
  · Agregar" en compuestos con peso o con barra; redondeado a tu equipo.
- **Discos por lado** con barra: "Por lado (110 kg): 25 + 20" (se
  actualiza al cambiar el peso). Barra y discos salen del perfil de
  equipo (`js/ej-equipo.js`; se editan en Ajustes del gimnasio, fase 4).
- **RIR**: al marcar una serie aparecen chips 0–4+ ("¿Cuántas reps te
  quedaban?"); opcional, se guarda como `rir` en la serie.
- **Superseries y circuitos**: menú del ejercicio › "Superserie con el
  siguiente" (o en el editor de rutinas, "Superserie: A–D"). Se ven A1/A2;
  al marcar A1 no hay descanso ("Sigue con A2") y al final de la ronda
  descansas el mayor descanso de la ronda. Se guarda `grupo`.
- **Descanso**: por marcas de tiempo (correcto aunque bloquees el teléfono);
  pitidos en los últimos 3 s y al terminar pitido + voz ("Descanso
  terminado. Siguiente: Sentadilla, serie 2.") con `js/avisos.js`, el mismo
  de las rutinas de Running; la pantalla queda encendida (Wake Lock)
  mientras el entreno está abierto. Sin descanso elegido, el sugerido.
- **Récord en vivo**: "¡Récord! 1RM estimado 128 kg (antes 122 kg)" o
  "¡Récord de 5 reps: 110 kg! (antes 105 kg)".
- **Al terminar**: hoja de resumen con volumen, series y reps contra la
  última vez de la misma rutina, récords, músculos, duración y "¿Qué tan
  duro fue?" (1–10) → `rpeSesion` y la carga de la sesión. El aviso de
  "Nuevos rangos" espera a que cierres el resumen.
- Archivos: `js/ej-entreno.js` y `js/ej-equipo.js` (UMD, con pruebas),
  `js/ej-entreno-ui.js` (resumen) y cambios en `js/gimnasio.js`.

## Progresión v2, estancamiento, descarga y Ajustes (fase 4, D-094)

- **Progresión v2** (`js/progresion.js`, compatible con la anterior):
  doble progresión de siempre + el peso ajustado a tu equipo (la subida es
  al menos la microcarga posible) + RIR (si te sobraban reps, sube el
  doble o suma 2 reps) + la tendencia del 1RM estimado de las últimas 6
  sesiones + semana de descarga.
- **Estancamiento** (`js/ej-programa.js`): en el entreno, debajo del
  porqué, "Estancado: sin mejorar en 5 semanas (tu mejor 1RM estimado:
  91,8 kg)" con qué hacer (otro rango de reps, una variante con tu equipo
  o una descarga). También en la ficha (Historial).
- **Descarga**: tarjeta arriba de Entrenamiento y de Gimnasio cuando
  coinciden 2 o más señales, con el porqué; "Aplicar descarga" (7 días
  desde hoy), "Ahora no" (7 días sin preguntar, en el teléfono). Durante
  la descarga las rutinas vienen con ~40 % menos series y ~10 % menos peso
  y la tarjeta dice "Semana de descarga · hasta el …" con "Terminar".
- **Ajustes del gimnasio** (`js/ej-ajustes-gym.js`, en Gimnasio y en
  Perfil › Ajustes y datos): perfiles (Gimnasio, Casa, + Nuevo), qué
  equipo tienes, barra, discos, mancuernas, pasos de máquinas y poleas;
  tu meta (fuerza, músculo o general) y tu nivel.

## Volumen, equilibrio y generador (fase 5, D-095)

- **Series por músculo** (Entrenamiento, debajo de la distribución
  muscular): 11 músculos con una barra contra tu rango (verde), lo hecho
  (lleno) y, si tienes plan semanal, lo que te queda del plan hasta el
  domingo (rayado). "Bien", "Faltan 3" o "Mucho". Arriba, en una frase,
  a qué músculos les faltan series (los 3 más atrasados) o cuáles se
  pasan. Sin plan mira los últimos 7 días. En semana de descarga no
  reclama series.
- **Equilibrio** (últimas 4 semanas): empuje/tirón del torso,
  cuádriceps/isquios y hombro de adelante/atrás, con qué sumar si está
  desparejo.
- **Crear rutinas para mí** (Gimnasio › Rutinas › "Crear para mí" o desde
  la tarjeta): días (2–6), minutos (30–90), meta, nivel y perfil de
  equipo → propuesta con el split, las series por músculo que daría, y
  cada rutina con foto, series × reps y descanso. Se puede cambiar el
  nombre y el día, cambiar un ejercicio por otro parecido (flechas) o
  quitarlo, y tocarlo para ver la ficha. Se guardan como rutinas nuevas
  (nunca pisa las tuyas; si el nombre ya existe, "(nueva)"), el plan solo
  en días libres, y tu meta y nivel quedan en Ajustes.
- **Bloque** (opcional): 4, 5 o 6 semanas; la última es de descarga
  (agendada en `descargas`). La tarjeta muestra "Bloque: semana 2 de 5".

## Recuperación, "¿Qué entreno hoy?" y carga (fase 6, D-096)

- **¿Qué entreno hoy?** (arriba de Entrenamiento y de Gimnasio, en lugar
  del "Hoy toca"): la rutina del plan con el porqué ("Músculos listos:
  pecho, hombros y tríceps"). Si ayer (u hoy) corriste largo o duro, o si
  sus músculos todavía se recuperan, propone otra de tus rutinas con los
  músculos listos y que complete lo que te falta de la semana: "Hoy,
  jueves, tocaba Pierna · Mejor hoy: Empuje", con "Empezar Empuje" y
  "Hacer Pierna igual". Si ninguna sirve: Movilidad o descanso. Sin rutina
  en el plan: descanso, o una rutina si algo va atrasado. Si mañana sueles
  hacer una carrera larga, lo avisa ("hoy mejor sin pierna pesada").
- **Recuperación** (Entrenamiento y Perfil): figura de frente y espalda con
  cada músculo listo (verde), recuperándose (ámbar) o cansado (rojo), y la
  lista de los que no están listos con cuándo lo estarán ("listo el sáb").
  Cuenta tus entrenos y tus carreras y salidas en bici.
- **Carga de la semana** (Entrenamiento): barras por día con gimnasio,
  Running y bici en la misma escala, el total contra tu semana típica (las
  4 anteriores) y una frase.

## Fórmulas

- **1RM estimado (Epley)**: kg × (1 + reps / 30); 1 rep = el peso; reps
  topadas en 12 (igual que Rangos). Con RIR: reps + RIR. En peso
  corporal: carga = tu peso de ese día × factor del ejercicio + lastre −
  asistencia. Peso para n reps: 1RM / (1 + n / 30).
- **Récords por reps**: "tu mejor" n RM = el mayor peso con el que hiciste
  al menos n reps; "estimado" = el de tu mejor 1RM con Epley.
- **Alternativas**: comparten al menos un músculo principal; puntaje =
  2 × Jaccard(principales) + 0,5 × Jaccard(los que ayudan) + 0,6 si es el
  mismo tipo de movimiento + 0,3 si es destacado + 0,1 si tiene la misma
  mecánica; −1 si es olímpico y el original no. Misma familia (fuerza,
  isométrico o cardio), sin movilidad; con perfil de equipo (fase 4), solo
  el equipo disponible.

- **Calentamiento**: 40 % × 8, 60 % × 5 y 80 % × 3 del peso de trabajo,
  redondeados a tu equipo; con barra, primero la barra sola × 10 si el
  peso de trabajo es ≥ 3 veces la barra. Solo compuestos con peso o con
  barra, y si el peso de trabajo pasa de la barra + 10 kg (o de 15 kg).
- **Descanso sugerido** (ACSM, 2009): compuesto de músculos grandes con
  ≤ 6 reps, 3 min; con más reps, 2:30; otro compuesto, 2 min;
  aislamiento, 75 s; isométrico, 1 min; cardio, nada.
- **Redondeo al equipo**: barra = barra + múltiplos de 2 × el disco más
  chico; mancuernas y kettlebells, al peso más cercano de la lista (mín.,
  máx., paso); máquinas de 5 en 5 y poleas de 2,5 en 2,5 (editables).
  Discos por lado: de mayor a menor mientras entren.
- **Récord en vivo**: si el 1RM estimado de la serie supera tu mejor
  (historial + series ya marcadas hoy), o si el peso supera tu mejor peso
  con al menos esas reps (hasta 12). Sin historial no hay récords.
- **Carga de la sesión** (session RPE, Foster et al., 2001): RPE × minutos ×
  100 / 480, la misma escala que Running (1 hora a RPE 8 = 100; D-065).

- **Progresión v2**: al tope del rango en todas las series → +2,5 kg
  (tren superior) o +5 kg (inferior), redondeado a tu equipo y nunca
  menos que la microcarga (2 × el disco más chico, el paso de mancuernas o
  de la máquina); con RIR medio ≥ 3, el doble. Sin llegar al tope → mismo
  peso y +1 rep por serie (+2 con RIR ≥ 2). Dos veces seguidas bajo el
  mínimo → −10 %. El RIR medio cuenta si se anotó en al menos la mitad de
  las series. Tendencia: pendiente de mínimos cuadrados del mejor 1RM
  estimado de cada sesión (kg por semana).
- **Estancamiento**: con 4+ sesiones, si el mejor 1RM estimado no se
  superó (por más de 0,5 %) en las 3 sesiones siguientes, o en 4 semanas
  con al menos 2 sesiones.
- **Señales de descarga** (se sugiere con 2+; nunca dentro de las 4
  semanas siguientes a otra): (1) en 2+ ejercicios la última sesión de las
  últimas 5 semanas quedó ≥ 3 % bajo el promedio de las 2 anteriores; (2)
  RPE medio de las últimas 2 semanas ≥ 1 punto sobre las 2 anteriores (con
  3+ datos en cada una) o RIR medio ≤ 0,5; (3) 6+ semanas seguidas con 2
  o más entrenos desde la última descarga.
- **Semana de descarga**: series × 0,6 (redondeado, mínimo 1) y peso × 0,9
  redondeado hacia abajo a tu equipo; 7 días.

- **Series efectivas por músculo**: por cada serie de trabajo, 1 si el
  músculo es principal y 0,5 si ayuda; cada ejercicio suma una sola vez
  por músculo aunque toque varias zonas (pecho alto y medio = pecho).
- **Rango por semana** (Schoenfeld et al., 2017; ACSM, 2009): músculo
  10–20, fuerza 6–15, general 6–12. Principiante: mínimo × 0,7 y máximo ×
  0,75; avanzado: máximo × 1,1. Músculos chicos (hombro lateral y
  posterior, bíceps, tríceps, pantorrillas, abdominales): mínimo × 0,6
  (al menos 3), porque ya trabajan en los ejercicios grandes.
- **Equilibrio** (con 6+ series en el par): empuje/tirón del torso (series
  de trabajo de ejercicios de empuje o tirón sin piernas como principal)
  entre 1:1,5 y 1,5:1; cuádriceps/isquios hasta 2:1; deltoide
  anterior/posterior hasta 3:1.
- **Generador**: split por días (2–3 cuerpo completo; 4 torso/pierna; 5
  empuje/tirón/pierna + torso/pierna; 6 empuje/tirón/pierna × 2). Cada
  sesión tiene huecos de movimiento (sentadilla, bisagra, empuje y tirón
  horizontal y vertical, accesorios); para cada hueco, el mejor ejercicio
  con tu equipo y nivel (destacados y con peso primero; barra, mancuernas,
  máquinas…; en accesorios, de aislamiento), variando entre sesiones.
  Dosis: músculo 3 × 6–10 / 2 min (compuestos) y 3 × 10–15 / 75 s
  (aislamiento); fuerza 4 × 3–5 / 3 min el primero, 3 × 5–8 / 2:30 otros
  compuestos; general 3 × 8–12 / 90 s y 2 × 12–15 / 60 s. Principiante −1
  serie (mín. 2); avanzado +1 en compuestos. Tiempo = series × (descanso
  + 45 s). Si no entra: accesorios a 2 series y después se quitan los
  menos importantes (mín. 3). Después se revisa la semana: equilibrio
  (sumar del lado que falta o bajar del que sobra), músculos bajo el
  rango (un accesorio donde haya tiempo) y sobre el rango (una serie
  menos, accesorios primero).
- **Bloque**: empieza el lunes de esta semana (o el próximo si hoy es
  jueves o más tarde); la última semana es de descarga (series × 0,6 y
  peso × 0,9, como en la fase 4).

- **Fatiga por músculo**: cada serie de trabajo suma 1 a sus músculos
  principales y 0,5 a los que ayudan (× 1,15 con RIR ≤ 1 o esfuerzo de la
  sesión ≥ 9; × 0,85 con RIR ≥ 3 o esfuerzo ≤ 5) y baja con el tiempo:
  × e^(−horas / τ), τ = 30 h en músculos grandes (cuádriceps, isquios,
  glúteos, espalda, lumbares, pecho) y 22 h en el resto. Listo < 1,5 ≤
  recuperándose < 4 ≤ cansado. Listo en τ × ln(valor / 1,5) horas. Correr
  suma por cada 100 de carga 5 series a cuádriceps y pantorrillas y 3,5 a
  isquios y glúteos; la bici, 4 a cuádriceps, 2,5 a glúteos y 1,5 a
  pantorrillas e isquios (sin RPE se supone 5).
- **Carrera larga o dura** (ayer u hoy): ≥ 15 km, carga ≥ 120 o RPE ≥ 8.
  **Mañana sueles correr**: corriste ese día de la semana en 3+ de las
  últimas 6 semanas; es exigente si la mediana es ≥ 12 km o carga ≥ 100.
- **Rutina que sirve hoy**: menos del 25 % de sus series en músculos
  cansados y menos del 60 % recuperándose; si es de pierna (≥ 35 % de sus
  series) y hubo o habrá carrera exigente, no. Entre las que sirven gana
  la que más completa lo que falta de la semana y menos fatiga tiene.
- **Carga del gimnasio** (Foster et al., 2001): esfuerzo de la sesión ×
  minutos × 100 / 480; sin esfuerzo anotado, el RPE medio de las series
  (o 10 − RIR) o 7; sin duración, 2,5 min por serie. Running y bici usan
  su carga (D-065). Semana típica = promedio de las 4 semanas anteriores.

Las siguientes se completan en cada fase (fuentes en `DECISIONS.md`).
