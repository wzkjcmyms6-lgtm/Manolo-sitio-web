# Ropa (con IA e inspiración de Pinterest)

> **Plan 2026-11 · Ropa** (D-145). Pedido del dueño del 2026-11-22, completo
> al final de este archivo. Estado de las fases en `.claude/CURRENT_PHASE.md`.

Una sección nueva, **Ropa**: el ropero del dueño con fotos; una IA (el mejor
modelo de Claude) describe cada prenda, toma sus inspiraciones de Pinterest y
arma esos looks con su ropa, le dice qué ponerse cada día y qué le conviene
comprar según lo que se repite en sus pines.

## Auditoría (fase 0): lo que ya existe y se reutiliza

- **Fotos** (`js/lugares-fotos.js`, D-117): la foto grande (máx. 1200 px,
  JPEG 0,75) en el teléfono (IndexedDB) y una miniatura (máx. 200 px, ~10 KB)
  en la nube. Ropa usa lo mismo con su propia base (`manolo-ropa`): el código
  se generaliza en un ayudante común sin cambiar cómo funciona Lugares.
- **Copia de seguridad** (`js/respaldo-motor.js`, `js/respaldo.js`): se
  suman las colecciones de Ropa y sus fotos, igual que las de Lugares (restaurar
  solo agrega).
- **Clima**: Open-Meteo ya se usa en `js/run-enriquecer.js` (gratis, sin
  clave). Para "¿Qué me pongo hoy?": el pronóstico por hora de la ciudad
  elegida (La Paz por defecto), guardado en el teléfono por el día. Manolo no
  pide ubicación (`.claude/RULES.md`).
- **Navegación**: como Running y Bici, la sección cuelga de Inicio (tarjeta)
  y tiene barra propia y engranaje (`js/modules.js`: `SUB_PANELS`,
  `TAB_BARS`, `PILLS_ESCRITORIO`, `PILL_AJUSTES`).
- **Resúmenes**: `js/resumen-fuentes.js` tiene una función por sección para
  "Tu semana" y "Tu año"; Ropa suma la suya en la fase 6.
- **Íconos** (`js/icons.js`): ya hay `camera`, `sparkle`, `shopping`, `tag`,
  `heart`, `calendar`, `gear`; se suman `ropa` (percha) y `outfit`.
- **Reglas de Firestore**: `users/{uid}/{document=**}` ya cubre las
  colecciones nuevas; no hay que publicar nada.
- **El repositorio es público**: nada de la ropa del dueño ni de su Pinterest
  se sube al repo; todo vive en su Firestore y en su teléfono.

## Prueba de Pinterest (fase 0, 2026-11-22)

Desde un servidor (este entorno, con `www.pinterest.com` e `i.pinimg.com`
permitidos):

- **Tablero público por RSS**: `https://www.pinterest.com/{usuario}/{tablero}.rss`
  responde XML con los últimos 25 pines del tablero (probado con tableros
  públicos de la cuenta de Pinterest: 5 de 5 bien; una vez antes dio 404, así
  que hay que reintentar y guardar la última lista buena). El perfil entero:
  `https://www.pinterest.com/{usuario}/feed.rss`.
- Cada pin trae su **título**, el **link del pin** y la **imagen** chica
  (`i.pinimg.com/236x/…`); la misma imagen en **736 px** (`/736x/`) se baja
  bien y alcanza para la IA. La original (`/originals/`) da 403.
- **Link de un pin pegado a mano**:
  `https://www.pinterest.com/oembed.json?url={link}` devuelve título, autor
  e imagen.
- **Ninguna respuesta trae permiso CORS**: el teléfono no puede leerlas
  directo; las lee el puente (abajo).
- **Límites**: solo tableros **públicos** (los secretos no tienen RSS); cada
  lectura trae los últimos 25 pines (Manolo los va guardando, así que se
  acumulan); Pinterest no documenta el RSS y podría cambiarlo. Por eso
  siempre queda la **forma segura**: subir la imagen (o una captura) o pegar el
  link del pin.
- La **API oficial** de Pinterest pide registrar una app y esperar su
  aprobación (a veces se traba); no hace falta.
- **El link corto del iPhone** (Compartir › Copiar link en la app de
  Pinterest): `https://pin.it/XXXX` responde 308 a
  `api.pinterest.com/url_shortener/XXXX/redirect/`, que lleva al pin o al
  tablero; el puente sigue esos saltos sin bajar las páginas (probado el
  2026-11-23).
- **Las imágenes de `i.pinimg.com` tampoco traen CORS**: el teléfono las puede
  mostrar, pero no guardarlas; las trae el puente (`/pinterest/imagen`).
- **Falta probar**: con el tablero del dueño y desde el puente en Cloudflare
  (cuando esté instalado).

## Diseño

### Pantallas
- **Inicio**: tarjeta "Ropa" (cuántas prendas; en la fase 6, el outfit de hoy).
- **Barra de Ropa**: **Ropero · Outfits · + · Inspiración · Compras**;
  engranaje arriba → **Ajustes de Ropa**. En la compu, las mismas secciones
  como pills (como Bici).
