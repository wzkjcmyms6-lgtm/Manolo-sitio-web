# Lugares

Tu guía personal de dónde comer (pedido del dueño, 2026-11-15, D-117):
lugares a los que vas, qué venden, qué probaste, si te gustó y si volverías.
Se llega desde la tarjeta **Lugares** de Inicio (sub-panel `#lugares`, como
Libros y Biblia: "‹ Inicio" arriba, sin versículo).

## Pantallas

- **Arriba**: "¿Dónde como hoy?" y "Estadísticas"; buscador (nombre, plato,
  etiqueta o lo que venden; sin tildes; espera 0,2 s mientras escribes).
- **Pestañas** "Visitados · N" y "Quiero ir · N".
- **Chips deslizables**: Ordenar (mejor calificados, más visitados,
  recientes, más baratos), Tipo, Zona (las que usaste), Precio, Volvería y
  Calificación mínima (estos dos solo en Visitados). "Quitar filtros".
- **Tarjeta**: foto (o el emoji del tipo), nombre, tipo · zona · precio,
  estrellas, insignia "Volvería: Sí / Tal vez / No" (verde / ámbar / rojo,
  con ícono y texto) y la última visita. En "Quiero ir", el botón **Ya fui**
  abre la calificación y, al guardar, lo pasa a Visitados (con la visita de
  hoy).
- **Detalle**: foto principal (y las demás), calificación y desglose
  (Comida, Atención, Ambiente, Precio-calidad), "Fuiste X veces · última:
  fecha", visitas, platos (con "Mi favorito de aquí"), etiquetas, notas,
  "Abrir en Google Maps", Editar y Eliminar.
- **Botón ＋** abajo a la derecha (al alcance del pulgar).
- **Exportar (JSON)** abajo: todos tus lugares y las fotos completas de este
  teléfono.

## Registrar en menos de 15 segundos

Solo **nombre**, **estrellas** y **¿volverías?** (en "Quiero ir", solo el
nombre). "Fui hoy" viene marcado (anota la visita de hoy) y puedes poner
cuánto gastaste. Lo demás va en **Más detalles**: tipo (restaurante, café,
comida rápida, pastelería, bar, puesto callejero, otro), zona, qué venden,
precio ($ $$ $$$), gasto aproximado por persona, calificación por partes,
fotos (hasta 6), link de Google Maps, etiquetas y notas.

- Todos los formularios van en hojas que suben desde abajo, con letra de 16
  px (el iPhone no hace zoom) y teclado de números en los montos.
- **Borrador**: lo que escribes se guarda mientras escribes. Si cierras la
  hoja sin querer, al volver a abrirla dice "Seguimos con lo que habías
  escrito" (y "Empezar de cero").
- **Borrar** (un lugar, un plato o una visita): al instante, con "Deshacer"
  durante 5 segundos. Nunca un cuadro de "¿Seguro?".
- **¿Lo pasas a Finanzas?**: al guardar una visita con gasto, Manolo
  pregunta. "Agregar a Finanzas" abre la hoja de siempre de Finanzas ya
  llena (categoría Comida, fecha y el nombre del lugar); eliges la cartera y
  tocas Guardar. Si no, no se anota nada.

## ¿Dónde como hoy? y estadísticas

- Uno al azar entre los visitados con **Volvería: Sí**, filtrable por tipo y
  precio; "Otra opción" no repite el último. Aparece con una animación corta
  (sin animación si el teléfono pide menos movimiento).
- Estadísticas: total de lugares, promedio de estrellas, gasto total en
  salidas (la suma de tus visitas), tu tipo de comida más visitado y tu top 5.

## Datos

| Dónde | Qué |
|---|---|
| `users/{uid}/lugares/{id}` (Firestore) | `v: 1, nombre, estado ("visitado"/"quiero"), calificacion (1–5), volveria ("si"/"tal_vez"/"no"), tipo, zona, maps, especialidad, precio (1–3), gastoAproxCent, desglose {comida, atencion, ambiente, precioCalidad}, etiquetas [], notas, platos {id: {nombre, precioCent, gusto, nota, favorito, creado}}, visitas {id: {fecha, conQuien, gastoCent, nota, creado}}, fotos [{id, mini, ancho, alto}], creado, actualizado` |
| IndexedDB `manolo-lugares` › `fotos` (este teléfono) | La foto completa: `{ id, lugarId, blob (JPEG ≤ 1200 px, calidad 0,75), mini, ancho, alto, creado }` |
| `localStorage` | `manolo.lugares.vista` (pestaña, filtros y orden) y `manolo.lugares.borradores` (solo texto e ids de fotos) |

- Los montos se guardan en **centavos**. Las fotos **nunca** van en
  localStorage. En la nube queda solo una miniatura de ~200 px de cada foto
  (unos 10 KB): si cambias de teléfono, ves la miniatura; la foto completa
  vive en el teléfono donde la sacaste y en tus copias de seguridad.
- Una miniatura solo se acepta si es una imagen en base64 (JPEG, PNG o
  WebP; `LugaresMotor.miniOk`) y siempre se escapa al mostrarla, también
  si viene de una copia de seguridad (D-119).
- Manolo pide al navegador que no borre tus datos (`navigator.storage.persist()`).
- Las reglas de Firestore ya cubren `users/{uid}/**`: no hay que tocar la
  consola.

## Archivos

| Archivo | Qué hace |
|---|---|
| `js/lugares-motor.js` | UMD sin DOM: validar, leer documentos viejos, buscar, filtrar, ordenar, "¿Dónde como hoy?", estadísticas, montos y fechas. Pruebas: `tests/lugares-motor.test.js` |
| `js/lugares-fotos.js` | Fotos en IndexedDB: achicar (lienzo), guardar, leer, borrar, miniatura |
| `js/lugares.js` | Pantalla: pestañas, buscador, chips, tarjetas, ¿Dónde como hoy?, estadísticas, exportar, aviso con Deshacer |
| `js/lugares-hojas.js` | Detalle y formularios (lugar, plato, visita), borradores, pasar a Finanzas |
| `css/lugares.css` | Estilos (clases `.lug-`), con las variables de `css/style.css` |
| `scripts/e2e/lugares.js` | Prueba de pantalla a 375 px |
