# Rutinas guiadas de Running por CSV (fase 4; planes de varios días desde 2026-10-01)

Lectura y validación: `js/rutina-running.js` (pruebas en
`tests/rutina-running.test.js`). Importar, vista previa y guardado:
`js/rutinas-running-ui.js`. El lector de CSV/Excel es el del importador del
gimnasio (`EjImportar.leerCsv` / `leerXlsx`, cargado solo al importar). Todo
se procesa en el teléfono: el archivo nunca se sube.

## Formato

Una rutina:

```csv
orden,tipo,duracion,descripcion
1,caminar,3:00,Calentamiento
2,correr,2:00,Correr suave
3,caminar,180,Recuperación
4,correr,2 min,"Correr, sin apuro"
```

Un **plan de varios días** (columna `dia`): cada día queda como una rutina
en la lista ("Día 1", "Día 2"…), en orden.

```csv
dia,orden,tipo,duracion,descripcion
1,1,caminar,5:00,Calentamiento
1,2,correr,1:00,Correr suave
2,1,caminar,5:00,Calentamiento
2,2,correr,2:00,Correr suave
```

| Columna | Obligatoria | Valores |
|---|---|---|
| `tipo` | sí | caminar · trotar · correr · descanso (también caminata, trote, run, pausa…; sin importar tildes ni mayúsculas) |
| `duracion` | sí | segundos (`180`), `m:ss` (`3:00`), `h:mm:ss`, `3 min`, `90 s`, `2m30s`. Si la columna se llama `minutos`, un número suelto son minutos |
| `dia` | no | `1`, `Día 2`, `D3`… Vacío = el mismo día de la fila de arriba. Con esta columna el archivo es un plan |
| `orden` | no | número (dentro del día); si falta, manda el orden de las filas |
| `descripcion` | no | texto libre (máx. 80 caracteres) |

- Separador `,` o `;`, comillas para textos con comas, UTF-8 con o sin BOM
  (si no es UTF-8 se lee como Windows-1252, típico de Excel viejo).
- Sin fila de títulos también se entiende si las columnas son
  `tipo,duracion[,descripcion]` u `orden,tipo,duracion[,descripcion]`.
- También acepta **Excel (.xlsx)**: se lee la primera hoja (horas de Excel
  incluidas).
- Nombre de la rutina o del plan: el del archivo (editable en la vista
  previa). La vista previa de un plan muestra cada día con sus intervalos.

## Validación

- Límites: CSV ≤ 200 KB (Excel ≤ 1 MB), ≤ 200 intervalos por rutina (o por
  día), ≤ 2.000 filas y ≤ 60 días por plan, 5 s a 2 h por intervalo, ≤ 4 h
  por rutina (o por día).
- Errores por fila, en español (falta el tipo, tipo desconocido, duración
  inválida, "3 segundos es muy corto: si eran minutos escribe 3:00", falta
  el día, día inválido…).
- **Un archivo con cualquier error no se guarda**: se muestran los errores y
  se ofrece elegir otro archivo o descargar la plantilla.
- Plantilla descargable: `plantilla-rutinas-running.csv` (plan de 3 días).

## Guardado y la cola

`users/{uid}/rutinas_running/{id}`: `v:1, nombre, intervalos:[{tipo, seg,
texto}], totalSeg, creado, orden`; un día de un plan además `plan` (id común
del plan) y `dia`. Se guarda en un solo lote, al final de la cola.

- **La lista es una cola** ordenada por `orden` (rutinas viejas sin `orden`
  cuentan como 0): la de arriba es la "Siguiente".
- Al guardar una rutina **completada**, su `orden` pasa a ser el mayor + 1:
  se va al final. Si se terminó antes, no se mueve (D-036).
- Cada vez que se guarda, queda en el historial (`users/{uid}/running`,
  `fuente:"rutina"`, `rutina: {id, nombre, completados, total}`; el nombre
  completo, p. ej. "Plan 5K · Día 2").
- Eliminar una rutina (o el plan entero: la app pregunta) **no borra el
  historial**.

Pendiente para más adelante (no pedido aún): bloques que se repiten
(`repetir`), crear rutinas a mano dentro de la app.