- **Ropero** (`#ropa`): grupos como chips (Todo, Arriba, Abajo, Cuerpo entero,
  Abrigos, Zapatos, Accesorios), búsqueda, filtros (color, clima, formalidad),
  orden (recientes, más usadas, menos usadas) y la grilla de fotos con el tipo y
  sus colores; "para lavar" se ve como etiqueta. Vacío: invita a agregar.
- **Ficha** (`#ropa-prenda/{id}`): foto grande, datos, veces que la usaste y la
  última, en qué outfits aparece, costo por uso (si tiene precio). Botones:
  Editar, Para lavar / Ya está limpia, Ya no la tengo; con IA: Describir de
  nuevo y "¿Con qué combino esto?".
- **"+"**: hoja con **Agregar prenda** (cámara o galería, varias seguidas) y
  **Agregar inspiración** (imagen o link de Pinterest).
- **Agregar prenda**: por cada foto, el formulario ya lleno (el color sale de
  la foto; desde la fase 2, todo lo llena la IA) → Guardar y seguir.
- **Outfits** (`#ropa-outfits`): arriba "¿Qué me pongo hoy?" (ocasión, clima de
  hoy, Armar) → 3 opciones con las fotos juntas, por qué combina y la
  inspiración a la que se parece; botones Me lo pongo, Otra opción, Guardar,
  No me gusta. Abajo: guardados y el calendario de lo que te pusiste.
- **Inspiración** (`#ropa-inspiracion`): los pines (del tablero o subidos),
  "Actualizar tablero", "Mi estilo" (resumen que se puede corregir). Cada pin
  (`#ropa-pin/{id}`): la imagen, las prendas que se ven, **"Armar este look con
  mi ropa"** (lo más parecido y lo que falta) y "Ver en Pinterest".
- **Compras** (`#ropa-compras`): **Qué te falta** (lo que se repite en tus
  pines y no tienes, con sus fotos y cuántos outfits nuevos te daría), **Ver
  opciones en Pinterest** (abre `https://www.pinterest.com/search/pins/?q=…`),
  **Qué no comprar**, **Lista de deseos** ("lo compré" la pasa al ropero) y el
  presupuesto del mes.
- **Ajustes de Ropa** (`#ropa-ajustes`): ciudad del clima, ocasiones, tablero de
  Pinterest, IA (gasto del mes y tope), presupuesto.

### Datos (solo se suman)
- `users/{uid}/ropa/{id}`: `v`, `grupo`, `tipo`, `colores` ([{ nombre, hex,
  peso }]), `estampado`, `tela`, `corte` (D-154: pegado | regular | suelto |
  oversize | pitillo | recto | ancho | acampanado, los de su grupo; "" si no
  lo elegiste), `manga` (D-154: sin | corta | larga, solo arriba y cuerpo
  entero; ""), `estilo` ([…]), `clima` ([frio | templado | calor]),
  `formalidad` (1–5), `marca`, `talla`, `precio`, `compra` (fecha), `notas`,
  `fotos` ([{ id, mini, ancho, alto }]), `estado` (activa | lavar | fuera),
  `fueraFecha`, `ia` ({ fecha }), `creado`, `editado`. Lo escrito se guarda
  con mayúscula al empezar; la talla en letras, toda en mayúscula (D-154).
- `users/{uid}/ropa_usos/{fecha}`: lo que te pusiste ese día ({ prendas,
  outfitId }); de ahí salen las veces, la última y el calendario.
- `users/{uid}/ropa_outfits/{id}` (D-149; uno por conjunto de prendas: si
  armas el mismo, es el mismo): `v`, `prendas`, `ocasion` (casual, trabajo,
  noche, deporte, formal o una tuya "o-…"), `origen` (ia | reglas |
  inspiracion | manual), `nombre`, `porque`, `capas`, `ciudad`, `clima` (el
  resumen del día), `inspiracionId`, `guardado`, `gusto` (si | no), `puesto`
  ([fechas]), `para` (la fecha para la que lo elegiste), `creado`, `editado`.
- `users/{uid}/ropa_inspiracion/{id}` (D-148; los pines con id `pin-{id del
  pin}`, así no se repiten): `v`, `via` (tablero | link | foto), `pin` ({ id,
  url, titulo, img, fecha }), `fotos` ([{ id, mini, ancho, alto }]),
  `analisis` (lo que vio la IA: { esRopa, resumen, prendas [{ grupo, tipo,
  colores, estampado, tela, detalle }], estilo, clima, formalidad, ocasion }),
  `ia` ({ fecha }), `iaError` ({ veces, mensaje }), `look` (el de la IA: {
  origen, fecha, prendas [{ pin, id, parecido, porque }], faltan [{ pin,
  grupo, tipo, colores, porque }], consejo }), `oculta`, `creado`, `editado`.
- `users/{uid}/ropa_deseos/{id}` (D-150): `v`, `grupo`, `tipo`, `colores`
  ([ids]), `nota`, `inspiraciones` ([ids]), `origen` (falta | pin | manual),
  `estado` (quiero | comprado | descartado), `prendaId` (la del ropero, al
  comprarla), `compradoFecha`, `creado`, `editado`.
