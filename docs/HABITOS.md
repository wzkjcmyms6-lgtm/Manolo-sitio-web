# Hábitos

Módulo de hábitos de Manolo: marcar el día, rachas, rangos por hábito, XP y
nivel, jefe semanal, misiones, logros, tienda, estadísticas, Manolo Wrapped
y el plan guiado de Scalping (`docs/SCALPING.md`, no se toca). Desde
2026-11-05 tiene categorías completas, la Temporada 2 (subir cuesta más),
Hoy filtrado y agrupado, página por categoría, "se marca solo" con los
demás módulos y plantillas (plan de 9 fases, D-079 a D-087).

## Archivos
| Archivo | Qué hace |
|---|---|
| `js/habitos-config.js` | **Única** fuente de constantes (tipos, estados, XP, NIVEL, FUERZA, misiones, jefe, logros) |
| `js/habitos-engine.js` | Motor puro: todo se recalcula desde el historial (rachas, XP, rango, misiones, jefes, logros, estadísticas, copia) |
| `js/habitos-categorias.js` | Categorías (antes "áreas de vida"): modelo, migración en lectura, paleta, sugerencias (fase 1) |
| `js/habitos-hoy.js` | Lista de Hoy: filtros, grupos (momento o categoría), cadenas, hora y pendientes (fase 4) |
| `js/habitos-graficos.js` | Gráficos SVG (líneas, columnas, radar) |
| `js/habitos.js` | Pantallas Hoy, detalle, formulario, Estadísticas, Logros y Firestore; expone `window.HabitosApp` para las pantallas en archivos aparte |
| `js/habitos-categorias-ui.js` | Hojas de categorías: lista, crear/editar, sugeridas, archivar, asignar en lote (fase 3) |
| `js/habitos-categoria.js` | Página de una categoría `#hab-categoria/{id}` (fase 5) |
| `js/habitos-auto.js` | Se marca solo: fuentes, valor de cada día, qué poner y qué deshacer (fase 6) |
| `js/habitos-plantillas.js` | 39 plantillas de hábitos, búsqueda y paso al formulario (fase 7) |
| `js/habitos-plantillas-ui.js` | Hoja de plantillas (fase 7) |
| `js/habito-scalping.js` | Tarjeta y pantalla de Scalping |
| `tests/habitos-engine.test.js` | Pruebas del motor; `tests/habitos-sim.js` simula la dificultad |

## Datos (Firestore)
- `users/{uid}/habitos/{id}`: `name, emoji, tipo, freqType, days,
  timesPerWeek, cadaN, timeOfDay, dificultad, area, minima, despuesDe,
  vinculo, meta, unidad, descripcion, registros{AAAA-MM-DD:{e,v,t,m,n}},
  done[], inicio, orden, archivado, pausas[]`. `area` guarda el **id de la
  categoría**. Cada día se escribe por ruta de campo (`registros.F`).
- `users/{uid}/meta/habitos_juego`: `prefs` (fin del día, sonidos, nombres
  viejos de áreas), `recompensas`, `compras`, `misiones`, `jefes`,
  `snapshot` (lo ya celebrado) y, desde 2026-11, `categorias` y la
  calibración de la Temporada 2 (fases 1–2).
- `users/{uid}/meta/habitos_dias`: ánimo y nota de cada día.

## Auditoría (fase 0, 2026-11-05)
Con datos realistas (9 hábitos, 3 meses al ~80 %, `scripts/e2e/habitos-semilla.js`)
a 390 px:

1. **Demasiado fácil**: a los 3 meses, nivel 16 "Disciplinado" y la
   categoría Cuerpo en nivel 16; 9 hábitos entre Plata y Diamante.
2. **Las categorías casi no se ven**: no aparecen en Hoy; 2 de 9 hábitos
   "Sin área" y no hay forma rápida de asignarlas; las tarjetas de Áreas en
   Logros no se pueden abrir.
3. **Formulario largo**: unas 3 pantallas y "Crear hábito" solo al final.
4. La sugerencia de Scalping ocupa un cuarto de la pantalla arriba de Hoy.
5. El pie de Hoy (Cerrar el día · Ordenar · Ajustes) se parte en dos líneas.
6. El rango no explica por qué está donde está ni cuánto falta.
7. Parcial, mínima, saltar y nota piden abrir el detalle (2–3 toques).
8. Estadísticas: 14 tarjetas seguidas sin filtro.

## Diseño
### Categorías
Las 6 áreas se vuelven categorías con los mismos ids (`cuerpo, mente,
dinero, carrera, bienestar, social`) y los nombres que les puso el dueño.
Cada una: nombre, emoji, color (paleta cerrada), orden y archivada. Límite
16 activas (era 12; subió al sumar 4 de fábrica, D-088). Se guardan en `meta/habitos_juego.categorias` (el mismo documento que
ya se escucha: cero lecturas nuevas). Sin el campo, se arman al leer desde
`prefs.areas`.

