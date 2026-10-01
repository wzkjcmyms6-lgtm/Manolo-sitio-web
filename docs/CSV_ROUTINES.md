# Rutinas de Running por CSV (implementado en fase 4)

Lectura y validación: `js/rutina-running.js` (pruebas en
`tests/rutina-running.test.js`). Importar, vista previa y guardado:
`js/rutinas-running-ui.js`. El lector de CSV/Excel es el del importador del
gimnasio (`EjImportar.leerCsv` / `leerXlsx`, cargado solo al importar). Todo
se procesa en el teléfono: el archivo nunca se sube.

## Formato

```csv
orden,tipo,duracion,descripcion
1,caminar,3:00,Calentamiento
2,correr,2:00,Correr suave
3,caminar,180,Recuperación
4,correr,2 min,"Correr, sin apuro"
```

| Columna | Obligatoria | Valores |
|---|---|---|
| `tipo` | sí | caminar · trotar · correr · descanso (también caminata, trote, run, pausa…; sin importar tildes ni mayúsculas) |
| `duracion` | sí | segundos (`180`), `m:ss` (`3:00`), `h:mm:ss`, `3 min`, `90 s`, `2m30s`. Si la columna se llama `minutos`, un número suelto son minutos |
| `orden` | no | número; si falta, manda el orden de las filas |
| `descripcion` | no | texto libre (máx. 80 caracteres) |

- Separador `,` o `;`, comillas para textos con comas, UTF-8 con o sin BOM
  (si no es UTF-8 se lee como Windows-1252, típico de Excel viejo).
- Sin fila de títulos también se entiende si las columnas son
  `tipo,duracion[,descripcion]` u `orden,tipo,duracion[,descripcion]`.
- También acepta **Excel (.xlsx)**: se lee la primera hoja (horas de Excel
  incluidas).
- Nombre de la rutina: el del archivo (editable en la vista previa).

## Validación

- Límites: CSV ≤ 200 KB (Excel ≤ 1 MB), ≤ 200 intervalos, 5 s a 2 h por
  intervalo, rutina ≤ 4 h.
- Errores por fila, en español (falta el tipo, tipo desconocido, duración
  inválida, "3 segundos es muy corto: si eran minutos escribe 3:00"…).
- **Un archivo con cualquier error no se guarda**: se muestran los errores y
  se ofrece elegir otro archivo o descargar la plantilla.
- Plantilla descargable: `plantilla-rutina-running.csv`.

## Guardado

`users/{uid}/rutinas_running/{id}`: `v:1, nombre, intervalos:[{tipo, seg,
texto}], totalSeg, creado`. Eliminar una rutina no borra las carreras
hechas con ella (cada carrera guarda `rutina: {id, nombre, completados,
total}`).

Pendiente para más adelante (no pedido aún): bloques que se repiten
(`repetir`), crear rutinas a mano dentro de la app.