- `users/{uid}/meta/ropa_ajustes`: `pinterest` ({ usuario, tablero, titulo,
  conectado, leido, error, errorFecha } o null), `estilo` ({ resumen, claves,
  colores, prendas, fecha, pines, corregido }) (D-148); `ciudad` ({ nombre,
  region, pais, codigoPais, lat, lon, zona }), `ciudades` (las últimas 5),
  `sensacion` (friolento | normal | caluroso), `ocasiones` ([{ id, nombre,
  como }]) (D-149); `presupuestoMes` (Bs por mes, o null) (D-150).

### La IA y el puente
- **Puente**: un Worker en Cloudflare (plan gratis). Su código va en el repo
  (`puente/`), sin secretos; la clave de la IA y el modelo se guardan como
  secretos y variables en Cloudflare (el modelo no va en el repo). Lo
  instala y actualiza el agente; el dueño solo pega la clave en Cloudflare.
- Revisa el **token de Firebase** (proyecto `manolo-4c57b`) y que el usuario
  esté en la **lista permitida** (solo el dueño); acepta pedidos solo del sitio
  de Manolo.
- **Rutas**: describir una prenda, analizar un pin, armar un look con tu ropa,
  outfits del día, tu estilo, leer el tablero de Pinterest, leer un link de
  pin, gasto y tope.
- **Respuestas con esquema fijo** (JSON); la app revisa que cada prenda
  propuesta exista en tu ropero (si no, se descarta).
- **Gasto**: cada respuesta trae lo que se usó; el puente suma el costo del mes
  y corta al llegar al **tope** (8 USD al empezar). Manolo lo muestra.
- **Imágenes**: prendas a 1200 px (como Lugares); pines a 736 px.
- **Privacidad**: a la IA solo le llegan fotos y listas de ropa, nunca el
  nombre, el correo ni el usuario. El puente no guarda fotos ni textos (solo el
  total del gasto del mes).
- **Si el plan gratis de Cloudflare no alcanza**: plan B en Firebase
  (Functions, pide tarjeta); se avisa al dueño antes de cualquier costo.
- **Pruebas**: con un puente falso y respuestas inventadas (sin gastar); al
  final, una prueba real corta con el OK del dueño.

### Sin IA o sin internet
- El ropero funciona sin internet (Firestore guarda en el teléfono y las fotos
  viven ahí).
- El **color sale de la foto** en el teléfono, sin IA (principal y secundario,
  con nombre en español).
- Cuántos **outfits nuevos** daría una compra lo cuenta Manolo con reglas
  (grupos que se combinan, formalidad y clima parecidos, colores que
  combinan), siempre igual y sin gastar.
- Lo que necesita la IA avisa que hace falta conexión.

### Costos estimados (el mejor modelo)
- Describir una prenda: 2 a 3 centavos (150 prendas: unos 4 USD, una vez).
- Analizar un pin: unos 2 a 3 centavos (50 pines: unos 1,50 USD, una vez).
- "Armar este look con mi ropa" con la IA: unos 3 a 5 centavos (si miras
  varios pines seguidos, menos: tu ropero queda unos minutos en caché). Sin la
  IA (por reglas) no cuesta nada. "Mi estilo": 1 a 2 centavos.
- "¿Qué me pongo hoy?" con la IA: unos 5 a 7 centavos (2 por día: unos 4 USD
  al mes); "Otra opción" usa las que la IA dejó de reserva, sin volver a
  preguntarle. Con reglas, gratis. El clima (Open-Meteo): gratis.
- En total, unos 5 USD al mes; tope de 8 USD. El puente y el clima: gratis.

## Fases
| Fase | Qué |
|---|---|
| 0 | Diseño y prueba de Pinterest |
| 1 | Mi ropa sin IA: agregar con fotos (varias seguidas), datos a mano, color de la foto, ropero con filtros, ficha, para lavar, ya no la tengo, copia de seguridad |
| 2 | La IA describe: cuentas con el dueño, el puente, describir al agregar y las que ya tienes, gasto y tope |
| 3 | Inspiración de Pinterest: subir imagen o link, leer el tablero, las prendas de cada pin, "Armar este look con mi ropa", "Mi estilo" |
| 4 | Outfits: "¿Qué me pongo hoy?" (ocasión, clima, estilo, sin repetir), Me lo pongo, Guardar, No me gusta, "¿Con qué combino esto?", calendario |
| 5 | Compras desde Pinterest: qué te falta, cuántos outfits nuevos, Ver opciones en Pinterest, qué no comprar, lista de deseos, lo compré, presupuesto |
| 6 | Extras: lo más y lo menos usado, colores, costo por uso, "Tu semana", "Tu año", Inicio |
| 7 | Revisión final: todas las pruebas, Lighthouse, la prueba real de la IA y la lista para el iPhone |

## Hecho en la fase 1 (D-146)
- `js/ropa-motor.js` (sin pantalla, `tests/ropa-motor.test.js`): grupos y tipos
  (con su género, para que el color concuerde: "Zapatillas negras"), 29
  colores con nombre en español y su familia, **el color de una foto** (cada
  punto al color más parecido de la paleta; el fondo —lo que domina el borde—
  no cuenta salvo que la prenda sea del mismo color; el centro pesa más; las
  sombras de un mismo color se juntan), normalizar, revisar, las veces que te
  la pusiste, costo por uso, buscar sin tildes, filtrar, ordenar y la fecha
  larga ("domingo 22 de noviembre").
