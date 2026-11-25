# Pruebas

## Estado actual
- 2026-11-25 (Ropa: tus favoritos, D-163): `npm test` → **854** (en
  `ropa-outfit-motor`: tus favoritos pesan una vez y media). E2E nueva
  `ropa-favoritos` (**56**): "Tus favoritos" (sin ninguno, cómo se suman; antes
  de "Guardados", que ya no los repite); el corazón de cada opción (aviso,
  Deshacer, tocarlo otra vez); en grande (una opción, un guardado, un día), se
  prende ahí mismo; "Quitar de guardados" solo si está guardado; "Me lo pongo
  hoy" desde un favorito; "No me gusta" lo saca; "A favoritos" en Armar el mío
  (con su nombre) y editar un favorito (el nuevo es el favorito; Deshacer); el
  corazón en tu estilista y tus favoritos primero para la IA; 320 px en oscuro
  y en claro (corazones de 44 px, cada botón con su texto adentro).
  `ropa-outfits` (89) bien.
- 2026-11-25 (Ropa, nivel 2, fase 6, D-162: la revisión final de tu
  estilista): `npm test` → **853**; el puente: **10** pruebas del Worker
  (nueva: los latidos —contesta enseguida, late mientras la IA piensa y al
  final el JSON; los errores, adentro; sin `?latidos`, como antes—) y **18** de
  su lógica; instalado (versión 7). E2E: `ropa-estilista` con un puente de
  mentira como el 7 (latidos, errores adentro; **114**), `ropa-outfits` (en
  grande, "Se parece a tu inspiración" lleva al pin; **89**); las demás con
  puentes de mentira como el de antes (la app nueva anda con los dos). Las
  **51 suites** de `scripts/e2e/` sin fallas (**4.320** comprobaciones).
  Lighthouse (`scratchpad/lh/correr11.mjs`, fuera del repo) de las 13
  pantallas nuevas de tu estilista en oscuro y en claro: **100** en
  accesibilidad y en buenas prácticas en las 26 (antes: 98 en una opción en
  grande —un link "#…" que Lighthouse tomaba por un link para saltar— y 99 en
  Armar el mío —las fotos con su nombre al lado—).
- 2026-11-24 (Ropa, nivel 2, fase 5, D-161: tu estilista, conectado con
  Outfits, Compras e Inicio): `npm test` → **853** (el aviso del día: el clima
  y la ocasión, lo que ya tienes, compraste, ya no quieres u ocultaste; lo que
  te armó hoy y en palabras). E2E nueva `ropa-conectar` (**74**, con un
  puente de mentira que solo contesta `/quien`): el aviso de hoy y de mañana,
  la ✕ con Deshacer, "Ya está en tu lista", lo que ya tienes no sale, sin
  aviso combinando una prenda, sale igual sin el puente; "Hoy te armó…" con el
  link a esa conversación; "Para mañana" con Deshacer (nuevo y ya guardado);
  en Compras, "Tu estilista también lo sugiere", "También está en 2 de tus
  pines" y "Te lo sugirió tu estilista"; Inicio (lo que te armó hoy, "¿Qué me
  pongo hoy?", sin internet, a la noche, sin el puente); 320 px en oscuro y
  en claro (las tarjetas de Inicio entran). Las **51 suites** de
  `scripts/e2e/` sin fallas (**4.317** comprobaciones).
- 2026-11-24 (Ropa, nivel 2, fase 4, D-160: lo que opina tu estilista y "¿Qué
  opinas?"): `npm test` → **851** (nuevo `ropa-opinion-motor`: lo que ve
  Manolo con sus números, tu ropa con las veces, tus pines en palabras, cada
  repaso guardado, el veredicto y cambiar una prenda). E2E nueva
  `ropa-opinion` (**56**, con un puente de mentira): pedir la opinión en
  Compras (y un error), lo que va al puente, lo guardado, cada parte del
  repaso, "A mi lista" y Pinterest, lo guardado sin la IA; "¿Qué opinas?" en
  Armar el mío ("Cambiar" con Deshacer, sin pagar dos veces, "Preguntarle otra
  vez") y desde un guardado; sin la IA no aparece; 320 px en oscuro y en claro.
  Las **50 suites** de `scripts/e2e/` sin fallas (**4.243** comprobaciones,
  con D-159).
- 2026-11-24 (D-159: tu estilista recuerda lo del día): `npm test` → **846**
  (en `puente-logica`, los outfits de antes con su número y su nombre y lo que
  viste hoy; en `ropa-estilista-motor`, `delDia`, `deHoy` y lo de antes con
  nombre). `ropa-estilista` → **113** (sigue la conversación de hoy; una de
  otro día, no; en una nueva igual sabe lo de hoy; le llegan las opciones de
  Outfits); `ropa-outfits` → **87** (al volver a hoy o a otra ocasión, siguen
  las opciones). Puente: 18 de la lógica y 9 del Worker (versión 6).
- 2026-11-24 (Ropa, nivel 2, fase 3, D-158: hablar con tu estilista):
  `npm test` → **844 pruebas** (nuevo `ropa-estilista-motor`: el título de
  cada conversación, los mensajes, cuándo está llena y lo que quedó sin
  respuesta, lo que va al puente, tu ropa con lo que está para lavar, el
  presupuesto, lo que recuerda de ti y "hoy", "ayer" o la fecha). E2E nueva
  `ropa-estilista` (**104**, con un puente de mentira): "Pídelo con tus
  palabras" en Outfits; lo que va al puente (tu ropa sin lo que ya no tienes ni
  tus notas, el clima de hoy y de mañana, lo que recuerda de ti, el
  presupuesto, lo hablado antes); los outfits revisados, "A mi lista", "Lo
  recordé" y "Olvidar"; Guardar, No me gusta y Me lo pongo con Deshacer; Ver en
  grande, Cambiar una prenda y Otra opción; un error y "Volver a preguntar";
  los ejemplos, Enter y el borrador; tus conversaciones y lo que recuerda de ti
  (con Deshacer en la misma hoja) y en Ajustes de Ropa; una conversación llena;
  sin internet, quien no es el dueño y sin el puente; 320 px en oscuro y en
  claro (nada se sale, todo se toca con el dedo y se lee bien). Las **49
  suites** de `scripts/e2e/` sin fallas (**4.175** comprobaciones).
- 2026-11-24 (Ropa, nivel 2, fase 2, D-157: el puente aprende a conversar y a
  opinar): `npm test` → **836 pruebas** (5 nuevas en `puente-logica`: los
  esquemas y las instrucciones —sin el nombre de la app ni correos—, las
  veces que te pusiste cada prenda, conversar —los últimos 10 mensajes que
  sirven, un bloque por mensaje, los outfits con tus ids y sin lo que está
  para lavar—, "¿Qué opinas?" —solo cambios posibles, de la misma parte— y el
  repaso —solo los números que mandó la app—). El puente entero (`cd puente
  && npm run prueba`, con fetch de mentira, sin gastar): **9** (2 nuevas:
  `/charla` con la ropa y el último mensaje en caché, esfuerzo medio, sin tus
  ids ni tus notas; `/opinar` y `/opinion` con su esfuerzo y sus 400). Sin
  pantallas nuevas: las suites de Ropa (`ropa`, `ropa-final`, `ropa-armar`,
  `ropa-outfits`, `ropa-compras`, `ropa-insp`, `ropa-numeros`,
  `ropa-corte`), `sin-internet`, `respaldo` y `regresion`, sin fallas.
  Arreglada en `ropa` la medición de la grilla en la compu, que fallaba a
  veces con la máquina ocupada: la lista se volvía a dibujar entre buscarla y
  medirla (`$eval` lo hace en dos pasos); ahora va en un solo `evaluate`. Para
  medir algo que se vuelve a dibujar, buscarlo y medirlo en el mismo paso.
- 2026-11-24 (Ropa, nivel 2, fase 1, D-156: ver en grande y armar el mío):
  `npm test` → **831 pruebas** (nuevo `ropa-armar-motor`). Las **48 suites**
  de `scripts/e2e/` sin fallas (4.071 comprobaciones; en la corrida
  completa, la Biblia de `lectura-qa` dio 1.567 ms con la máquina ocupada y,
  sola, 1.255 ms, bajo el límite de 1,5 s). Nueva `ropa-armar`
  (78: ver en grande una opción —tocando sus fotos o el botón; las de al lado,
  "Otra opción", "Guardar", el foco al cerrar, cada prenda a su ficha—, un
  guardado y lo de hoy; armar el mío —las partes, cambiar o sumar, los avisos
  con el clima del día, para lavar, los filtros, el orden de las capas, la
  barra fija al bajar, el borrador, Guardar, Me lo pongo, Para mañana y Empezar
  de cero, con Deshacer—; cambiar una prenda, editar y duplicar; sin internet;
  320 px en oscuro y en claro con el contraste). `ropa-outfits` lee las
  prendas de cada opción por `data-prenda`.
- 2026-11-24 (Ropa: corte, mangas, colores y mayúsculas, D-154; el puente
  instalado, D-153): `npm test` → **825 pruebas** (el corte, las mangas y las
  mayúsculas en `ropa-motor`; en `puente-logica`, las listas iguales a las de
  la app, el esquema con vacío y la limpieza según el grupo). Las **47
  suites** de `scripts/e2e/` sin fallas (3.993 comprobaciones; en la
  corrida completa, la medición de la Biblia de `lectura-qa` dio 1.686 ms con
  la máquina ocupada, y sola 1.325 ms, bajo el límite de 1,5 s). Nueva
  `ropa-corte` (69: el corte con su nombre según la prenda y el grupo, tocar
  otra vez para quitarlo, cambiar los colores, el principal, sin repetir y el
  foco, las mayúsculas al guardar, la ficha con "Cambiar los colores", buscar,
  la IA con un puente de mentira, una prenda de antes y 320 px en oscuro y en
  claro). El Worker del puente: 7 (versión 4). Ojo: para ver si algo está a la
  vista no basta el atributo `hidden` (un estilo puede ganarle): `ropa-corte`
  mira `getClientRects`.
