// Puente de Manolo (puente/src/logica.js, D-147): el token de Firebase (firma
// y datos), quién puede usar la IA, CORS, el costo y el tope, y lo que se le
// pide y se acepta de la IA al describir una prenda (con las mismas listas que
// js/ropa-motor.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../js/ropa-motor.js");

const cargar = () => import("../puente/src/logica.js");
const b64url = buf => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const subtle = globalThis.crypto.subtle;

// Un par de llaves como las de Google y un token firmado con la privada.
async function llaves() {
  const par = await subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const pub = await subtle.exportKey("jwk", par.publicKey);
  return { privada: par.privateKey, jwks: { keys: [Object.assign({ kid: "k1", alg: "RS256", use: "sig" }, { kty: pub.kty, n: pub.n, e: pub.e })] } };
}
async function token(privada, payload, header) {
  const h = b64url(JSON.stringify(Object.assign({ alg: "RS256", kid: "k1", typ: "JWT" }, header || {})));
  const p = b64url(JSON.stringify(payload));
  const firma = await subtle.sign("RSASSA-PKCS1-v1_5", privada, new TextEncoder().encode(`${h}.${p}`));
  return `${h}.${p}.${b64url(firma)}`;
}
const AHORA = 1795000000;
const bueno = (extra) => Object.assign({ aud: "manolo-4c57b", iss: "https://securetoken.google.com/manolo-4c57b", sub: "dueno123", iat: AHORA - 60, auth_time: AHORA - 3600, exp: AHORA + 3000 }, extra || {});

test("token de Firebase: el bueno pasa, los demás no", async () => {
  const L = await cargar();
  const { privada, jwks } = await llaves();
  const ok = await L.verificarToken(await token(privada, bueno()), jwks, "manolo-4c57b", AHORA, subtle);
  assert.deepEqual(ok, { ok: true, uid: "dueno123" });
  const motivo = async (t, proyecto) => (await L.verificarToken(t, jwks, proyecto || "manolo-4c57b", AHORA, subtle)).motivo;
  assert.equal(await motivo(await token(privada, bueno({ exp: AHORA - 1 }))), "vencido");
  assert.equal(await motivo(await token(privada, bueno({ aud: "otro-proyecto", iss: "https://securetoken.google.com/otro-proyecto" }))), "proyecto");
  assert.equal(await motivo(await token(privada, bueno()), "otro"), "proyecto");
  assert.equal(await motivo(await token(privada, bueno({ iat: AHORA + 3600 }))), "fecha");
  assert.equal(await motivo(await token(privada, bueno({ sub: "" }))), "usuario");
  assert.equal(await motivo(await token(privada, bueno(), { kid: "otra" })), "llave");
  assert.equal(await motivo(await token(privada, bueno(), { alg: "none" })), "algoritmo");
  assert.equal(await motivo("no.es.token"), "formato");
  assert.equal(await motivo(""), "formato");
  // Firmado por otra llave (alguien que no es Google).
  const otra = await llaves();
  assert.equal(await motivo(await token(otra.privada, bueno())), "firma");
  // Cambiar el usuario sin volver a firmar.
  const t = (await token(privada, bueno())).split(".");
  t[1] = b64url(JSON.stringify(bueno({ sub: "intruso" })));
  assert.equal(await motivo(t.join(".")), "firma");
});

test("solo los usuarios de la lista usan la IA; CORS solo para Manolo", async () => {
  const L = await cargar();
  assert.equal(L.permitido("dueno123", "dueno123"), true);
  assert.equal(L.permitido("dueno123", " otro , dueno123 "), true);
  assert.equal(L.permitido("otro", "dueno123"), false);
  assert.equal(L.permitido("", ""), false);
  assert.equal(L.permitido("x", undefined), false);
  const h = L.cors("https://wzkjcmyms6-lgtm.github.io", "https://wzkjcmyms6-lgtm.github.io");
  assert.equal(h["Access-Control-Allow-Origin"], "https://wzkjcmyms6-lgtm.github.io");
  assert.equal(L.cors("https://malo.example", "https://wzkjcmyms6-lgtm.github.io")["Access-Control-Allow-Origin"], undefined);
  assert.equal(L.cors("http://localhost:8080", "")["Access-Control-Allow-Origin"], "http://localhost:8080");
  assert.match(h["Access-Control-Allow-Headers"], /Authorization/);
});