- `js/ropa-datos.js`: escucha `ropa` y `ropa_usos`; guarda, cambia el estado,
  borra y restaura; "me la puse" con `arrayUnion` / `arrayRemove` en el día.
  Las fotos con `FotosLocales.crear({ base: "manolo-ropa", campo: "grupoId" })`;
  los borradores de más de una hora se limpian solos.
- `js/lugares-fotos.js` ahora es una fábrica (`FotosLocales.crear`); Lugares
  sigue igual (misma base, mismo índice, mismas funciones). Ropa guarda además
  una mediana de 480 px para la grilla (`url(id, "media")`; si falta, se hace
  una vez desde la grande).
- `js/ropa.js`: el ropero (cuántas, buscar, grupos con cuántas hay, chips de
  color, clima, formalidad, orden y "Para lavar", la grilla con la miniatura
  al toque y la foto grande cuando se ve, "Ya no las tengo"), la ficha
  (`#ropa-prenda/{id}`: foto con su forma, datos, cuánto la usas, "Me la puse
  hoy", para lavar, editar, ya no la tengo / la volví a tener, borrar con
  Deshacer) y la tarjeta de Inicio.
- `js/ropa-form.js`: el "+" (varias fotos a la vez o sin foto), una prenda por
  foto con el color ya puesto, "Guardar y seguir" / "Saltar esta", "Otro" para
  escribir el tipo, colores a mano (hasta 3), "Más datos" (talla, precio,
  compra, notas), editar y cambiar la foto.
- Copia de seguridad: `ropa` y `ropa_usos` en las colecciones y `fotosRopa`
  (las fotos completas) en el archivo; restaurar trae las que faltan. Las
  copias viejas (sin `fotosRopa`) siguen sirviendo.
- `css/ropa.css` (`.ro-`); el modo claro sale solo de las variables.

## Hecho en la fase 2 (D-147): lista en el código, falta conectarla
- `puente/` (Worker de Cloudflare, `puente/README.md`): revisa el token de
  Firebase sin dependencias (firma RS256 con las llaves públicas de Google,
  proyecto, emisor y vencimiento), deja pasar solo a `USUARIOS`, CORS solo
  para el sitio, llama a la IA con la biblioteca oficial (`@anthropic-ai/sdk`)
  con esfuerzo bajo, **respuesta con esquema fijo** (las mismas listas que la
  app; una prueba revisa que sigan iguales) y el respaldo del servidor si el
  modelo se niega (`fallbacks: "default"`), suma el gasto del mes en KV y
  corta en el tope. La clave, el modelo y los usuarios son secretos de
  Cloudflare.
- `js/ropa-ia.js`: habla con el puente con el token de la sesión; a la IA
  solo le llega la foto.
- Agregar: mientras la IA mira la foto, "Llenar a mano"; la siguiente foto ya
  se va mirando; "Lo llenó la IA: revísalo"; avisa si hay varias prendas o si
  no ve ropa; si la IA no puede (tope, crédito, sin internet), lo dice y queda
  el color de la foto. Se guarda `ia: { fecha }`.
- La ficha: "Describir con IA" abre Editar con lo que vio la IA.
- `js/ropa-ajustes.js` (`#ropa-ajustes`, el engranaje): conectada o no, tu
  código de usuario para conectarla, el gasto del mes con su tope y "Describir
  con IA las que cargaste antes" (llena solo lo que falta). Quien no es el
  dueño usa Ropa sin IA.

## Hecho en la fase 3 (D-148): Inspiración
- **La barra de Ropa** (como Running y Bici): Ropero · **+** · Inspiración
  (Outfits y Compras se suman en las fases 4 y 5); en la compu, arriba.
  El **+**: a tu ropero (fotos o sin foto) o una inspiración (imágenes o un
  link de Pinterest).
- **Inspiración** (`#ropa-inspiracion`, `js/ropa-insp.js`): tu tablero de
  Pinterest (se conecta pegando su link; Manolo trae solo los pines nuevos
  —la imagen la trae el puente y se guarda en el teléfono— y lo vuelve a
  leer solo si pasaron 6 horas), las imágenes que subes y los links que
  pegas; las tarjetas en columnas, cada imagen con su forma. Con la IA, mira
  cada una sola (una por una; si llega otra en el medio, también) y la
  tarjeta dice cuántas prendas se ven. "Quitar de Manolo" deja oculto un pin
  del tablero (no vuelve al actualizar; "Las que quitaste" para traerlo); las
  imágenes subidas se borran con Deshacer.
- **Un pin** (`#ropa-pin/{id}`): la imagen, "Ver en Pinterest", **lo que se
  ve** (cada prenda con su nombre: "Abrigo camel largo", y el estilo, el
  clima, la formalidad y la ocasión) y **con tu ropa**: lo más parecido de tu
  ropero al toque y gratis (por grupo, tipo y color, `js/ropa-insp-motor.js`)
  o, con la IA, **"Armar este look con mi ropa"** (cada prenda tuya con por
  qué, lo que te falta con "Ver ideas" en Pinterest y un consejo; queda
  guardado). "Me lo pongo hoy" anota esas prendas en lo que te pusiste.
