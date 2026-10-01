# Pruebas

## Estado actual
- `npm test` → **209 pruebas, todas pasan** (2026-10-01, sin GPS). Lógica pura
  UMD: hábitos, finanzas, mapa muscular, rangos, rutinas, importador, series,
  sesiones, intervalos, rutinas CSV de varios días y cola, resumen semanal,
  versión del service worker.
- `tests/sw-version.test.js` falla si se cambia un archivo de la app sin
  correr `npm run sw` (protege la caché offline).
- **Pantalla (E2E)** en `scripts/e2e/` (Playwright + Chromium, 390 px):
  - `fase1.js` — login, nota de hábitos, accesos y admin.
  - `running.js` — Running y Bici sin GPS: resumen semanal (semana actual,
    elegir otra, Distancia/Tiempo, sin desnivel), importar un plan de 3 días,
    rutina guiada completa (voz, cambios, fin, resumen, km), la completada
    pasa al final, rutina sin terminar (pausa, recuperar tras recargar, aviso
    en Inicio, guardar sin km, no se mueve), voz apagada, descartar, borrar
    un día o el plan entero sin tocar el historial, borrar una carrera vieja
    con GPS y su recorrido, registro a mano, Bici, computadora.
  - `hojas.js` — deslizar hacia abajo para cerrar (dedo simulado): la hoja
    sigue al dedo, vuelve si se suelta a mitad, se cierra al bajarla o con un
    tirón, de lado no se mueve, con la lista desplazada primero sube la lista;
    en Finanzas, el selector de categorías, Hábitos y Running.
  - `regresion.js` — las 15 pantallas en teléfono (390 px) y computadora
    (1280 px): se ven, sin errores y sin scroll de lado; acciones de siempre:
    marcar un hábito, anotar un gasto, registrar Running y Bici a mano,
    marcar una serie en Gimnasio; aviso "Sin conexión".
  - Utilidades en `scripts/e2e/comun.js` (reloj y voz simulados). Usan
    `fake-firebase.js`: Firestore y Auth en memoria (con `FieldPath`,
    `increment`, `arrayUnion`/`arrayRemove` y `update(campo, valor, …)` como
    el SDK real), con las reglas de `accesos`/`admins` simuladas. **No
    prueban las reglas reales** (se verifican al publicarlas, `docs/ADMIN.md`).

## Por fase (mínimos)
- **F1**: contraseña (teclado, ocultar/mostrar, válido/ inválido/ vacío),
  nota de hábito (sin nota, con nota, editar, hábitos viejos), evento de
  login (1 por inicio de sesión, sin duplicados, sin datos sensibles),
  bandeja admin (ver, leído, historial), usuario normal sin acceso
  (verificado con las reglas publicadas).
- **F2–F5**: intervalos (cambios, cuenta atrás, fin, recuperación con
  timestamps), CSV (válido, vacío, columnas, duraciones, filas incompletas,
  tamaño, caracteres especiales, días). El motor GPS y sus pruebas se
  retiraron en D-033.
- **Dispositivo real (iPhone)**: pantalla encendida, voz y sonido se validan
  en el teléfono del dueño; nada se da por funcionando sin esa prueba.
- **Regresión** en cada fase: `npm test` + recorrido de Hábitos, Ejercicio y
  Finanzas en 390 px.

## Cómo correr todo
```bash
npm test
export NODE_PATH=/opt/node22/lib/node_modules   # donde está Playwright
for f in fase1 running hojas regresion; do node scripts/e2e/$f.js || break; done
```
Cada script termina con "Todo bien" (código 0) o con la cantidad de fallos.

## Resultado del QA final (fase 8, 2026-10-01)
- Unitarias: 225/225. E2E: fase1 39 ✓, fase3 45 ✓, fase4 30 ✓, fase5 24 ✓,
  fase6 15 ✓, regresion 37 ✓ (15 pantallas × 2 tamaños + 7 acciones).
  (fase3–fase6 eran del GPS; se retiraron con él y `running.js` las
  reemplaza.)
