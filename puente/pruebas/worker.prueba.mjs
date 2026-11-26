// Pruebas del Worker entero (puente/src/index.js, D-147 / D-148), sin red y
// sin gastar: el fetch de afuera es de mentira (Google, Pinterest y la API de
// la IA), así se revisa lo que el puente le pide a cada uno y lo que contesta.
// Necesita las dependencias del puente: cd puente && npm install && npm run prueba
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const subtle = globalThis.crypto.subtle;
const b64url = buf => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const par = await subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const pub = await subtle.exportKey("jwk", par.publicKey);
const JWKS = { keys: [{ kid: "k1", alg: "RS256", use: "sig", kty: pub.kty, n: pub.n, e: pub.e }] };
async function token(sub) {
  const ahora = Math.floor(Date.now() / 1000);
  const h = b64url(JSON.stringify({ alg: "RS256", kid: "k1", typ: "JWT" }));
  const p = b64url(JSON.stringify({ aud: "manolo-4c57b", iss: "https://securetoken.google.com/manolo-4c57b", sub, iat: ahora - 60, auth_time: ahora - 600, exp: ahora + 3000 }));
  const firma = await subtle.sign("RSASSA-PKCS1-v1_5", par.privateKey, new TextEncoder().encode(`${h}.${p}`));
  return `${h}.${p}.${b64url(firma)}`;
}

// KV de mentira.
function kv() {
  const m = new Map();
  return { m, get: async (k, tipo) => (m.has(k) ? (tipo === "json" ? JSON.parse(m.get(k)) : m.get(k)) : null), put: async (k, v) => { m.set(k, String(v)); } };
}
const ORIGEN = "https://wzkjcmyms6-lgtm.github.io";
const entorno = extra => Object.assign({ FIREBASE_PROJECT: "manolo-4c57b", ORIGENES: ORIGEN, USUARIOS: "dueno123", ANTHROPIC_API_KEY: "sk-ant-de-prueba", MODELO: "modelo-de-prueba", GASTO: kv() }, extra || {});

