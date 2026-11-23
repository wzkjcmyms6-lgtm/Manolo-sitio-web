// ---------- Puente de Manolo (Cloudflare Worker, D-147 / D-148) ----------
// Entre Manolo (sitio estático) y la IA de Claude: guarda la clave de la IA
// (secreto ANTHROPIC_API_KEY en Cloudflare, nunca en la app ni en el repo),
// deja pasar solo al dueño (token de Firebase revisado + USUARIOS), suma el
// gasto del mes en KV (GASTO) y corta al llegar al tope. También lee Pinterest
// por el teléfono (Pinterest no da permiso CORS): tableros públicos, pines y
// sus imágenes; solo lectura. No guarda fotos ni textos.
// Configuración en Cloudflare: secretos ANTHROPIC_API_KEY, MODELO y USUARIOS;
// variables FIREBASE_PROJECT y ORIGENES (wrangler.toml).
// Rutas: GET /quien, GET /gasto, POST /tope; IA: POST /describir,
// /inspiracion, /look, /estilo, /outfits; Pinterest: POST /pinterest/tablero,
// /pinterest/pin, /pinterest/imagen.
// Lógica sin red (y sus pruebas): ./logica.js, ./pinterest.js y
// tests/puente-logica.test.js, tests/puente-pinterest.test.js.
import Anthropic from "@anthropic-ai/sdk";
import * as L from "./logica.js";
import * as P from "./pinterest.js";

// Lo que este puente sabe hacer (la app lo mira para mostrar o no lo nuevo).
const VERSION = 3;   // 2: Pinterest e inspiración (D-148); 3: outfits (D-149)

let jwks = null;   // { llaves, vence }
async function llaves() {
  if (jwks && jwks.vence > Date.now()) return jwks.llaves;
  const r = await fetch(L.GOOGLE_JWKS);
  if (!r.ok) throw new Error(`jwks ${r.status}`);
  const llavesNuevas = await r.json();
  const edad = /max-age=(\d+)/.exec(r.headers.get("cache-control") || "");
  jwks = { llaves: llavesNuevas, vence: Date.now() + (edad ? Number(edad[1]) * 1000 : 3600e3) };
  return llavesNuevas;
}

async function leerGasto(env, mes) { return (await env.GASTO.get(`gasto:${mes}`, "json")) || { usd: 0, n: 0 }; }
async function leerTope(env) { return L.topeValido(await env.GASTO.get("tope")) || L.topeValido(env.TOPE) || L.TOPE_INICIAL; }
async function estadoGasto(env) {
  const mes = L.mesDe(Date.now());
  const [g, tope] = await Promise.all([leerGasto(env, mes), leerTope(env)]);
  return { mes, usd: L.redondo(g.usd), veces: g.n, tope };
}
async function sumarGasto(env, usd) {
  const mes = L.mesDe(Date.now());
  const g = await leerGasto(env, mes);
  g.usd = L.redondo(g.usd + usd);
  g.n++;
  await env.GASTO.put(`gasto:${mes}`, JSON.stringify(g), { expirationTtl: 400 * 86400 });
  return { mes, usd: g.usd, veces: g.n, tope: await leerTope(env) };
}

// Los errores de la IA, en palabras simples.
function errorIA(e, que) {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return [503, "clave", "La clave de la IA no sirve: revísala en Cloudflare."];
  if (e instanceof Anthropic.RateLimitError) return [429, "ocupada", "La IA está ocupada. Intenta de nuevo en un rato."];
  if (e instanceof Anthropic.BadRequestError && /credit|balance|billing/i.test(e.message || "")) return [402, "credito", "Se acabó el crédito de la IA: recárgalo en platform.claude.com."];
  if (e instanceof Anthropic.APIConnectionError) return [503, "conexion", "No pude hablar con la IA. Intenta de nuevo."];
  if (e instanceof Anthropic.APIError && e.status >= 500) return [503, "caida", "La IA no está respondiendo. Intenta de nuevo en un rato."];
  return [500, "ia", `La IA no pudo ${que}. Intenta de nuevo.`];
}