Paleta (se lee bien sobre el fondo oscuro y no choca con el dorado):
Coral `#f2716b` · Rosa `#f472b6` · Violeta `#a78bfa` · Índigo `#818cf8` ·
Azul `#60a5fa` · Celeste `#22d3ee` · Turquesa `#2dd4bf` · Verde `#4ade80` ·
Lima `#a3e635` · Piedra `#a8a29e`.

| Id | Emoji | Color |
|---|---|---|
| cuerpo | 💪 | Coral |
| mente | 🧠 | Violeta |
| dinero | 💰 | Verde |
| carrera | 💼 | Azul |
| bienestar | 🌿 | Turquesa |
| social | 🤝 | Rosa |

| fe | 🙏 | Índigo |
| lectura | 📚 | Celeste |
| cuidado | 💆 | Lima |
| hogar | 🏠 | Piedra |

Las 4 últimas las propuso la fase 0 y el dueño las eligió (D-088): vienen
de fábrica junto a las 6 de siempre (10 en total, hasta 16 activas).

### Gestión (fase 3)
Ajustes › Categorías: lista con su color y cuántos hábitos tiene, flechas
para ordenar, "+ Nueva categoría", "Asignar categorías · N sin categoría",
Sugeridas y Archivadas (Restaurar). Editar: nombre, 10 colores, emojis o
uno propio; Archivar (con historial y sin hábitos activos) o Eliminar
(nunca usada). Formulario del hábito: chips de categoría con su color,
"Sin categoría" y "+ Nueva".

### Hoy (fase 4)
Fila de filtros (Todas · cada categoría con sus pendientes, y "Sin
categoría" si hay), "Momento | Categoría" para agrupar, "Ocultar hechos",
color de la categoría en cada fila y progreso por grupo. Un toque marca;
mantener presionado (o clic derecho) abre las opciones del día (valor,
mínima, parcial, saltar con motivo, nota, cronómetro). Lógica:
`js/habitos-hoy.js` (`filtros`, `grupos`, `ordenarGrupo` con la hora
opcional, `pendientesMomento`).

### Página de categoría y estadísticas (fase 5)
- `#hab-categoria/{id}`: cabecera con emoji y color, nivel y XP de la
  categoría ("Te faltan 153 XP para el nivel 6: a tu ritmo, 10 días"),
  Esta semana y Últimos 30 días contra el periodo anterior, racha activa y
  mejor racha, mapa de calor, tendencia, ranking por fuerza, en riesgo y
  logros (niveles 5, 10, 15, 20). Vacía: "Crear un hábito" (ya con la
  categoría) y "Asignar hábitos". "Atrás" vuelve a Hoy, Estadísticas o
  Logros según de dónde viniste.
- Estadísticas: filtro de categoría arriba (aplica a todas las tarjetas),
  "Por categoría" y "Equilibrio entre categorías" (radar 3–8 ejes, si no
  barras).
- Gamificación: misión de categoría en semanas pares; logros Especialista
  (nivel 5) y Maestría (nivel 10) de una categoría.

### Se marca solo (fase 6)
| Fuente | Sí/No | Medible / Tiempo | Notas |
|---|---|---|---|
| Running, Bici | hubo carrera/rodada | km, minutos o cuántas | `manolo:actividades` |
| Movilidad | completaste una rutina (o una en particular) | minutos o cuántas | `manolo:fuente` |
| Libros | leíste ese día | páginas del día | `LibrosProgreso.paginasPorDia` |
| Biblia | anotaste una lectura | cuántas | |
| Finanzas | anotaste un movimiento | cuántos | |
| Gasto (Evitar) | un gasto en la categoría = recaída | — | |
| Gimnasio | al guardar un entreno | meta | evento `entreno:guardado` |

Datos nuevos del hábito: `vinculo`, `vinculoCfg { medida, rutina,
categoria }`, `vinculoDesde`; en el registro, `auto: { f, v }`.

### Crear más rápido y avisos (fase 7)
- Plantillas (📋 arriba de "Nuevo hábito"): por categoría, con buscador.
- Sugerencia de categoría al escribir el nombre.
- Hora opcional (`hora`), que ordena dentro del momento.
- Aviso de pendientes del momento en Inicio y en Hoy. Push y Calendario:
  ver `docs/NOTIFICATIONS.md` (esperan el OK del dueño).

### Dificultad: antes y después (simulación con el motor real)
Hábito diario cumplido el 100 %:

| Tiempo | Antes | Después |
|---|---|---|
| 1 semana | Bronce I | Hierro II |
| 1 mes | Oro II | Bronce II |
| 3 meses | Diamante I | Oro II |
| 6 meses | Campeón III | Esmeralda I |
| 1 año | Inquebrantable | Diamante III |
| 1,5 años | Inquebrantable | Inquebrantable |

Techo según constancia (lo máximo al que se llega sosteniéndola):

| Constancia | Antes | Después |
|---|---|---|
| 50 % | Rubí II | Bronce II |
| 70 % | Esmeralda III | Plata II |
| 80 % | Diamante I | Oro II |
| 90 % | Campeón I | Rubí III |
| 95 % | Inquebrantable | Esmeralda III |
| 98 % | Inquebrantable | Diamante III |
| 99 % | Inquebrantable | Inquebrantable (con ~1,5 años) |

(Fallos repartidos parejo. Si al 50 % los fallos vienen de a tres
seguidos, se queda en Hierro: tres seguidos bajan una división.)

Nivel del jugador con 5 hábitos al 80 % (con misiones y jefes):

| Tiempo | Antes | Después |
|---|---|---|
| 3 días | 3 | 2 |
| 1 mes | 10 | 5 |
| 6 meses | 23 | ~11 |
| 1 año | 31 | ~15 |
| 2 años | 43 | ~20 |

Cómo (fase 2, `js/habitos-config.js`):
- Fuerza: `ALFA_SUBE` 0,021 → 0,007; `ALFA_BAJA` 0,0126 → 0,032 (un fallo
  pesa ~4,6 veces un día cumplido; con 4× exacto el 98 % llegaba a
  Campeón); `MIN_DIAS_MAXIMO` 300 → 540; la versión mínima vale 50 % (antes
  70 %) y un parcial, el 80 % de lo hecho.
- Bajar de división: un fallo suelto nunca baja (se tolera lo que quita un
  fallo desde el piso); **3 fallos seguidos bajan una división** y hacen
  falta 3 cumplidos seguidos para recuperarla. Sin "escudo" tras subir.
- Semanales: cada sesión cuenta como un paso (3 por semana = cada 7/3
  días); una semana incompleta pesa como los días fallados de un diario.
- Nivel del jugador: `95 × (n − 1)^2,08` (antes `16 × (n − 1)^2,14`).
  Nivel de categoría: `80 × (n − 1)^2` (antes 8). Comodín: 350 monedas
  (antes 80): uno cada ~3,3 semanas con constancia normal.
- El XP de cada registro no cambia, así que las monedas ganadas quedan igual.

### Temporada 2 (transición)
`meta/habitos_juego.calibracion` guarda la versión (2). La primera vez que
se abre la versión nueva: el snapshot se reemplaza en silencio por el de
ahora (sin celebrar ni avisar bajadas), conservando los logros ganados;
el nivel y los mejores rangos de antes quedan en `temporada1 { nivel,
rangos, logros, hasta, nivelNuevo, visto }` y se ve la hoja "Temporada 2:
ahora subir cuesta más" hasta tocar "Entendido". En Logros: tarjeta
"Temporada 1", y los logros ganados siguen como conseguidos aunque hoy no
se cumplan. Un usuario sin historia no ve la hoja.

### Por qué cuesta (en pantalla)
- Detalle del hábito: "Con tu 82 % de los últimos 90 días, tu techo es Oro;
  para Rubí necesitas ~85 %. Cumpliendo todo lo que toca, llegas a Oro III
  en 12 días." (`HE.explicarRango`, fórmula del estado estable
  `p·sube / (p·sube + (1−p)·baja)`).