// Lo de afuera: Google (llaves), Pinterest e IA.
const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Manolo</title>
<item><title>Abrigo camel</title><link>https://www.pinterest.com/pin/111/</link><description>&lt;img src=&quot;https://i.pinimg.com/236x/aa/bb/cc/abc.jpg&quot;&gt;</description><pubDate>Sun, 22 Nov 2026 18:21:01 GMT</pubDate></item>
<item><title>Jean recto</title><link>https://www.pinterest.com/pin/222/</link><description>&lt;img src=&quot;https://i.pinimg.com/236x/dd/ee/ff/def.jpg&quot;&gt;</description></item>
</channel></rss>`;
let pedidos = [], respuestaIA = null, rssFalla = 0, rssModo = "";   // rssModo: "403", "html" o "404" (siempre)
const IMG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
globalThis.fetch = async (url, init) => {
  const u = String(url instanceof Request ? url.url : url);
  const opciones = init || {};
  pedidos.push({ url: u, init: opciones });
  const r = (cuerpo, status, headers) => new Response(cuerpo, { status: status || 200, headers: headers || {} });
  if (u.startsWith("https://www.googleapis.com/")) return r(JSON.stringify(JWKS), 200, { "cache-control": "public, max-age=3600" });
  // Como Pinterest de verdad desde Cloudflare (probado el 2026-11-26): sin
  // User-Agent de navegador, "Forbidden" (403).
  const ua = new Headers(opciones.headers || {}).get("User-Agent") || "";
  if (/^https:\/\/(www\.|api\.)?pinterest\.com\/|^https:\/\/pin\.it\//.test(u) && !/Mozilla\/5\.0/.test(ua)) return r("<!DOCTYPE HTML><title>Pinterest - Forbidden</title>", 403, { "Content-Type": "text/html" });
  if (u === "https://pin.it/2Ab3Cd4Ef") return r(null, 308, { Location: "https://api.pinterest.com/url_shortener/2Ab3Cd4Ef/redirect/" });
  if (u === "https://api.pinterest.com/url_shortener/2Ab3Cd4Ef/redirect/") return r(null, 302, { Location: "https://www.pinterest.com/juanito_99/manolo/?invite_code=z" });
  if (u === "https://pin.it/PinCorto1") return r(null, 308, { Location: "https://www.pinterest.com/pin/333/sent/?x=1" });
  if (u === "https://www.pinterest.com/juanito_99/manolo.rss") {
    if (rssModo === "403") return r("Forbidden", 403);
    if (rssModo === "html") return r("<!doctype html><html><body>¿Eres un robot?</body></html>", 200, { "Content-Type": "text/html" });
    if (rssModo === "404") return r("Board not found", 404);
    if (rssFalla > 0) { rssFalla--; return r("no", 404); }
    return r(RSS, 200, { "Content-Type": "text/xml" });
  }
  if (u === "https://pin.it/Roto1234") return r(null, 404);
  if (u.startsWith("https://www.pinterest.com/oembed.json?url=")) {
    return decodeURIComponent(u.split("url=")[1]) === "https://www.pinterest.com/pin/333/"
      ? r(JSON.stringify({ title: "Look de oficina", thumbnail_url: "https://i.pinimg.com/236x/12/34/56/x.jpg" }), 200, { "Content-Type": "application/json" })
      : r("{}", 404);
  }
  if (u === "https://i.pinimg.com/736x/12/34/56/x.jpg") return r("no", 403);
  if (u === "https://i.pinimg.com/474x/12/34/56/x.jpg") return r(IMG, 200, { "Content-Type": "image/jpeg", "Content-Length": String(IMG.length) });
  if (u.startsWith("https://i.pinimg.com/")) return r("no", 404);
  if (/\/v1\/messages$/.test(u)) {
    const c = respuestaIA || {};
    if (c.demora) await new Promise(res => setTimeout(res, c.demora));   // la IA "pensando" (para los latidos)
    return r(JSON.stringify({
      id: "msg_1", type: "message", role: "assistant", model: "modelo-de-prueba",
      content: c.content || [{ type: "text", text: JSON.stringify(c.datos || {}) }],
      stop_reason: c.stop_reason || "end_turn", stop_sequence: null,
      usage: c.usage || { input_tokens: 2000, output_tokens: 500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
    }), 200, { "Content-Type": "application/json", "request-id": "req_1" });
  }
  return r("fuera de la prueba: " + u, 599);
};
const deIA = () => pedidos.filter(p => /\/v1\/messages$/.test(p.url));
const cuerpoIA = p => JSON.parse(p.init.body);
const encabezado = (p, n) => {
  const h = p.init.headers;
  if (!h) return null;
  if (typeof h.get === "function") return h.get(n);
  const k = Object.keys(h).find(x => x.toLowerCase() === n);
  return k ? h[k] : null;
};

async function pedir(env, ruta, cuerpo, sub) {
  const t = await token(sub || "dueno123");
  const req = new Request(`https://manolo-puente.prueba.workers.dev${ruta}`, {
    method: cuerpo === undefined ? "GET" : "POST",
    headers: Object.assign({ Origin: ORIGEN, Authorization: `Bearer ${t}` }, cuerpo === undefined ? {} : { "Content-Type": "application/json" }),
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
  });
  const res = await worker.fetch(req, env);
  const tipo = res.headers.get("Content-Type") || "";
  return { status: res.status, headers: res.headers, json: tipo.includes("json") ? await res.json() : null, bytes: tipo.startsWith("image/") ? new Uint8Array(await res.arrayBuffer()) : null };
}
const FOTO = { tipo: "image/jpeg", imagen: "A".repeat(4000) };

