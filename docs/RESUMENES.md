# Tu semana y Tu año en Manolo

Pedido del dueño (2026-11-16): "Haz el 1, 2 y 4, desarróllalos de la manera
más completa posible". Es decir:

1. **"Tu 2026 en Manolo"**: un resumen de tu año con todo junto.
2. **"Tu semana"**: cada lunes, un repaso corto de la semana en todas tus
   áreas.
4. **Bici al nivel de Running** (plan en `docs/CYCLING.md`).

Decisión de diseño: D-136. Estado de las fases en
`.claude/CURRENT_PHASE.md`.

## Auditoría (fase 0)

Lo que ya existe y se aprovecha:

| Sección | Datos (todos se cargan completos al abrir la app) | Lo que ya calcula |
|---|---|---|
| Hábitos | `habitos` (registros por día) | `HabitosEngine.resumenSemana` y `wrapped` (el "Manolo Wrapped" de Hábitos, con sus diapositivas) |
| Gimnasio | `entrenamientos` | `EjSesiones.resumen` / `records`, `EjInteligencia.resumenSemana` / `racha`, `Gimnasio.volumen` |
| Running y Bici | `running`, `bicicleta` (+ `rutas`) | `RunAnalisis` (períodos, marcas, metas, racha), `ActividadAnalisis.porSemana` |
| Movilidad | `movilidad` (una por rutina completada) | racha y "esta semana" |
| Libros | `libros`, `libros_frases` | `LibrosEstadisticas.anio` ("Tu año en libros"), páginas por día |
| Biblia | `biblia` (versículos), `meta/biblia_leidos` (capítulos por día) | `BibliaMotor.racha`, planes |
| Finanzas | `finanzas` (movimientos en centavos) | `FinanzasAnalisis` (gasto e ingreso sin transferencias ni excluidos) |
| Medir tiempos | `tiempos` (segundos por actividad y día) | `TiemposStats` (mi mañana por día, mediana) |
| Lugares | `lugares` (calificación, visitas con fecha) | zonas, ordenar |
| Ropa | `ropa` (nombre, color, fecha de compra), `ropa_usos` (lo que te pusiste cada día) | `RopaNumerosMotor.familiaDe` (la familia de cada color); D-151 |

Todas las secciones escuchan sus datos completos al abrir Manolo y los
comparten con globales (`HabitosApp`, `Gimnasio`, `RunDatos`, `LibrosDatos`,
`TiemposDatos`, `LugaresApp`, `FinanzasResumen`…) o con el evento
`manolo:fuente`. **Los resúmenes no leen nada nuevo de Firestore**: son
instantáneos, no cuestan lecturas y funcionan sin internet.

## Diseño

### Piezas (código)

| Archivo | Qué hace |
|---|---|
| `js/resumen-motor.js` | Sin pantalla (UMD, `node --test`): con los datos ya normalizados de cada sección arma la semana (cifras por área, contra la semana anterior y tu promedio de 4 semanas, lo mejor, lo que se quedó atrás y una sugerencia) y el año (cifras, récords, mejor mes, rachas, comparación con el año anterior) |
| `js/resumen-fuentes.js` | Junta lo que cada sección ya tiene en memoria y lo deja en un formato común (fechas AAAA-MM-DD, km, minutos, centavos) |
| `js/resumen-semana-ui.js` | La tarjeta de Inicio y la pantalla `#semana` |
| `js/resumen-anio-ui.js` | "Tu año" a pantalla completa (diapositivas tipo historia) |
| `js/resumen-imagen.js` | Imágenes para compartir (1080 × 1920): `plan()` sin pantalla, `dibujar()` en un canvas, como `js/run-compartir.js` |

### "Tu semana"

- **Inicio, lunes y martes**: tarjeta "Tu semana · 10–16 nov" con el
  titular y 3 cifras. "Ver" abre la pantalla; "Listo" la oculta hasta el
  lunes siguiente (se recuerda en el teléfono). El resto de la semana no
  aparece sola, pero siempre está en el menú ☰ › "Tu semana" y al pie de
  Inicio.
- **Pantalla `#semana`** (‹ semana › para ir a las anteriores; también
  "Esta semana, hasta hoy"):

```text
← Inicio                  Tu semana
‹  10 – 16 nov  ›
Semana fuerte: 3 entrenos, 21 km corriendo y el 82 % de tus hábitos.
Lo mejor
  🏅 Nuevo récord en 5K: 24:10
  📚 Terminaste «Hábitos atómicos»
  🔥 4 días perfectos de hábitos
Por área                                  vs semana anterior
  Hábitos   82 %            ▲ 9 pts      mejor: Leer 30 min
  Gimnasio  3 de 4 entrenos · 52 series · 8.400 kg · 1 récord
  Running   21,3 km · 3 carreras · 2:05 h        ▲ 4,1 km
  Bici      45 km · 2 rodadas
  Libros    142 páginas · 5 días leyendo · 1 terminado
  Biblia    6 de 7 días · 9 capítulos
  Finanzas  Bs 1.240 gastados  ▼ 12 % vs tu promedio · 2 días sin gastar
  Mi mañana 54 min de promedio (5 días)  ▲ 3 min más rápido
Se quedó atrás
  • «Meditar»: 1 de 7 días
  • Comida: Bs 420, 40 % más que tu promedio
Para esta semana
  Intenta 4 entrenos: la semana pasada hiciste 3 de 4.
[ Compartir mi semana ]
```