- 2026-11-23 (Ropa, fase 7, D-152: revisión final): `npm test` → **823
  pruebas**; las **46 suites** de `scripts/e2e/` sin fallas sobre la versión
  final (3.924 comprobaciones). Nueva `ropa-final` (28: la IA sin internet con
  un puente de mentira y las 8 pantallas de Ropa a 320, 390 —oscuro y claro—
  y 1280 px, con el contraste de cada texto); `sin-internet` (13) suma Ropa
  en modo avión. El Worker del puente (`puente/`, `npm run prueba`): 7.
  Lighthouse 100 en 52 pantallas con Ropa llena (`scratchpad/lh/correr9.mjs`) y en
  12 con Ropa vacía (`correr10.mjs`).
- 2026-11-23 (Ropa, fase 6, D-151: Extras): `npm test` → **823 pruebas**
  (nuevo `ropa-numeros-motor`: lo que más te pones, lo que no te pones hace 3
  meses o más —también sin fecha—, tus colores por familia y el que más te
  pones, cuánto te sale cada uso y lo invertido; Ropa en `resumen-motor` —la
  semana; sin ropa no cambia nada— y en `resumen-anio` —tu prenda del año, el
  color, las compras y la diapositiva sin plata—). Suite nueva `ropa-numeros`
  (54 comprobaciones: las cifras, las listas y los colores iguales a las
  reglas, cada prenda a su ficha, cambia solo, la tarjeta de Inicio —hoy, el
  outfit para hoy, nada—, Ropa en "Tu semana" y en "Tu año" con "Compartir",
  sin ropa, sin precios, 320 px, el contraste en oscuro y en claro, la compu)
  y 13 suites cercanas sin fallas (resumenes, ropa, ropa-insp, ropa-outfits,
  ropa-compras, tema-claro, mi-dia, sin-internet, regresion, pantalla,
  respaldo, hojas y sw-instala: 742 comprobaciones). Lighthouse
  (`scratchpad/lh/correr9.mjs`): 100 en accesibilidad y buenas prácticas en
  52 pantallas. `scripts/e2e/comun.js` ahora exporta `auditarContraste`
  (el contraste de `tema-claro.js`, para cualquier suite). Ojo: con el reloj
  fijo, justo al abrir, el primer `$eval` de Playwright a veces lee la página
  sin estilos (vacíos); `ropa-numeros` espera a que los lea.
- 2026-11-23 (Ropa, fase 5, D-150: Compras): `npm test` → **818 pruebas**
  (nuevo `ropa-compras-motor`: qué te falta —cada pin una vez, desde 2, sin
  accesorios ni lo que quitaste, lo que ya tienes no; de otro color sí—,
  cuántos outfits nuevos te daría, "van juntas", qué no comprar, el gasto del
  mes, el presupuesto y la lista de deseos). Suite nueva `ropa-compras` (50
  comprobaciones: qué te falta con sus pines, los outfits nuevos iguales a
  las reglas, "Ver opciones en Pinterest", "A mi lista" con Deshacer, "Ya no
  lo quiero", el presupuesto —"1.000"—, "Lo compré" sin foto y con foto, ya
  no te falta, te pasaste, qué no comprar, desde un pin, sin inspiraciones,
  320 px, claro, la compu y la copia de seguridad) y 11 suites cercanas sin
  fallas (ropa, ropa-insp, ropa-outfits, respaldo, regresion, tema-claro,
  pantalla, sin-internet, mi-dia, hojas y sw-instala: 569 comprobaciones).
  Lighthouse (`scratchpad/lh/correr8.mjs`): 100 en accesibilidad y buenas
  prácticas en 46 pantallas de Ropa.
- 2026-11-23 (Ropa, fase 4, D-149: Outfits): `npm test` → **813
  pruebas** (nuevos `ropa-clima`: el pronóstico real de La Paz y Santa Cruz del
  2026-11-23 —capas y sol; calor, lluvia, viento y tormenta—, frío, nieve,
  friolento y caluroso, el buscador de ciudades y la hora de la ciudad; y
  `ropa-outfit-motor`: 3 opciones distintas con abrigo o liviano según el día,
  sin lo de lavar, el trabajo y la noche, "¿Con qué combino esto?", lo que
  aprende —con tope, por ocasión— y lo que no vuelve, la ropa de verano que no
  sale con frío, el jean a 30 °C, repetir zapatos y abrigo, tus ocasiones, tu
  estilo de Pinterest y revisar lo que contesta la IA; `parecidaA` en
  `ropa-insp-motor`; outfits en `puente-logica`). El Worker entero (7). Suite
  nueva `ropa-outfits` (84 comprobaciones, con Open-Meteo y el puente de
  mentira: La Paz y Santa Cruz, cambiar de ciudad, friolento, hoy y mañana, las
  ocasiones y una tuya, "Otra opción", "No me gusta", "Guardar", "Me lo pongo",
  la inspiración parecida, el calendario, combinar, sin clima, el clima de hace
  un rato, la IA con su reserva y si falla, un puente viejo, 320 px, claro, la
  compu y la copia de seguridad) y 10 suites cercanas sin fallas (ropa,
  ropa-insp, respaldo, regresion, tema-claro, pantalla, sin-internet, mi-dia,
  hojas y sw-instala: 485 comprobaciones). Lighthouse
  (`scratchpad/lh/correr7.mjs`): 100 en accesibilidad y buenas prácticas en 38
  pantallas de Ropa.
- 2026-11-23 (Ropa, fase 3, D-148: Inspiración): `npm test` → **795
  pruebas** (nuevos `puente-pinterest`: links de pin, tablero y `pin.it`, el
  link corto sin salir de Pinterest, el RSS de un tablero —también el real
  bajado el 2026-11-22—, oEmbed y las imágenes que el puente acepta; y
  `ropa-insp-motor`: normalizar, qué tan parecida es una prenda, el look sin
  IA, "Mi estilo" sin IA y lo que se manda a la IA; en `puente-logica`, los
  esquemas, instrucciones y limpieza de inspiración, look y estilo). El
  Worker entero con fetch de mentira: `cd puente && npm install && npm run
  prueba` (6). Suite nueva `ropa-insp` (107 comprobaciones: sin puente,
  con un puente de mentira que contesta como Pinterest y la IA, a 390 y 320
  px, en claro, sin la clave de la IA, la compu y la copia de seguridad) y
  `ropa` (159, con el "+" de la barra); y 12 suites cercanas sin
  fallas (respaldo, regresion, pantalla, tema-claro, sin-internet, lugares,
  hojas, sw-instala, fase1, mi-dia, bici y running: 554 comprobaciones). Lighthouse
  (`scratchpad/lh/correr6.mjs`): 100 en accesibilidad y buenas prácticas en
  24 pantallas de Ropa.
- 2026-11-22 (Ropa, fase 2, D-147: la IA, lista para conectar): `npm test` →
  **778 pruebas** (nuevo `puente-logica`: el token de Firebase firmado con
  una llave hecha en la prueba —el bueno pasa; vencido, de otro proyecto,
  con otra llave, sin firma o con el usuario cambiado, no—, usuarios, CORS,
  costo, mes de Bolivia, tope, esquema e instrucciones, limpiar lo que
  contesta la IA y la foto; y que sus listas sean las de la app). Suite
  `ropa` con la fase 2 (159 comprobaciones en total) con un puente de
  mentira (rutas de Playwright, opción nueva `rutas` de `abrir`): sin puente,
  conectada con gasto y tope, agregar con la IA (esperar, la siguiente ya
  mirada, varias prendas), la IA no puede (tope), "Llenar a mano", "Describir
  con IA" en la ficha, las que cargaste antes (solo lo que falta) y quien no
  es el dueño. Lighthouse (`scratchpad/lh/correr5.mjs`, con un puente de
  mentira en su servidor): 100 en accesibilidad y buenas prácticas en las 12
  pantallas de Ropa.
- 2026-11-22 (Ropa, fase 1, D-146): `npm test` → **771 pruebas**. Nuevo
  `ropa-motor` (el color de una foto sin contar el fondo, el nombre que
  concuerda, normalizar, revisar, usos, costo por uso, buscar, filtrar,
  ordenar) y la copia con las fotos de Ropa en `respaldo-motor`. Nueva suite
  de pantalla `ropa` (126 comprobaciones): Inicio, vacío, dos fotos de
  una vez con su color, errores, sin foto y "Otro", grupos, filtros, buscar,
  ordenar, la ficha (me la puse hoy, para lavar, editar con precio, ya no la
  tengo y volver, borrar con Deshacer), las fotos en el teléfono, la copia y
  restaurarla en un teléfono nuevo; 390 y 320 px y la compu. `lugares`,
  `respaldo` y `regresion` bien. Lighthouse (`scratchpad/lh/correr5.mjs`):
  100 en accesibilidad y buenas prácticas en las 8 pantallas (oscuro y
  claro).