test("quién soy: el dueño, la versión y el gasto; los demás no pasan", async () => {
  pedidos = [];
  const env = entorno();
  const r = await pedir(env, "/quien");
  assert.equal(r.status, 200);
  assert.equal(r.json.permitido, true);
  assert.equal(r.json.version, 8, "8: Pinterest con cara de navegador (D-168)");
  assert.equal(r.json.lista, true);
  assert.equal(r.json.gasto.usd, 0);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), ORIGEN);
  const otro = await pedir(env, "/pinterest/pin", { link: "https://www.pinterest.com/pin/333/" }, "intruso");
  assert.equal(otro.status, 403);
  const sinToken = await worker.fetch(new Request("https://x.dev/quien", { headers: { Origin: ORIGEN } }), env);
  assert.equal(sinToken.status, 401);
});

test("Pinterest: el tablero con el link corto del iPhone, reintentando si da 404", async () => {
  pedidos = [];
  rssFalla = 1;
  const env = entorno({ ANTHROPIC_API_KEY: "" });   // Pinterest funciona aunque falte la clave de la IA
  const r = await pedir(env, "/pinterest/tablero", { link: "Mira mi tablero https://pin.it/2Ab3Cd4Ef" });
  assert.equal(r.status, 200);
  assert.deepEqual([r.json.usuario, r.json.tablero, r.json.titulo], ["juanito_99", "manolo", "Manolo"]);
  assert.deepEqual(r.json.pines.map(p => [p.id, p.titulo, p.img]), [["111", "Abrigo camel", "https://i.pinimg.com/736x/aa/bb/cc/abc.jpg"], ["222", "Jean recto", "https://i.pinimg.com/736x/dd/ee/ff/def.jpg"]]);
  const saltos = pedidos.filter(p => /pin\.it|url_shortener/.test(p.url));
  assert.ok(saltos.length === 2 && saltos.every(p => p.init.redirect === "manual"), "el link corto se sigue sin bajar páginas");
  assert.equal(pedidos.filter(p => p.url.endsWith("manolo.rss")).length, 2, "reintentó el 404");
  assert.ok(!pedidos.some(p => /Manolo|dueno123/i.test(JSON.stringify(p.init.headers || {}))), "a Pinterest no le llega ni el nombre de la app ni el usuario");
  // Un pin no es un tablero; un link raro tampoco.
  assert.equal((await pedir(env, "/pinterest/tablero", { link: "https://www.pinterest.com/pin/333/" })).json.error, "es-pin");
  assert.equal((await pedir(env, "/pinterest/tablero", { link: "hola" })).json.error, "link");
});