- Solo aparecen las áreas que usas (con algo en las últimas 8 semanas).
- Las comparaciones son contra la semana anterior y tu promedio de las 4
  anteriores, para que una semana rara no exagere.
- "Se quedó atrás" (hasta 3) y "Para esta semana" (una sola sugerencia)
  salen de reglas simples, sin IA: la mayor caída contra tu promedio, un
  hábito en riesgo, un plan del gimnasio sin completar, gastar más de lo
  habitual. La sugerencia es concreta y alcanzable.

### "Tu año" ("Tu 2026 en Manolo")

- Diapositivas a pantalla completa, como el "Manolo Wrapped" de Hábitos:
  tocar a la derecha avanza, a la izquierda vuelve; teclado y lector de
  pantalla.
- **Cuándo**: siempre disponible (menú ☰ › "Tu año"; si el año no
  terminó dice "hasta hoy"). En Inicio aparece una tarjeta del 1 de
  diciembre al 31 de enero (en enero, la del año que terminó). Años
  anteriores con datos, para elegir.
- **Diapositivas** (solo las de las áreas que usaste ese año):
  1. Portada: "Tu 2026 en Manolo" y cuántos días registraste algo.
  2. El año en números: días activos, entrenos, km, libros, capítulos,
     hábitos cumplidos.
  3. Hábitos: cumplimiento, el mejor mes, el hábito estrella, la mejor
     racha (y "Ver tu año en hábitos", el Wrapped completo de Hábitos).
  4. Gimnasio: entrenos, horas, series, kg movidos, récords del año, el
     ejercicio que más hiciste, tu mejor mes.
  5. Running: km, carreras, horas, desnivel, la más larga, tus mejores
     marcas del año.
  6. Bici: km, rodadas, horas, desnivel, la más larga.
  7. Movilidad: rutinas y minutos.
  8. Libros: terminados, páginas, tu libro del año (5 ★), autor y frase
     del año.
  9. Biblia: capítulos leídos (y % de la Biblia), días con lectura,
     versículos guardados, el libro que más leíste.
  10. Finanzas: cuánto ahorraste de lo que ganaste (%), el mes que más
      ahorraste, en qué se fue más, días sin gastar.
  11. Mi mañana: días medidos, tu promedio y cuánto mejoraste.
  12. Lugares: lugares nuevos, el mejor calificado, tu zona.
  13. Ropa (D-151): tu prenda del año, los días con tu ropa anotada, las
      prendas distintas, tu color del año y lo que compraste (sin plata).
  14. Tu mejor mes (con más actividad en todo) y tu día de la semana.
  15. Contra el año anterior (si hay datos): más km, más libros…
  16. Cierre: "Gracias por un año más", "Compartir tu año" y "Verlo otra
      vez".
- **Compartir**: cada diapositiva tiene "Compartir" (imagen vertical
  1080 × 1920) y al final una imagen con lo mejor del año. **Sin montos de
  dinero**: Finanzas se comparte solo en porcentajes y no entra en la
  imagen del año. Nada sale de Manolo hasta que eliges dónde.

### Hecho en la fase 1 (D-137)
`js/resumen-motor.js` y `js/resumen-fuentes.js`; en Finanzas,
`FinanzasResumen.movimientos()` y `categorias()` (solo leen). Pruebas:
`tests/resumen-motor.test.js` y `scripts/e2e/resumenes.js` (los datos de
las 10 secciones llegan al motor en la app).

### Hecho en la fase 2 (D-138)
`js/resumen-semana-ui.js` (tarjeta de Inicio y `#semana`),
`js/resumen-imagen.js` (imagen sin dinero) y `css/resumenes.css`; "Tu
semana" en el menú ☰ y al pie de Inicio.

### Hecho en la fase 3 (D-139)
`js/resumen-anio.js` (el contenido de cada diapositiva, años con datos) y,
en `js/resumen-fuentes.js`, `datos({ anio })` con el Wrapped de Hábitos y
"Tu año en libros"; las carreras traen sus mejores marcas y la Biblia los
nombres de sus libros.

### Hecho en la fase 4 (D-140)
`js/resumen-anio-ui.js` (el visor, la tarjeta de Inicio de diciembre y
enero, "Tu año" en el menú ☰ y al pie de Inicio), las imágenes de cada
diapositiva y la del año en `js/resumen-imagen.js` y, en Hábitos,
`HabitosApp.abrirWrapped(año)` para "Ver tu año en hábitos".

### Ropa (D-151)
"Tu semana" suma el área Ropa (los días que anotaste lo que te pusiste, lo
que más te pusiste y lo que compraste) y "Tu año", su diapositiva (tu prenda
del año). Los días con ropa anotada cuentan como días con algo.

### Datos

Ningún campo nuevo en Firestore para los resúmenes. En el teléfono:
"manolo.semana.vista" (la semana que ya viste en Inicio) y
"manolo.anio.visto" (la tarjeta del año que cerraste).