- **Mi estilo**: una fila arriba de los pines con lo que más se repite
  (estilos, colores, prendas); con la IA, un resumen en palabras que puedes
  **corregir** (se usará para los outfits).
- **El puente** (versión 2): `/pinterest/tablero` (RSS del tablero, con
  reintentos), `/pinterest/pin` (oEmbed), `/pinterest/imagen` (solo de
  `i.pinimg.com`), y la IA: `/inspiracion`, `/look` (el ropero va con
  referencias cortas —la IA no ve tus ids— y en caché) y `/estilo`. Pinterest
  anda aunque falte la clave de la IA. Las instrucciones a la IA ya no dicen el
  nombre de la app.
- La copia de seguridad lleva las inspiraciones y sus imágenes.

## Hecho en la fase 4 (D-149): Outfits
- **La barra de Ropa**: Ropero · Outfits · **+** · Inspiración.
- **El clima de cualquier ciudad** (`js/ropa-clima.js`, Open-Meteo: gratis y
  sin clave): La Paz por defecto; "Cambiar ciudad" busca cualquiera (las de tu
  país primero) y las últimas quedan a un toque para cuando viajes. Nunca usa
  tu ubicación. Hoy o mañana (de noche, mañana) y los consejos del día: capas,
  frío, calor, lluvia, tormenta, nieve, viento y sol fuerte. En Ajustes, "Cómo
  sientes el frío": friolento o caluroso corre todo 3 grados.
- **"¿Qué me pongo?"** (`#ropa-outfits`, `js/ropa-outfits.js`): la ocasión
  (Casual, Trabajo, Salir de noche, Deporte, Evento formal y **las tuyas** con
  "+ Otra": un nombre y a cuál se parece); 3 opciones solo con tu ropa (nada
  para lavar), cada una con sus fotos en una fila, por qué combina, cómo llevar
  las capas y **a qué inspiración tuya se parece** (lleva al pin). Botones:
  "Me lo pongo", "Guardar" (de noche, "Para mañana"), **"Otra opción"** (cambia
  esa sola) y "No me gusta" (no vuelve y llega otra), con Deshacer; "Otras
  opciones" cambia las tres. Aprende de lo que guardas, te pones y no te gusta.
- **Sin IA, con reglas** (`js/ropa-outfit-motor.js`): el clima, la ocasión,
  tu estilo de Pinterest, los colores, lo que te pusiste estos días y lo que
  aprendió de ti. **Con la IA** (`/outfits` en el puente, versión 3), lo mismo
  pensado por la IA (pide 5: se ven 3 y 2 quedan para "Otra opción"); si no
  puede, con reglas.
- **Lo de hoy, tus guardados y el calendario** de lo que te pusiste (cada día
  con una foto; tócalo para verlo).
- **"¿Con qué combino esto?"** en la ficha de cada prenda: arma con esa prenda
  en las tres.
- **Ajustes de Ropa › Tus outfits**: la ciudad, cómo sientes el frío y tus
  ocasiones (para quitarlas).
- La copia de seguridad lleva tus outfits.

## Hecho en la fase 5 (D-150): Compras desde Pinterest
- **La barra de Ropa** completa: Ropero · Outfits · **+** · Inspiración ·
  Compras.
- **Compras** (`#ropa-compras`, `js/ropa-compras.js`), sin IA y sin gastar
  (con lo que la IA ya vio en tus pines; `js/ropa-compras-motor.js`):
  - **Qué te falta**: lo que se repite en tus inspiraciones (en 2 pines o
    más; sin accesorios) y no tienes ni igual ni parecido. Por ejemplo,
    "Abrigo camel · En 6 de tus inspiraciones · en tu ropero, solo de otro
    color". Con las fotos de esos pines (llevan al pin), **cuántos outfits
    nuevos** te daría con tu ropa, **"Ver opciones en Pinterest"** (abre
    Pinterest con la búsqueda lista: "abrigo camel outfit") y "A mi lista".
  - **Tu lista de deseos**: lo que traes de Pinterest (desde "Qué te falta" o
    desde "Te falta" en un pin; lo mismo no se repite). **"Lo compré"**: con
    foto o sin foto, el formulario ya viene con lo que querías y la fecha de
    hoy; al guardarla, pasa a tu ropero y en la lista queda como comprado.
    "Ya no lo quiero" (con Deshacer). Abajo, "Lo que compraste".
  - **Qué no comprar**: lo que ya tienes de sobra (3 o más del mismo tipo y
    color).
  - **Tu presupuesto de ropa**, si quieres: lo que gastaste en el mes (el
    precio de lo que compraste ese mes), de cuánto, lo que te queda o cuánto
    te pasaste.
- Manolo nunca compra nada: solo muestra ideas.
- La copia de seguridad lleva tu lista de deseos.

