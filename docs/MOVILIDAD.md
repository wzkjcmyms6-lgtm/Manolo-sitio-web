# Movilidad

Sección pedida por el dueño (2026-10-30): dos rutinas guiadas de
estiramiento. Funciona como Libros y Biblia: tarjeta en **Inicio** (después
de Biblia), sub-panel de `inicio` en `SUB_PANELS` (`#movilidad`), botón
"‹ Inicio" arriba, sin versículo, mismos componentes y colores
(`.lib-cifras`, `.bib-hoy`, `.lib-btn`, la hoja `.budget-sheet`).

## Rutinas (datos en `js/movilidad-rutinas.js`)

| Rutina | Duración | Ejercicios |
|---|---|---|
| Liberar el cuerpo | 2 min | 6 × 20 s (World's greatest stretch: 10 s por lado) |
| Antes de correr | 5 min | los 6 de arriba + 6 × 30 s "en movimiento" (balanceos de pierna: 15 s por pierna) |

En "Antes de correr", durante la segunda parte se ve la nota "En esta parte
todo va en movimiento continuo, sin sostener posiciones."

### Cómo editar o agregar una rutina

Solo se toca `js/movilidad-rutinas.js`. Cada rutina:

```js
{ id: "mi-rutina", nombre: "Mi rutina", partes: [
  { titulo: "Parte 1", nota: "Texto que se ve durante esta parte", ejercicios: [
    { nombre: "Gato-vaca", instruccion: "Arquea y redondea…", segundos: 20, porLado: false }
  ] }
] }
```

- `id`: minúsculas, números y guiones; no cambiarlo después (queda en el
  historial).
- `porLado: true` avisa "Cambia de lado" a la mitad (usar segundos pares).
- `titulo` y `nota` de la parte son opcionales.
- `npm test` revisa que todo esté bien escrito (`MovilidadMotor.problemas`).
- Después de editar: subir `?v=` del archivo en `index.html` y `npm run sw`.

## Pantallas

- **Principal**: racha (días seguidos con al menos una rutina, viva hasta
  ayer), sesiones de esta semana (lunes a domingo) y en total; una tarjeta
  por rutina (nombre, duración, número de ejercicios); últimas 5 sesiones.
- **Vista previa** (hoja): la lista de ejercicios con sus segundos (y "por
  lado"), las partes con su nota, y "Empezar".
- **Modo guiado** (pantalla completa, encima de la barra de abajo):
  - cuenta 3-2-1 ("Prepárate · Empieza con: …"), sin pausar ni saltar;
  - nombre e instrucción en grande; círculo con la cuenta regresiva;
  - avance solo al siguiente; barra de toda la rutina; "Ejercicio N de M";
    "Siguiente: … · 20 s";
  - Pausar / Reanudar, Saltar y Salir (pide confirmar; no se guarda);
  - en los "por lado", "Cambia de lado" durante 3 s a la mitad y "Lado 1 /
    Lado 2" bajo el número;
  - vibración corta (`navigator.vibrate`, si existe) al cambiar de
    ejercicio (150 ms) y de lado (100 ms), y al terminar;
  - pantalla encendida con Wake Lock (reusa `Avisos.pedirPantalla()` de
    `js/avisos.js`, que la vuelve a pedir al regresar a la app);
  - si sales de la app a mitad de rutina, queda en pausa; atrás del
    navegador (o ir a otra sección) la cierra sin guardar.
- **Rutina completada**: festejo con la racha y los ejercicios saltados;
  se guarda la sesión.

El tiempo se calcula con marcas de tiempo (inicio, pausas, saltos), no
contando segundos: si el iPhone congela la app, al volver sabe dónde va
(`js/movilidad-motor.js`, mismo enfoque que `js/intervalos-motor.js`).

**iPhone**: Safari no deja vibrar a las páginas web (Apple no lo permite),
así que en el iPhone no vibra; en Android sí. La pantalla encendida
funciona en iOS 16.4 o más nuevo.

## Datos

`users/{uid}/movilidad/{id}`: una sesión por rutina completada (ver
`docs/DATABASE.md`). Sin internet se guarda en el teléfono (persistencia de
Firestore) y se sube sola al volver la conexión. Las reglas ya cubren
`users/{uid}/**`. No usa `localStorage`.

## Archivos

| Archivo | Qué hace |
|---|---|
| `js/movilidad-rutinas.js` | Las rutinas (solo datos) |
| `js/movilidad-motor.js` | UMD sin DOM: pasos, cuenta 3-2-1, info en cada instante, pausa, saltar, cambios (para vibrar), sesión, racha, últimas. Pruebas: `tests/movilidad-motor.test.js` |
| `js/movilidad.js` | Pantallas y Firestore |
| `css/movilidad.css` | Estilos propios (clases `.mov-`) |
| `scripts/e2e/movilidad.js` | Prueba de pantalla con reloj falso (57 comprobaciones) |

## Cómo probar en el iPhone

1. Cierra Manolo y vuelve a abrirlo. Inicio › **Movilidad**.
2. Toca "Liberar el cuerpo": mira la lista y toca **Empezar**.
3. Cuenta 3-2-1 y empieza Gato-vaca; espera que pase solo al siguiente.
   Prueba **Pausar**, **Reanudar** y **Saltar**.
4. En "World's greatest stretch", a los 10 s sale "Cambia de lado".
5. Al terminar: "Rutina completada"; toca **Listo** y mira la racha y
   "Últimas sesiones".
6. Con modo avión también funciona (y la sesión se sube después).
