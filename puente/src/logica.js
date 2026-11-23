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
// Sin el nombre de la app ni de la persona: a la IA solo le llega lo necesario.
const QUIEN = "Eres el asistente de ropa de una app personal";
const TIPOS = () => Object.entries(GRUPOS).map(([g, ts]) => `- ${g}: ${ts.join(", ")}`).join("\n");
const FORMALIDAD = "1 muy informal (buzo, ropa de deporte), 2 informal (polera, jean), 3 intermedio (camisa casual, chino), 4 formal (camisa de vestir, saco), 5 muy formal (terno, vestido de gala)";
export function instruccionesPrenda() {
  const tipos = TIPOS();
  return `${QUIEN}. Te muestran la foto de una prenda, un par de zapatos o un accesorio de la ropa de una persona, y la describes para su ropero.

Reglas:
- Describe solo lo que se ve. No inventes la marca: ponla solo si se lee en la foto.
- grupo y tipo: el tipo en español de Bolivia. Si calza, usa uno de estos (por grupo):
${tipos}
  Si no calza ninguno, escribe el nombre común y corto (por ejemplo "Pantalón cargo").
- colores: de 1 a 3, el principal primero (el que más se ve). El fondo no cuenta.
- tela: tu mejor suposición en una o dos palabras (algodón, jean, lana, cuero, poliéster…); vacío si no se nota.
- estilo: de 1 a 3. clima: frío (abriga), templado o calor; puede ser más de uno.
- formalidad: ${FORMALIDAD}.
- varias: true si en la foto hay más de una prenda (describe la principal). esPrenda: false si la foto no muestra ropa.`;
}
const obj = x => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
const solo = (v, validos, max) => (Array.isArray(v) ? v : []).filter((y, i, a) => validos.includes(y) && a.indexOf(y) === i).slice(0, max);
const corto = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
const formal = v => { const f = Math.round(Number(v)); return f >= 1 && f <= 5 ? f : null; };
// Lo que contestó la IA → algo seguro para el formulario (listas válidas, sin repetir).
export function limpiarPrenda(x) {
  const o = obj(x);
  const grupo = GRUPOS[o.grupo] ? o.grupo : "arriba";
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
    formalidad: formal(o.formalidad),
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

// ---- Inspiración (D-148): lo que se ve en un pin o en una captura ----
const ESQ_VISTA = {
  type: "object",
  additionalProperties: false,
  required: ["grupo", "tipo", "colores", "estampado", "tela", "detalle"],
  properties: {
    grupo: { type: "string", enum: Object.keys(GRUPOS) },
    tipo: { type: "string", description: "Qué prenda es, en español de Bolivia (de la lista si calza)" },
    colores: { type: "array", items: { type: "string", enum: COLORES }, description: "De 1 a 3, el principal primero" },
    estampado: { type: "string", enum: ESTAMPADOS },
    tela: { type: "string", description: "Tu mejor suposición en una o dos palabras; vacío si no se nota" },
    detalle: { type: "string", description: "El corte o detalle que importa, en pocas palabras (largo, oversize, tiro alto); vacío si nada" }
  }
};
export const ESQUEMA_INSPIRACION = {
  type: "object",
  additionalProperties: false,
  required: ["esRopa", "resumen", "prendas", "estilo", "clima", "formalidad", "ocasion"],
  properties: {
    esRopa: { type: "boolean", description: "true si la imagen muestra ropa (un look, un outfit o una prenda)" },
    resumen: { type: "string", description: "Una frase corta: qué look es" },
    prendas: { type: "array", items: ESQ_VISTA, description: "Cada prenda, calzado o accesorio que se ve, de arriba abajo; como máximo 8" },
    estilo: { type: "array", items: { type: "string", enum: ESTILOS }, description: "De 1 a 3" },
    clima: { type: "array", items: { type: "string", enum: CLIMAS }, description: "Para qué clima sirve (puede ser más de uno)" },
    formalidad: { type: "integer", description: "1 muy informal (buzo) a 5 muy formal (terno)" },
    ocasion: { type: "string", description: "Para qué ocasión sirve, en pocas palabras" }
  }
};
export function instruccionesInspiracion() {
  return `${QUIEN}. Te muestran una imagen de inspiración (un pin de Pinterest o una captura): un look, un outfit armado o una prenda. Dices qué prendas se ven, para que la persona arme algo parecido con su propia ropa.

Reglas:
- Describe solo la ropa, el calzado y los accesorios. No describas a la persona (ni su cuerpo ni su cara).
- prendas: cada prenda que se ve, de arriba abajo (al final los zapatos y los accesorios), como máximo 8. Si hay varios looks, describe el principal.
- grupo y tipo: el tipo en español de Bolivia. Si calza, usa uno de estos (por grupo):
${TIPOS()}
  Si no calza ninguno, escribe el nombre común y corto (por ejemplo "Pantalón cargo").
- colores: de 1 a 3 por prenda, el principal primero.
- detalle: lo que hace especial a esa prenda, en pocas palabras (largo, oversize, tiro alto, cuello alto); vacío si nada.
- resumen: una frase corta que diga qué look es (por ejemplo "Casual de invierno: abrigo camel largo con jean recto").
- estilo: de 1 a 3. clima: frío (abriga), templado o calor; puede ser más de uno.
- formalidad: ${FORMALIDAD}.
- ocasion: para qué sirve, en pocas palabras ("oficina", "salida de noche", "fin de semana").
- esRopa: false si la imagen no muestra ropa; entonces prendas va vacío.`;
}
function limpiarVista(p) {
  const o = obj(p);
  if (!GRUPOS[o.grupo]) return null;
  return {
    grupo: o.grupo,
    tipo: corto(o.tipo, 40) || GRUPOS[o.grupo][0],
    colores: solo(o.colores, COLORES, 3),
    estampado: ESTAMPADOS.includes(o.estampado) ? o.estampado : "liso",
    tela: corto(o.tela, 40),
    detalle: corto(o.detalle, 60)
  };
}
// Lo que contestó la IA (o lo que manda Manolo de un pin) → limpio.
export function limpiarInspiracion(x) {
  const o = obj(x);
  const prendas = o.esRopa === false ? [] : (Array.isArray(o.prendas) ? o.prendas : []).map(limpiarVista).filter(Boolean).slice(0, 8);
  return {
    esRopa: o.esRopa !== false,
    resumen: corto(o.resumen, 160),
    prendas,
    estilo: solo(o.estilo, ESTILOS, 3),
    clima: solo(o.clima, CLIMAS, 3),
    formalidad: formal(o.formalidad),
    ocasion: corto(o.ocasion, 60)
  };
}

// ---- "Armar este look con mi ropa" (D-148) ----
// Manolo manda lo que se ve en el pin y su ropero (sin notas, talla ni precio);
// la IA solo ve referencias cortas (p1, p2…) y el puente las vuelve a los ids.
export const PARECIDOS = ["igual", "parecida", "reemplazo"];
export const ESQUEMA_LOOK = {
  type: "object",
  additionalProperties: false,
  required: ["prendas", "faltan", "consejo"],
  properties: {
    prendas: {
      type: "array",
      description: "Por cada prenda del look que se puede cubrir con su ropa, la suya",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["pin", "ref", "parecido", "porque"],
        properties: {
          pin: { type: "integer", description: "El número de la prenda del look (1, 2, 3…)" },
          ref: { type: "string", description: "La referencia de su prenda (p1, p2…), tal cual" },
          parecido: { type: "string", enum: PARECIDOS },
          porque: { type: "string", description: "Una frase corta" }
        }
      }
    },
    faltan: {
      type: "array",
      description: "Las prendas del look que no se pueden cubrir con su ropa",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["pin", "grupo", "tipo", "colores", "porque"],
        properties: {
          pin: { type: "integer", description: "El número de la prenda del look" },
          grupo: { type: "string", enum: Object.keys(GRUPOS) },
          tipo: { type: "string" },
          colores: { type: "array", items: { type: "string", enum: COLORES } },
          porque: { type: "string", description: "Una frase corta" }
        }
      }
    },
    consejo: { type: "string", description: "Una frase para llevar el look con su ropa" }
  }
};
const ID = /^[A-Za-z0-9_-]{1,64}$/;
function entradaPrenda(p) {
  const o = obj(p);
  if (!ID.test(String(o.id || "")) || !GRUPOS[o.grupo]) return null;
  return {
    id: o.id, grupo: o.grupo, tipo: corto(o.tipo, 40) || GRUPOS[o.grupo][0], colores: solo(o.colores, COLORES, 3),
    estampado: ESTAMPADOS.includes(o.estampado) ? o.estampado : "", tela: corto(o.tela, 40), estilo: solo(o.estilo, ESTILOS, 3),
    clima: solo(o.clima, CLIMAS, 3), formalidad: formal(o.formalidad), marca: corto(o.marca, 40), lavar: o.lavar === true
  };
}
// { pin, ropero } que manda Manolo → limpio, o null si no alcanza.
export const MAX_ROPERO = 600;
export function entradaLook(c) {
  const o = obj(c);
  const pin = limpiarInspiracion(o.pin);
  if (!pin.prendas.length) return null;
  const vistos = new Set();
  const ropero = (Array.isArray(o.ropero) ? o.ropero : []).slice(0, MAX_ROPERO).map(entradaPrenda)
    .filter(p => p && !vistos.has(p.id) && vistos.add(p.id));
  return ropero.length ? { pin, ropero } : null;
}
const nombreCol = id => id.replace(/-/g, " ");
const lineaVista = (p, i) => `${i + 1}. ${[p.grupo, p.tipo, p.colores.map(nombreCol).join(" y "), p.estampado !== "liso" ? p.estampado : "", p.tela, p.detalle].filter(Boolean).join(" · ")}`;
// El ropero en texto, con referencias cortas → { texto, refs: Map(ref → id) }.
export function textoRopero(ropero) {
  const refs = new Map();
  const lineas = ropero.map((p, i) => {
    const ref = `p${i + 1}`;
    refs.set(ref, p.id);
    return `${ref} · ${[p.grupo, p.tipo, p.colores.map(nombreCol).join(" y "), p.estampado && p.estampado !== "liso" ? p.estampado : "", p.tela,
      p.estilo.join(", "), p.clima.join(", "), p.formalidad ? `formal ${p.formalidad}` : "", p.marca, p.lavar ? "para lavar" : ""].filter(Boolean).join(" · ")}`;
  });
  return { texto: `La ropa que tengo (cada prenda con su referencia):\n${lineas.join("\n")}`, refs };
}
export function textoLook(pin) {
  const datos = [pin.estilo.length ? `Estilo: ${pin.estilo.join(", ")}.` : "", pin.clima.length ? `Clima: ${pin.clima.join(", ")}.` : "",
    pin.formalidad ? `Formalidad: ${pin.formalidad} de 5.` : "", pin.ocasion ? `Ocasión: ${pin.ocasion}.` : ""].filter(Boolean).join(" ");
  return `El look de inspiración${pin.resumen ? `: ${pin.resumen}` : ""}.${datos ? `\n${datos}` : ""}\nSus prendas:\n${pin.prendas.map(lineaVista).join("\n")}\n\nArma este look con mi ropa.`;
}
export function instruccionesLook() {
  return `${QUIEN}. Te paso un look de inspiración (sus prendas numeradas) y la ropa que tiene la persona (cada prenda con su referencia: p1, p2…). Arma el look más parecido usando SOLO su ropa.

Reglas:
- Para cada prenda del look, elige como máximo una prenda suya, por su referencia. Nunca inventes una referencia ni uses la misma prenda dos veces.
- parecido: "igual" si es prácticamente la misma prenda; "parecida" si cumple el mismo papel con otro detalle o tono; "reemplazo" si no tiene algo así y eliges lo que mejor la reemplaza (dilo en porque).
- Si no tiene nada que sirva para esa prenda, ponla en faltan, con el tipo y el color que harían falta.
- Los accesorios del look son opcionales: si no tiene, ponlos en faltan solo si son clave.
- Que todo combine entre sí: colores, formalidad y clima parecidos. Prefiere la ropa limpia: lo marcado "para lavar" solo si no hay otra igual de buena.
- porque: una frase corta en español. consejo: una frase para llevarlo (cómo combinarlo o qué cuidar).`;
}
// Lo que contestó la IA → solo prendas que existen, sin repetir.
// refs: Map(ref → id); n: cuántas prendas tiene el look.
export function limpiarLook(x, refs, n) {
  const o = obj(x);
  const usados = new Set(), cubiertas = new Set();
  const enRango = i => i >= 1 && i <= n;
  const prendas = [];
  (Array.isArray(o.prendas) ? o.prendas : []).forEach(p => {
    const q = obj(p);
    const i = Math.round(Number(q.pin));
    const id = refs.get(String(q.ref || "").trim().toLowerCase());
    if (!enRango(i) || !id || usados.has(id) || cubiertas.has(i)) return;
    usados.add(id); cubiertas.add(i);
    prendas.push({ pin: i, id, parecido: PARECIDOS.includes(q.parecido) ? q.parecido : "parecida", porque: corto(q.porque, 140) });
  });
  const faltan = [];
  (Array.isArray(o.faltan) ? o.faltan : []).forEach(f => {
    const q = obj(f);
    const i = Math.round(Number(q.pin));
    if (!enRango(i) || cubiertas.has(i) || !GRUPOS[q.grupo]) return;
    cubiertas.add(i);
    faltan.push({ pin: i, grupo: q.grupo, tipo: corto(q.tipo, 40) || GRUPOS[q.grupo][0], colores: solo(q.colores, COLORES, 3), porque: corto(q.porque, 140) });
  });
  const orden = (a, b) => a.pin - b.pin;
  return { prendas: prendas.sort(orden), faltan: faltan.sort(orden), consejo: corto(o.consejo, 220) };
}