- 2026-11-16 (Tu semana, Tu año y Bici: control final, D-144): `npm test`
  → **759 pruebas**; pruebas de pantalla: 39 de 40 grupos bien
  y 3.437 comprobaciones (solo falla la medida de tiempo de la
  Biblia en `lectura-qa`, 1,7 s contra 1,5 s: el entorno, igual sin estos
  cambios). La suite `bici` suma: la rodada que importes después de
  crear un segmento de bici se suma sola a su tabla (fallaba antes del
  arreglo). Lighthouse (`scratchpad/lh/correr4.mjs`, fuera del repo): 100
  en accesibilidad en las 16 pantallas (8 en oscuro y 8 en claro); buenas
  prácticas 100 salvo "Tu semana" abierta de entrada (96 por los pedidos de
  afuera que este entorno no deja salir). "Tu semana" se arma en ~8 ms y
  "Tu año" en ~25 ms con 3 años de datos.
- 2026-11-16 (Bici, fase 7, D-143): `npm test` → **759 pruebas**.
  En `bici-analisis`: los km de cada bici, la predeterminada, el
  mantenimiento (desde que la agregaste, "Hecho hoy", cada cuánto, el
  service por km o por tiempo) y los avisos. Suite `bici` con la fase 7
  (agregar una bici, ponérsela a las rodadas sin bici, el aviso arriba del
  feed, "Hecho hoy", cada cuánto, otra bici elegida con Editar, anotar a
  mano con la predeterminada, retirar y volver, un segmento de bici creado
  desde una rodada y buscado en las demás, su página con la velocidad, la
  pestaña de Bici y no en la de Running; 390 y 320 px).
- 2026-11-16 (Bici, fase 6, D-142): `npm test` → **757 pruebas**.
  En `bici-analisis`: los récords de una rodada vieja salen de su ruta
  (igual que al importar, ±5 s), cuáles faltan por calcular y la
  evolución. Suite `bici` con la fase 6 (totales con la velocidad, racha,
  metas, diario, récords sueltos, mejores tiempos con top 3 y evolución,
  Eddington, los récords de la rodada vieja se guardan solos, mapa de
  calor, Ajustes de Bici con sus metas y el engranaje; 390 y 320 px).
  Revisión completa: 39 de 40 (solo `lectura-qa` Biblia, el entorno).
- 2026-11-16 (Bici, fase 5, D-141): `npm test` → **755 pruebas**.
  Nuevo `bici-analisis` (velocidad, filtros, récords de bici al importar
  aparte de los de correr, medallas, récords sueltos, Eddington, el resumen
  inteligente, Inicio). Nueva suite de pantalla `bici` (40 suites): el
  feed, filtros, la barra con el "+", anotar a mano, Inicio, el detalle con
  lo de bici y la barra de Bici, Progreso con el resumen semanal, de a 20,
  sin rodadas, 390 y 320 px y la compu. `running` y `regresion` miran la
  pantalla nueva de Bici (el resumen semanal en Progreso; anotar a mano
  desde el "+"); `run-feed` mira solo la hoja del "+" de Running (la de
  Bici usa las mismas clases). Revisión completa: 38 de 40 a la primera
  (`run-feed` por eso; `lectura-qa` Biblia 1,9 s, el entorno).
- 2026-11-16 (Resúmenes, fase 4, D-140): `npm test` → **748
  pruebas**. En `resumen-imagen`: cada diapositiva del año se comparte como
  se ve, todo dentro de la imagen y sin montos; la imagen final con lo
  destacado, sin Finanzas ni dinero. Suite `resumenes` con la fase 4 (la
  tarjeta en diciembre y enero y no en noviembre, todas las diapositivas
  sin salirse a lo ancho y con el principio a la vista, compartir una y el
  año, «Verlo otra vez», tocar para avanzar y volver, el Wrapped de
  Hábitos, «Ahora no», el menú ☰ y el foco, sin datos; 390 × 844 y 320 ×
  568). Revisión completa: 38 de 39; solo `lectura-qa` «Biblia con 1.500
  versículos» (2,4 s en este entorno; ver la fase 3: también la versión
  anterior tarda eso aquí).
- 2026-11-16 (Resúmenes, fase 3, D-139): `npm test` → **745
  pruebas**. Nuevo `resumen-anio` (años con datos, el año en curso hasta
  hoy, cada sección con sus récords y su mejor mes, equivalencias, el año
  en números, contra el año anterior a la misma altura, lo destacado sin
  dinero, con el Wrapped de Hábitos y "Tu año en libros"). Suite
  `resumenes` con la fase 3 (el contenido con los datos de la app).
  Revisión completa: 37 de 39 a la primera. `resumenes` «Compartir mi
  semana» esperaba la imagen 5 s y con la máquina ocupada tardó más (ahora
  hasta 15 s; sola pasa). `lectura-qa` «Biblia con 1.500 versículos»: en
  este entorno hoy da 1,6–2,4 s, igual con la versión anterior medida lado
  a lado (1,8 y 2,4 s contra 1,8 y 1,6 s): es la máquina, no los
  resúmenes ("Tu semana" se arma en ~8 ms y "Tu año" en ~25 ms con 3 años
  de datos).
- 2026-11-16 (Resúmenes, fase 2, D-138): `npm test` → **740
  pruebas**. Nuevo `resumen-imagen` (la imagen de la semana sin dinero, solo
  lo que mejoró, todo dentro). Suite `resumenes` con la fase 2 (la tarjeta
  de Inicio el lunes, la pantalla, ‹ ›, compartir, «Listo», el menú; el
  miércoles sin tarjeta; sin datos; 390 y 320 px). La revisión completa
  encontró dos cosas: en la compu «Tu semana» se colaba en la barra de
  arriba (ya no: va al pie de Inicio) y, los lunes y martes, la tarjeta se
  recalculaba al abrir cualquier sección (ahora solo con Inicio a la
  vista; `lectura-qa` Biblia con 1.500 versículos volvió a 1,3–1,5 s).
  `respaldo` busca su botón por sí mismo (en el menú ☰ hay otros extra).
- 2026-11-16 (Resúmenes, fase 1, D-137): `npm test` → **738 pruebas**.
  Nuevo `resumen-motor` (cifras de cada sección, la semana contra la
  anterior y tu promedio, a mitad de semana, lo mejor, lo que se quedó
  atrás, la sugerencia, hábitos "X veces por semana", formatos). Nueva
  suite de pantalla `resumenes` (los datos de las 10 secciones llegan al
  motor; Finanzas sin transferencias ni excluidos): ahora son 39 suites.
  `run-feed` «se cargan 20 más solas» fallaba a veces: al abrir, la base
  de datos de prueba avisa a todas las pantallas con cada cosa que se
  guarda, la lista de carreras se vuelve a dibujar varias veces y la
  prueba bajaba con el botón «Ver más» ya reemplazado (en la app real no
  pasa: cada colección avisa solo lo suyo). Ahora la prueba reintenta.
- 2026-11-16 (Libros nivel 3, control final, D-135): `npm test` → **732
  pruebas**; las 38 pruebas de pantalla pasan (3161 comprobaciones);
  Lighthouse de las pantallas nuevas de Libros en oscuro y en claro: 100 en accesibilidad y en buenas prácticas en las 12 pantallas
  (`scratchpad/lh/correr3.mjs`, fuera del repo). La medición "Biblia con
  1.500 versículos < 1,5 s" de `lectura-qa` está al borde en este entorno:
  si falla, repetirla sola.
- 2026-11-16 (Libros nivel 3, fase 6, D-134): `npm test` → **732
  pruebas**. Nuevo `libros-recomendar` (de qué libros se parte, los mismos
  temas sin cuentos infantiles ni el mismo autor, uno por autor, títulos en
  inglés no, intercalar sin repetir ni lo que tienes ni lo descartado) y en
  `libros-siguiente` (del mismo autor o temas que uno que te gustó). E2E
  `libros-n3` con la fase 6 (la sección con 2 y "Ver las 12", sus razones,
  sin lo que tienes, "✕", "＋ Quiero leer" abre Agregar libro lleno, al
  volver sin pedir nada; "¿Qué leo después?" con lo que te gustó; 390 y 320
  px). Las pruebas de pantalla ya no salen a internet a buscar libros
  (`scripts/e2e/comun.js`).
- 2026-11-16 (Libros nivel 3, fase 5, D-133): `npm test` → **727
  pruebas**. Nuevo `libros-completar` (qué libros revisar, el título en
  español con el tuyo como original, solo se suma lo que falta, con otro
  autor o un resumen no, las páginas de la edición en español más común y
  nunca la mediana de todos los idiomas). E2E `libros-n3` con la fase 5 (la
  tarjeta con cuántos, revisa de a uno, propuestas, "Usar los 2 seguros",
  lo tuyo no cambia, "Deshacer", "Dejar como está", no encontrado, sin
  internet, lo que dejaste no vuelve; 390 y 320 px).
- 2026-11-16 (Libros nivel 3, fase 4, D-132): `npm test` → **722
  pruebas**. Más en `libros-fuentes` (temas en español, "sport" no es
  "transport", "De qué trata" de Wikipedia sin la serie ni la película,
  Open Library solo en español, Google Books de extra, limpiar el texto).
  E2E `libros-n3` con la fase 4 (temas en la ficha, tocar uno filtra la
  lista, "De qué trata" con fuente y "Ver más", Google Books cuando no hay
  Wikipedia, la segunda vez sin pedir nada, temas al agregar, páginas por
  género; 390 y 320 px).
- 2026-11-16 (Libros nivel 3, fase 3, D-131): `npm test` → **719
  pruebas**. Más en `libros-fuentes` (el autor por su nombre, su ficha, su
  Wikipedia emparejada por Wikidata y sin homónimos, sus libros más leídos
  sin los que ya tienes; respuestas reales). E2E `libros-n3` con la fase 3
  (tocar el autor, quién es, foto y resumen, tus libros de él, sus libros
  más leídos, «＋ Quiero leer», la segunda vez sin pedir nada, sin
  internet; 390 y 320 px).
