# Rangos (Ejercicio › Rangos)

Sistema de rangos inspirado en Symmetry: 9 rangos y 25 divisiones según tu
percentil estimado frente a hombres que entrenan. No hay comunidad: el
percentil sale de una tabla fija de estándares (hombre de 85 kg).

## Archivos

| Archivo | Qué es |
|---|---|
| `js/rangos-config.js` | **Único archivo de configuración**: constantes, 25 niveles, músculos, grupos y estándares (`STANDARDS.hombre`) con sus vínculos (`baseIds`, `alias`). |
| `js/rangos-engine.js` | Cálculo puro: score, percentil e inversa, nivel sostenido, protección, inactividad, músculo → grupo → global, meta y snapshot. |
| `tests/rangos-engine.test.js` | Tests, incluidos todos los casos del documento de requisitos (sección 9). |
| `js/rangos-insignias.js` | Insignias SVG propias (forma según rango, I/II/III al centro, Simétrico iridiscente). |
| `js/rangos.js` | Pantalla Rangos, hojas (músculo, ejercicio, vincular) y aviso "Nuevos rangos". |
| `js/perfil-ejercicio.js` | Perfil: altura e historial de pesajes. |

## Cómo se calcula (resumen)

1. **Score por serie** (config `CONST`): Epley con tope de reps (12 con carga,
   30 en peso corporal), normalizado a 85 kg con `(85 / peso) ^ 0,67`.
   - `carga`: kg de la serie (mancuernas: kg de cada una).
   - `corporal`: peso corporal + lastre − asistencia.
   - `reps` / `tiempo`: reps o segundos, sin ajuste por peso.
   - Se ignoran calentamientos y registros fuera de rango. Una serie > 1,25 ×
     P99 (o > 1,5 × tu nivel sostenido en carga/corporal) es sospechosa: no
     cuenta hasta que la confirmes en el detalle del ejercicio.
2. **Sesión** = el mismo ejercicio dentro de un entreno; su score es la mejor serie.
3. **Nivel sostenido L**: 1.ª sesión L = S; luego sube 50 % hacia una sesión
   mejor y baja 20 % hacia una peor. Tras subir de división, 2 sesiones
   protegidas. Inactividad: 28 días de margen, luego −1 %/semana con suelo
   min(L, 85 % del pico).
4. **Percentil**: interpolación lineal entre (0,0) y las anclas P5…P99; por
   encima de P99, `min(99,9; 99 + (S − a99)/(a99 − a95))`. Histéresis de 1 punto
   para bajar (solo en la capa de ejercicio, que tiene historial).
5. **Músculo**: media de percentiles ponderada por implicación (1 / 0,5) ×
   series válidas en 90 días (mín. 1). **Grupo**: media de sus músculos por su
   peso. **Global** (con 10 ejercicios con rango): `(Σ √Pg / 6)²`.

## De dónde salen los datos

- Entrenos: `users/{uid}/entrenamientos` (sin cambios; campos nuevos
  opcionales por serie: `calentamiento: true`, `asistencia: kg`).
- Peso por sesión: último pesaje ≤ fecha (`meta/perfil_ejercicio.pesajes`)
  → peso del perfil (`meta/ajustes_ejercicio.pesoCorporal`) → 85.
- Músculos de cada ejercicio del catálogo: los del mapa muscular de Manolo
  (primario 1, secundario 0,5; los tres pechos = pectoral, espalda media =
  espalda alta, pantorrillas = gemelos); si no hay, los de la tabla.
- Vínculo de un ejercicio registrado con el catálogo, en este orden:
  vínculo manual (`meta/rangos_vinculos.vinculos`, clave `id:<ejercicio>` o
  `n:<nombre normalizado>`, valor = id del catálogo o `__ninguno__`) →
  `baseIds` del catálogo → alias. Si no: "sin estándar" (reconocido pero no
  está en el catálogo) o "sin vincular" (nombre desconocido).
- Guardado nuevo (solo esto): `meta/rangos_vinculos` (vínculos y series
  confirmadas), `meta/rangos_snapshot` (niveles para el aviso) y
  `meta/perfil_ejercicio` (altura y pesajes).

## Aviso "Nuevos rangos"

Al guardar o editar un entreno (evento `entreno:guardado` de
`js/gimnasio.js`) se compara con `meta/rangos_snapshot`. Si subió alguna
división (ejercicio, músculo, grupo o global) o se desbloqueó el global, se
muestra la lista; "Continuar" actualiza el snapshot. La primera vez el
snapshot se crea en silencio.

## Cómo ajustar

- **Recalibrar un ejercicio**: cambia sus `anclas` en `js/rangos-config.js`.
- **Agregar un ejercicio al catálogo**: nueva entrada en `STANDARDS.hombre`
  con familia, músculos, anclas, `baseIds` (ids de `data/ejercicios.json`) y
  alias. Corre `npm test`.
- **Otra cohorte** (fuera de alcance): añadir `STANDARDS.mujer` y cambiar `COHORTE`.
- Tras cambiar un archivo, sube su `?v=` en `index.html`.

## Decisiones

- Manolo solo tiene modo oscuro: las insignias se probaron sobre fondo claro
  y oscuro, pero no se creó un tema claro para la app.
- "Fondos en paralelas" en el mapa de Manolo tiene tríceps primario y pecho
  secundario, así que en el rango del pectoral pesa 0,5 (no 1 como en la tabla).
- Abductores y cuello no tienen rango (se ven en gris en el diagrama).