test("el costo de cada respuesta, el mes en Bolivia y el tope", async () => {
  const L = await cargar();
  // 2.600 de entrada y 700 de salida: 2600 × 4 + 700 × 20 = 24.400 por millón.
  assert.equal(L.redondo(L.costo({ input_tokens: 2600, output_tokens: 700 })), 0.0244);
  assert.equal(L.redondo(L.costo({ input_tokens: 1000, cache_read_input_tokens: 10000, output_tokens: 0 })), 0.006);
  assert.equal(L.redondo(L.costo({ input_tokens: 0, output_tokens: 0, server_tool_use: { web_search_requests: 3 } })), 0.03);
  assert.equal(L.costo(null), 0);
  assert.equal(L.costo({ input_tokens: -5, output_tokens: "x" }), 0);
  assert.equal(L.mesDe(Date.UTC(2026, 11, 1, 2)), "2026-11", "a las 22:00 del 30 de noviembre en La Paz todavía es noviembre");
  assert.equal(L.mesDe(Date.UTC(2026, 11, 1, 5)), "2026-12");
  assert.equal(L.topeValido("8"), 8);
  assert.equal(L.topeValido(12.345), 12.35);
  assert.equal(L.topeValido(0), null);
  assert.equal(L.topeValido(500), null);
  assert.equal(L.topeValido("nada"), null);
});

test("las listas del puente son las mismas que las de la app", async () => {
  const L = await cargar();
  assert.deepEqual(Object.keys(L.GRUPOS), R.GRUPOS.map(g => g.id));
  R.GRUPOS.forEach(g => assert.deepEqual(L.GRUPOS[g.id], g.tipos.map(t => t[0]), g.id));
  assert.deepEqual(L.COLORES, R.COLORES.map(c => c.id));
  assert.deepEqual(L.ESTAMPADOS, R.ESTAMPADOS.map(e => e[0]));
  assert.deepEqual(L.ESTILOS, R.ESTILOS.map(e => e[0]));
  assert.deepEqual(L.CLIMAS, R.CLIMAS.map(c => c[0]));
});

test("el esquema y las instrucciones para describir una prenda", async () => {
  const L = await cargar();
  const s = L.ESQUEMA_PRENDA;
  assert.equal(s.additionalProperties, false);
  assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort(), "todo es obligatorio (salidas con esquema)");
  const sinLimites = JSON.stringify(s);
  assert.ok(!/minimum|maximum|minItems|maxItems|minLength|maxLength/.test(sinLimites), "sin límites que el esquema no acepta");
  const i = L.instruccionesPrenda();
  assert.match(i, /Chompa con capucha/);
  assert.match(i, /No inventes la marca/);
});

test("lo que contesta la IA se limpia antes de llegar al formulario", async () => {
  const L = await cargar();
  const p = L.limpiarPrenda({ esPrenda: true, varias: false, grupo: "abajo", tipo: "  Jean  ", colores: ["azul-jean", "azul-jean", "violeta", "blanco", "negro", "rojo"], estampado: "lunares", tela: "Jean", estilo: ["casual", "nada"], clima: ["frio", "templado"], formalidad: 2.4, marca: "Levi's" });
  assert.deepEqual(p, { esPrenda: true, varias: false, grupo: "abajo", tipo: "Jean", colores: ["azul-jean", "blanco", "negro"], estampado: "liso", tela: "Jean", estilo: ["casual"], clima: ["frio", "templado"], formalidad: 2, marca: "Levi's" });
  const raro = L.limpiarPrenda({ grupo: "luna", formalidad: 9, varias: "si", esPrenda: false });
  assert.equal(raro.grupo, "arriba");
  assert.equal(raro.tipo, "Polera");
  assert.equal(raro.formalidad, null);
  assert.equal(raro.varias, false);
  assert.equal(raro.esPrenda, false);
  assert.deepEqual(L.limpiarPrenda(null).colores, []);
  // Y la app lo entiende tal cual.
  const n = R.normalizar("x", p);
  assert.equal(R.titulo(n), "Jean azul");
});

test("la foto que manda Manolo", async () => {
  const L = await cargar();
  const img = "A".repeat(5000);
  assert.deepEqual(L.fotoValida({ tipo: "image/jpeg", imagen: img }), { tipo: "image/jpeg", imagen: img });
  assert.equal(L.fotoValida({ tipo: "image/gif", imagen: img }), null);
  assert.equal(L.fotoValida({ tipo: "image/jpeg", imagen: "corta" }), null);
  assert.equal(L.fotoValida({ tipo: "image/jpeg", imagen: "A".repeat(4.3e6) }), null);
  assert.equal(L.fotoValida({ tipo: "image/jpeg", imagen: img + "<script>" }), null);
  assert.equal(L.fotoValida(null), null);
});
