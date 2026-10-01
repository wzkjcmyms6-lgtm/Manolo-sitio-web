# Rutinas de Running por CSV (borrador, se cierra en fase 4)

Se reutiliza el lector de `js/importar-rutinas.js` (`EjImportar.leerCsv`:
separador `,` o `;`, comillas, BOM) y el patrón de vista previa de
`importar-ui.js`. Todo se procesa en el teléfono.

Formato propuesto:

```csv
orden,tipo,duracion,descripcion
1,caminar,3:00,Calentamiento
2,correr,2:00,Correr suave
3,caminar,180,Recuperación
```

- `tipo`: caminar · correr · trotar · descanso (sin tildes ni mayúsculas
  obligatorias).
- `duracion`: segundos (`180`) o `m:ss` (`3:00`); 5 s – 2 h por intervalo.
- `orden` opcional (si falta, el de las filas); `descripcion` opcional.
- Opcional: `repetir` (bloques) — a decidir en fase 4.
- Límites: archivo ≤ 200 KB, ≤ 200 intervalos, rutina ≤ 4 h.
- Errores por fila, en español; un archivo con errores **no** se guarda.
- Plantilla descargable con el ejemplo.