- 2026-11-16 (Libros nivel 3, fase 2, D-130): `npm test` → **716
  pruebas**. Más en `libros-fuentes` (ediciones reales: páginas,
  editorial, año, tapa; grupos por largo; la recomendada; ISBN exacto; sin
  ediciones en español), `libros-progreso` (páginas por día para una fecha
  y las tres sugerencias) y `libros-motor` (la edición y `metaFin`). E2E
  `libros-n3` con la fase 2 (elegir edición, la portada la sigue, a mano
  mandan las tuyas, guardar y ver en la ficha, ISBN exacto, «Ver más», sin
  internet, «¿Para cuándo lo quieres terminar?», no menos páginas que la
  página en la que vas; 390 y 320 px). `libros-progreso` y `lectura-n2`
  no piden ediciones (las cortan).
- 2026-11-16 (Libros nivel 3, fase 1, D-129): `npm test` → **711
  pruebas**. Nueva: `libros-fuentes` (título en español, el libro de
  verdad primero, resúmenes al final, sin repetidos, autor en nuestro
  alfabeto, buscar por autor, ISBN; con respuestas reales de Open Library
  en `tests/fixtures/libros/`). E2E nueva: `libros-n3` (buscar, elegir y
  guardar con título original y autor, cambiar el autor a mano, por autor,
  autor en otro alfabeto, ISBN; 390, 320 y 1280 px). `libros-progreso`: el
  resultado dice ediciones en vez de páginas.