test("Pinterest: un pin pegado (link corto) y su imagen para el teléfono", async () => {
  pedidos = [];
  const env = entorno();
  const r = await pedir(env, "/pinterest/pin", { link: "https://pin.it/PinCorto1" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.pin, { id: "333", url: "https://www.pinterest.com/pin/333/", titulo: "Look de oficina", img: "https://i.pinimg.com/736x/12/34/56/x.jpg" });
  const img = await pedir(env, "/pinterest/imagen", { url: r.json.pin.img });
  assert.equal(img.status, 200);
  assert.equal(img.headers.get("Content-Type"), "image/jpeg");
  assert.equal(img.headers.get("Access-Control-Allow-Origin"), ORIGEN, "el teléfono la puede leer");
  assert.deepEqual([...img.bytes], [...IMG], "si la de 736 no está, trae la de 474");
  const mala = await pedir(env, "/pinterest/imagen", { url: "https://example.com/x.jpg" });
  assert.equal(mala.status, 404);
  assert.ok(!pedidos.some(p => p.url.startsWith("https://example.com")), "no trae nada que no sea de Pinterest");
  assert.equal((await pedir(env, "/pinterest/pin", { link: "https://www.pinterest.com/pin/999/" })).json.error, "pin");
});

test("IA: lo que se ve en una inspiración (pedido con esquema, respaldo y esfuerzo bajo)", async () => {
  pedidos = [];
  const env = entorno();
  respuestaIA = { datos: { esRopa: true, resumen: "Casual de invierno", prendas: [{ grupo: "abrigos", tipo: "Abrigo", colores: ["camel"], estampado: "liso", tela: "Lana", detalle: "largo" }, { grupo: "luna" }], estilo: ["casual"], clima: ["frio"], formalidad: 2, ocasion: "fin de semana" } };
  const r = await pedir(env, "/inspiracion", FOTO);
  assert.equal(r.status, 200);
  assert.equal(r.json.inspiracion.prendas.length, 1, "limpio: sin la prenda rara");
  assert.equal(r.json.gasto.veces, 1);
  assert.equal(r.json.gasto.usd, 0.018, "2000 de entrada a 4 y 500 de salida a 20 por millón");
  const [p] = deIA();
  const c = cuerpoIA(p);
  assert.equal(c.model, "modelo-de-prueba");
  assert.equal(c.fallbacks, "default");
  assert.equal(c.output_config.effort, "low");
  assert.equal(c.output_config.format.type, "json_schema");
  assert.ok(/server-side-fallback-2026-07-01/.test(encabezado(p, "anthropic-beta") || ""), "el respaldo del servidor va pedido");
  const clave = encabezado(p, "x-api-key") || String(encabezado(p, "authorization") || "").replace(/^Bearer /, "");
  assert.equal(clave, "sk-ant-de-prueba", "la clave va al pedido (y solo ahí)");
  assert.equal(c.messages[0].content[0].type, "image");
  assert.ok(!/Manolo|dueno123/.test(JSON.stringify(c)), "a la IA no le llega el nombre de la app ni el usuario");
  // Rechazo y respuesta rara.
  respuestaIA = { stop_reason: "refusal", content: [] };
  assert.equal((await pedir(env, "/inspiracion", FOTO)).status, 422);
  respuestaIA = { content: [{ type: "text", text: "no es json" }] };
  assert.equal((await pedir(env, "/inspiracion", FOTO)).json.error, "respuesta");
  assert.equal((await pedir(env, "/inspiracion", { tipo: "image/jpeg", imagen: "x" })).status, 400);
});

test("IA: armar el look con tu ropa (el ropero en caché, referencias cortas) y mi estilo", async () => {
  pedidos = [];
  const env = entorno();
  respuestaIA = { datos: { prendas: [{ pin: 1, ref: "p2", parecido: "parecida", porque: "Tu abrigo beige." }, { pin: 2, ref: "p7", parecido: "igual", porque: "no existe" }], faltan: [{ pin: 2, grupo: "zapatos", tipo: "Botines", colores: ["cafe"], porque: "No tienes." }], consejo: "Súbele las mangas." } };
  const pin = { resumen: "Casual de invierno", prendas: [{ grupo: "abrigos", tipo: "Abrigo", colores: ["camel"] }, { grupo: "zapatos", tipo: "Botines", colores: ["cafe"] }], estilo: ["casual"], clima: ["frio"], formalidad: 2 };
  const ropero = [{ id: "jean_1", grupo: "abajo", tipo: "Jean", colores: ["azul-jean"] }, { id: "abrigo_9", grupo: "abrigos", tipo: "Abrigo", colores: ["beige"], notas: "secreto" }];
  const r = await pedir(env, "/look", { pin, ropero });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.look.prendas, [{ pin: 1, id: "abrigo_9", parecido: "parecida", porque: "Tu abrigo beige." }]);
  assert.deepEqual(r.json.look.faltan.map(f => f.tipo), ["Botines"]);
  const c = cuerpoIA(deIA()[0]);
  assert.equal(c.output_config.effort, "medium");
  assert.deepEqual(c.messages[0].content[0].cache_control, { type: "ephemeral" }, "el ropero queda en caché");
  assert.match(c.messages[0].content[0].text, /^La ropa que tengo/);
  assert.ok(!/jean_1|abrigo_9|secreto/.test(JSON.stringify(c)), "la IA no ve tus ids ni tus notas");
  assert.equal((await pedir(env, "/look", { pin, ropero: [] })).status, 400);
  // Mi estilo.
  respuestaIA = { datos: { resumen: "Te gustan los neutros.", claves: ["neutros"], colores: ["camel"], prendas: ["Abrigo largo"] } };
  const e = await pedir(env, "/estilo", { pines: [pin, pin, pin] });
  assert.equal(e.status, 200);
  assert.equal(e.json.estilo.resumen, "Te gustan los neutros.");
  assert.equal((await pedir(env, "/estilo", { pines: [pin] })).status, 400);
});

