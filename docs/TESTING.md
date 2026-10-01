# Pruebas

## Estado actual
- `npm test` → **225 pruebas, todas pasan** (fin de fase 8, QA final). Lógica pura UMD:
  hábitos, finanzas, mapa muscular, rangos, rutinas, importador, series,
  sesiones, versión del service worker.
- `tests/sw-version.test.js` falla si se cambia un archivo de la app sin
  correr `npm run sw` (protege la caché offline).
- **Pantalla (E2E)** en `scripts/e2e/` (Playwright + Chromium, 390 px):
  `node scripts/e2e/fase1.js [capturas]` (login, nota de hábitos, accesos y
  admin), `node scripts/e2e/fase3.js [capturas]` (Running con GPS y reloj
  simulados: preparar, correr, pausar, recuperar tras recargar, resumen,
  mapa, guardar, abrir, eliminar, permiso denegado, registro a mano) y
  `node scripts/e2e/regresion.js [capturas]` (las 15 pantallas en teléfono
  390 px y en computadora 1280 px: se ven, sin errores y sin scroll de lado;
  acciones de siempre: marcar un hábito, anotar un gasto, registrar Running y
  Bici a mano, marcar una serie en Gimnasio; aviso "Sin conexión"). `node scripts/e2e/fase4.js [capturas]`:
  importar CSV con errores y válido, correr con rutina (voz, 3-2-1, cambio,
  fin), pausa, recuperación, app congelada, sin GPS, guardar, voz apagada,
  eliminar rutina. `node scripts/e2e/fase5.js [capturas]`: Bicicleta (velocidad
  grande, parciales de 5 km, sin calorías, guardar, abrir, eliminar, registro
  a mano, una actividad a la vez). `node scripts/e2e/fase6.js [capturas]`:
  progreso por semana, tendencia, marcas (sin las anotadas a mano), meses,
  gráficos de ritmo/velocidad y altitud, parciales resaltados (actividades
  generadas con el motor real). Utilidades comunes en `scripts/e2e/comun.js` (GPS, reloj
  y voz simulados). Usan `fake-firebase.js`: Firestore
  y Auth en memoria (con `FieldPath`, `increment`, `arrayUnion`/`arrayRemove`
  y `update(campo, valor, …)` como el SDK real), con las reglas de
  `accesos`/`admins` simuladas. **No
  prueban las reglas reales** (se verifican al publicarlas, `docs/ADMIN.md`).

## Por fase (mínimos)
- **F1**: contraseña (teclado, ocultar/mostrar, válido/ inválido/ vacío),
  nota de hábito (sin nota, con nota, editar, hábitos viejos), evento de
  login (1 por inicio de sesión, sin duplicados, sin datos sensibles),
  bandeja admin (ver, leído, historial), usuario normal sin acceso
  (verificado con las reglas publicadas).
- **F2–F5**: motor (Haversine, filtros, pausas, tiempo en movimiento,
  ritmo/velocidad, parciales, serialización), intervalos (cambios, cuenta
  atrás, fin, recuperación con timestamps), CSV (válido, vacío, columnas,
  duraciones, filas incompletas, tamaño, caracteres especiales).
- **Dispositivo real (iPhone)**: GPS, wake lock, voz y sonido se validan en
  el teléfono del dueño; nada se da por funcionando sin esa prueba.
- **Regresión** en cada fase: `npm test` + recorrido de Hábitos, Ejercicio y
  Finanzas en 390 px.

## Cómo correr todo
```bash
npm test
export NODE_PATH=/opt/node22/lib/node_modules   # donde está Playwright
for f in fase1 fase3 fase4 fase5 fase6 regresion; do node scripts/e2e/$f.js || break; done
```
Cada script termina con "Todo bien" (código 0) o con la cantidad de fallos.

## Resultado del QA final (fase 8, 2026-10-01)
- Unitarias: 225/225. E2E: fase1 39 ✓, fase3 45 ✓, fase4 30 ✓, fase5 24 ✓,
  fase6 15 ✓, regresion 37 ✓ (15 pantallas × 2 tamaños + 7 acciones).
- Hallazgo: el Firestore de prueba no entendía `FieldPath` (lo usa Hábitos
  al marcar); era un límite del simulador, no de la app. Corregido en
  `scripts/e2e/fake-firebase.js`.
- Revisión de seguridad de las plantillas nuevas: los textos del usuario
  (nombres de rutina, notas, usuario del aviso) se escapan o van como texto.
- Lo que **no** se puede probar aquí: GPS real, pantalla encendida, voz y
  pitidos reales, teclado del iPhone, reglas publicadas en Firebase. Va en
  la lista de abajo.

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

**Hábitos, Ejercicio, Finanzas (como antes)**
- [ ] Marcar y desmarcar un hábito; crear uno con nota y ver la nota.
- [ ] Gimnasio: empezar una rutina, marcar series (✓), terminar y ver que
  los botones Finalizar/Descartar no quedan tapados.
- [ ] Ejercicio › Perfil: el gráfico y los períodos se ven bien.
- [ ] Finanzas: anotar un gasto y verlo en Movimientos y en Presupuesto.

**Running con GPS (afuera, cielo abierto)**
- [ ] "Iniciar carrera" pide permiso de ubicación; tras unos segundos dice
  "GPS listo".
- [ ] Correr 1–2 km: distancia, tiempo y ritmo cambian; la pantalla **no se
  apaga** sola (iOS 18.4 o más nuevo).
- [ ] Pausar 1 minuto: el tiempo se detiene; Reanudar sigue sumando.
- [ ] Finalizar: resumen con mapa de calles, parciales por km y desnivel.
- [ ] Guardar: aparece en "Tus carreras" con la etiqueta GPS; al tocarla se
  abre con su mapa.
- [ ] Comparar la distancia con un reloj/app de confianza o una pista
  conocida (diferencia esperable: 1–3 %).
- [ ] Cerrar Manolo a mitad de una carrera en pausa y volver a abrirlo: la
  recupera.
- [ ] Bloquear el teléfono 30 s corriendo: al volver, el tramo aparece como
  recta (el iPhone no registra con la pantalla bloqueada; es lo esperado).

**Rutina de intervalos (CSV)**
- [ ] "Descargar plantilla", editarla (o usar la de ejemplo) e "Importar CSV".
- [ ] Correr con la rutina **con música sonando**: se oyen los pitidos 3-2-1
  y la voz en cada cambio, y la música sigue.
- [ ] Con el interruptor de silencio del iPhone activado: anotar si se oyen
  los pitidos/voz (depende de iOS).
- [ ] Apagar "Sonido" y "Voz": ya no suenan; el aviso grande en pantalla sigue.

**Bicicleta**
- [ ] Una rodada corta: la velocidad es el número grande, parciales de 5 km,
  velocidad máxima; guardar y abrir con su mapa.

**Sin conexión**
- [ ] Modo avión: Manolo abre, se puede marcar un hábito y aparece "Sin
  conexión"; al volver internet se sincroniza solo.
- [ ] Correr en modo avión: el GPS funciona; el mapa del resumen puede salir
  sin calles (el recorrido sí se dibuja) y se guarda al volver internet.
