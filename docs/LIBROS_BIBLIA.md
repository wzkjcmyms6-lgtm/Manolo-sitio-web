# Libros y Biblia

Dos secciones nuevas (pedido del dueño, 2026-10-29). Solo se llega desde
dos tarjetas de **Inicio** (debajo de Finanzas e Inversiones); son
sub-paneles de `inicio` en `SUB_PANELS` (`js/modules.js`), como Running y
Bicicleta: **no** están en la barra inferior ni en el menú ☰. Cada una
tiene el botón "‹ Inicio" arriba; el gesto o atrás del navegador también
vuelve (la navegación es por `#hash`).

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Tarjetas en Inicio + secciones vacías con botón volver | ✅ 2026-10-29 |
| 2 | Biblia completa | ✅ 2026-10-29 |
| 3 | Libros sin portada + frases | ✅ 2026-10-29 |
| 4 | Portadas (búsqueda gratuita y foto) | ✅ 2026-10-29 |

## Archivos

| Archivo | Qué hace |
|---|---|
| `js/lectura-comun.js` | Piezas de pantalla de las dos secciones: hoja que sube desde abajo, exportar, errores |
| `js/biblia-motor.js` | UMD sin DOM: 66 libros, validar, buscar, racha, calendario, exportar. Pruebas: `tests/biblia-motor.test.js` |
| `js/biblia.js` | Pantalla de Biblia. Registra su ícono (`ICONS.biblia`) |
| `js/libros-motor.js` | UMD sin DOM: validar libros y frases, ordenar, buscar, resumen, color de la tapa genérica, exportar. Pruebas: `tests/libros-motor.test.js` |
| `js/libros.js` | Pantalla de Libros. Registra su ícono (`ICONS.libro`) |
| `css/libros.css` | Estilos propios (solo `.lib-` y `.bib-`) |
| `scripts/e2e/lectura.js` | Prueba de pantalla de las dos secciones (95 comprobaciones; Open Library simulado) |

Cambios en archivos compartidos (los mínimos pedidos): dos tarjetas y dos
`<section>` en `index.html` (con su `<link>`/`<script>`) y dos líneas en
`SUB_PANELS`. Los íconos se agregan al objeto `ICONS` desde los archivos
nuevos (antes de que `renderIcons()` corra al cargar), sin tocar
`js/icons.js`.

## Biblia (fase 2)

- **Anotar**: fecha (hoy por defecto; se puede poner un día pasado, no uno
  futuro), libro (lista de los 66, en dos grupos), capítulo (avisa si ese
  libro no lo tiene: "Proverbios va de 1 a 31"), versículo (`16`, `16-18`
  o `1,3`), texto (lo escribes o pegas) y nota opcional. Propone el último
  libro que usaste.
- **Lista**: lo más reciente arriba, agrupada por mes. Buscador (todas las
  palabras, sin importar tildes, en el texto, la nota y la cita) y filtro
  por libro (solo los que ya usaste, en el orden de la Biblia).
- **Racha**: días seguidos con al menos un versículo. Si hoy todavía no
  anotaste, la racha de ayer sigue viva hasta que termine el día. También
  la mejor racha y los días del mes.
- **Calendario**: mes con los días anotados resaltados; al tocar un día
  se ven sus versículos (o "Anotar el …" con esa fecha).
- Tocar un versículo lo abre para editar; Eliminar pide confirmación.
- **Exportar (JSON)**: todos los versículos con su cita. En iPhone abre el
  menú de compartir.
- Sin internet funciona igual (Firestore guarda los cambios y los sube al
  volver la conexión).

## Libros (fase 3)

- **Agregar o editar**: título (obligatorio), autor, páginas, estado (Por
  leer / Leyendo / Terminado), calificación opcional de 1 a 5 estrellas,
  "Mi opinión" y tres fechas con selector: registro (hoy por defecto; se
  puede poner una pasada para cargar libros leídos antes), inicio y fin.
  Al marcar "Leyendo" o "Terminado" sin fecha, propone la de hoy (y avisa).
  La fecha de fin no puede ser antes del inicio; ninguna puede ser futura.
- **Lista**: cuadrícula con portada (por ahora tapa genérica: dos tonos
  por libro, título y autor), estado y estrellas. Buscador por título o
  autor (sin tildes), filtro por estado y orden: registro, terminado,
  empezado (lo nuevo primero; sin esa fecha, al final) o título A–Z.
- **Ficha** (tocar un libro): datos, fechas, opinión y sus frases; Editar,
  Eliminar (borra también sus frases; pide confirmación) y "＋ Frase".
- **Frases**: texto, página opcional y fecha (hoy por defecto). Dentro de
  cada libro y en "Todas mis frases" (buscador por frase, título o autor).
- **Exportar (JSON)**: libros y frases.

## Portadas (fase 4)

- **Buscar portada** (en el formulario del libro): usa el título y el autor
  escritos y consulta **Open Library** (`openlibrary.org/search.json`),
  gratis y sin clave. Muestra hasta 6 portadas; tocas la tuya y se guarda
  **solo la URL** (`covers.openlibrary.org/b/id/…-M.jpg`). Verificado el
  2026-10-29 desde GitHub Actions (D-050): encontró portadas de 6 libros de
  prueba en español e inglés, responde en menos de 0,6 s y permite que la
  app la llame desde el teléfono (CORS). Google Books sin clave respondió
  "cuota excedida": descartado.
- **Tomar o subir foto**: en el iPhone abre cámara o fotos. La foto se
  achica a 400 × 600 como máximo y se comprime en JPEG (calidad 0,72 → 0,4
  hasta que entre en ~220 KB; una foto de 2400 × 3200 quedó en ~50 KB). Se
  guarda en `libros_portadas/{id}`; el documento de Firestore admite 1 MB.
  No usa Firebase Storage (es de pago).
- **Quitar portada**: vuelve a la tapa genérica (y borra la foto).
- **Sin portada o sin internet**: la tapa genérica (dos tonos, título y
  autor) está siempre debajo; si la imagen de Open Library no carga (por
  ejemplo sin conexión), se ve esa tapa. Las fotos sí se ven sin internet
  (están en Firestore, con su caché).
- Exportar (JSON) incluye las fotos de portada (`fotosDePortada`).

## Cómo probar en el iPhone

1. Inicio: abajo, las tarjetas **Libros** y **Biblia**. Cada sección tiene
   "‹ Inicio" arriba; el gesto de volver también funciona.
2. **Biblia**: "Anotar versículo" (fecha de hoy; cámbiala para un día
   pasado), elige el libro, capítulo, versículo, pega el texto y guarda.
   Mira la racha, busca una palabra, filtra por libro y abre "Calendario".
3. **Libros**: "Agregar libro", escribe título y autor, toca "Buscar
   portada" y elige una; o "Tomar o subir foto". Pon estado, estrellas,
   fechas y tu opinión. Abre el libro y agrega una frase; mira "Todas mis
   frases".
4. Con modo avión: anota un versículo o una frase; al volver la conexión se
   sube solo.
5. "Exportar (JSON)" en cada sección: "Guardar en Archivos".

## Firebase

Las reglas publicadas (`firestore.rules`) ya permiten que cada usuario lea
y escriba **todo** lo que está bajo `users/{su uid}/…`. Las colecciones
nuevas (`users/{uid}/biblia`, `users/{uid}/libros`, …) quedan cubiertas:
**no hay que cambiar nada en la consola de Firebase.**
