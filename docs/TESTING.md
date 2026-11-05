# Pruebas

## Estado actual
- 2026-11-05 (Ejercicio inteligente, fases 0–8): `npm test` → **480
  pruebas**. Nuevas: `ej-historial`, `ej-equipo`, `ej-entreno`,
  `ej-programa` (progresión v2, estancamiento, descarga, volumen,
  equilibrio, generador), `ej-recuperacion` y `ej-inteligencia`. E2E
  `scripts/e2e/ejercicio.js` (9 semanas de entrenos realistas en
  `ejercicio-semilla.js`, a 390 y 1280 px; por partes con `SOLO=demos`,
  `ficha`, `entreno`, `programa`, `volumen`, `hoy` o `perfil`).
- 2026-11-04 (Running fase 1): `npm test` → **356 pruebas**. Nuevas:
  `run-formatos` (GPX, TCX, FIT armado byte a byte en
  `tests/run-fixtures.js`: big-endian, horas comprimidas, campos de
  desarrollador, pausas, vueltas), `run-zip` (ZIP64, lectura parcial, gzip,
  respaldo sin deflate-raw), `run-csv` (columnas repetidas, fechas UTC,
  inglés/español), `run-metricas` (distancia, tiempo en movimiento, pausas,
  limpieza, desnivel, parciales, GAP, mejores marcas, zonas, carga, ruta
  ≤ 1 MiB) y `run-guardar` (duplicados, fusión, lotes, clima y lugar).
- `npm test` → **209 pruebas, todas pasan** (2026-10-01, sin GPS). Lógica pura
  UMD: hábitos, finanzas, mapa muscular, rangos, rutinas, importador, series,
  sesiones, intervalos, rutinas CSV de varios días y cola, resumen semanal,
  versión del service worker.
- `tests/sw-version.test.js` falla si se cambia un archivo de la app sin
  correr `npm run sw` (protege la caché offline).