- Logros: "Te faltan 340 XP para el nivel 6: a tu ritmo (~65 XP por día),
  6 días." (`HE.explicarNivel`, XP de los últimos 28 días).

## Pruebas
- Unitarias: `habitos-engine` (motor), `habitos-dificultad` (simulaciones de
  la tabla: 100/98/95/90/80/70/50 % diarios y semanales, nivel con 5
  hábitos al 80 %, un fallo no baja y tres sí, comodín cada 3–4 semanas),
  `habitos-categorias` (migración desde áreas, crear, archivar, reasignar,
  sugerir, radar con muchos ejes, misiones y logros por categoría, frases),
  `habitos-hoy` (filtros, grupos, cadenas, hora), `habitos-auto` (se marca
  solo, deshacer, lo manual manda, sin XP al rellenar) y
  `habitos-plantillas` (plantillas válidas).
- E2E: `scripts/e2e/habitos.js` (390 y 1280 px) y las de siempre
  (`scalping`, `regresion`, `fase1`, `emojis`, `hojas`).
- Lista para el iPhone: `docs/TESTING.md` › "Hábitos: categorías y
  siguiente nivel".

## Auditoría: qué se arregló
| Problema (fase 0) | Arreglo |
|---|---|
| Demasiado fácil | Temporada 2 (fase 2) |
| Categorías invisibles, "Sin área" sin forma rápida | Colores en Hoy, filtros, página, asignar en lote (fases 3–5) |
| Formulario largo | "Más opciones", botones fijos, plantillas (fases 3 y 7) |
| Sugerencia de Scalping grande | Una línea (fase 4) |
| Pie partido en dos líneas | Una línea (fase 4) |
| El rango no explicaba nada | Techo, constancia necesaria y días (fase 2) |
| Parcial/saltar/nota a 2–3 toques | Mantener presionado (fase 4) |
| Estadísticas sin filtro | Filtro de categoría (fase 5) |

## Para después (no hecho)
Push con la app cerrada; recordatorios en el Calendario (investigados en
`docs/NOTIFICATIONS.md`); metas que agrupen hábitos ("Correr un 10K");
más planes guiados como Scalping.