// ---- "Mi estilo" (D-148): lo que se repite en tus pines ----
export const ESQUEMA_ESTILO = {
  type: "object",
  additionalProperties: false,
  required: ["resumen", "claves", "colores", "prendas"],
  properties: {
    resumen: { type: "string", description: "2 o 3 frases, hablándole de tú, sobre el estilo que se repite en sus pines" },
    claves: { type: "array", items: { type: "string" }, description: "De 3 a 6 rasgos de su estilo, cortos" },
    colores: { type: "array", items: { type: "string", enum: COLORES }, description: "Los colores que más se repiten, como máximo 5" },
    prendas: { type: "array", items: { type: "string" }, description: "Las prendas clave que se repiten, como máximo 6, cortas" }
  }
};
export const MIN_PINES_ESTILO = 3, MAX_PINES_ESTILO = 80;
export function entradaEstilo(c) {
  const pines = (Array.isArray(obj(c).pines) ? obj(c).pines : []).slice(0, MAX_PINES_ESTILO).map(limpiarInspiracion).filter(p => p.esRopa && p.prendas.length);
  return pines.length >= MIN_PINES_ESTILO ? { pines } : null;
}
export function textoEstilo(pines) {
  return `Mis pines de inspiración (lo que se ve en cada uno):\n${pines.map((p, i) => `${i + 1}. ${p.resumen || "Un look"}${p.estilo.length ? ` (${p.estilo.join(", ")})` : ""}: ${p.prendas.map(x => [x.tipo, x.colores.map(nombreCol).join(" y "), x.detalle].filter(Boolean).join(" ")).join("; ")}.`).join("\n")}\n\n¿Cuál es mi estilo?`;
}
export function instruccionesEstilo() {
  return `${QUIEN}. Te paso lo que se ve en los pines de inspiración que guardó una persona. Dile cuál es su estilo: lo que se repite.

Reglas:
- resumen: 2 o 3 frases, hablándole de tú, en español simple y cálido. Concreto: colores, cortes y prendas que se repiten. Sin exagerar ni adular.
- claves: de 3 a 6 rasgos cortos (por ejemplo "colores neutros", "capas", "cortes rectos").
- colores: los que más se repiten, como máximo 5. prendas: las prendas clave que se repiten, como máximo 6, en pocas palabras.
- Habla solo de la ropa, nunca de la persona.`;
}
export function limpiarEstilo(x) {
  const o = obj(x);
  const textos = (v, n, max) => (Array.isArray(v) ? v : []).map(t => corto(t, max)).filter((t, i, a) => t && a.indexOf(t) === i).slice(0, n);
  return { resumen: corto(o.resumen, 600), claves: textos(o.claves, 6, 50), colores: solo(o.colores, COLORES, 5), prendas: textos(o.prendas, 6, 50) };
}