- **Pantalla (E2E)** en `scripts/e2e/` (Playwright + Chromium, 390 px):
  - `fase1.js` — login, nota de hábitos, accesos y admin.
  - `running.js` — Running y Bici sin GPS: resumen semanal (semana actual,
    elegir otra, Distancia/Tiempo, sin desnivel), importar un plan de 3 días,
    rutina guiada completa (voz, cambios, fin, resumen, km), la completada
    pasa al final, rutina sin terminar (pausa, recuperar tras recargar, aviso
    en Inicio, guardar sin km, no se mueve), voz apagada, descartar, borrar
    un día o el plan entero sin tocar el historial, borrar una carrera vieja
    con GPS y su recorrido, registro a mano, Bici, computadora.
  - `hojas.js` — deslizar hacia abajo para cerrar (dedo simulado): la hoja
    sigue al dedo, vuelve si se suelta a mitad, se cierra al bajarla o con un
    tirón, de lado no se mueve, con la lista desplazada primero sube la lista;
    en Finanzas, el selector de categorías, Hábitos y Running. Además, que
    las hojas no se salgan de ancho ni reboten (formulario Medible, Ajustes
    de Hábitos, transacción) y que la pantalla no rebote.
  - `habitos.js` — Hábitos a 390 y 1280 px con datos realistas
    (`habitos-semilla.js`), sin errores de página ni de consola: hoja de la
    Temporada 2 (sin celebraciones, logros conservados), detalle que explica
    el techo, Temporada 1 en Logros; gestionar categorías (crear, repetida,
    ordenar, sugerida, eliminar, no archivar con hábitos activos, asignar en
    lote, "+ Nueva" desde el formulario); Hoy filtrado, agrupado, ocultar
    hechos, un toque marca y mantener presionado abre opciones; Estadísticas
    con filtro, "Por categoría" y radar; página de categoría desde
    Estadísticas, Logros y Hoy; se marca solo con Running (rellenar,
    marcar, deshacer, lo manual manda), Movilidad, Libros y Finanzas;
    plantillas, sugerencia de categoría, hora y aviso de pendientes;
    exportar e importar con categorías.
  - `scalping.js` — hábito Scalping con fecha y huso de La Paz fijos
    (además: el plan no avanza sin día completo, reinicio automático una vez
    y botón "Reiniciar desde el día 1"):
    agregarlo, tarjeta y botones rápidos, vista Hoy (aviso, fotos, pasos,
    marcar con minutos, nota), Ajustes, persistencia al recargar, «Cerrar el
    día», Inicio, Progreso, Semana, Guía, la tabla de verificación del dueño
    (días 1, 5, 31, 91, 180 y 181) y las horas del plan (27,5 · 36,7 · 50 ·
    65 h), y el temporizador guiado con reloj falso.
  - `emojis.js` — selector de emojis del formulario: 11 categorías, elegir
    uno de otra categoría sin perder lo escrito, emoji propio del teclado y
    editar un hábito (abre la categoría de su emoji).
  - `run-importar.js` — Running › Importar (390 y 1280 px): ZIP del export
    de Strava (CSV con columnas repetidas, FIT.gz, GPX, foto que no se lee),
    GPX suelto sin deporte, archivo roto, duplicada, fusión con una rutina
    guiada y con una carrera a mano, otros deportes, la que falta en el ZIP,
    guardado (rutas aparte), historial con título y lugar, clima y lugar en
    segundo plano (respuestas simuladas, solo coordenadas redondeadas) y
    volver a importar lo mismo (todo se salta).
  - `run-detalle.js` — detalle de una actividad: abrir desde el historial,
    cifras, logros, mapa Leaflet (teselas simuladas), cursor del perfil que
    mueve un punto en el mapa, parciales, vueltas, zonas, mapa grande,
    editar, exportar GPX (descarga), corregir desnivel (API simulada, lotes
    ≤ 100), intervalos de la rutina sombreados, carrera a mano, sin internet
    (trazo SVG), eliminar con su ruta y 1280 px.
  - `run-feed.js` — Actividades: barra propia con el "+", tarjetas, mes,
    filtros, abrir el detalle, pestañas, anotar a mano desde el "+",
    sugerencia de estirar, importar y rutina guiada desde el "+", tarjeta
    de Inicio, estado vacío, carga de a 20 y pills en la computadora.
  - `run-progreso.js` — Progreso: totales por período contra el anterior,
    resumen semanal, racha, metas, diario (huecos, círculos, meses), mejores
    marcas y evolución, predicciones, forma y fatiga, zapatillas; Ajustes
    (validación, guardar sin pisar zapatillas, agregar, predeterminada,
    retirar) y el selector de zapatillas del detalle; 1280 px.
  - `run-inteligencia.js` — Resumen inteligente (marca, recorrido
    repetido, sin consejos de salud, al menos dos frases) y Mismo
    recorrido (lista, mejor, puesto en otra vuelta, sin ruta no aparece).
  - `run-segmentos.js` — crear un segmento (controles, vista previa en el
    perfil, mínimo 100 m), búsqueda retroactiva, página con tabla y
    medallas, lista, puesto en el detalle, detección al importar, buscar de
    nuevo, renombrar, borrar una carrera quita su tiempo, mapa de calor
    (SVG, filtros, con calles en lienzo) y eliminar el segmento.
  - `run-compartir.js` — imagen 1080 × 1920 (píxeles: fondo oscuro y
    esquina transparente), descarga del PNG sin menú de compartir, carrera
    sin ruta y el menú de compartir simulado con el archivo.
  - `run-qa.js` — QA final: el recorrido completo a 390 y 1280 px
    (importar FIT.gz + GPX desde el "+", tarjeta, detalle con parciales,
    marcas, vueltas y resumen, crear un segmento, ver sin internet, eliminar,
    exportar todo y releer el ZIP) sin errores de página ni de consola, y
    rendimiento con 500 carreras (feed < 1,5 s, Progreso y detalle < 0,2 s).
  - `sw-instala.js` — el service worker de verdad (las demás E2E lo
    bloquean): se instala, guarda la app y Leaflet, y una versión nueva
    muestra "Actualizar" y la activa (D-078).
  - `regresion.js` — las 15 pantallas en teléfono (390 px) y computadora
    (1280 px): se ven, sin errores y sin scroll de lado; acciones de siempre:
    marcar un hábito, anotar un gasto, registrar Running y Bici a mano,
    marcar una serie en Gimnasio; aviso "Sin conexión".
  - Utilidades en `scripts/e2e/comun.js` (reloj y voz simulados). Usan
    `fake-firebase.js`: Firestore y Auth en memoria (con `FieldPath`,
    `increment`, `arrayUnion`/`arrayRemove` y `update(campo, valor, …)` como
    el SDK real), con las reglas de `accesos`/`admins` simuladas. **No
    prueban las reglas reales** (se verifican al publicarlas, `docs/ADMIN.md`).

