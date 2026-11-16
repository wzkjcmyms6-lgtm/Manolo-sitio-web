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

## Crear y editar en la app (D-124, 2026-11-16)

Ya no hace falta un CSV: Running › Rutinas › **"＋ Nueva"**, y el menú **⋯**
de cada rutina (Editar, Duplicar, Hacer la siguiente, Eliminar).

- **Pasos:** la rutina se arma de arriba abajo con:
  - **intervalos**: tipo (caminar, trotar, correr, descanso), minutos y
    segundos, y una nota opcional;
  - **series que se repiten**: "Repetir 4 veces: correr 1:00 + caminar
    1:30" (de 1 a 50 veces, hasta 10 intervalos por serie).
- Una rutina nueva empieza con calentamiento (caminar 5:00), 4 series de
  correr 1:00 + caminar 1:30 y enfriamiento (caminar 5:00): 20 minutos.
- **＋ Intervalo** agrega el contrario del último (después de caminar,
  correr), con la duración del último de ese tipo. ↑ ↓ mueven y ✕ quita
  (una serie que queda vacía se quita).
- Abajo, fijo: el total ("12 intervalos · 27 min 30 s") y **Guardar**. Los
  mismos límites del CSV (mínimo 5 s, máximo 2 h por intervalo, 200
  intervalos y 4 horas); el error dice qué paso y deja el cursor ahí.
- **Qué se guarda:** lo de siempre (`intervalos`, `totalSeg`: la rutina en
  vivo no cambia) más los pasos en `bloques` (opcional) para volver a
  editarla igual, y `editado` al guardar cambios. Una rutina sin `bloques`
  (importada de un CSV) se agrupa sola al editarla: lo que se repite seguido
  queda como serie, sin cambiar nada.
- **Un día de un plan:** el nombre es el del plan y cambia en todos sus
  días; "Duplicar" crea un día nuevo al final del plan. Una rutina suelta se
  duplica como "Nombre (copia)", justo debajo.
- **Hacer la siguiente** la pone arriba de la cola. Una rutina nueva queda
  al final.
- Lógica en `js/rutina-running-editor.js` (`tests/rutina-running-editor.test.js`);
  pantalla en `js/rutina-running-editor-ui.js` y `css/rr-editor.css`
  (`scripts/e2e/rr-editor.js`).