- Hallazgo: el Firestore de prueba no entendía `FieldPath` (lo usa Hábitos
  al marcar); era un límite del simulador, no de la app. Corregido en
  `scripts/e2e/fake-firebase.js`.
- Revisión de seguridad de las plantillas nuevas: los textos del usuario
  (nombres de rutina, notas, usuario del aviso) se escapan o van como texto.
- Lo que **no** se puede probar aquí: pantalla encendida, voz y pitidos
  reales, teclado del iPhone, reglas publicadas en Firebase. Va en la lista
  de abajo.

## Pruebas en el iPhone (las hace el dueño)
Abrir Manolo **desde el ícono de la pantalla de inicio** (no desde Safari),
con iOS actualizado. Marcar cada punto; si algo falla, anotar qué pasó.

**Antes de empezar (una sola vez)**
- [ ] Publicar las reglas y crear `admins/{tu uid}` (`docs/ADMIN.md`).

**Login**
- [ ] Al tocar la contraseña aparece el teclado de números.
- [ ] "Usar teclado de letras" cambia al teclado normal y vuelve.
- [ ] El ojo muestra y oculta la contraseña.
- [ ] Contraseña equivocada: mensaje de error, no entra.

**Avisos de acceso (admin)**
- [ ] Iniciar sesión con otra cuenta (o en otro equipo) → en tu cuenta la
  campana muestra el número; al abrirla se ve usuario y hora y se marca leído.
- [ ] Con una cuenta que no es admin no aparece la campana.

**Deslizar para cerrar**
- [ ] En Finanzas toca **+**: baja la hoja con el dedo; a mitad de camino y
  soltando vuelve; bajándola más (o con un tirón) se cierra.
- [ ] Lo mismo en el detalle de un hábito y en el selector de categorías.

**Hábitos, Ejercicio, Finanzas (como antes)**
- [ ] Marcar y desmarcar un hábito; crear uno con nota y ver la nota.
- [ ] Gimnasio: empezar una rutina, marcar series (✓), terminar y ver que
  los botones Finalizar/Descartar no quedan tapados.
- [ ] Ejercicio › Perfil: el gráfico y los períodos se ven bien.
- [ ] Finanzas: anotar un gasto y verlo en Movimientos y en Presupuesto.

**Running: resumen semanal**
- [ ] Arriba se ve la semana actual con Distancia y Tiempo y el gráfico de
  12 semanas; tocar otro punto muestra esa semana.
- [ ] Tocar "Tiempo" cambia el gráfico a horas/minutos.

**Rutinas guiadas (CSV de varios días)**
- [ ] "Descargar plantilla" (plan de 3 días), editarla o usarla tal cual e
  "Importar CSV": la vista previa muestra Día 1, 2 y 3; guardar.
- [ ] La lista muestra Día 1 con "Siguiente". Tocarlo, Iniciar: la pantalla
  **no se apaga** sola (iOS 18.4 o más nuevo).
- [ ] **Con música sonando**: se oyen los pitidos 3-2-1 y la voz en cada
  cambio, y la música sigue.
- [ ] Con el interruptor de silencio activado: anotar si se oyen los
  pitidos/voz (depende de iOS).
- [ ] Apagar "Sonido" y "Voz": ya no suenan; el aviso grande sigue.
- [ ] Al terminar: resumen; anotar km (opcional) y guardar → aparece en
  "Tus carreras" con "Rutina" y el Día 1 pasa al final de la lista.
- [ ] Cerrar Manolo a mitad de una rutina en pausa y volver a abrirlo: la
  recupera.
- [ ] Borrar una rutina: su historial sigue en "Tus carreras".

**Bicicleta**
- [ ] Registrar una rodada a mano: suma en el resumen de la semana.

**Sin conexión**
- [ ] Modo avión: Manolo abre, se puede marcar un hábito y aparece "Sin
  conexión"; al volver internet se sincroniza solo.
- [ ] Hacer una rutina en modo avión: funciona igual y se sube al volver
  internet.