## Hecho en la fase 6 (D-151): Extras
- **Tus números** (`#ropa-numeros`: en el ropero, "Tus números";
  `js/ropa-numeros.js` y `js/ropa-numeros-motor.js`), sin IA:
  - Arriba: cuántas prendas tienes, los días que anotaste lo que te pusiste
    (de los últimos 30) y lo que invertiste (el precio de lo que tienes).
  - **Lo que más te pones** (los últimos 3 meses, desde 2 veces).
  - **Lo que no te pones hace 3 meses o más** (o nunca, si la tienes hace 3
    meses o más): "La última vez: hace 4 meses". En su ficha, "Ya no la
    tengo".
  - **Tus colores**: una barra por color (por familia: el gris oscuro va con
    el negro, el camel con el beige), con su muestra y su número, y el que
    más te pones.
  - **Cuánto te sale cada uso**: el precio dividido por las veces que te la
    pusiste. Lo que mejor rinde, lo que menos y lo que no estrenaste.
  - Cada prenda lleva a su ficha. Sin lo que ya no tienes.
- **Inicio**: la tarjeta de Ropa muestra lo que te pusiste hoy (las fotos) o,
  si todavía no anotaste nada, el outfit que guardaste para hoy ("Para hoy
  elegiste «Oficina fresca»"), y lleva a Outfits.
- **"Tu semana"**: Ropa, con los días que anotaste tu ropa, lo que más te
  pusiste y lo que compraste (contra la semana anterior).
- **"Tu año"**: una diapositiva de Ropa con **tu prenda del año** (cuántas
  veces te la pusiste), los días anotados, cuántas prendas distintas, tu
  color del año y cuántas compraste (sin plata: se puede compartir). "Tu
  prenda del año" también va en lo destacado de la imagen de tu año.

## Hecho en la fase 7 (D-152): revisión final
- **Todas las pruebas**: las de la app, las 46 pruebas de pantalla y las del
  puente, sin fallas; Lighthouse 100 con Ropa llena y con Ropa vacía (lo
  primero que ve alguien nuevo), en oscuro y en claro.
- **Arreglos del repaso**: la IA sin internet. Ajustes de Ropa ya no se queda
  en "Revisando la conexión…": dice "Sin internet: la IA necesita conexión" (o
  el error del puente, con "Reintentar"); cuando vuelve internet, la IA se
  conecta sola; al agregar una foto sin internet: "Sin internet: la IA no
  puede mirar la foto. Llénala a mano."
- **Revisado**: a la IA solo le llegan las fotos y la lista de tu ropa (sin
  notas, talla ni precio), nunca tu nombre, tu correo ni tu usuario; nada se
  borra solo (solo "Borrar", con Deshacer); todo entra en la copia de
  seguridad; sin internet, el ropero, Tus números y Outfits funcionan igual.
- **La lista para el iPhone**, completa: `docs/TESTING.md` › "Pruebas en el
  iPhone" › Ropa.

## El puente, instalado (D-153, 2026-11-24)
- En la cuenta de Cloudflare del dueño: `https://manolo-puente.manolo-ropa-482.workers.dev`
  (el subdominio de workers.dev se cambió para que no lleve el nombre del
  correo), el contador del gasto (KV `GASTO`, tope US$ 8 al mes) y tres
  secretos: el modelo, el código de Manolo del dueño (solo él usa la IA; no va
  en el repositorio) y la clave de la IA, que pegó el dueño en Cloudflare (no
  pasó por el chat).
- La app ya apunta al puente (`js/ropa-ia.js`). En las pruebas,
  `manolo.puente` = "ninguno" la deja sin puente (las que lo necesitan traen
  uno de mentira).
- **Cuánto gasta, siendo realista**: US$ 2 a 4 al mes; el primer mes, unos
  US$ 6 si describes todo tu ropero de una vez; el puente corta en US$ 8 (se
  cambia en Ajustes de Ropa). Lo que la IA hace sola: mirar cada inspiración
  nueva (unos US$ 0,03 cada una), leer tu tablero de Pinterest al abrir
  Inspiración (como mucho cada 6 horas; leerlo no usa la IA), mirar la foto al
  agregar una prenda y Outfits con la IA (US$ 0,07 a 0,10). Las recargas
  automáticas de crédito se ven y se apagan en la consola de Claude
  (Billing › Auto-reload).

## Corte, mangas, cambiar los colores y mayúsculas (D-154, 2026-11-24)
Pedido del dueño: "que siempre escriba los detalles con mayúscula y que
permita cambiar los colores, igual lo que es si la polera es pegada, suelta,
corte recto, ya sabes".
- **El corte** ("cómo te queda"), según el grupo: arriba y abrigos (pegado,
  regular, suelto, oversize); abajo (pitillo, pegado, recto, ancho,
  acampanado); cuerpo entero (pegado, recto, suelto, acampanado); zapatos y
  accesorios no tienen. El nombre va con la prenda: "Polera pegada", "Falda
  recta", "Leggings pegados" ("Pitillo", "Regular" y "Oversize" no cambian).
  **Las mangas**: sin, corta o larga (solo arriba y cuerpo entero). Tocar otra
  vez el que elegiste lo quita. En la ficha: "Corte" y "Mangas".
- **Cambiar los colores**: en el formulario, toca un color y elige el nuevo
  ("Elige el color nuevo en lugar de blanco"); queda en el mismo lugar; si ya
  estaba en otro lugar, no se repite. "Que sea el principal" lo pasa adelante.
  En la ficha, "Cambiar los colores" abre el formulario con la paleta lista.
- **Mayúsculas**: lo que escribes empieza con mayúscula (qué es cuando eliges
  "Otro", tela, marca, notas, tus ocasiones, la nota de un deseo y "Mi
  estilo"); la talla en letras, toda en mayúscula ("m" → "M", "2xl" → "2XL").
  Lo de antes ya se ve con mayúscula; se guarda así cuando lo editas.
- **La IA** llena el corte y las mangas al mirar la foto (el puente, versión 4)
  y los usa para armar looks y outfits. Buscar encuentra por el corte y las
  mangas ("pegada", "manga corta").
- Solo se suma: las prendas de antes quedan sin corte ni mangas hasta que las
  edites.

## La prueba real de la IA (el puente ya está instalado)
Corta, con tu OK: cuesta unos centavos (menos de US$ 0,25).
1. Abre Ropa › el engranaje: tiene que decir "La IA está conectada" y "Este
   mes: US$ 0,00 de US$ 8,00".
2. "+" › "Sacar o elegir fotos": una foto de una prenda (por ejemplo, una
   polera). La IA llena qué es, el corte, las mangas, los colores, la tela, el
   estilo, el clima y la formalidad: revísalo (si un color salió mal, tócalo y
   cámbialo) y guárdala.
3. Una foto con dos prendas juntas: tiene que avisar que hay varias.
4. Inspiración: sube una captura de un pin; ábrelo: "Lo que se ve" y "Armar
   este look con la IA".
5. Outfits: "¿Qué me pongo?" con la IA: 3 opciones solo con tu ropa.
6. Vuelve al engranaje: el gasto del mes subió unos centavos.

Si algo no anda, me dices qué pasó (y qué decía la pantalla) y lo reviso.

## Lo que hace el dueño
- **Fase 0 / 3**: crear en Pinterest un tablero **público** (por ejemplo,
  "Manolo") y, con el puente instalado, conectarlo en Inspiración pegando su
  link (Compartir › Copiar link).
- **Fase 2**: crear la cuenta de Claude (tarjeta, crédito y clave) y la de
  Cloudflare (gratis), con guía paso a paso; la clave se pega solo en
  Cloudflare. ✅ Hecho el 2026-11-24 (D-153).
- Sacarle fotos a su ropa (una prenda por foto, buena luz, fondo liso) y
  guardar sus inspiraciones en el tablero.

---

## Pedido del dueño (2026-11-22)

> PROYECTO: "ROPA" EN MANOLO, CON IA E INSPIRACIÓN DE PINTEREST
>
> **1. Qué quiero.** Una sección nueva, Ropa, donde guardo toda mi ropa con
> fotos. Una IA (el mejor modelo de Claude) hace tres cosas: describe cada
> prenda; toma mis inspiraciones de Pinterest y arma esos looks con mi ropa;
> me sugiere qué comprar a partir de mis inspiraciones de Pinterest. Hazlo de
> la manera más completa posible, por fases, como Running y Bici.
>
> **2. Reglas de siempre.** Seguir `.claude/RULES.md`: español simple, tú
> decides lo técnico y solo me preguntas lo que bloquea o lo que cambia cómo se
> ve. No romper nada de lo que ya funciona. Mis datos solo se suman: nunca se
> borran ni se cambian. Con el aspecto de Manolo, en modo claro y oscuro. Que
> funcione bien en el iPhone y en la compu. Las fotos como en Lugares: la
> grande en mi teléfono y una chiquita en la nube. Todo entra en la copia de
> seguridad. En cada fase, pruebas completas y un resumen como siempre: qué
> hiciste, cómo lo pruebo en el iPhone, cuántas pruebas pasaron, qué decidiste y
> qué archivos cambiaron.
>
> **3. Mi ropa (el ropero).** Agregar prendas con la cámara o desde la
> galería, varias seguidas. Grupos: arriba (camisas, poleras, chompas), abajo
> (pantalones, jeans, shorts), cuerpo entero, abrigos (chamarras, abrigos),
> zapatos, accesorios. De cada prenda: tipo, colores y estampado; tela y
> estilo; para qué clima y qué tan formal es (de 1 a 5); marca; si quiero:
> talla, precio y cuándo la compré. Lista con fotos: filtros por grupo, color,
> clima y formalidad; búsqueda; orden por recientes, más usadas y menos usadas.
> Ficha de cada prenda: foto y datos; cuántas veces la usé y cuándo fue la
> última; en qué outfits aparece; cuánto me salió cada uso, si puse el precio.
> Marcar "para lavar": mientras tanto no entra en los outfits. Marcar "ya no la
> tengo": sale del ropero, pero su historial queda.
>
> **4. La IA describe.** Cuando saco la foto, la IA llena todos los datos. Yo
> reviso y corrijo antes de guardar. Si en la foto hay varias prendas, me
> avisa. Puedo pedirle que describa de nuevo, y que describa también las
> prendas que cargué antes sin IA.
>
> **5. Inspiración de Pinterest.** Mis inspiraciones vienen de Pinterest. Dos
> formas de traerlas: la segura (guardo la imagen del pin o una captura y la
> subo en Ropa › Inspiración, varias a la vez; si quiero, pego el link del pin)
> y la automática (conectar mi tablero para que Manolo lo lea solo; probarla en
> la fase 0; si Pinterest no la permite, queda la segura). En cada inspiración
> la IA reconoce las prendas. "Armar este look con mi ropa": lo más parecido
> con lo que tengo y lo que me falta. Mi estilo: con mis inspiraciones, un
> resumen de mi estilo (colores, cortes, tipo de ropa) que puedo ver y
> corregir, y que se usa al armar los outfits. Cada inspiración con "Ver en
> Pinterest".
>
> **6. Outfits.** "¿Qué me pongo hoy?": elijo la ocasión (trabajo, casual,
> salir, deporte, formal; puedo agregar las mías); la IA mira el clima de hoy en
> mi ciudad (La Paz, se puede cambiar; Manolo no pide mi ubicación); que piense
> en capas (mañana fría y sol al mediodía). Me da 3 opciones solo con mi ropa,
> siguiendo mi estilo de Pinterest; nunca inventa una prenda que no tengo; cada
> opción con las fotos juntas, una frase de por qué combina y, si se parece a
> una de mis inspiraciones, cuál. No me repite lo de los últimos días ni usa lo
> que está para lavar. Botones: "Me lo pongo" (anota que lo usé), "Otra
> opción", "Guardar", "No me gusta"; con lo que guardo y lo que no me gusta,
> aprende mis gustos. "¿Con qué combino esto?": desde una prenda, outfits
> alrededor de ella. Mis outfits guardados y un calendario de lo que me puse.
>
> **7. Compras desde Pinterest.** Qué me falta según mis inspiraciones: lo que
> se repite en mis pins y no tengo (por ejemplo: "En 6 de tus inspiraciones hay
> un abrigo camel y no tienes uno"). Cada sugerencia con las fotos de mis pins
> donde aparece, cuántos outfits nuevos me daría con mi ropa y un botón "Ver
> opciones en Pinterest" que abre Pinterest con la búsqueda lista. Qué no
> comprar: lo que ya tengo de sobra. Lista de deseos; "lo compré" la pasa a mi
> ropero. Nunca compra nada sola. Un presupuesto de ropa por mes, si quiero.
>
> **8. Extras.** Lo que más uso, lo que no uso hace 3 meses o más, mis colores y
> el costo por uso. Conectarlo con "Tu semana" y "Tu año" (por ejemplo, mi
> prenda más usada del año). Si tiene sentido, una tarjeta en Inicio con el
> outfit del día.
>
> **9. Cómo se conecta (lo técnico lo decides tú).** Un puente seguro en
> Cloudflare (gratis) guarda la clave de la IA; la clave nunca va dentro de
> Manolo ni en el chat. Solo yo puedo usar la IA; los demás usuarios pueden usar
> Ropa sin IA. A la IA solo le llegan fotos (mi ropa o mis inspiraciones) y la
> lista de mi ropa, nunca mi nombre, mi correo ni mi usuario; el puente no
> guarda fotos. Pinterest: Manolo solo lee mis inspiraciones; nunca publica ni
> cambia nada en mi Pinterest. El pago en platform.claude.com, con crédito por
> adelantado y recarga automática si quiero; me guías para crear las cuentas y
> la clave. El gasto: Manolo me muestra cuánto llevo en el mes; tope de 8
> dólares al mes para empezar (se puede cambiar); al llegar, la IA se pausa
> hasta el mes siguiente. Sin internet, mi ropero funciona igual; la IA avisa
> que necesita conexión. Si el plan gratis de Cloudflare no alcanza, usas otra
> opción, pero me avisas antes de cualquier costo. Las pruebas de la IA con
> respuestas inventadas, para no gastar; al final, una prueba real corta con mi
> OK.
>
> **10. Fases.** 0 Diseño y prueba de Pinterest · 1 Mi ropa, sin IA · 2 La IA
> describe · 3 Inspiración de Pinterest · 4 Outfits · 5 Compras desde
> Pinterest · 6 Extras · 7 Revisión final.
>
> **11. Lo que no hace.** No genera fotos mías con la ropa puesta. No compra
> nada sola. No publica ni cambia nada en mi Pinterest. No busca fotos nuevas de
> Pinterest dentro de Manolo: para eso abre Pinterest. No pide mi ubicación.
>
> **12. Lo que hago yo.** En la fase 0: crear en Pinterest un tablero para
> Manolo y decirte mi usuario (si tiene que ser público, me avisas antes). En
> la fase 2: crear la cuenta de Claude (tarjeta, crédito y clave) y la de
> Cloudflare, con tu guía. Sacarle fotos a mi ropa (una prenda por foto, con
> buena luz y fondo liso). Guardar mis inspiraciones en ese tablero. Probar en
> el iPhone al final de cada fase.
