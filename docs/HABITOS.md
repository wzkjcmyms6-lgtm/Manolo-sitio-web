# Hábitos

Módulo de hábitos de Manolo: marcar el día, rachas, rangos por hábito, XP y
nivel, jefe semanal, misiones, logros, tienda, estadísticas, Manolo Wrapped
y el plan guiado de Scalping (`docs/SCALPING.md`, no se toca).

## Archivos
| Archivo | Qué hace |
|---|---|
| `js/habitos-config.js` | **Única** fuente de constantes (tipos, estados, XP, NIVEL, FUERZA, misiones, jefe, logros) |
| `js/habitos-engine.js` | Motor puro: todo se recalcula desde el historial (rachas, XP, rango, misiones, jefes, logros, estadísticas, copia) |
| `js/habitos-categorias.js` | Categorías (antes "áreas de vida"): modelo, migración en lectura, paleta, sugerencias (fase 1) |
| `js/habitos-graficos.js` | Gráficos SVG (líneas, columnas, radar) |
| `js/habitos.js` | Pantallas Hoy, detalle, formulario, Estadísticas, Logros y Firestore |
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
12. Se guardan en `meta/habitos_juego.categorias` (el mismo documento que
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

Propuestas extra (las decide el dueño; aparecen como "Sugeridas" para
crearlas con un toque): **Fe** 🙏 Índigo (Biblia, orar), **Lectura** 📚
Celeste (Libros), **Cuidado personal** 💆 Lima (Scalping, piel) y
**Hogar** 🏠 Piedra.

### Hoy
Fila de filtros (Todas · cada categoría con sus pendientes), "Agrupar por"
Momento o Categoría, color de la categoría en cada fila, progreso por grupo
y "Ocultar hechos". Un toque marca; mantener presionado abre las opciones
del día. Boceto en el checkpoint de la fase 0.

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
| 50 % | Rubí II | Bronce III |
| 70 % | Esmeralda III | Plata III |
| 80 % | Diamante I | Oro III |
| 90 % | Campeón I | Rubí III |
| 95 % | Inquebrantable | Esmeralda III |
| 98 % | Inquebrantable | Diamante III |

Nivel del jugador con 5 hábitos al 80 % (con misiones y jefes):

| Tiempo | Antes | Después |
|---|---|---|
| 3 días | 3 | 2 |
| 1 mes | 10 | 5 |
| 6 meses | 23 | ~11 |
| 1 año | 31 | ~15 |
| 2 años | 43 | ~20 |

Cómo: `ALFA_SUBE` 0,021 → 0,007, `ALFA_BAJA` = 4 × `ALFA_SUBE`,
`MIN_DIAS_MAXIMO` 300 → 540, curva de nivel `95 × (n − 1)^2,08`. El XP de
cada registro no cambia (las monedas ganadas quedan igual).
