// ---------- Puente de Manolo (Cloudflare Worker, D-147) ----------
// Entre Manolo (sitio estático) y la IA de Claude: guarda la clave de la IA
// (secreto ANTHROPIC_API_KEY en Cloudflare, nunca en la app ni en el repo),
// deja pasar solo al dueño (token de Firebase revisado + USUARIOS), suma el
// gasto del mes en KV (GASTO) y corta al llegar al tope. No guarda fotos ni
// textos. Configuración en Cloudflare: secretos ANTHROPIC_API_KEY, MODELO y
// USUARIOS; variables FIREBASE_PROJECT y ORIGENES (wrangler.toml).
// Rutas: GET /quien, GET /gasto, POST /tope, POST /describir.
// Lógica sin red (y sus pruebas): ./logica.js, tests/puente-logica.test.js.
import Anthropic from "@anthropic-ai/sdk";
import * as L from "./logica.js";

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
function errorIA(e) {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return [503, "clave", "La clave de la IA no sirve: revísala en Cloudflare."];
  if (e instanceof Anthropic.RateLimitError) return [429, "ocupada", "La IA está ocupada. Intenta de nuevo en un rato."];
  if (e instanceof Anthropic.BadRequestError && /credit|balance|billing/i.test(e.message || "")) return [402, "credito", "Se acabó el crédito de la IA: recárgalo en platform.claude.com."];
  if (e instanceof Anthropic.APIConnectionError) return [503, "conexion", "No pude hablar con la IA. Intenta de nuevo."];
  if (e instanceof Anthropic.APIError && e.status >= 500) return [503, "caida", "La IA no está respondiendo. Intenta de nuevo en un rato."];
  return [500, "ia", "La IA no pudo con esta foto. Intenta de nuevo."];
}

async function describir(env, cuerpo) {
  const foto = L.fotoValida(cuerpo);
  if (!foto) return [400, { error: "foto", mensaje: "Esa foto no se pudo leer." }];
  const g = await estadoGasto(env);
  if (g.usd >= g.tope) return [402, { error: "tope", mensaje: `Llegaste al tope del mes (US$ ${g.tope}). La IA vuelve el mes que viene, o sube el tope en Ajustes de Ropa.`, gasto: g }];
  const ia = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  let r;
  try {
    r = await ia.beta.messages.create({
      model: env.MODELO,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: L.instruccionesPrenda(),
      output_config: { effort: "low", format: { type: "json_schema", schema: L.ESQUEMA_PRENDA } },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: foto.tipo, data: foto.imagen } },
          { type: "text", text: "Describe esta prenda para mi ropero." }
        ]
      }]
    });
  } catch (e) {
    const [status, error, mensaje] = errorIA(e);
    console.log("IA:", e && e.status, e && e.message);
    return [status, { error, mensaje }];
  }
  const gasto = await sumarGasto(env, L.costo(r.usage));
  if (r.stop_reason === "refusal") return [422, { error: "rechazo", mensaje: "La IA no quiso describir esta foto.", gasto }];
  const bloque = (r.content || []).find(b => b.type === "text");
  let datos = null;
  try { datos = JSON.parse(bloque ? bloque.text : ""); } catch (e) { datos = null; }
  if (!datos) return [502, { error: "respuesta", mensaje: "La IA contestó algo raro. Intenta de nuevo.", gasto }];
  return [200, { prenda: L.limpiarPrenda(datos), gasto }];
}

export default {
  async fetch(request, env) {
    const h = L.cors(request.headers.get("Origin") || "", env.ORIGENES);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    const json = (status, cuerpo) => new Response(JSON.stringify(cuerpo), { status, headers: Object.assign({}, h, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }) });
    const ruta = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    try {
      const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const v = await L.verificarToken(token, await llaves(), env.FIREBASE_PROJECT, Math.floor(Date.now() / 1000), crypto.subtle);
      if (!v.ok) return json(401, { error: "sesion", mensaje: "Vuelve a iniciar sesión en Manolo." });
      const dueno = L.permitido(v.uid, env.USUARIOS);
      if (ruta === "/quien") return json(200, Object.assign({ permitido: dueno, uid: v.uid, lista: !!(env.ANTHROPIC_API_KEY && env.MODELO) }, dueno && env.GASTO ? { gasto: await estadoGasto(env) } : {}));
      if (!dueno) return json(403, { error: "permiso", mensaje: "La IA de Ropa es solo para el dueño." });
      if (!env.GASTO) return json(503, { error: "kv", mensaje: "Falta preparar el puente (la cuenta del gasto)." });
      if (ruta === "/gasto" && request.method === "GET") return json(200, { gasto: await estadoGasto(env) });
      if (ruta === "/tope" && request.method === "POST") {
        const t = L.topeValido((await request.json().catch(() => ({}))).tope);
        if (t == null) return json(400, { error: "tope", mensaje: "El tope va de 1 a 100 dólares." });
        await env.GASTO.put("tope", String(t));
        return json(200, { gasto: await estadoGasto(env) });
      }
      if (!env.ANTHROPIC_API_KEY || !env.MODELO) return json(503, { error: "falta-clave", mensaje: "Falta conectar la IA: la clave va en Cloudflare." });
      if (ruta === "/describir" && request.method === "POST") {
        const [status, cuerpo] = await describir(env, await request.json().catch(() => ({})));
        return json(status, cuerpo);
      }
      return json(404, { error: "ruta", mensaje: "No existe." });
    } catch (e) {
      console.log("Puente:", e && e.message);
      return json(500, { error: "puente", mensaje: "El puente tuvo un problema. Intenta de nuevo." });
    }
  }
};
