# Copia de seguridad de todo Manolo

Pedido del dueño (2026-11-15, D-118): "Copia de seguridad: exportar/importar
JSON que incluya TODO (también Lugares). Al importar, valida el archivo y
haz un respaldo antes de reemplazar." Se abre desde **Inicio › "Copia de
seguridad"** (abajo, junto a "Estado de la cuenta") y desde el **menú ☰**
del teléfono. Código: `js/respaldo-motor.js` (lógica, con pruebas) y
`js/respaldo.js` (la hoja); estilos en `css/respaldo.css`.

## Guardar una copia

1. "Descargar copia de todo" lee todas tus colecciones de la nube (sin
   conexión, lo guardado en el teléfono, y lo avisa) y las fotos de Lugares
   del teléfono.
2. Muestra qué tiene ("Lista: 1.234 registros y 12 fotos · 3,4 MB").
3. "Guardar archivo" abre "Compartir" en el iPhone (Guardar en Archivos,
   iCloud Drive…) o descarga el archivo en la compu:
   `manolo-copia-AAAA-MM-DD.json`.

Son dos toques a propósito: el iPhone solo abre "Compartir" justo después
de un toque, y preparar la copia tarda un poco.

La hoja recuerda (en este teléfono) cuándo guardaste la última copia.

## Qué lleva el archivo

```json
{
  "app": "Manolo", "tipo": "copia-completa", "version": 1,
  "exportado": "2026-11-15T17:00:00.000Z",
  "conteos": { "finanzas": 120, "lugares": 8, "fotosLugares": 5, "…": 0 },
  "colecciones": { "habitos": { "id": { "…": "…" } }, "finanzas": { }, "…": { } },
  "fotosLugares": [{ "id": "f…", "lugarId": "l…", "ancho": 1200, "alto": 900, "datos": "data:image/jpeg;base64,…" }]
}
```

- **Colecciones** (todo lo de `users/{uid}`): hábitos, meta (ajustes y
  planes de todas las secciones), finanzas, ahorros, carteras_movimientos,
  inversiones, entrenamientos, rutinas, running, bicicleta, rutas,
  rutinas_running, run_segmentos, movilidad, libros, libros_frases,
  libros_portadas, biblia, biblia_marcas, tiempos y lugares.
- **No van**: `finanzas_respaldos` (copias internas de lo mismo) ni lo
  compartido con otros (`feed`, `comentarios`, `accesos`, `admins`).
- Una prueba (`tests/respaldo-motor.test.js`) revisa todo `js/` y falla si
  una colección nueva de la app no está en la copia.
- Las fechas de Firestore (Timestamp) se guardan como
  `{ "__tipo": "timestamp", "ms": … }` y vuelven como Timestamp.

## Restaurar

1. **Elegir archivo de copia** › se revisa el archivo:
   - que sea JSON;
   - que sea una copia de Manolo de una versión que la app entiende;
   - que cada documento tenga un id válido;
   - que las fotos sean imágenes.

   Lo dañado o desconocido se deja afuera y se avisa.
2. Se lee **de la nube** lo que ya tienes. Hace falta internet: así se
   sabe bien qué existe y no se pisa nada.
3. Pantalla "Esto se agregaría":
   - el total, en grande, y el detalle por sección;
   - "Los otros N ya los tienes: no se tocan (aunque en la copia estén
     distintos)";
   - el aviso de la copia automática.

   Si ya está todo: "Ya tienes todo".
4. **Agregar lo que falta**:
   1. **Primero** guarda una **copia automática** de lo que tienes ahora en
      este teléfono (IndexedDB `manolo-respaldos` › `copias`, las últimas
      3, con "Descargar"). Si no se puede guardar, no cambia nada.
   2. Después agrega **solo los documentos que no existen**, en lotes de
      hasta 400 escrituras y 4 MB.
   3. Por último, las fotos de Lugares que falten en el teléfono.

   Nunca borra ni cambia lo que ya tienes.
5. "Listo: agregué …" con **Deshacer**, que quita exactamente lo que se
   agregó (y nada más).

Otros detalles:
- **Sin señal a mitad de camino:** lo escrito queda en el teléfono y
  Firestore lo sube solo. Si se corta, restaurar la misma copia otra vez
  agrega el resto, sin repetir lo que ya está.
- **Puedes cerrar la hoja mientras restaura:** sigue sola y avisa al
  terminar.
- **También sirve el "Exportar (JSON)" de Lugares:** trae los documentos
  tal cual y las fotos completas.
- **Copias de una sola sección:**
  - La de **Hábitos** se importa en Hábitos › Ajustes, y la de
    **Finanzas** en Finanzas › Ajustes. La hoja dice dónde.
  - Los resúmenes de Libros, Biblia, Inversiones y Medir tiempos no se
    restauran.

## Accesibilidad y diseño

- Usa las variables de `:root`: estados, radios y tiempos. Los mensajes
  llevan siempre ícono y texto.
- Botones de 44 px o más y números con `tabular-nums`.
- Al cambiar de paso, el foco pasa al título. Los errores llevan
  `role="alert"` y la barra de avance es `role="progressbar"`.
- Con "Reducir movimiento", la rueda no gira.
- En la compu, el botón del menú se oculta: la barra de arriba no se
  amontona y está abajo en Inicio.

## Pruebas

- `tests/respaldo-motor.test.js`:
  - armar la copia y las fechas;
  - revisar el archivo, lo dañado, las copias de una sección y el archivo
    de Lugares;
  - que solo se agregue lo que falta;
  - los ids;
  - que ninguna colección quede afuera.
- `scripts/e2e/respaldo.js`:
  - descargar y abrir el archivo;
  - restaurar sin pisar, la foto, la copia automática y Deshacer;
  - la misma copia otra vez y el archivo de Lugares;
  - archivos que no sirven y sin internet;
  - 375 px, 44 px, menú ☰, compu y menos movimiento.