// Una pregunta a la IA con respuesta de esquema fijo: revisa el tope, suma el
// gasto y devuelve { datos, gasto } o { status, cuerpo } si no se pudo.
async function preguntar(env, { system, contenido, esquema, esfuerzo, que }) {
  const g = await estadoGasto(env);
  if (g.usd >= g.tope) return { status: 402, cuerpo: { error: "tope", mensaje: `Llegaste al tope del mes (US$ ${g.tope}). La IA vuelve el mes que viene, o sube el tope en Ajustes de Ropa.`, gasto: g } };
  const ia = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  let r;
  try {
    r = await ia.beta.messages.create({
      model: env.MODELO,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      output_config: { effort: esfuerzo, format: { type: "json_schema", schema: esquema } },
      messages: [{ role: "user", content: contenido }]
    });
  } catch (e) {
    const [status, error, mensaje] = errorIA(e, que);
    console.log("IA:", e && e.status, e && e.message);
    return { status, cuerpo: { error, mensaje } };
  }
  const gasto = await sumarGasto(env, L.costo(r.usage));
  if (r.stop_reason === "refusal") return { status: 422, cuerpo: { error: "rechazo", mensaje: `La IA no quiso ${que}.`, gasto } };
  // El texto con el JSON es el último bloque de texto (si hubo respaldo, el del modelo que terminó).
  const textos = (r.content || []).filter(b => b.type === "text");
  let datos = null;
  try { datos = JSON.parse(textos.length ? textos[textos.length - 1].text : ""); } catch (e) { datos = null; }
  if (!datos || r.stop_reason === "max_tokens") return { status: 502, cuerpo: { error: "respuesta", mensaje: "La IA contestó algo raro. Intenta de nuevo.", gasto } };
  return { datos, gasto };
}
const imagen = foto => ({ type: "image", source: { type: "base64", media_type: foto.tipo, data: foto.imagen } });

async function describir(env, cuerpo) {
  const foto = L.fotoValida(cuerpo);
  if (!foto) return [400, { error: "foto", mensaje: "Esa foto no se pudo leer." }];
  const r = await preguntar(env, {
    system: L.instruccionesPrenda(), esquema: L.ESQUEMA_PRENDA, esfuerzo: "low", que: "describir esta foto",
    contenido: [imagen(foto), { type: "text", text: "Describe esta prenda para mi ropero." }]
  });
  return r.cuerpo ? [r.status, r.cuerpo] : [200, { prenda: L.limpiarPrenda(r.datos), gasto: r.gasto }];
}
// Lo que se ve en un pin o en una captura (D-148).
async function inspiracion(env, cuerpo) {
  const foto = L.fotoValida(cuerpo);
  if (!foto) return [400, { error: "foto", mensaje: "Esa imagen no se pudo leer." }];
  const r = await preguntar(env, {
    system: L.instruccionesInspiracion(), esquema: L.ESQUEMA_INSPIRACION, esfuerzo: "low", que: "mirar esta imagen",
    contenido: [imagen(foto), { type: "text", text: "¿Qué prendas se ven en esta inspiración?" }]
  });
  return r.cuerpo ? [r.status, r.cuerpo] : [200, { inspiracion: L.limpiarInspiracion(r.datos), gasto: r.gasto }];
}
// "Armar este look con mi ropa": el ropero va primero y queda en caché unos
// minutos (si miras varios pines seguidos, sale más barato).
async function look(env, cuerpo) {
  const e = L.entradaLook(cuerpo);
  if (!e) return [400, { error: "datos", mensaje: "Falta lo que se ve en el pin o tu ropero." }];
  const { texto, refs } = L.textoRopero(e.ropero);
  const r = await preguntar(env, {
    system: L.instruccionesLook(), esquema: L.ESQUEMA_LOOK, esfuerzo: "medium", que: "armar este look",
    contenido: [{ type: "text", text: texto, cache_control: { type: "ephemeral" } }, { type: "text", text: L.textoLook(e.pin) }]
  });
  return r.cuerpo ? [r.status, r.cuerpo] : [200, { look: L.limpiarLook(r.datos, refs, e.pin.prendas.length), gasto: r.gasto }];
}
// "Mi estilo": lo que se repite en tus pines.
async function estilo(env, cuerpo) {
  const e = L.entradaEstilo(cuerpo);
  if (!e) return [400, { error: "datos", mensaje: `Hacen falta al menos ${L.MIN_PINES_ESTILO} pines con ropa.` }];
  const r = await preguntar(env, {
    system: L.instruccionesEstilo(), esquema: L.ESQUEMA_ESTILO, esfuerzo: "low", que: "ver tu estilo",
    contenido: [{ type: "text", text: L.textoEstilo(e.pines) }]
  });
  return r.cuerpo ? [r.status, r.cuerpo] : [200, { estilo: L.limpiarEstilo(r.datos), gasto: r.gasto }];
}

