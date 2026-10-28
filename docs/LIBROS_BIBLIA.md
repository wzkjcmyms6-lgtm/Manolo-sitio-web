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
| 2 | Biblia completa | pendiente |
| 3 | Libros sin portada + frases | pendiente |
| 4 | Portadas (búsqueda gratuita y foto) | pendiente |

## Archivos

| Archivo | Qué hace |
|---|---|
| `js/biblia.js` | Pantalla de Biblia. Registra su ícono (`ICONS.biblia`) |
| `js/libros.js` | Pantalla de Libros. Registra su ícono (`ICONS.libro`) |
| `css/libros.css` | Estilos propios (solo `.lib-` y `.bib-`) |
| `scripts/e2e/lectura.js` | Prueba de pantalla de las dos secciones |

Cambios en archivos compartidos (los mínimos pedidos): dos tarjetas y dos
`<section>` en `index.html` (con su `<link>`/`<script>`) y dos líneas en
`SUB_PANELS`. Los íconos se agregan al objeto `ICONS` desde los archivos
nuevos (antes de que `renderIcons()` corra al cargar), sin tocar
`js/icons.js`.

## Firebase

Las reglas publicadas (`firestore.rules`) ya permiten que cada usuario lea
y escriba **todo** lo que está bajo `users/{su uid}/…`. Las colecciones
nuevas (`users/{uid}/biblia`, `users/{uid}/libros`, …) quedan cubiertas:
**no hay que cambiar nada en la consola de Firebase.**