## Por fase (mínimos)
- **F1**: contraseña (teclado, ocultar/mostrar, válido/ inválido/ vacío),
  nota de hábito (sin nota, con nota, editar, hábitos viejos), evento de
  login (1 por inicio de sesión, sin duplicados, sin datos sensibles),
  bandeja admin (ver, leído, historial), usuario normal sin acceso
  (verificado con las reglas publicadas).
- **F2–F5**: intervalos (cambios, cuenta atrás, fin, recuperación con
  timestamps), CSV (válido, vacío, columnas, duraciones, filas incompletas,
  tamaño, caracteres especiales, días). El motor GPS y sus pruebas se
  retiraron en D-033.
- **Dispositivo real (iPhone)**: pantalla encendida, voz y sonido se validan
  en el teléfono del dueño; nada se da por funcionando sin esa prueba.
- **Regresión** en cada fase: `npm test` + recorrido de Hábitos, Ejercicio y
  Finanzas en 390 px.

## Cómo correr todo
```bash
npm test
export NODE_PATH=/opt/node22/lib/node_modules   # donde está Playwright
for f in fase1 running hojas scalping emojis regresion; do node scripts/e2e/$f.js || break; done
```
Cada script termina con "Todo bien" (código 0) o con la cantidad de fallos.

## Resultado del QA final (fase 8, 2026-10-01)
- Unitarias: 225/225. E2E: fase1 39 ✓, fase3 45 ✓, fase4 30 ✓, fase5 24 ✓,
  fase6 15 ✓, regresion 37 ✓ (15 pantallas × 2 tamaños + 7 acciones).
  (fase3–fase6 eran del GPS; se retiraron con él y `running.js` las
  reemplaza.)
- Hallazgo: el Firestore de prueba no entendía `FieldPath` (lo usa Hábitos
  al marcar); era un límite del simulador, no de la app. Corregido en
  `scripts/e2e/fake-firebase.js`.
- Revisión de seguridad de las plantillas nuevas: los textos del usuario
  (nombres de rutina, notas, usuario del aviso) se escapan o van como texto.
- Lo que **no** se puede probar aquí: pantalla encendida, voz y pitidos
  reales, teclado del iPhone, reglas publicadas en Firebase. Va en la lista
  de abajo.

## Resultado del QA final de Ejercicio inteligente (fase 8, 2026-11-05)
- Unitarias: 481/481. E2E, las 24 suites de `scripts/e2e/` (1.578
  comprobaciones, 0 fallas): ejercicio 349, habitos 205, inversiones 137,
  lectura 98, scalping 75, run-importar 70, running 64, tarjetas 56,
  tiempos 56, movilidad 55, libros-progreso 52, run-feed 48, run-qa 46,
  run-detalle 42, fase1 40, regresion 39, run-progreso 36, run-segmentos
  29, hojas 21, ej-calendario 18, run-inteligencia 14, run-compartir 13,
  emojis 10, sw-instala 5.
- Lo que no se puede probar aquí: voz, pitidos y pantalla encendida
  reales, el menú de compartir del iPhone y las demos sin conexión en el
  teléfono. Van en la lista de abajo ("Ejercicio inteligente").

## Pruebas en el iPhone (las hace el dueño)
Abrir Manolo **desde el ícono de la pantalla de inicio** (no desde Safari),
con iOS actualizado. Marcar cada punto; si algo falla, anotar qué pasó.

**Antes de empezar (una sola vez)**
- [ ] Publicar las reglas y crear `admins/{tu uid}` (`docs/ADMIN.md`).

**Login**
- [ ] Al tocar la contraseña aparece el teclado de números.
- [ ] "Usar teclado de letras" cambia al teclado normal y vuelve.
- [ ] El ojo muestra y oculta la contraseña.
- [ ] Contraseña equivocada: mensaje de error, no entra.

**Avisos de acceso (admin)**
- [ ] Iniciar sesión con otra cuenta (o en otro equipo) → en tu cuenta la
  campana muestra el número; al abrirla se ve usuario y hora y se marca leído.