test("IA: outfits del día (el ropero en caché, referencias cortas, esfuerzo medio)", async () => {
  pedidos = [];
  const env = entorno();
  respuestaIA = { datos: { outfits: [{ nombre: "Capas neutras", prendas: ["p3", "p1", "p2"], porque: "Neutros.", capas: "" }, { nombre: "Con inventada", prendas: ["p1", "p9"], porque: "", capas: "" }], nota: "" } };
  const ropero = [{ id: "pol", grupo: "arriba", tipo: "Polera", colores: ["blanco"] }, { id: "jean", grupo: "abajo", tipo: "Jean", colores: ["azul-jean"] }, { id: "cha", grupo: "abrigos", tipo: "Chamarra", colores: ["verde-oliva"], notas: "secreta" }];
  const r = await pedir(env, "/outfits", { ropero, clima: "En La Paz: 9 a 20 °C.", necesidades: { base: "templado", abrigo: "abrigo", capas: true }, ocasion: "Casual" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.outfits.map(o => o.prendas), [["cha", "pol", "jean"]], "con tus ids; la que tenía una inventada, fuera");
  const c = cuerpoIA(deIA()[0]);
  assert.equal(c.output_config.effort, "medium");
  assert.deepEqual(c.messages[0].content[0].cache_control, { type: "ephemeral" });
  assert.match(c.messages[0].content[1].text, /Lo que pide: ropa de templado; abrigo para el frío; capas/);
  assert.ok(!/pol"|jean"|secreta/.test(JSON.stringify(c.messages)), "la IA no ve tus ids ni tus notas");
  assert.equal((await pedir(env, "/outfits", { ropero: [] })).status, 400);
});

test("IA: conversar con el estilista (la ropa y el último mensaje de antes en caché, esfuerzo medio)", async () => {
  pedidos = [];
  const env = entorno();
  respuestaIA = { datos: { respuesta: "Va así:", outfits: [{ nombre: "Capas", prendas: ["p3", "p2", "p1"], porque: "Abriga.", capas: "" }], faltan: [], recordar: ["Es friolento"] } };
  const ropero = [{ id: "pol", grupo: "arriba", tipo: "Polera", colores: ["blanco"] }, { id: "jean", grupo: "abajo", tipo: "Jean", colores: ["azul-jean"] }, { id: "cha", grupo: "abrigos", tipo: "Chamarra", colores: ["verde-oliva"], notas: "secreta" }];
  const historial = [{ de: "yo", texto: "Hola" }, { de: "ia", texto: "¿Qué necesitas?", outfits: [] }];
  const r = await pedir(env, "/charla", { mensaje: "Hace frío", ropero, historial, clima: "9 a 20 °C" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.outfits[0].prendas, ["cha", "jean", "pol"], "con tus ids");
  assert.deepEqual(r.json.recordar, ["Es friolento"]);
  assert.equal(typeof r.json.gasto.usd, "number");
  const c = cuerpoIA(deIA()[0]);
  assert.equal(c.output_config.effort, "medium");
  const bloques = c.messages[0].content;
  assert.deepEqual(bloques.map(x => !!x.cache_control), [true, false, false, true, false], "la ropa y el último mensaje de antes, en caché");
  assert.match(bloques[1].text, /^El clima: 9 a 20 °C/);
  assert.deepEqual(bloques.slice(2).map(x => x.text), ["Yo: Hola", "Tú: ¿Qué necesitas?", "Ahora te digo: Hace frío"]);
  assert.match(c.system, /^Eres el estilista personal/);
  assert.ok(!/pol"|jean"|cha"|secreta/.test(JSON.stringify(c.messages)), "la IA no ve tus ids ni tus notas");
  assert.equal((await pedir(env, "/charla", { mensaje: " ", ropero })).status, 400);
});

test("IA: «¿Qué opinas?» (esfuerzo medio) y el repaso del ropero (esfuerzo alto)", async () => {
  pedidos = [];
  const env = entorno();
  const ropero = [{ id: "pol", grupo: "arriba", tipo: "Polera", colores: ["blanco"] }, { id: "jean", grupo: "abajo", tipo: "Jean", colores: ["azul-jean"] },
    { id: "zap", grupo: "zapatos", tipo: "Zapatillas", colores: ["blanco"] }, { id: "zn", grupo: "zapatos", tipo: "Zapatos", colores: ["negro"], formalidad: 4 }];
  respuestaIA = { datos: { veredicto: "bien", funciona: "Bien.", cambios: [{ sale: "p3", entra: "p4", porque: "Más formal." }, { sale: "p1", entra: "p2", porque: "Otra parte." }], consejo: "" } };
  let r = await pedir(env, "/opinar", { outfit: ["pol", "jean", "zap"], ropero, ocasion: "Trabajo" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.cambios, [{ sale: "zap", entra: "zn", porque: "Más formal." }], "solo cambios posibles, con tus ids");
  let c = cuerpoIA(deIA()[0]);
  assert.equal(c.output_config.effort, "medium");
  assert.match(c.messages[0].content[1].text, /^Mi outfit: p1, p2, p3\.\nPara: Trabajo\./);
  assert.equal((await pedir(env, "/opinar", { outfit: ["pol"], ropero })).status, 400);
  respuestaIA = { datos: { resumen: "Buenas bases.", comentarios: [{ hecho: "h1", texto: "Suma algo abajo." }], sugerencias: [{ grupo: "abajo", tipo: "Chino", color: "beige", porque: "Aclara.", combina: ["p1"] }],
    noComprar: [], dejar: [], colores: { van: ["negro"], sumar: ["beige"], porque: "" }, consejos: [] } };
  r = await pedir(env, "/opinion", { ropero: ropero.map((p, k) => Object.assign({ veces: k }, p)), hechos: [{ id: "h1", texto: "Tienes 1 de abajo." }], ciudad: "La Paz" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.sugerencias[0].combina, ["pol"]);
  c = cuerpoIA(deIA()[1]);
  assert.equal(c.output_config.effort, "high");
  assert.match(c.messages[0].content[0].text, /p1 · arriba · Polera · blanco · sin usar/);
  assert.match(c.messages[0].content[1].text, /^Los datos de mi ropero \(de la app\):\nh1\. Tienes 1 de abajo\./);
  assert.equal((await pedir(env, "/opinion", { ropero: ropero.slice(0, 2) })).status, 400);
});

test("el tope: al llegar, la IA no se llama; Pinterest sigue", async () => {
  pedidos = [];
  const env = entorno();
  const mes = new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 7);
  await env.GASTO.put(`gasto:${mes}`, JSON.stringify({ usd: 8.01, n: 300 }));
  const r = await pedir(env, "/inspiracion", FOTO);
  assert.equal(r.status, 402);
  assert.equal(r.json.error, "tope");
  assert.equal(deIA().length, 0, "no se gastó nada");
  assert.equal((await pedir(env, "/pinterest/pin", { link: "https://www.pinterest.com/pin/333/" })).status, 200);
});

test("los latidos (D-162): con ?latidos=1 contesta enseguida, late mientras la IA piensa y al final el JSON (también los errores)", async () => {
  pedidos = [];
  const env = entorno({ LATIDO_MS: "5" });   // en Cloudflare, cada 10 segundos
  respuestaIA = { demora: 60, datos: { respuesta: "Va así:", outfits: [{ nombre: "Capas", prendas: ["p2", "p1"], porque: "", capas: "" }], faltan: [], recordar: [] } };
  const ropero = [{ id: "pol", grupo: "arriba", tipo: "Polera", colores: ["blanco"] }, { id: "jean", grupo: "abajo", tipo: "Jean", colores: ["azul-jean"] }, { id: "zap", grupo: "zapatos", tipo: "Zapatillas", colores: ["blanco"] }];
  const crudo = async (ruta, cuerpo) => {
    const t = await token("dueno123");
    const res = await worker.fetch(new Request(`https://manolo-puente.prueba.workers.dev${ruta}`, { method: "POST", headers: { Origin: ORIGEN, Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) }), env);
    return { status: res.status, headers: res.headers, texto: await res.text() };
  };
  let r = await crudo("/charla?latidos=1", { mensaje: "Hace frío", ropero });
  assert.equal(r.status, 200, "contesta enseguida");
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), ORIGEN, "el teléfono lo puede leer");
  assert.match(r.headers.get("Cache-Control"), /no-transform/, "sin comprimir (si no, los latidos esperan)");
  assert.match(r.texto, /^ +\{/, `latió mientras la IA pensaba («${r.texto.slice(0, 12)}…»)`);
  const j = JSON.parse(r.texto);
  assert.deepEqual(j.outfits[0].prendas, ["jean", "pol"], "y al final, lo de siempre");
  assert.equal(typeof j.gasto.usd, "number");
  // Si no se pudo: el error va adentro (con su status), igual de claro.
  respuestaIA = { datos: {} };
  r = await crudo("/opinion?latidos=1", { ropero: ropero.slice(0, 2) });
  assert.equal(r.status, 200);
  assert.deepEqual([JSON.parse(r.texto).status, JSON.parse(r.texto).error], [400, "datos"]);
  const mes = new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 7);
  await env.GASTO.put(`gasto:${mes}`, JSON.stringify({ usd: 8.01, n: 300 }));
  const antes = deIA().length;
  r = await crudo("/opinar?latidos=1", { outfit: ["pol", "jean"], ropero });
  const e = JSON.parse(r.texto);
  assert.deepEqual([r.status, e.status, e.error], [200, 402, "tope"], "el tope, adentro");
  assert.equal(typeof e.gasto.usd, "number", "con el gasto");
  assert.equal(deIA().length, antes, "y no se llamó a la IA");
  // Sin ?latidos, como antes (para la app de antes).
  assert.equal((await pedir(env, "/opinar", { outfit: ["pol", "jean"], ropero })).status, 402);
});

test("Pinterest (D-164): si el tablero no se puede leer, dice qué pasó", async () => {
  pedidos = [];
  const env = entorno();
  const leer = async link => (await pedir(env, "/pinterest/tablero", { link })).json;
  try {
    rssModo = "404";
    let j = await leer("https://www.pinterest.com/juanito_99/manolo/");
    assert.equal(j.error, "tablero");
    assert.match(j.mensaje, /no existe o es secreto/);
    assert.deepEqual(j.detalle, { paso: "rss", status: 404 });
    rssModo = "403";
    j = await leer("https://www.pinterest.com/juanito_99/manolo/");
    assert.equal(j.error, "pinterest-bloqueo");
    assert.match(j.mensaje, /no dejó leer tu tablero desde el puente \(respondió 403\)/);
    assert.match(j.mensaje, /pídele ideas a tu estilista/);
    rssModo = "html";
    j = await leer("https://www.pinterest.com/juanito_99/manolo/");
    assert.equal(j.error, "pinterest-raro");
    rssModo = "";
    j = await leer("https://pin.it/Roto1234");
    assert.equal(j.error, "corto");
    assert.match(j.mensaje, /link corto de Pinterest \(respondió 404\)/);
    assert.equal((await leer("https://www.pinterest.com/juanito_99/manolo/")).titulo, "Manolo", "y si se puede, como siempre");
  } finally { rssModo = ""; }
});