// "¿Qué me pongo hoy?" (D-149): tres outfits solo con tu ropa (el ropero en
// caché, como en el look).
async function outfits(env, cuerpo) {
  const e = L.entradaOutfits(cuerpo);
  if (!e) return [400, { error: "datos", mensaje: "Hace falta tu ropero para armar outfits." }];
  const { texto, refs } = L.textoRopero(e.ropero);
  const r = await preguntar(env, {
    system: L.instruccionesOutfits(), esquema: L.ESQUEMA_OUTFITS, esfuerzo: "medium", que: "armar tus outfits",
    contenido: [{ type: "text", text: texto, cache_control: { type: "ephemeral" } }, { type: "text", text: L.textoOutfits(e, refs) }]
  });
  return r.cuerpo ? [r.status, r.cuerpo] : [200, Object.assign(L.limpiarOutfits(r.datos, refs), { gasto: r.gasto })];
}

// ---- Pinterest (solo lectura) ----
// Pide algo a Pinterest; si falla (a veces da 404 un rato), reintenta.
async function traer(url, intentos) {
  let r = null;
  for (let i = 0; i < (intentos || 3); i++) {
    try { r = await fetch(url, { headers: { Accept: "*/*" } }); } catch (e) { r = null; }
    if (r && r.ok) return r;
    if (r && r.status !== 404 && r.status !== 429 && r.status < 500) return r;
    await new Promise(res => setTimeout(res, 500 * (i + 1)));
  }
  return r;
}
// Un link (o lo que pegó el iPhone) → { tipo, … }, siguiendo el link corto.
async function entender(texto) {
  const l = P.leerLink(texto);
  if (!l || l.tipo !== "corto") return l;
  return P.resolverCorto(l.url, async u => {
    const r = await fetch(u, { redirect: "manual" });
    return { status: r.status, location: r.headers.get("Location") };
  });
}
async function tablero(cuerpo) {
  const c = cuerpo || {};
  const l = c.link ? await entender(c.link) : P.leerLink(`${c.usuario || ""}/${c.tablero || ""}`);
  if (l && l.tipo === "pin") return [400, { error: "es-pin", mensaje: "Ese link es de un pin, no de un tablero: abre el tablero y copia su link." }];
  if (l && l.tipo === "perfil") return [400, { error: "perfil", mensaje: "Ese link es de tu perfil: abre el tablero y copia su link." }];
  if (!l || l.tipo !== "tablero") return [400, { error: "link", mensaje: "No entendí ese link. En Pinterest, abre el tablero › Compartir › Copiar link, y pégalo aquí." }];
  const r = await traer(P.urlRss(l.usuario, l.tablero));
  const xml = r && r.ok ? await r.text() : "";
  if (!/<rss[\s>]/i.test(xml)) return [404, { error: "tablero", mensaje: "No pude leer ese tablero. Revisa que sea público (los secretos no se pueden leer)." }];
  return [200, { usuario: l.usuario, tablero: l.tablero, titulo: P.tituloRss(xml), pines: P.leerRss(xml, 50) }];
}
async function pin(cuerpo) {
  const l = await entender((cuerpo || {}).link);
  if (l && l.tipo === "tablero") return [400, { error: "es-tablero", mensaje: "Ese link es de un tablero: conéctalo en Ajustes de Ropa." }];
  if (!l || l.tipo !== "pin") return [400, { error: "link", mensaje: "No entendí ese link. En Pinterest, abre el pin › Compartir › Copiar link, y pégalo aquí." }];
  const r = await traer(P.urlOembed(l.id));
  const datos = r && r.ok ? P.pinDeOembed(l.id, await r.json().catch(() => null)) : null;
  if (!datos) return [404, { error: "pin", mensaje: "No pude leer ese pin. Si es de un tablero secreto, guarda una captura y súbela." }];
  return [200, { pin: datos }];
}
// La imagen de un pin para el teléfono (que no la puede leer directo): la de
// 736 px o, si no está, una más chica. Pasa tal cual, sin guardarse.
async function imagenPin(cuerpo, h) {
  const url = String((cuerpo || {}).url || "");
  if (!P.imagenValida(url)) return null;
  for (const u of [url].concat(P.imagenesPosibles(url).filter(x => x !== url))) {
    const r = await traer(u, 2);
    if (!r || !r.ok) continue;
    const tipo = (r.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
    if (!P.TIPOS_IMAGEN.includes(tipo) || Number(r.headers.get("Content-Length") || 0) > P.MAX_IMAGEN) return null;
    return new Response(r.body, { status: 200, headers: Object.assign({}, h, { "Content-Type": tipo, "Cache-Control": "private, max-age=86400" }) });
  }
  return null;
}

export default {
  async fetch(request, env) {
    const h = L.cors(request.headers.get("Origin") || "", env.ORIGENES);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    const json = (status, cuerpo) => new Response(JSON.stringify(cuerpo), { status, headers: Object.assign({}, h, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }) });
    const ruta = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    const post = request.method === "POST";
    const leer = () => request.json().catch(() => ({}));
    try {
      const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const v = await L.verificarToken(token, await llaves(), env.FIREBASE_PROJECT, Math.floor(Date.now() / 1000), crypto.subtle);
      if (!v.ok) return json(401, { error: "sesion", mensaje: "Vuelve a iniciar sesión en Manolo." });
      const dueno = L.permitido(v.uid, env.USUARIOS);
      if (ruta === "/quien") return json(200, Object.assign({ permitido: dueno, uid: v.uid, lista: !!(env.ANTHROPIC_API_KEY && env.MODELO), version: VERSION }, dueno && env.GASTO ? { gasto: await estadoGasto(env) } : {}));
      if (!dueno) return json(403, { error: "permiso", mensaje: "La IA de Ropa es solo para el dueño." });
      // Pinterest no usa la IA ni gasta: funciona aunque falte la clave.
      if (post && ruta === "/pinterest/tablero") return json(...(await tablero(await leer())));
      if (post && ruta === "/pinterest/pin") return json(...(await pin(await leer())));
      if (post && ruta === "/pinterest/imagen") return (await imagenPin(await leer(), h)) || json(404, { error: "imagen", mensaje: "No pude traer esa imagen de Pinterest." });
      if (!env.GASTO) return json(503, { error: "kv", mensaje: "Falta preparar el puente (la cuenta del gasto)." });
      if (ruta === "/gasto" && request.method === "GET") return json(200, { gasto: await estadoGasto(env) });
      if (ruta === "/tope" && post) {
        const t = L.topeValido((await leer()).tope);
        if (t == null) return json(400, { error: "tope", mensaje: "El tope va de 1 a 100 dólares." });
        await env.GASTO.put("tope", String(t));
        return json(200, { gasto: await estadoGasto(env) });
      }
      if (!env.ANTHROPIC_API_KEY || !env.MODELO) return json(503, { error: "falta-clave", mensaje: "Falta conectar la IA: la clave va en Cloudflare." });
      const ia = { "/describir": describir, "/inspiracion": inspiracion, "/look": look, "/estilo": estilo, "/outfits": outfits }[ruta];
      if (post && ia) return json(...(await ia(env, await leer())));
      return json(404, { error: "ruta", mensaje: "No existe." });
    } catch (e) {
      console.log("Puente:", e && e.message);
      return json(500, { error: "puente", mensaje: "El puente tuvo un problema. Intenta de nuevo." });
    }
  }
};