- [ ] Con una cuenta que no es admin no aparece la campana.

**Deslizar para cerrar**
- [ ] En Finanzas toca **+**: baja la hoja con el dedo; a mitad de camino y
  soltando vuelve; bajándola más (o con un tirón) se cierra.
- [ ] Lo mismo en el detalle de un hábito y en el selector de categorías.

**Hábitos: categorías y siguiente nivel (2026-11)**
- [ ] Al abrir Hábitos aparece una vez "Temporada 2: ahora subir cuesta
  más" con tu nivel y rangos de antes y de ahora; "Entendido". No aparecen
  celebraciones de golpe.
- [ ] Logros › Logros: tarjeta "Temporada 1" y tus logros de siempre como
  conseguidos. Arriba: "Te faltan N XP para el nivel…".
- [ ] Un hábito › detalle: debajo del rango, tu techo con tu constancia y
  cuántos días faltan para la próxima división.
- [ ] Ajustes › Categorías: crea una (nombre, color, emoji), ordénalas,
  "Asignar categorías" a los que no tienen. Prueba una "Sugerida".
- [ ] Hoy: chips de categoría arriba (con pendientes), "Categoría" para
  agrupar, "Ocultar hechos", colores en cada fila, aviso "Te faltan N de…".
- [ ] Mantén presionado un hábito: parcial, mínima, saltar y nota.
- [ ] Racha que perdona: en el detalle de un hábito, "Racha que perdona"
  con tus perdones; si ayer se te pasó, en Hoy dice "🛡 ayer se salvó tu
  racha" y el número sigue.
- [ ] Toca el nombre de un grupo (agrupado por categoría): su página con
  nivel, semana y mes, mapa de calor, ranking y logros. "Atrás" vuelve.
- [ ] Estadísticas: toca una categoría arriba; "Por categoría" y el radar.
- [ ] Vincula tu hábito de correr con Running (Editar › Más opciones › Se
  marca solo); acepta rellenar; guarda o importa una carrera: se marca.
- [ ] + › Plantillas: busca "agua", elige, cambia la meta y crea.
- [ ] Ponle hora a un hábito: se ordena dentro de su momento.
- [ ] Scalping sigue igual (tarjeta, sesiones, pantalla propia).

**Running al nivel de Strava (2026-11)**
- [ ] Running → **+** → Importar → elige el ZIP de Strava (o un .gpx/.fit
  de Archivos): la vista previa muestra cuántas, cuáles ya estaban y las que
  se unen a una rutina; Guardar.
- [ ] En Actividades cada carrera tiene su tarjeta con el trazo; tócala.
- [ ] En el detalle: mapa con calles (con internet), desliza el dedo sobre
  el gráfico y mira el punto en el mapa; parciales; Resumen inteligente.
- [ ] Compara 1–2 carreras con Strava: distancia (±2 %), tiempo en
  movimiento (±3 %) y desnivel (±15 %).
- [ ] ⋯ → Crear segmento; luego pestaña Segmentos.
- [ ] Compartir → la imagen se abre en el menú de compartir del iPhone.
- [ ] Progreso: totales, diario, mejores marcas, forma y fatiga, mapa de
  calor; ⚙ Ajustes: FC, metas, zapatillas, "Exportar todo".
- [ ] Modo avión: Actividades, un detalle (con el trazo) y Progreso se ven.

**Scalping**
- [ ] En Hábitos toca **Agregar** en la sugerencia de Scalping: aparece la
  tarjeta "Día 1/180…".
- [ ] Toca **Mañana · 5 min**: queda marcado; ciérrala y ábrela: sigue marcado.
- [ ] Abre la tarjeta › **Iniciar guiado**: la pantalla no se apaga, suena un
  pitido en cada paso y al final la sesión queda hecha.
- [ ] Revisa Progreso, Semana, Guía y Ajustes.

**Mi día (2026-11)**
- [ ] Abre Manolo: arriba de Inicio está "Mi día" con la fecha y cuántas
  cosas te quedan. Revisa que cada fila diga lo correcto (entreno,
  hábitos, versículo, para gastar hoy, Running) y que al tocarla te lleve
  a su sección.
