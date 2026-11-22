// ---------- Puente de Manolo: la lógica sin red (D-147) ----------
// Revisar el token de Firebase (firma RS256 con las llaves públicas de Google
// y sus datos: proyecto, emisor, vencimiento), quién puede usar la IA, CORS,
// el costo de cada respuesta, el mes y el tope de gasto, y lo que se le pide a
// la IA para describir una prenda (instrucciones, esquema fijo y revisar lo
// que contesta). Sin secretos: la clave de la IA y el modelo viven en
// Cloudflare. Pruebas: tests/puente-logica.test.js.

export const GOOGLE_JWKS = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

// ---- Token de Firebase ----
function deB64url(s) {
  const b = String(s).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b + "===".slice((b.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const texto = bytes => new TextDecoder().decode(bytes);
export function partesJwt(token) {
  const p = String(token || "").split(".");
  if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return null;
  try {
    return {
      header: JSON.parse(texto(deB64url(p[0]))),
      payload: JSON.parse(texto(deB64url(p[1]))),
      firmado: new TextEncoder().encode(`${p[0]}.${p[1]}`),
      firma: deB64url(p[2])
    };
  } catch (e) { return null; }
}
// jwks: { keys: [{ kid, kty, n, e, alg }] }; ahora en segundos; subtle: crypto.subtle.
// → { ok: true, uid } o { ok: false, motivo }
export async function verificarToken(token, jwks, proyecto, ahora, subtle) {
  const t = partesJwt(token);
  if (!t) return { ok: false, motivo: "formato" };
  if (t.header.alg !== "RS256") return { ok: false, motivo: "algoritmo" };
  const jwk = ((jwks && jwks.keys) || []).find(k => k.kid === t.header.kid);
  if (!jwk) return { ok: false, motivo: "llave" };
  let bien = false;
  try {
    const llave = await subtle.importKey("jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    bien = await subtle.verify("RSASSA-PKCS1-v1_5", llave, t.firma, t.firmado);
  } catch (e) { bien = false; }
  if (!bien) return { ok: false, motivo: "firma" };
  const p = t.payload;
  if (!proyecto || p.aud !== proyecto || p.iss !== `https://securetoken.google.com/${proyecto}`) return { ok: false, motivo: "proyecto" };
  if (!(typeof p.exp === "number" && p.exp > ahora)) return { ok: false, motivo: "vencido" };
  if (!(typeof p.iat === "number" && p.iat <= ahora + 300)) return { ok: false, motivo: "fecha" };
  if (typeof p.auth_time === "number" && p.auth_time > ahora + 300) return { ok: false, motivo: "fecha" };
  if (typeof p.sub !== "string" || !p.sub || p.sub.length > 128) return { ok: false, motivo: "usuario" };
  return { ok: true, uid: p.sub };
}
// lista: "uid1, uid2" (en Cloudflare, no en el repo).
export const permitido = (uid, lista) => !!uid && String(lista || "").split(",").map(s => s.trim()).filter(Boolean).includes(uid);

// ---- CORS: solo el sitio de Manolo (y la compu del que prueba) ----
export function cors(origen, permitidos) {
  const lista = String(permitidos || "").split(",").map(s => s.trim()).filter(Boolean);
  const ok = lista.includes(origen) || /^http:\/\/localhost(:\d+)?$/.test(origen || "");
  return Object.assign({
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  }, ok ? { "Access-Control-Allow-Origin": origen } : {});
}

// ---- Gasto ----
// precios: { entrada, salida, cacheLeer, cacheEscribir } en USD por millón de tokens.
export const PRECIOS = { entrada: 4, salida: 20, cacheLeer: 0.2, cacheEscribir: 5, busqueda: 0.01 };
export function costo(usage, precios) {
  const u = usage || {}, p = Object.assign({}, PRECIOS, precios || {});
  const n = x => (typeof x === "number" && isFinite(x) && x > 0 ? x : 0);
  const busquedas = n(u.server_tool_use && u.server_tool_use.web_search_requests);
  return (n(u.input_tokens) * p.entrada + n(u.output_tokens) * p.salida + n(u.cache_read_input_tokens) * p.cacheLeer + n(u.cache_creation_input_tokens) * p.cacheEscribir) / 1e6 + busquedas * p.busqueda;
}
// El mes en Bolivia (UTC−4, sin horario de verano): "2026-11".
export const mesDe = ms => new Date(ms - 4 * 3600e3).toISOString().slice(0, 7);
export const TOPE_INICIAL = 8;
export function topeValido(v) {
  const n = Number(v);
  return isFinite(n) && n >= 1 && n <= 100 ? Math.round(n * 100) / 100 : null;
}
export const redondo = usd => Math.round(usd * 10000) / 10000;

// ---- Describir una prenda ----
// Las mismas listas que js/ropa-motor.js (una prueba revisa que sigan iguales).
export const GRUPOS = {
  arriba: ["Polera", "Polera con cuello", "Camisa", "Blusa", "Chompa", "Chompa con capucha", "Top", "Musculosa"],
  abajo: ["Pantalón", "Jean", "Pantalón de tela", "Short", "Falda", "Buzo", "Leggings"],
  cuerpo: ["Vestido", "Enterizo", "Overol"],
  abrigos: ["Chamarra", "Abrigo", "Saco", "Chaleco", "Rompevientos", "Parka"],
  zapatos: ["Zapatillas", "Zapatos", "Botas", "Botines", "Sandalias", "Mocasines"],
  accesorios: ["Cinturón", "Gorra", "Sombrero", "Bufanda", "Guantes", "Reloj", "Lentes", "Corbata", "Mochila", "Cartera"]
};
export const COLORES = ["negro", "gris-oscuro", "gris", "gris-claro", "blanco", "crema", "beige", "camel", "cafe", "cafe-oscuro", "azul-marino", "azul", "azul-jean", "celeste", "turquesa", "verde", "verde-oscuro", "verde-oliva", "amarillo", "mostaza", "naranja", "rojo", "bordo", "rosado", "fucsia", "lila", "morado", "dorado", "plateado"];
export const ESTAMPADOS = ["liso", "rayas", "cuadros", "puntos", "floral", "estampado", "logo"];
export const ESTILOS = ["casual", "formal", "deportivo", "elegante", "urbano", "clasico"];
export const CLIMAS = ["frio", "templado", "calor"];

export const ESQUEMA_PRENDA = {
  type: "object",
  additionalProperties: false,
  required: ["esPrenda", "varias", "grupo", "tipo", "colores", "estampado", "tela", "estilo", "clima", "formalidad", "marca"],
  properties: {
    esPrenda: { type: "boolean", description: "true si la foto muestra ropa, calzado o un accesorio" },
    varias: { type: "boolean", description: "true si en la foto hay más de una prenda" },
    grupo: { type: "string", enum: Object.keys(GRUPOS) },
    tipo: { type: "string", description: "Qué prenda es, en español de Bolivia (usa los nombres de la lista si calzan)" },
    colores: { type: "array", items: { type: "string", enum: COLORES }, description: "De 1 a 3, el principal primero" },
    estampado: { type: "string", enum: ESTAMPADOS },
    tela: { type: "string", description: "Tu mejor suposición en una o dos palabras; vacío si no se nota" },
    estilo: { type: "array", items: { type: "string", enum: ESTILOS }, description: "De 1 a 3" },
    clima: { type: "array", items: { type: "string", enum: CLIMAS }, description: "Para qué clima sirve (puede ser más de uno)" },
    formalidad: { type: "integer", description: "1 muy informal (buzo) a 5 muy formal (terno)" },
    marca: { type: "string", description: "Solo si se lee en la foto; si no, vacío" }
  }
};
export function instruccionesPrenda() {
  const tipos = Object.entries(GRUPOS).map(([g, ts]) => `- ${g}: ${ts.join(", ")}`).join("\n");
  return `Eres el asistente de ropa de Manolo, una app personal. Te muestran la foto de una prenda, un par de zapatos o un accesorio de la ropa de una persona, y la describes para su ropero.

Reglas:
- Describe solo lo que se ve. No inventes la marca: ponla solo si se lee en la foto.
- grupo y tipo: el tipo en español de Bolivia. Si calza, usa uno de estos (por grupo):
${tipos}
  Si no calza ninguno, escribe el nombre común y corto (por ejemplo "Pantalón cargo").
- colores: de 1 a 3, el principal primero (el que más se ve). El fondo no cuenta.
- tela: tu mejor suposición en una o dos palabras (algodón, jean, lana, cuero, poliéster…); vacío si no se nota.
- estilo: de 1 a 3. clima: frío (abriga), templado o calor; puede ser más de uno.
- formalidad: 1 muy informal (buzo, ropa de deporte), 2 informal (polera, jean), 3 intermedio (camisa casual, chino), 4 formal (camisa de vestir, saco), 5 muy formal (terno, vestido de gala).
- varias: true si en la foto hay más de una prenda (describe la principal). esPrenda: false si la foto no muestra ropa.`;
}
// Lo que contestó la IA → algo seguro para el formulario (listas válidas, sin repetir).
export function limpiarPrenda(x) {
  const o = x && typeof x === "object" ? x : {};
  const solo = (v, validos, max) => (Array.isArray(v) ? v : []).filter((y, i, a) => validos.includes(y) && a.indexOf(y) === i).slice(0, max);
  const corto = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
  const grupo = GRUPOS[o.grupo] ? o.grupo : "arriba";
  const f = Math.round(Number(o.formalidad));
  return {
    esPrenda: o.esPrenda !== false,
    varias: o.varias === true,
    grupo,
    tipo: corto(o.tipo, 40) || GRUPOS[grupo][0],
    colores: solo(o.colores, COLORES, 3),
    estampado: ESTAMPADOS.includes(o.estampado) ? o.estampado : "liso",
    tela: corto(o.tela, 40),
    estilo: solo(o.estilo, ESTILOS, 3),
    clima: solo(o.clima, CLIMAS, 3),
    formalidad: f >= 1 && f <= 5 ? f : null,
    marca: corto(o.marca, 40)
  };
}
// La foto que manda Manolo: base64 de una JPEG/PNG/WebP de hasta ~3 MB.
export function fotoValida(cuerpo) {
  const c = cuerpo || {};
  const tipo = ["image/jpeg", "image/png", "image/webp"].includes(c.tipo) ? c.tipo : null;
  const ok = tipo && typeof c.imagen === "string" && c.imagen.length > 100 && c.imagen.length <= 4.2e6 && /^[A-Za-z0-9+/]+=*$/.test(c.imagen.slice(-200));
  return ok ? { tipo, imagen: c.imagen } : null;
}
