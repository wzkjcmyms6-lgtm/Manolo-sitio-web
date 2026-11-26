# Puente de Manolo (la IA de Ropa)

Un Worker de Cloudflare entre Manolo (sitio estático) y la IA de Claude
(D-147, `docs/ROPA.md`). **No es parte de la app**: la app sigue sin
dependencias; esto se instala aparte, en la cuenta de Cloudflare del dueño.

- Guarda la clave de la IA como secreto de Cloudflare (`ANTHROPIC_API_KEY`):
  nunca va en la app ni en este repo.
- Deja pasar solo al dueño: revisa el token de Firebase de la sesión (firma
  de Google, proyecto, vencimiento) y que el usuario esté en `USUARIOS`.
- Lleva la cuenta del gasto del mes en KV (`GASTO`) y corta al llegar al
  tope (8 USD al empezar; se cambia desde Ajustes de Ropa).
- No guarda fotos ni textos.

Rutas: `GET /quien`, `GET /gasto`, `POST /tope`; la IA: `POST /describir`,
`/inspiracion`, `/look`, `/estilo`, `/outfits` (5 outfits del mejor al menos
bueno, con tu ropa y el clima del día); el estilista (D-157): `/charla`
(conversar: una respuesta corta, 0 a 3 outfits con tu ropa, 0 a 2 prendas que
te faltan y 0 a 2 cosas para recordar de ti), `/opinar` ("¿Qué opinas?" de un
outfit tuyo: veredicto y 0 a 2 cambios por prendas tuyas de la misma parte) y
`/opinion` (el repaso del ropero, con más esfuerzo: comenta los números que
calcula la app —`h1`, `h2`…— sin cambiarlos, sugiere prendas y dice qué no
comprar y qué dejar); Pinterest (solo lectura, sin la IA):
`POST /pinterest/tablero`, `/pinterest/pin`, `/pinterest/imagen`. `/quien`
dice la versión del puente (3: con outfits; 4: `/describir` también dice el
corte y las mangas de la prenda, D-154; 5: el estilista, D-157; 6: en
`/charla`, los outfits de antes con su nombre y lo que ya viste hoy, `hoy`,
D-159; 7: los latidos, D-162; 8: Pinterest con cara de navegador, D-168); la
app usa lo nuevo solo si el puente lo tiene.

**Pinterest desde Cloudflare (versión 8, D-168).** Probado desde el puente el
2026-11-26: si el pedido no trae el `User-Agent` de un navegador, Pinterest
contesta "Forbidden" (403) en el RSS de los tableros, en el del perfil y en
oEmbed; con el de Safari del iPhone (`NAVEGADOR` en `src/index.js`), 200. Los
links cortos (`pin.it`) y las imágenes (`i.pinimg.com`) andan igual. Además,
en el RSS de los tableros cada pin viene ahora con un código de 55 letras
(`/pin/e1_AfqPS…/`, antes un número): el puente acepta códigos de hasta 100.
oEmbed no reconoce esos códigos nuevos (no hace falta: el RSS trae el título y
la imagen). En las pruebas, el Pinterest de mentira también contesta 403 sin
`User-Agent`.

**Latidos (versión 7, D-162).** El iPhone (Safari) corta un pedido si no le
llega nada en 60 segundos, y la IA puede tardar más (el repaso del ropero, con
esfuerzo alto). Las rutas de la IA con `?latidos=1` contestan enseguida
(`200`, `Cache-Control: no-store, no-transform` para que Cloudflare no la
comprima ni la retenga) y, mientras la IA piensa, mandan un espacio cada 10
segundos (al JSON no le molesta); al final va el JSON de siempre o, si no se
pudo, `{ error, mensaje, status }` adentro (la app lo entiende igual). Sin
`?latidos`, todo como antes (la app vieja sigue andando). En las pruebas,
`LATIDO_MS` lo acorta.

Para que cueste poco, la ropa va primero y en caché (en `/charla` y
`/opinar`); en `/charla`, además, cada mensaje de antes va en su propio
bloque y el último queda en caché: el mensaje siguiente lee de la caché todo
lo anterior. A la IA le van los últimos 10 mensajes que sirven (pasados 10, lo
más viejo sale y esa parte se escribe de nuevo en la caché; la ropa no). Con tu ropa
solo van referencias (p1, p2…): ni tus ids, ni notas, talla o precio; la app
recibe de vuelta tus ids, sin lo que está para lavar.

**Pinterest, si no se puede leer un tablero (D-164)**: el error dice qué pasó
(`detalle: { paso, status }`): `corto` (el link pin.it no llevó a Pinterest),
`tablero` (404: no existe o es secreto), `pinterest-bloqueo` (Pinterest
contestó otro error, con su código), `pinterest-raro` (contestó algo que no es
el RSS) o `pinterest-red` (no se pudo llegar). La lectura desde Cloudflare
nunca se pudo probar desde estas sesiones (su red no llega al Worker).

**Instalado** (D-153, 2026-11-24): `https://manolo-puente.manolo-ropa-482.workers.dev`,
en la cuenta de Cloudflare del dueño. Para subir un cambio: `npm run prueba`
y, desde aquí, `npx wrangler deploy` (los secretos quedan).
Lógica sin red en `src/logica.js` y `src/pinterest.js` (pruebas:
`tests/puente-logica.test.js` y `tests/puente-pinterest.test.js`, en el
`npm test` de la app). El Worker entero, con fetch de mentira:
`npm run prueba` (aquí, después de `npm install`).

## Instalar (lo hace el agente, con el token de Cloudflare del dueño)

1. `npm install` (aquí, en `puente/`).
2. `npx wrangler kv namespace create GASTO` y poner su id en `wrangler.toml`.
3. Secretos (no van al repo): `npx wrangler secret put MODELO` (el modelo de
   Claude) y `npx wrangler secret put USUARIOS` (el código de usuario del
   dueño, que Manolo muestra en Ajustes de Ropa).
4. `npx wrangler deploy` → la dirección `https://manolo-puente.….workers.dev`.
5. El dueño pega la clave de la IA en Cloudflare: Workers › manolo-puente ›
   Settings › Variables and Secrets › Add › Secret `ANTHROPIC_API_KEY`.
6. En la app, la dirección va en `PUENTE` (`js/ropa-ia.js`) y `npm run listo`.