- [ ] Marca un hábito y vuelve a Inicio: el número cambia.
- [ ] "Ocultar «Mi día»" la quita; ciérrala y ábrela: sigue oculta.
  "Mostrar «Mi día»" (al pie) la trae.

**Ejercicio inteligente (2026-11)**
- [ ] Abre una rutina y toca el nombre de un ejercicio: la ficha muestra la
  demo (2 fotos que se alternan; ⏸ la pausa), "Cómo se hace", "Ver video",
  Historial, Récords y alternativas. Con modo avión, las demos de tus
  rutinas se siguen viendo.
- [ ] Empieza la rutina de hoy: cada ejercicio dice qué peso usar y por qué
  ("Subes: la última vez…"); toca "Calentamiento" y "Discos".
- [ ] Marca una serie: arranca el descanso; con la pantalla encendida
  suenan 3-2-1 y la voz dice "Descanso terminado. Siguiente: …".
- [ ] Anota el RIR en una serie; prueba una superserie (⋯ › Superserie).
- [ ] Termina: el resumen dice "En pocas palabras" (récords, comparación,
  qué queda cansado), elige el esfuerzo y toca "Compartir imagen".
- [ ] Gimnasio › Ajustes del gimnasio: cambia tu barra o tus discos; el
  entreno muestra los discos por lado con tu equipo.
- [ ] Entrenamiento: la tarjeta de arriba dice qué entrenar hoy. El día
  después de una carrera larga debería proponer otra rutina ("Hacer X
  igual" sigue a mano).
- [ ] Baja: "Recuperación" (figura con colores), "Carga de la semana" y
  "Series por músculo" (con lo que te queda del plan).
- [ ] "Crear rutinas para mí": 3 días, 45 min → Ver propuesta; cambia y
  quita un ejercicio; Guardar. Tus rutinas de antes siguen igual y el plan
  solo se llenó en días libres.
- [ ] Perfil: "Tu semana" (Compartir mi semana) y los gráficos Fuerza,
  Volumen, Frecuencia y Peso.
- [ ] Rangos, Feed y el calendario siguen como antes.

**Hábitos, Ejercicio, Finanzas (como antes)**
- [ ] Marcar y desmarcar un hábito; crear uno con nota y ver la nota.
- [ ] Gimnasio: empezar una rutina, marcar series (✓), terminar y ver que
  los botones Finalizar/Descartar no quedan tapados.
- [ ] Ejercicio › Perfil: el gráfico y los períodos se ven bien.
- [ ] Finanzas: anotar un gasto y verlo en Movimientos y en Presupuesto.

**Running: resumen semanal**
- [ ] Arriba se ve la semana actual con Distancia y Tiempo y el gráfico de
  12 semanas; tocar otro punto muestra esa semana.
- [ ] Tocar "Tiempo" cambia el gráfico a horas/minutos.

**Rutinas guiadas (CSV de varios días)**
- [ ] "Descargar plantilla" (plan de 3 días), editarla o usarla tal cual e
  "Importar CSV": la vista previa muestra Día 1, 2 y 3; guardar.
- [ ] La lista muestra Día 1 con "Siguiente". Tocarlo, Iniciar: la pantalla
  **no se apaga** sola (iOS 18.4 o más nuevo).
- [ ] **Con música sonando**: se oyen los pitidos 3-2-1 y la voz en cada
  cambio, y la música sigue.
- [ ] Con el interruptor de silencio activado: anotar si se oyen los
  pitidos/voz (depende de iOS).
- [ ] Apagar "Sonido" y "Voz": ya no suenan; el aviso grande sigue.
- [ ] Al terminar: resumen; anotar km (opcional) y guardar → aparece en
  "Tus carreras" con "Rutina" y el Día 1 pasa al final de la lista.
- [ ] Cerrar Manolo a mitad de una rutina en pausa y volver a abrirlo: la
  recupera.
- [ ] Borrar una rutina: su historial sigue en "Tus carreras".

**Bicicleta**
- [ ] Registrar una rodada a mano: suma en el resumen de la semana.

**Sin conexión**
- [ ] Modo avión: Manolo abre, se puede marcar un hábito y aparece "Sin
  conexión"; al volver internet se sincroniza solo.
- [ ] Hacer una rutina en modo avión: funciona igual y se sube al volver
  internet.
