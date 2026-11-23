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
bueno, con tu ropa y el clima del día); Pinterest (solo lectura, sin la IA):
`POST /pinterest/tablero`, `/pinterest/pin`, `/pinterest/imagen`. `/quien`
dice la versión del puente (3: con outfits); la app usa lo nuevo solo si el
puente lo tiene.
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
