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
| 3 | Libros sin portada + frases | pendiente |
| 4 | Portadas (búsqueda gratuita y foto) | pendiente |

## Archivos

| Archivo | Qué hace |
|---|---|
| `js/lectura-comun.js` | Piezas de pantalla de las dos secciones: hoja que sube desde abajo, exportar, errores |
| `js/biblia-motor.js` | UMD sin DOM: 66 libros, validar, buscar, racha, calendario, exportar. Pruebas: `tests/biblia-motor.test.js` |
| `js/biblia.js` | Pantalla de Biblia. Registra su ícono (`ICONS.biblia`) |
| `js/libros.js` | Pantalla de Libros. Registra su ícono (`ICONS.libro`) |
| `css/libros.css` | Estilos propios (solo `.lib-` y `.bib-`) |
| `scripts/e2e/lectura.js` | Prueba de pantalla de las dos secciones |

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

## Firebase

Las reglas publicadas (`firestore.rules`) ya permiten que cada usuario lea
y escriba **todo** lo que está bajo `users/{su uid}/…`. Las colecciones
nuevas (`users/{uid}/biblia`, `users/{uid}/libros`, …) quedan cubiertas:
**no hay que cambiar nada en la consola de Firebase.**