- 2026-11-16 (control final de las mejoras sin servidor): `npm test` →
  **702 pruebas**; las 37 suites de `scripts/e2e/` en verde con la app
  empaquetada (2.908 comprobaciones, 0 fallas); Lighthouse 100 / 100 en las
  pantallas nuevas, en oscuro y en claro (ver "Resultado del control
  final" abajo).
- 2026-11-16 (la app abre más rápido, D-127): `npm test` → **702
  pruebas**. Nueva: `paquete` (paquetes al día, la lista sin repetidos y
  sin módulos sueltos en index.html, el orden de los estilos, el modo
  claro se sigue generando de cada estilo, Firebase antes, cada módulo
  válido, un error en uno no frena a los demás, el service worker ve los
  datos dentro del paquete). `sin-internet` revisa que se guarden los
  paquetes y que la búsqueda de la Biblia arranque en modo avión (sin el
  arreglo, falla: probado); `sw-instala`, que se guarden los paquetes.
  Regresión con la app empaquetada: las 37 suites en verde. **Después de
  cambiar cualquier .js o .css de la app: `npm run listo`** (paquete +
  tema + sw). Un módulo nuevo se agrega en `js/paquete.json`.
- 2026-11-16 (modo claro, D-126): `npm test` → **694 pruebas**. Nueva:
  `tema-claro` (colores, cómo se aclara cada uso, :where(), leer CSS, que
  `css/tema-claro.css` esté al día y cargue al final). E2E nueva:
  `tema-claro` (elegir la apariencia, que quede guardada, automático sigue
  al teléfono, y contraste de cada texto visible en 19 pantallas y 6 hojas).
  Las E2E corren con el teléfono en oscuro (`comun.js · esquema`).
  **Después de cambiar cualquier CSS: `npm run tema` y después `npm run
  sw`** (si no, falla `tests/tema-claro.test.js`). Regresión: las 37
  suites en verde. De paso, dos pruebas que fallaban a veces (también
  antes) leen de forma más robusta: `run-progreso` (los totales pedazo por
  pedazo: innerText a veces juntaba "Tiempo1 h") y `run-feed` (espera las
  20 carreras siguientes en vez de 600 ms fijos).
- 2026-11-16 (rutinas del gimnasio desde el entreno, D-125): `npm test` →
  **683 pruebas**. Nueva: `rutina-desde-entreno` (cambios de hoy, aplicar
  solo lo elegido, orden, dos veces el mismo ejercicio, cardio e
  isométricos, entreno libre como rutina). E2E nueva: `rutina-entreno`
  (entreno con cambios › elegir › guardar › deshacer, entreno libre ›
  rutina nueva, el editor pregunta antes de perder cambios).
- 2026-11-16 (rutinas de Running desde la app, D-124): `npm test` → **675
  pruebas**. Nueva: `rutina-running-editor` (pasos y series, agrupar lo que
  se repite, duración en min y s, límites con el paso que falla, copias y
  orden de la cola). E2E nueva: `rr-editor` (crear, errores, editar, una
  importada se agrupa, duplicar, hacer la siguiente, eliminar, nombre de un
  plan, la rutina se usa como siempre, 320 px); `running` borra desde el
  menú ⋯.
- 2026-11-16 (Biblia en audio, D-123): `npm test` → **665 pruebas**. Nueva:
  `biblia-audio` (texto para la voz, trozos, "Primera de Corintios",
  velocidades, qué voz usar, cuándo cuenta como escuchado). E2E nueva:
  `biblia-audio` (con una voz falsa: botón y barra, ⏮/⏭, pausa,
  velocidad, voz, seguir con el siguiente, marcar con "Deshacer", desde un
  versículo, salir de la app, errores y vigía, 320 px). Regresión: las 34
  suites en verde. De paso: el aviso del audio se crea al usarlo (antes,
  creado al abrir la app, confundía a la prueba de tarjetas, que lee el
  primer aviso "Deshacer" de la página).
- 2026-11-15 (pago mínimo, Biblia en papel y arreglos del iPhone, D-120 a
  D-122): `npm test` → **655 pruebas**. Nuevas: `viewport-ajuste` (cuánto
  mover lo fijo cuando el iPhone deja la pantalla corrida), `biblia-marcar`
  (qué sigue, lo de hoy, recientes, el plan) y más en `finanzas-tarjetas`
  (pago mínimo: guardar, ciclo, cuánto falta) y `mi-dia` (aviso del
  mínimo). E2E nuevas: `pantalla` (pantalla corrida, campos de 16 px,
  campos de hora, nombres largos), `tarjetas-minimo` y `biblia-marcar`.
- 2026-11-15 (QA final de Finanzas, Lugares y copia de seguridad, D-119):
  `npm test` → **641 pruebas** en verde (las del disponible por día: 11 de
  11; nueva en `lugares-motor`: miniaturas solo de imágenes de verdad). E2E nueva `scripts/e2e/sin-internet.js` (service worker de verdad,
  modo avión) y más en `lugares` (zoom libre, títulos en orden) y
  `respaldo` (guardar la copia no cambia datos, menú cerrado fuera del
  foco); las 30 suites en verde. Lighthouse (Accesibilidad / Buenas
  prácticas, 375 px): Inicio 100/100, hoja de la copia 100/100, Lugares
  lista 100/100, detalle 100/100, nuevo lugar 97/100 (botón fijo
  "Guardar" sobre dos chips; ver D-119), Finanzas 100/100 y "¿Cómo se
  calcula?" 100/100.
- 2026-11-15 (Copia de seguridad de todo, D-118): `npm test` → **640
  pruebas**. Nueva: `respaldo-motor` (armar la copia y las fechas, revisar
  el archivo, lo dañado, copias de una sección y el archivo de Lugares,
  solo agregar lo que falta, ids, ninguna colección afuera). E2E nueva
  `scripts/e2e/respaldo.js` (descargar y abrir el archivo, restaurar sin
  pisar, la foto, la copia automática, Deshacer, sin duplicados, archivos
  que no sirven, sin internet, 375 px, 44 px, menú ☰, compu, menos
  movimiento).
- 2026-11-15 (Lugares, D-117): `npm test` → **632 pruebas**. Nueva:
  `lugares-motor` (registrar, más detalles, montos, platos y visitas,
  documentos viejos, buscar y filtrar, ordenar, "¿Dónde como hoy?",
  estadísticas, montos y fechas). E2E nueva `scripts/e2e/lugares.js` (75
  comprobaciones a 375 px: registro rápido, validación, Finanzas solo si
  confirmas, borrador, fotos en IndexedDB, detalle, platos, visitas,
  Deshacer, Ya fui, buscar y filtros, sugerencia, estadísticas, exportar,
  44 px, menos movimiento).
- 2026-11-15 (Finanzas: disponible diario, D-116): `npm test` → **621
  pruebas**. Nueva: `finanzas-diario` (100 por día con 3000 de 5000, sin
  ingresos, negativo, último día, febrero, otros meses, excluidos, centavos,
  periodo del 25 al 24). E2E nueva `scripts/e2e/finanzas-diario.js`.
- 2026-11-15 (QA final de Libros, Biblia y Medir tiempos, D-115): `npm
  test` → **610 pruebas** (+3: con miles de datos, mismos resultados y
  rápido; el respaldo de Libros con tus ajustes). E2E nueva
  `scripts/e2e/lectura-qa.js` (datos de antes intactos, respaldos,
  rendimiento, 320 px); las 26 suites en verde.
- 2026-11-15 (Medir tiempos fase 7, D-114): `npm test` → **607 pruebas**.
  Nuevas: `tiempos-plan`, `tiempos-stats`; más en `mi-dia` (filas nuevas y
  máximo 5) y `habitos-auto` (fuente Medir tiempos). E2E `SOLO=fase7`.
- 2026-11-15 (Medir tiempos fase 6, D-113): `npm test` → **596 pruebas**.
  Nuevas: `tiempos-actividades`, `tiempos-crono`, `tiempos-auto` y más en
  `tiempos-motor`. E2E `scripts/e2e/tiempos.js` (+ `SOLO=fase6`).
- 2026-11-15 (Libros fase 5e, D-112): `npm test` → **584 pruebas**. Nueva:
  `libros-estadisticas` (calendario, tiempo, velocidad, autores, el año).
  E2E `SOLO=stats`. Con esto, la fase 5 de Libros está completa.
- 2026-11-15 (Libros fase 5d, D-111): `npm test` → **577 pruebas**. Nueva:
  `libros-isbn` (códigos de barras dibujados: borrosos, con ruido, girados,
  de costado; y que no invente). E2E `SOLO=isbn`.
- 2026-11-15 (Libros fase 5c, D-110): `npm test` → **567 pruebas**. Nueva:
  `libros-importar` (CSV, Goodreads, StoryGraph, Kindle, duplicados). E2E
  `SOLO=importar`.
- 2026-11-15 (Libros fase 5b, D-109): `npm test` → **561 pruebas**. Nueva:
  `libros-frases` (repaso, calificar, etiquetas). E2E `SOLO=frases`.
- 2026-11-15 (Libros fase 5a, D-108): `npm test` → **557 pruebas**. Nueva:
  `libros-siguiente` ("¿Qué leo después?"). E2E `SOLO=siguiente`.
- 2026-11-15 (Libros fase 4, D-107): `npm test` → **552 pruebas**.
  Nueva: `libros-sesiones` (cronómetro, cerrar, velocidad, tiempo que
  falta, minutos por día); más casos en `libros-progreso` (audiolibro,
  releer, abandonar), `libros-motor` y `habitos-auto`. E2E
  `scripts/e2e/lectura.js` con `SOLO=sesion` (a 390, 1280 y 320 px).
- 2026-11-14 (Biblia fase 3, D-106): `npm test` → **544 pruebas**.
  Nuevas: `biblia-planes` (calendarios, lectura de hoy, atrasado, ponerse
  al día, mover, Proverbios, progreso) y `biblia-memoria` (cajas, primeras
  letras, ocultar, comparar lo escrito); más casos en `biblia-motor`,
  `mi-dia` y `habitos-auto`. E2E `scripts/e2e/lectura.js` con
  `SOLO=planes` y `SOLO=memoria` (a 390 y 1280 px).
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
- **Regresión** en cada fase: `npm test` + las 48 suites de `scripts/e2e/`
  (ver "Cómo correr todo"; D-115: una prueba que quedó fuera de la lista
  corta se rompió sin que se viera).

## Cómo correr todo
```bash
npm test
export NODE_PATH=/opt/node22/lib/node_modules   # donde está Playwright
for f in fase1 regresion hojas sw-instala emojis scalping inversiones tarjetas movilidad \
  running run-importar run-detalle run-feed run-progreso run-inteligencia run-segmentos \
  run-compartir run-qa habitos mi-dia ej-calendario ejercicio libros-progreso lectura \
  lectura-qa tiempos finanzas-diario lugares respaldo sin-internet pantalla tarjetas-minimo \
  biblia-marcar biblia-audio rr-editor rutina-entreno tema-claro libros-n3 bici resumenes \
  ropa ropa-insp ropa-outfits ropa-compras ropa-numeros ropa-final ropa-corte ropa-armar; do node scripts/e2e/$f.js || break; done
(cd puente && npm install && npm run prueba)   # el Worker del puente de Ropa
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

## Resultado del QA final de Libros, Biblia y Medir tiempos (fase 8, 2026-11-15)
- Unitarias: 610/610. E2E, las 26 suites de `scripts/e2e/` (2.498
  comprobaciones, 0 fallas): lectura 681, ejercicio 422, tiempos 223,
  habitos 216, inversiones 137, scalping 75, run-importar 70, running 64,
  tarjetas 56, movilidad 55, libros-progreso 53, run-feed 48, lectura-qa 47,
  run-qa 46, run-detalle 42, fase1 40, regresion 39, mi-dia 38, run-progreso
  36, run-segmentos 29, hojas 21, ej-calendario 18, run-inteligencia 14,
  run-compartir 13, emojis 10, sw-instala 5.
- Nueva `lectura-qa.js` (D-115): con tus datos guardados como antes, usar
  todo lo nuevo no cambia ni pierde nada de antes (documento por
  documento) y los tres «Exportar» llevan todo lo nuevo; con 3 años de
  tiempos, 1.500 versículos, 400 libros y 3.000 frases cada pantalla abre
  en menos de 1,5 s; a 320 px nada se mueve de lado.
- Hallazgos arreglados: estadísticas de Medir tiempos y «Frases de hoy»
  lentas con muchos datos (≈ 160 ms → ≈ 5 ms, mismos resultados); "Tus
  días" pinta los 90 más nuevos ("Ver 90 días más"); «Exportar» de Medir
  tiempos sin el plan ni los experimentos y el de Libros sin tus ajustes.
- `libros-progreso.js` (fuera de la lista corta de cada fase) esperaba el
  aviso general con un ISBN escrito; desde D-111 el aviso es el del ISBN.
  La prueba ahora revisa los dos avisos.
- Lo que no se puede probar aquí: el escáner con la cámara de verdad (que
  enfoque de cerca), «Leer ahora», ⏱ Medir y «Mi mañana» con el iPhone
  bloqueado de verdad y la pantalla encendida, el menú de compartir del
  iPhone y la descarga de la Biblia en el teléfono. Van en la lista de
  abajo.

## Resultado del control final de las mejoras sin servidor (2026-11-16)
- Unitarias: 702/702. E2E: las 37 suites de `scripts/e2e/` en verde sobre
  la versión final, con la app empaquetada (2.908 comprobaciones, 0 fallas).
- Lighthouse (Accesibilidad / Buenas prácticas, 375 px): 100 / 100 en los
  20 pasos, en oscuro y en claro: Inicio, hoja "Apariencia", Biblia y el
  lector con la barra de audio, rutinas de Running y su editor,
  Entrenamiento y el editor de rutinas, Hábitos y Finanzas (cada hoja
  confirmada abierta antes de medir).
- Abrir la app (con la app instalada y la CPU 4 veces más lenta, mediana
  de 7): 198 → 14 archivos; Inicio con contenido 640 → 400 ms (D-127).
- Hallazgos arreglados antes de subir: con la app empaquetada, la búsqueda
  de la Biblia no habría arrancado sin internet (su Worker carga dos
  archivos sueltos que ya no estaban en la lista del service worker; ahora
  se guardan aparte y `sin-internet` lo prueba en modo avión); el modo
  claro generado desde el paquete salía con otros títulos de sección
  (ahora idéntico). Dos pruebas que fallaban a veces, también antes de
  estos cambios, leen de forma más robusta (`run-progreso`, `run-feed`).
- Lo que no se puede probar aquí: las voces de verdad del iPhone y el
  audio con la pantalla bloqueada, el cambio claro/oscuro del iPhone en
  "Automático", la franja de la hora en la app instalada y la velocidad
  real al abrir en el teléfono. Van en la lista de abajo.

## Pruebas en el iPhone (las hace el dueño)
Abrir Manolo **desde el ícono de la pantalla de inicio** (no desde Safari),
con iOS actualizado. Marcar cada punto; si algo falla, anotar qué pasó.

**Antes de empezar (una sola vez)**
- [ ] Publicar las reglas y crear `admins/{tu uid}` (`docs/ADMIN.md`).

**Ropa (2026-11; revisión final D-152)**

*Ya funciona, sin la IA:*
- [ ] Inicio › Ropa › "+" › "Sacar o elegir fotos": elige 3 o 4 fotos a la
  vez. En cada una, mira que el color esté bien y elige qué es; "Guardar y
  seguir" hasta la última.
- [ ] Saca una foto con la cámara desde el "+" (no de la galería).
- [ ] La barra de Ropa: Ropero, Outfits, "+", Inspiración y Compras.
- [ ] El ropero: los grupos, el filtro de color y buscar por la marca.
- [ ] Una prenda: "Me la puse hoy", "Para lavar", "Editar" (ponle el precio)
  y "¿Con qué combino esto?".
- [ ] "+" › "Subir imágenes": 2 o 3 capturas de Pinterest; ábrelas.
- [ ] Outfits: el clima de hoy en La Paz y "¿Qué me pongo?"; prueba "Otra
  opción", "No me gusta" (y Deshacer), "Guardar" y "Me lo pongo"; mira el
  calendario de abajo.
- [ ] "Cambiar ciudad" (por ejemplo, Santa Cruz) y vuelve a La Paz desde "Las
  que usaste"; "Mañana" y "Para mañana" (al otro día, arriba dice "Para hoy
  elegiste").
- [ ] "+ Otra": una ocasión tuya; quítala en Ajustes de Ropa. Marca
  "Friolento" y mira cómo cambian los consejos.
- [ ] Compras: "Ponerme un presupuesto" (por ejemplo, 500); en tu lista, "Lo
  compré" (con foto): llega a tu ropero con la fecha de hoy y el precio.
- [ ] El ropero › "Tus números": lo que más te pones, lo que no te pones hace
  3 meses o más, tus colores y cuánto te sale cada uso. Toca una prenda: abre
  su ficha.
- [ ] Anota lo que te pusiste hoy y mira la tarjeta de Ropa en Inicio; menú ☰
  › "Tu semana" y "Tu año": mira Ropa (tu prenda del año).
- [ ] En modo avión: abre Ropa, "Tus números" y Outfits (arma igual, sin el
  clima).
- [ ] Ajustes › Apariencia › Claro: mira Ropa en modo claro.
- [ ] Una polera: elige el corte ("Pegada", "Suelta"…) y las mangas; tócalo
  otra vez y se quita. Cambia a "Abajo": los cortes de pantalón, sin mangas.
- [ ] Toca un color para cambiarlo; con dos colores, "Que sea el principal".
  En la ficha, "Cambiar los colores".
- [ ] Escribe la tela y la marca en minúscula y la talla "m": al guardar,
  quedan con mayúscula ("M").

- [ ] Outfits: toca las fotos de una opción: la ves en grande; pasa a las otras
  con las flechas. Toca una foto: abre esa prenda.
- [ ] "Armar el mío": elige arriba, abajo y zapatos; mira los avisos (si hace
  frío, te lo dice). Baja a las fotos: las partes quedan arriba. Guárdalo con un
  nombre; "Me lo pongo" otro día.
- [ ] En una opción, "Cambiar una prenda"; en un guardado, "Editar" y
  "Duplicar".

*Con la IA (el puente ya está instalado):*
- [ ] La prueba real corta (`docs/ROPA.md` › "La prueba real de la IA").
- [ ] Agrega 2 o 3 fotos: la IA llena todo, también el corte y las mangas;
  revísalo antes de guardar. En una prenda vieja: "Describir con IA".
- [ ] Ajustes de Ropa: el gasto del mes; cambia el tope.
- [ ] Inspiración › "Conectar tablero": en Pinterest, tu tablero › Compartir ›
  Copiar link, y pégalo; mira que lleguen tus pines. "+" › "Link de
  Pinterest": pega el link de un pin.
- [ ] Un pin: "Lo que se ve", "Armar este look con la IA" y "Me lo pongo hoy";
  "Mi estilo": míralo y corrígelo.
- [ ] Outfits con la IA. Compras: "Qué te falta" y "Ver opciones en
  Pinterest"; "A mi lista" desde un pin.
- [ ] Outfits › "Tu estilista": dicta con el micrófono del teclado "Hace frío,
  quiero una chompa y una chamarra encima". Mira los outfits; "Me lo pongo" o
  "Guardar" uno; "Otra opción". Si te falta algo, "A mi lista".
- [ ] Cuéntale algo de ti ("Soy friolento"): aparece "Lo recordé"; míralo en
  "Lo que recuerda de ti" (también en Ajustes de Ropa).
- [ ] Sal y vuelve: la conversación sigue; en "Conversaciones", empieza una
  nueva y vuelve a la de antes.
- [ ] Compras › "Lo que opina tu estilista" › "Pedir su opinión" (unos 12
  centavos; tarda un poco). Lee lo que ve y lo que sumaría; "A mi lista" en
  una sugerencia.
- [ ] "Armar el mío": arma un outfit y toca "¿Qué opinas?"; si propone un
  cambio, "Cambiar".
- [ ] Con un repaso de tu estilista: en Outfits, mira si sale el aviso corto
  ("Para el frío de hoy, tu estilista te sugirió: …"); toca "Mañana" (si
  llueve, cambia); "Ver en Compras"; la ✕ lo oculta (y "Deshacer").
- [ ] Pídele algo a tu estilista y vuelve a Outfits: "Hoy te armó…" › "Verlos"
  abre esa conversación. En un outfit, "Para mañana": míralo en tus guardados.
- [ ] Compras: "Tu estilista también lo sugiere" (si coincide con tus pines) y
  "Te lo sugirió tu estilista" en tu lista. Inicio: la tarjeta de Ropa dice lo
  que te armó hoy o "¿Qué me pongo hoy?".
- [ ] La prueba real corta de tu estilista (`docs/ROPA_ESTILISTA.md` › "La
  prueba real de tu estilista"; unos 25 centavos). El repaso de tu ropero
  puede tardar más de un minuto: tiene que llegar igual (los latidos, D-162).
- [ ] Tus favoritos: toca el corazón en una opción de Outfits y en un
  guardado; míralos en "Tus favoritos" y ponte uno ("Me lo pongo hoy"). En
  "Armar el mío", "A favoritos".
- [ ] En modo avión: Ajustes de Ropa dice "Sin internet"; al agregar una foto,
  "Sin internet: la IA no puede mirar la foto". Al volver internet, la IA se
  conecta sola.

**Bici (2026-11)**
- [ ] Bicis: agrega tu bici con los km que ya tiene y pónsela a tus
  rodadas. Mira el mantenimiento; cuando cambies algo, "Hecho hoy".
- [ ] En una rodada con mapa: ⋯ › Crear segmento. Míralo en Segmentos.
  Después importa una rodada que pase por ahí: su tiempo aparece solo.
- [ ] Progreso: tus récords y el número de Eddington; los mejores tiempos
  aparecen también para tus rodadas importadas antes (tarda un poco la
  primera vez).
- [ ] El engranaje de arriba: ponte una meta y mira el anillo en Progreso.
- [ ] Bicicleta: la barra de abajo es Actividades · Progreso · + ·
  Segmentos · Bicis.
- [ ] Actividades: tarjetas con velocidad, mapa y medallas; prueba los
  filtros. Toca una rodada: abajo sigue la barra de Bici.
- [ ] "+" › Anotar a mano: aparece en la lista.

**Tu año en Manolo (2026-11)**
- [ ] Menú ☰ › "Tu año": se abre a pantalla completa. Toca a la derecha
  para avanzar y a la izquierda para volver.
- [ ] Mira que cada diapositiva entre en la pantalla (si no, se desliza).
- [ ] En Hábitos, "Ver tu año en hábitos" abre el Wrapped de Hábitos.
- [ ] "Compartir" en una diapositiva y, al final, "Compartir tu año": las
  imágenes no tienen montos de dinero.
- [ ] En diciembre: la tarjeta "Tu año" en Inicio; "Ahora no" la cierra.

**Tu semana (2026-11)**
- [ ] El lunes, en Inicio: la tarjeta "Tu semana" con la semana pasada.
  Toca "Ver mi semana".
- [ ] Mira cada área (toca una: va a su sección), "Lo mejor", "Se quedó
  atrás" y "Para esta semana". Con ‹ › ve semanas anteriores.
- [ ] "Compartir mi semana": la imagen no tiene montos de dinero.
- [ ] De vuelta en Inicio, "Listo": la tarjeta no vuelve hasta el lunes
  siguiente. "Tu semana" sigue en el menú ☰.

**Libros nivel 3: lista para el iPhone (2026-11-16)**
Un recorrido corto por todo lo nuevo (más detalle en cada lista de abajo):
- [ ] ＋ Agregar libro › Buscar "Hábitos atómicos": sale en español, con
  "Original: Atomic Habits"; elígelo y mira "¿Cuántas páginas tiene tu
  libro?" (la recomendada ya puesta).
- [ ] Abre un libro: toca el autor (su ficha), mira sus temas y "De qué
  trata"; si lo estás leyendo, "¿Para cuándo lo quieres terminar?".
- [ ] Arriba de tu lista: "Completar mi biblioteca" (nada cambia sin tu OK).
- [ ] Debajo de "¿Qué leo después?": "Si te gustó…" (con 4 o 5 estrellas
  en algún libro terminado).
- [ ] Prueba en modo claro y en oscuro (☰ › Apariencia).

**Libros: "Si te gustó…" (2026-11)**
- [ ] Califica con 4 o 5 estrellas un libro que terminaste.
- [ ] En Libros, debajo de "¿Qué leo después?", mira "Si te gustó…": cada
  idea dice por qué. Toca "Ver las…" para verlas todas.
- [ ] Toca "✕" en una que no te interese: desaparece. Toca "＋ Quiero
  leer" en otra: se abre "Agregar libro" lleno; guárdalo.

**Libros: completar tu biblioteca (2026-11)**
- [ ] Arriba de tu lista de libros, toca "Completar mi biblioteca".
- [ ] Mira lo que propone para cada libro. Toca "Usar" en uno y "Dejar como
  está" en otro.
- [ ] Abre el libro que usaste: tiene lo nuevo, y tus páginas, estrellas y
  fechas siguen igual. Si algo no te gustó, vuelve y toca "Deshacer".

**Libros: temas y "De qué trata" (2026-11)**
- [ ] Agrega un libro buscándolo: en su ficha salen sus temas en español.
  Toca uno: la lista muestra tus libros de ese tema.
- [ ] En la ficha, "De qué trata": ¿el resumen es de ese libro? Toca la
  fuente para verla.
- [ ] Estadísticas › "Lo que más lees": cada género dice sus páginas.

**Libros: la ficha del autor (2026-11)**
- [ ] Abre un libro tuyo y toca el nombre del autor: ¿sale su foto, quién
  es y un resumen en español? ¿Es la persona correcta?
- [ ] Abajo, "Sus libros más leídos": toca "＋ Quiero leer" en uno: se
  abre "Agregar libro" con todo lleno. Guárdalo.
- [ ] Vuelve a abrir la ficha del mismo autor con el modo avión: abre
  igual.

**Libros: las páginas de tu edición (2026-11)**
- [ ] "Agregar libro" › busca "habitos atomicos" y toca el primero: debajo
  de "Páginas" pregunta "¿Cuántas páginas tiene tu libro?" con las
  ediciones en español. Toca la que se parece a la tuya (o escribe las
  páginas de tu libro): cambian las páginas.
- [ ] Escanea el código de barras de un libro que tengas: arriba dice "Tu
  edición (por el código de barras)" con sus páginas. ¿Coinciden con la
  última página de tu libro?
- [ ] En un libro que estás leyendo: ábrelo y toca "En 2 semanas": en
  "Sigue leyendo" sale "🎯 Para el …: N páginas por día".

**Libros: buscar un libro (2026-11)**
- [ ] Libros › "Agregar libro" › en "Buscar el libro" escribe "padre rico
  padre pobre": el primero es "Padre rico, padre pobre" de Robert T.
  Kiyosaki y abajo dice "Original: Rich Dad, Poor Dad". Tócalo: se llenan
  el título en español, el autor y el género. Guárdalo y abre su ficha:
  dice el título original.
- [ ] Escribe "paulo coelho": dice "Libros de Paulo Coelho" y salen sus
  libros, El alquimista primero.
- [ ] Busca un libro que tengas en casa: ¿sale primero el de verdad y con
  el título como lo tienes? Si no, mándame una captura.

**La app abre más rápido (2026-11)**
- [ ] Cuando aparezca "Nueva versión disponible", toca "Actualizar".
- [ ] Cierra Manolo del todo (desliza hacia arriba) y ábrelo: Inicio
  aparece más rápido que antes.
- [ ] En modo avión: abre Manolo y entra a Hábitos, Finanzas y la Biblia.
  Si descargaste la Biblia, busca una palabra con la lupa.

**Modo claro (2026-11)**
- [ ] Inicio › abajo "Apariencia" › "Claro": todo se pone claro al
  instante. Recorre Hábitos, Ejercicio, Finanzas y la Biblia: ¿algo no se
  lee o se ve raro? Avísame con una captura.
- [ ] Arriba, la hora y la batería se leen (la franja queda oscura).
- [ ] "Automático": en Ajustes del iPhone › Pantalla y brillo, cambia entre
  Claro y Oscuro y vuelve a Manolo: cambia solo.
- [ ] "Oscuro": la app queda como siempre.

**Rutinas del gimnasio: guardar lo que cambiaste (2026-11)**
- [ ] Empieza una rutina, quita un ejercicio, agrega otro y haz una serie de
  más en alguno. "Terminar": al final del resumen sale "Hoy cambiaste…" con
  la lista. Quita la marca de algo y "Guardar en la rutina"; ábrela en el
  editor: tiene lo marcado y los mismos pesos.
- [ ] Toca "Deshacer": la rutina vuelve a como estaba.
- [ ] Entreno libre (sin rutina) › "Terminar" › "Guardar como rutina":
  aparece en tus rutinas.
- [ ] Editar una rutina, cambiar algo y tocar la ✕: pregunta "¿Salir sin
  guardar?".

**Rutinas de Running desde la app (2026-11)**
- [ ] Running › Rutinas › "＋ Nueva": aparece una rutina de ejemplo (20 min).
  Ponle un nombre, cambia el "4" de la serie y un tiempo, y "Guardar
  rutina": queda al final de la lista.
- [ ] Toca la rutina nueva: muestra sus intervalos; "Iniciar" funciona como
  siempre (pitidos y voz).
- [ ] ⋯ › "Editar": cambia algo y guarda. ⋯ › "Duplicar": aparece la copia
  debajo. ⋯ › "Hacer la siguiente": sube arriba.
- [ ] Escribe 0 min 3 s en un intervalo y guarda: no deja y dice qué paso.

**Biblia en audio (2026-11)**
- [ ] Biblia › abre el lector › toca los **audífonos** arriba: se oye
  "Juan, capítulo 3" (o el que tengas abierto) y luego cada versículo; el
  que suena se ve resaltado.
- [ ] Toca ⏸ y después ▶: sigue desde el mismo versículo. Prueba ⏭ y ⏮.
- [ ] Toca "1×" varias veces: cambia la velocidad.
- [ ] ⚙️ › elige otra voz y toca "Probar la voz".
- [ ] Abre el Salmo 117 (es corto) y escúchalo entero: sigue solo con el
  118 y aparece "quedó como leído hoy" con "Deshacer".
- [ ] Toca un versículo › "Escuchar": lee desde ahí.
- [ ] Mientras suena, sal de la app y vuelve: quedó en pausa y lo dice.
- [ ] Si no se oye nada: sube el volumen, quita el modo silencio y dime.

**Pago mínimo, Biblia en papel y arreglos (2026-11)**
- [ ] Finanzas › Tarjetas: edita una tarjeta, pon su "Pago mínimo" y
  guarda: la tarjeta dice cuánto falta y cuándo vence; "Pagar el mínimo"
  abre el pago con ese monto.
- [ ] Biblia: en "Leí en mi Biblia" toca "✓ Leí …": queda marcado y ofrece
  el siguiente. Toca "Deshacer" una vez.
- [ ] "Elegir otros capítulos" › un libro › toca 2 o 3 números: quedan en
  verde. Toca uno otra vez: se quita.
- [ ] Biblia › Progreso › un libro: misma hoja para marcar.
- [ ] Escribe algo (por ejemplo una nota de un hábito), cierra el teclado
  y baja hasta el final: la barra de abajo queda abajo (no a media
  pantalla).
- [ ] Medir tiempos › Plan de la mañana: los dos campos de hora caben en
  la tarjeta.

**Copia de seguridad (2026-11)**
- [ ] Inicio › abajo "Copia de seguridad" › "Descargar copia de todo" ›
  "Guardar archivo" › "Guardar en Archivos" (en iCloud Drive).
- [ ] Ábrelo de nuevo: dice cuándo guardaste la última copia.
- [ ] "Elegir archivo de copia" › elige el archivo recién guardado: dice
  "Ya tienes todo" (no agrega nada repetido).
- [ ] Borra un gasto de prueba en Finanzas, restaura la copia: aparece
  "Esto se agregaría: 1"; "Agregar lo que falta" lo trae de vuelta, y lo
  demás queda igual.
- [ ] Abajo aparece "Copias automáticas" con la de antes de restaurar.
- [ ] Menú ☰ › "Copia de seguridad" también la abre.

**Lugares (2026-11)**
- [ ] Inicio › "Lugares" › ＋: escribe un nombre, toca las estrellas y
  "¿Volverías?", y Guardar (menos de 15 segundos).
- [ ] Abre otro ＋, escribe algo y cierra la hoja sin guardar; ábrela de
  nuevo: sigue lo que escribiste.
- [ ] "Más detalles" › "Agregar foto": saca una foto; guarda y abre el
  lugar: se ve la foto.
- [ ] En un lugar: "＋ Plato" (márcalo como favorito) y "＋ Visita" con
  gasto: te pregunta si lo pasas a Finanzas; prueba "Agregar a Finanzas" y
  guarda en la hoja de Finanzas.
- [ ] "Quiero ir" › agrega uno › "Ya fui": califícalo y pasa a Visitados.
- [ ] Busca un plato; prueba los chips de Tipo y Ordenar.
- [ ] "¿Dónde como hoy?" y "Estadísticas".
- [ ] Borra un lugar y toca "Deshacer" (vuelve con todo).
- [ ] Con modo avión: abre Lugares y agrega uno (se sube al volver la
  conexión).

**Finanzas: disponible por día (2026-11)**
- [ ] Finanzas › Resumen: arriba, "Disponible por día" = lo que registraste
  de ingresos este mes ÷ los días del mes (si presupuestaste 5000 y
  recibiste 3000, dice Bs 100).
- [ ] Toca ⓘ: la cuenta con tus números.
- [ ] Anota un gasto: "Te queda por día desde hoy" baja al instante; si
  baja de tu disponible, el aviso pasa a ámbar.
- [ ] Inicio › "Mi día": "Para gastar hoy" dice lo mismo.

**Libros, Biblia y Medir tiempos: lista final (2026-11, unos 30 min)**
Sigue este orden. Abajo están las listas de cada parte, por si quieres
probar más.

*Leo la Biblia dentro de Manolo (también sin internet)*
- [ ] Biblia › «Leer la Biblia»: lee un capítulo, desliza el dedo para
  pasar al siguiente y toca «Marcar como leído».
- [ ] «Aa» › «Descargar la Biblia» (con wifi). Pon modo avión y abre otro
  libro: se lee igual.

*Sigo un plan y memorizo versículos*
- [ ] Biblia › «Planes» › elige uno › «Empezar hoy». Arriba dice la
  lectura de hoy: «Leer» y márcala como leída.
- [ ] En el lector toca un versículo › 🧠 «Memorizar». En Biblia,
  «Repasar» › «¡Lo sabía!».

*Mido mis sesiones de lectura y sé cuándo termino cada libro*
- [ ] Libros › «Sigue leyendo» › «▶ Leer ahora». Bloquea el iPhone 2
  minutos y vuelve: el reloj siguió. «Terminar», pon la página y guarda.
- [ ] Abre ese libro: tu velocidad y cuándo lo terminas.

*Agrego libros escaneando o importando*
- [ ] «Agregar libro» › «📷 Escanear el código de barras» › foto de la
  contratapa, de cerca: aparece tu libro.
- [ ] (Si usas Goodreads o Kindle) Libros › abajo, «Importar».

*Medir tiempos: mi mañana en vivo, se llena sola y me arma el plan*
- [ ] Medir tiempos › «🗓️ Plan de la mañana»: pon a qué hora te levantas y
  a qué hora tienes que estar listo.
- [ ] Una mañana: «▶ Empezar mi mañana» y «Siguiente» en cada paso. Debajo
  del reloj dice si vas adelantado o atrasado; al final, el resumen.
- [ ] Corre o entrena con Manolo: en Medir tiempos, Correr o Ejercicio de
  hoy aparecen solos con «⚡».
- [ ] Inicio › «Mi día»: tu mañana, el libro que lees y el repaso de hoy
  (5 filas como mucho).

*Mis versículos, libros, frases y tiempos de siempre siguen intactos*
- [ ] Biblia: tus versículos de antes, la racha y el calendario.
- [ ] Libros: tus libros y frases de antes, con fechas, estrellas y
  opiniones.
- [ ] Medir tiempos › «Tus días»: tus días de antes con sus tiempos;
  «Línea base» con tus primeros 30.
- [ ] «Exportar» en Biblia, Libros y Medir tiempos: «Guardar en Archivos».

*Nada más de Manolo se rompió*
- [ ] Marca un hábito, anota un gasto y abre una rutina de Gimnasio: todo
  como antes.

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

**Ejercicio: Rutina en casa (2026-11)**
- [ ] Ejercicio › Entrenamiento: abajo de tus rutinas, "Rutinas listas" ›
  "Rutina en casa — Glúteo & Full Body" (un lunes dice "Hoy: Día A").
- [ ] Ábrela: el día de hoy está destacado; cambia entre A, B y C.
- [ ] Marca algunas series, cierra Manolo y vuelve: siguen marcadas.
- [ ] "Terminar el día y guardar": aparece en Perfil (historial) y el
  mapa muscular pinta glúteos.
- [ ] Con modo avión, la rutina se abre igual.
- [ ] En el teléfono de tu novia, con su cuenta: la ve y la sigue igual.

**Hábitos: "¿Que se marque solo?" (2026-11)**
- [ ] Abre Hábitos › Hoy: si "Correr" no estaba vinculado, arriba dice
  "Correr puede marcarse solo…". Toca "Que se marque solo".
- [ ] Si hoy registraste una carrera, "Correr" queda hecho al instante;
  si te ofrece marcar días anteriores, acepta.
- [ ] Mañana, guarda o importa una carrera en Running y vuelve a Hábitos:
  "Correr" ya está marcado (con ⚡ Running).

**Medir tiempos: promedio por día (2026-11)**
- [ ] Medir tiempos › Promedios › "Por día": siete barras de lunes a
  domingo. Toca "Lu": la tabla dice cuánto tardas en promedio cada lunes.
  Con ‹ › pasas de día.

**Medir tiempos: plan de la mañana, estadísticas y experimentos (2026-11)**
- [ ] Medir tiempos › «🗓️ Plan de la mañana»: pon a qué hora te levantas y
  a qué hora tienes que estar listo. Mira si te sobra tiempo; toca «Sá».
- [ ] «▶ Empezar mi mañana»: debajo del reloj dice si vas adelantado o
  atrasado según tu plan; al final, a qué hora terminaste.
- [ ] «📊 Estadísticas»: toca otra actividad. «🧪 Experimentos › ＋ Nuevo».
- [ ] Inicio › «Mi día»: tu mañana, el libro que lees y el repaso de hoy.
- [ ] Hábitos › editar un hábito › «Se marca solo» › «Medir tiempos» ›
  elige «Rutina de la mañana».

**Medir tiempos: Mi mañana, ⏱ Medir y se llena sola (2026-11)**
- [ ] Inicio › Medir tiempos › «▶ Empezar mi mañana»: haz cada paso y toca
  «Siguiente». Si algo hoy no lo haces, «Saltar». Al final mira el resumen.
- [ ] En una actividad, «⏱ Medir»; bloquea el iPhone un minuto y vuelve: el
  reloj siguió. «Terminar y guardar».
- [ ] «⚙️ Tus actividades»: crea una nueva con emoji y súbela con ↑.
- [ ] Después de correr o entrenar con Manolo, abre Medir tiempos: Correr o
  Ejercicio de hoy aparecen solos con «⚡».

**Libros: estadísticas y «Tu año en libros» (2026-11)**
- [ ] Libros › Estadísticas: mira el calendario del mes; toca un día en
  color y lee qué leíste. Toca ‹ para ver el mes pasado.
- [ ] Más abajo: «Tiempo leyendo» y «Velocidad» (si usaste «Leer ahora»).
- [ ] Toca «🎉 Tu año en libros 2026» › «Compartir como imagen»: elige
  WhatsApp o «Guardar imagen».

**Libros: escanear el código de barras (2026-11)**
- [ ] Libros › «Agregar libro» › «📷 Escanear el código de barras» ›
  «Sacar foto del código»: saca la foto de la contratapa de cerca. En un
  segundo dice «Leí el ISBN…» y aparece tu libro para tocarlo.
- [ ] Prueba «Cámara en vivo»: pon el código dentro del recuadro. Si no lo
  lee en unos segundos, aleja un poco el teléfono (o usa la foto).
- [ ] Guarda el libro y ábrelo: en su ficha aparece «ISBN».

**Libros: importar (2026-11)**
- [ ] Si usas Goodreads: en la web, «Export Library»; guarda el .csv en
  Archivos. En Manolo, Libros › abajo «Importar» › elige el archivo: mira
  la vista previa y toca «Agregar».
- [ ] Con un Kindle: copia «My Clippings.txt» al iPhone y elígelo: llegan
  tus subrayados como frases.

**Libros: frases de hoy, favoritas, etiquetas y compartir (2026-11)**
- [ ] Libros: arriba, "Frases de hoy" › "Repasar". Toca ❤️, 👍 o 👎 en cada
  una; en una, "☆ Favorita" y "Compartir" (se abre el menú del iPhone).
- [ ] Al final, elige cuántas frases por día (1, 2 o 3).
- [ ] "Frases": abre una frase y ponle una etiqueta; filtra por ella y por
  "★ Favoritas".

**Libros: ¿Qué leo después?, sagas y notas (2026-11)**
- [ ] Libros: debajo de "Sigue leyendo", "¿Qué leo después?" con 3 libros y
  su razón. "Ver los…": pon uno en Alta y míralo subir; "Empezar" otro.
- [ ] Edita un libro: saga y número (por ejemplo Harry Potter, 2).
- [ ] En un libro, "＋ Nota" › "Aplicar" › escribe y guarda; tócala para
  editarla.

**Libros: Leer ahora, Abandonado, releer y audiolibros (2026-11)**
- [ ] Libros › "Sigue leyendo" › "▶ Leer ahora": corre el reloj. Bloquea el
  teléfono un par de minutos y vuelve: el tiempo siguió.
- [ ] "Terminar": pon la página a la que llegaste y "Guardar": dice cuántas
  páginas, minutos y páginas por hora. Abre el libro: tu velocidad y
  cuánto tiempo te falta.
- [ ] En un libro: "Dejar de leerlo" (queda en Abandonado) y "Retomar".
- [ ] En uno terminado: "📖 Leer de nuevo"; abajo dice "Lecturas
  anteriores".
- [ ] "Agregar libro" › Audiolibro › duración 10:30; "Anotar avance" con
  horas y minutos.

**Biblia: planes, progreso, memorizar y temas (2026-11)**
- [ ] Biblia › "Planes" › "Evangelios en 30 días" › "Empezar hoy". Arriba
  dice "Hoy: Mateo 1-2". Toca "Leer", lee y toca "Marcar como leído";
  sigue con el próximo. Al terminar, la tarjeta dice ✓.
- [ ] La racha sube aunque no anotes versículo; en "Calendario" el día
  tiene un punto verde; en Inicio, "Mi día" dice "Biblia leída hoy".
- [ ] Biblia › "Progreso": toca Mateo y luego un capítulo: se abre.
- [ ] En el lector toca un versículo › 🧠 Memorizar. En Biblia, "Repasar":
  prueba "Ocultar palabras" y "Escribirlo"; toca "¡Lo sabía!".
- [ ] "Anotar versículo": elige temas (fe, paz) y guarda; en la lista,
  filtra por "paz".
- [ ] ⚙ Ajustes › "Versículo de arriba: también de tus favoritos" (con
  algún ★ favorito): en Inicio, un día sí y otro no sale uno tuyo.

**Biblia: marcar, anotar, buscar y compartir (2026-11)**
- [ ] En el lector, toca dos versículos seguidos: abajo aparece la barra
  con la cita. Toca el amarillo: quedan resaltados.
- [ ] Toca uno y ★: queda con estrella. Toca uno y ✎: escribe una nota y
  guarda; aparece ✎ al final; tócalo para leerla.
- [ ] Toca uno y "Anotar": se abre "Anotar versículo" con todo puesto;
  guarda y míralo en tu lista (dice RV1909).
- [ ] Toca uno y "Compartir": se abre el menú del iPhone con la imagen.
- [ ] 🔍: busca "no temas" y toca un resultado.
- [ ] Biblia › "Marcados": están tus favoritos, notas y resaltados.
- [ ] "Anotar versículo": elige Salmos, 23 y 1: el texto se completa solo.

**Biblia: leer dentro de Manolo (2026-11)**
- [ ] Biblia › "Leer la Biblia": abre Mateo 1. Toca "Mateo 1 ▾", busca
  "juan", elige Juan y el capítulo 3.
- [ ] Desliza el dedo a la izquierda: pasa a Juan 4 (a la derecha vuelve).
- [ ] «Aa»: agranda la letra; apaga "Ortografía actual" y mira "á su
  Hijo"; vuelve a prenderla.
- [ ] Al final del capítulo, "Marcar como leído" → "✓ Leído hoy".
- [ ] Cierra con la ✕ (o el gesto de volver): la tarjeta dice "Seguir
  leyendo · Juan …".
- [ ] «Aa» › "Descargar la Biblia" (con wifi). Pon modo avión y abre otro
  libro: se lee igual.

**Reconocer ejercicios (2026-11)**
- [ ] Ejercicio → si hay "Ejercicios sin reconocer", mira si aparece
  «¿Es …?» con el ejercicio correcto; tócalo y el nombre desaparece de la
  lista (y empieza a pintar el mapa).
- [ ] Al agregar un ejercicio, escribe "press plano manc", "jalon",
  "hip th", "remo maq", "rdl": el que buscas sale primero.
- [ ] Escribe con errores ("sentadiya", "press vanca"): igual lo encuentra.

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
