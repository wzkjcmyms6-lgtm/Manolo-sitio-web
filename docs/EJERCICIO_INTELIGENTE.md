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
| 2 | Ficha del ejercicio (técnica, videos, historial, récords, alternativas) | |
| 3 | Entreno en vivo (objetivo, RIR, calentamiento, discos, superseries, descanso con aviso, récords, resumen) | |
| 4 | Progresión v2, estancamiento, descarga + Ajustes del gimnasio | |
| 5 | Volumen semanal, equilibrio y generador de rutinas | |
| 6 | Recuperación, "¿Qué entreno hoy?" y carga total con Running | |
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
| `meta/ajustes_ejercicio` | `descarga: { desde, hasta }` | Semana de descarga aplicada |
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
| `js/ej-recuperacion.js` (UMD) | Fatiga por músculo, recomendación del día, carga total |
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

## Fórmulas

Se completan en cada fase (fuentes en `DECISIONS.md`).
