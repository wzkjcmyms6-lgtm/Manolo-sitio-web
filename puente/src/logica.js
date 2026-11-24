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
// El corte y las mangas (D-154): cada grupo tiene sus cortes; zapatos y
// accesorios, ninguno. Las mangas, solo arriba y cuerpo entero.
export const CORTES = ["pegado", "regular", "suelto", "oversize", "pitillo", "recto", "ancho", "acampanado"];
export const CORTES_DE = {
  arriba: ["pegado", "regular", "suelto", "oversize"],
  abajo: ["pitillo", "pegado", "recto", "ancho", "acampanado"],
  cuerpo: ["pegado", "recto", "suelto", "acampanado"],
  abrigos: ["pegado", "regular", "suelto", "oversize"],
  zapatos: [], accesorios: []
};
export const MANGAS = ["sin", "corta", "larga"];
export const CON_MANGA = ["arriba", "cuerpo"];
const corteDe = (grupo, c) => ((CORTES_DE[grupo] || []).includes(c) ? c : "");
const mangaDe = (grupo, m) => (CON_MANGA.includes(grupo) && MANGAS.includes(m) ? m : "");

export const ESQUEMA_PRENDA = {
  type: "object",
  additionalProperties: false,
  required: ["esPrenda", "varias", "grupo", "tipo", "colores", "estampado", "tela", "corte", "manga", "estilo", "clima", "formalidad", "marca"],
  properties: {
    esPrenda: { type: "boolean", description: "true si la foto muestra ropa, calzado o un accesorio" },
    varias: { type: "boolean", description: "true si en la foto hay más de una prenda" },
    grupo: { type: "string", enum: Object.keys(GRUPOS) },
    tipo: { type: "string", description: "Qué prenda es, en español de Bolivia (usa los nombres de la lista si calzan)" },
    colores: { type: "array", items: { type: "string", enum: COLORES }, description: "De 1 a 3, el principal primero" },
    estampado: { type: "string", enum: ESTAMPADOS },
    tela: { type: "string", description: "Tu mejor suposición en una o dos palabras; vacío si no se nota" },
    corte: { type: "string", enum: ["", ...CORTES], description: "Cómo le queda, de los cortes de su grupo; vacío si no se nota, o en calzado y accesorios" },
    manga: { type: "string", enum: ["", ...MANGAS], description: "Solo arriba y cuerpo entero: sin, corta o larga; vacío en los demás o si no se ve" },
    estilo: { type: "array", items: { type: "string", enum: ESTILOS }, description: "De 1 a 3" },
    clima: { type: "array", items: { type: "string", enum: CLIMAS }, description: "Para qué clima sirve (puede ser más de uno)" },
    formalidad: { type: "integer", description: "1 muy informal (buzo) a 5 muy formal (terno)" },
    marca: { type: "string", description: "Solo si se lee en la foto; si no, vacío" }
  }
};
// Sin el nombre de la app ni de la persona: a la IA solo le llega lo necesario.
const QUIEN = "Eres el asistente de ropa de una app personal";
const TIPOS = () => Object.entries(GRUPOS).map(([g, ts]) => `- ${g}: ${ts.join(", ")}`).join("\n");
const CORTES_TEXTO = "Arriba y abrigos: pegado (ceñido al cuerpo), regular (el corte de siempre), suelto (holgado) u oversize (grande a propósito, hombros caídos). Abajo: pitillo (ajustado hasta el tobillo), pegado (ceñido, slim), recto, ancho o acampanado. Cuerpo entero: pegado, recto, suelto o acampanado.";
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
- corte: cómo le queda. ${CORTES_TEXTO} Calzado y accesorios: vacío. Vacío también si no se nota (por ejemplo, una prenda doblada).
- manga: solo arriba y cuerpo entero: sin (sin mangas o tirantes), corta o larga (tres cuartos cuenta como larga). En los demás grupos, vacío.
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
    corte: corteDe(grupo, o.corte),
    manga: mangaDe(grupo, o.manga),
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
    estampado: ESTAMPADOS.includes(o.estampado) ? o.estampado : "", tela: corto(o.tela, 40),
    corte: corteDe(o.grupo, o.corte), manga: mangaDe(o.grupo, o.manga), estilo: solo(o.estilo, ESTILOS, 3),
    clima: solo(o.clima, CLIMAS, 3), formalidad: formal(o.formalidad), marca: corto(o.marca, 40), lavar: o.lavar === true,
    // Las veces que te la pusiste (D-157, solo para el repaso del ropero).
    ...(Number.isInteger(o.veces) && o.veces >= 0 ? { veces: Math.min(o.veces, 9999) } : {})
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
const MANGA_TEXTO = { sin: "sin mangas", corta: "manga corta", larga: "manga larga" };
const lineaVista = (p, i) => `${i + 1}. ${[p.grupo, p.tipo, p.colores.map(nombreCol).join(" y "), p.estampado !== "liso" ? p.estampado : "", p.tela, p.detalle].filter(Boolean).join(" · ")}`;
// El ropero en texto, con referencias cortas → { texto, refs: Map(ref → id) }.
export function textoRopero(ropero) {
  const refs = new Map();
  const lineas = ropero.map((p, i) => {
    const ref = `p${i + 1}`;
    refs.set(ref, p.id);
    return `${ref} · ${[p.grupo, p.tipo, p.corte ? `corte ${p.corte}` : "", p.manga ? MANGA_TEXTO[p.manga] : "",
      p.colores.map(nombreCol).join(" y "), p.estampado && p.estampado !== "liso" ? p.estampado : "", p.tela,
      p.estilo.join(", "), p.clima.join(", "), p.formalidad ? `formal ${p.formalidad}` : "", p.marca,
      typeof p.veces === "number" ? (p.veces ? `puesta ${p.veces} ${p.veces === 1 ? "vez" : "veces"}` : "sin usar") : "", p.lavar ? "para lavar" : ""].filter(Boolean).join(" · ")}`;
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

// ---- Outfits del día (D-149) ----
export const ESQUEMA_OUTFITS = {
  type: "object",
  additionalProperties: false,
  required: ["outfits", "nota"],
  properties: {
    outfits: {
      type: "array",
      description: "Cinco outfits distintos, del mejor al menos bueno, solo con su ropa",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["nombre", "prendas", "porque", "capas"],
        properties: {
          nombre: { type: "string", description: "2 a 4 palabras" },
          prendas: { type: "array", items: { type: "string" }, description: "Las referencias de sus prendas (p1, p2…), tal cual" },
          porque: { type: "string", description: "Una frase corta" },
          capas: { type: "string", description: "Cómo llevar las capas ese día, si hace falta; vacío si no" }
        }
      }
    },
    nota: { type: "string", description: "Si le falta algo para este día u ocasión, una frase; vacío si no" }
  }
};
const NECESIDADES = { base: ["frio", "templado", "calor"], abrigo: ["abrigo", "liviano", ""], lluvia: ["si", "quizas", ""] };
// { ropero, clima (texto), necesidades, ocasion, estilo, recientes, gustan,
// noGustan, evitar, base } que manda Manolo → limpio, o null.
export function entradaOutfits(c) {
  const o = obj(c);
  const vistos = new Set();
  const ropero = (Array.isArray(o.ropero) ? o.ropero : []).slice(0, MAX_ROPERO).map(entradaPrenda)
    .filter(p => p && !p.lavar && !vistos.has(p.id) && vistos.add(p.id));
  if (ropero.length < 2) return null;
  const ids = new Set(ropero.map(p => p.id));
  const lista = (v, max) => [...new Set((Array.isArray(v) ? v : []).filter(id => typeof id === "string" && ids.has(id)))].slice(0, max);
  const combos = (v, max) => (Array.isArray(v) ? v : []).slice(0, max).map(x => lista(x, 8)).filter(x => x.length >= 2);
  const n = obj(o.necesidades);
  const de = (k, v) => (NECESIDADES[k].includes(v) ? v : NECESIDADES[k][NECESIDADES[k].length - 1]);
  return {
    ropero,
    clima: corto(o.clima, 400),
    necesidades: { base: NECESIDADES.base.includes(n.base) ? n.base : "templado", abrigo: de("abrigo", n.abrigo), capas: n.capas === true, lluvia: de("lluvia", n.lluvia), tormenta: n.tormenta === true, nieve: n.nieve === true, viento: n.viento === true, sol: n.sol === true },
    ocasion: corto(o.ocasion, 60) || "Casual",
    estilo: corto(o.estilo, 600),
    recientes: lista(o.recientes, 60),
    gustan: combos(o.gustan, 15),
    noGustan: combos(o.noGustan, 15),
    evitar: combos(o.evitar, 12),
    base: typeof o.base === "string" && ids.has(o.base) ? o.base : null
  };
}
// El pedido (después del ropero, que va en caché): el día, la ocasión, tu
// estilo y lo que aprendió de ti, todo con las referencias cortas.
export function textoOutfits(e, refs) {
  const refDe = new Map([...refs].map(([r, id]) => [id, r]));
  const rs = ids => ids.map(id => refDe.get(id)).filter(Boolean).join(", ");
  const n = e.necesidades;
  const pide = [`ropa de ${n.base === "frio" ? "frío" : n.base}`,
    n.abrigo === "abrigo" ? "abrigo para el frío" : n.abrigo === "liviano" ? "algo liviano encima" : "sin abrigo",
    n.capas ? "capas (mañana fresca, mediodía más cálido: lo de abajo para el mediodía y el abrigo para la mañana)" : "",
    n.tormenta ? "tormenta" : n.lluvia === "si" ? "lluvia" : n.lluvia === "quizas" ? "quizás llueva" : "",
    n.nieve ? "nieve" : "", n.viento ? "viento fuerte" : "", n.sol ? "sol muy fuerte" : ""].filter(Boolean).join("; ");
  return [
    e.clima ? `El día: ${e.clima}` : "",
    `Lo que pide: ${pide}.`,
    `Ocasión: ${e.ocasion}.`,
    e.estilo ? `Mi estilo: ${e.estilo}` : "",
    e.recientes.length ? `Me puse hace poco (mejor no repetir): ${rs(e.recientes)}.` : "",
    e.gustan.length ? `Combinaciones que me gustaron: ${e.gustan.map(x => `(${rs(x)})`).join("; ")}.` : "",
    e.noGustan.length ? `No me gustaron (no las repitas): ${e.noGustan.map(x => `(${rs(x)})`).join("; ")}.` : "",
    e.evitar.length ? `Ya vi estas (dame otras): ${e.evitar.map(x => `(${rs(x)})`).join("; ")}.` : "",
    e.base ? `Tiene que ir sí o sí: ${refDe.get(e.base)}.` : "",
    "Arma 5 outfits, del mejor al menos bueno."
  ].filter(Boolean).join("\n");
}
export function instruccionesOutfits() {
  return `${QUIEN}. Armas outfits para el día con la ropa que tiene la persona (cada prenda con su referencia: p1, p2…). Usa SOLO su ropa.

Reglas:
- Cada outfit: algo de arriba y algo de abajo (o algo de cuerpo entero), zapatos si tiene, y un abrigo si el día lo pide. Accesorios solo si suman (con sol fuerte, gorra o lentes; no de noche).
- Cinco outfits distintos entre sí (que cambien al menos dos prendas), del mejor al menos bueno: los tres primeros son los que va a ver; los otros, por si pide otra opción. Nunca inventes una referencia ni repitas una prenda.
- El clima manda: con calor, ropa liviana; con frío, abrigo; con capas, lo de abajo para el mediodía y el abrigo para la mañana; con lluvia, zapatos cerrados y, si tiene, algo que no se moje.
- La ocasión manda en qué tan formal. Respeta su estilo.
- Colores que combinen: neutros con uno o dos colores fuertes como mucho; un solo estampado.
- Evita lo que se puso hace poco si hay otra opción igual de buena. No repitas lo que no le gustó ni lo que ya vio.
- Si hay una prenda que tiene que ir, va en todos.
- nombre: 2 a 4 palabras. porque: una frase corta. capas: cómo llevarlas, si hace falta (si no, vacío). nota: si le falta algo para este día (por ejemplo, algo para la lluvia), una frase; si no, vacío.`;
}
// Lo que contestó la IA → con tus ids (lo completo lo revisa la app).
export function limpiarOutfits(x, refs) {
  const o = obj(x);
  const outfits = (Array.isArray(o.outfits) ? o.outfits : []).slice(0, 6).map(f => {
    const q = obj(f);
    const ids = [...new Set((Array.isArray(q.prendas) ? q.prendas : []).map(r => refs.get(String(r || "").trim().toLowerCase())).filter(Boolean))].slice(0, 8);
    return ids.length >= 2 ? { nombre: corto(q.nombre, 40), prendas: ids, porque: corto(q.porque, 200), capas: corto(q.capas, 160) } : null;
  }).filter(Boolean);
  return { outfits, nota: corto(o.nota, 200) };
}

// ======== El estilista (D-157, versión 5): conversar, "¿Qué opinas?" y el repaso del ropero ========
// Sin el nombre de nadie: "una app personal".
const ESTILISTA = "Eres el estilista personal de quien usa una app personal de ropa";
const deRefs = (v, refs, max) => [...new Set((Array.isArray(v) ? v : []).map(r => refs.get(String(r || "").trim().toLowerCase())).filter(Boolean))].slice(0, max);
// La ropa que manda Manolo (sin repetir), y las listas de ids que tienen que ser suyas.
function roperoDe(o) {
  const vistos = new Set();
  return (Array.isArray(o.ropero) ? o.ropero : []).slice(0, MAX_ROPERO).map(entradaPrenda).filter(p => p && !vistos.has(p.id) && vistos.add(p.id));
}
function listasDe(ropero) {
  const ids = new Set(ropero.map(p => p.id));
  const lista = (v, max) => [...new Set((Array.isArray(v) ? v : []).filter(id => typeof id === "string" && ids.has(id)))].slice(0, max);
  const combos = (v, max) => (Array.isArray(v) ? v : []).slice(0, max).map(x => lista(x, 8)).filter(x => x.length >= 2);
  return { lista, combos };
}
const memoriaDe = v => (Array.isArray(v) ? v : []).map(t => corto(t, 120)).filter(Boolean).slice(0, 30);
const refsDe = refs => { const refDe = new Map([...refs].map(([r, id]) => [id, r])); return ids => ids.map(id => refDe.get(id)).filter(Boolean).join(", "); };
const loQueSabes = m => (m.length ? `Lo que ya sabes de mí:\n${m.map(t => `- ${t}`).join("\n")}` : "");

// ---- Conversar (/charla) ----
const ESQ_OUTFIT = {
  type: "object",
  additionalProperties: false,
  required: ["nombre", "prendas", "porque", "capas"],
  properties: {
    nombre: { type: "string", description: "2 a 4 palabras" },
    prendas: { type: "array", items: { type: "string" }, description: "Las referencias de sus prendas (p1, p2…), tal cual" },
    porque: { type: "string", description: "Una frase corta" },
    capas: { type: "string", description: "Cómo llevar las capas ese día, si hace falta; vacío si no" }
  }
};
const ESQ_FALTA = {
  type: "object",
  additionalProperties: false,
  required: ["grupo", "tipo", "color", "porque"],
  properties: {
    grupo: { type: "string", enum: Object.keys(GRUPOS) },
    tipo: { type: "string", description: "Qué prenda, corta (por ejemplo \"Botines\")" },
    color: { type: "string", enum: ["", ...COLORES] },
    porque: { type: "string", description: "Una frase" }
  }
};
export const ESQUEMA_CHARLA = {
  type: "object",
  additionalProperties: false,
  required: ["respuesta", "outfits", "faltan", "recordar"],
  properties: {
    respuesta: { type: "string", description: "Lo que le contestas: de 1 a 4 frases, en español simple" },
    outfits: { type: "array", items: ESQ_OUTFIT, description: "De 0 a 3 outfits solo con su ropa, del mejor al menos bueno; vacío si no pidió outfits" },
    faltan: { type: "array", items: ESQ_FALTA, description: "De 0 a 2 prendas que no tiene y le servirían para lo que pidió" },
    recordar: { type: "array", items: { type: "string" }, description: "De 0 a 2 cosas nuevas y duraderas que dijo de sí mismo; vacío si nada" }
  }
};
export function instruccionesCharla() {
  return `${ESTILISTA}. La persona te escribe (o te dicta) lo que necesita y tú le armas outfits con SU ropa (cada prenda con su referencia: p1, p2…) o le contestas preguntas de ropa. Hablas como un buen estilista: amable, directo, en español de Bolivia, simple y corto.

Reglas:
- Usa SOLO su ropa, por referencia. Nunca inventes una referencia ni una prenda. Si pide algo que no tiene, díselo, arma lo más parecido con su ropa y, si vale la pena, ponlo en faltan.
- Nada de lo marcado "para lavar" en un outfit; si lo nombra, avísale que está para lavar.
- Cada outfit: algo de arriba y algo de abajo (o algo de cuerpo entero), zapatos si tiene y abrigo si el día lo pide. Hasta dos de arriba (por ejemplo, polera y chompa) y un abrigo encima. Accesorios solo si suman.
- Si nombra prendas ("una chompa y una chamarra encima", "con mi jean negro"), van en todos los outfits.
- El clima manda (si no dice el día, es hoy; si dice mañana, el de mañana): con frío, abrigo; con capas, lo de abajo para el mediodía y el abrigo para la mañana; con lluvia, zapatos cerrados.
- Fíjate en el corte y las mangas: proporciones que funcionen (algo suelto con algo más pegado; oversize con pitillo o recto).
- Colores que combinen: neutros con uno o dos colores fuertes; un solo estampado.
- Respeta lo que sabes de la persona y su estilo. Si hay otra opción igual de buena, evita lo que se puso hace poco y lo que no le gustó.
- Recuerdas lo que ya le armaste (cada outfit de antes va con su número y su nombre) y lo que ya vio hoy: si te nombra uno ("la opción 2", "el de capas"), es ese; puedes cambiarle prendas como te pida. Si pide otra cosa, que sea distinta de lo que ya vio.
- Si solo pregunta algo, contesta corto y deja outfits vacío; si puedes, nombra prendas suyas.
- respuesta: de 1 a 4 frases, sin repetir lo que ya dicen los outfits. outfits: de 0 a 3, distintos entre sí, del mejor al menos bueno. nombre: 2 a 4 palabras. porque: una frase corta. capas: cómo llevarlas, si hace falta; si no, vacío.
- faltan: como mucho 2, solo si de verdad le sirven para lo que pidió.
- recordar: solo lo nuevo y duradero que diga de sí mismo, en una frase corta ("No le gusta el amarillo", "Es friolento"); si nada, vacío. No repitas lo que ya sabes.
- Si te pide algo que no es de ropa, contesta amable que solo ayudas con la ropa.`;
}
export const MAX_HISTORIAL = 10;
// { mensaje, historial [{ de: "yo" | "ia", texto, outfits [[ids]] }], ropero,
// clima, estilo, recientes, gustan, noGustan, memoria, presupuesto } → limpio, o null.
export function entradaCharla(c) {
  const o = obj(c);
  const mensaje = corto(o.mensaje, 600);
  const ropero = roperoDe(o);
  if (!mensaje || !ropero.length) return null;
  const { lista, combos } = listasDe(ropero);
  // Los outfits de antes (D-159): [ids] (versión 5) o { prendas, nombre }.
  const conNombre = (v, max) => (Array.isArray(v) ? v : []).slice(0, max * 2).map(x => {
    const q = Array.isArray(x) ? { prendas: x } : obj(x);
    const prendas = lista(q.prendas, 8);
    return prendas.length >= 2 ? { prendas, nombre: corto(q.nombre, 40) } : null;
  }).filter(Boolean).slice(0, max);
  // Los últimos 10 que sirven (los vacíos o raros no ocupan lugar).
  const historial = (Array.isArray(o.historial) ? o.historial : []).slice(-60).map(h => {
    const x = obj(h);
    const de = x.de === "ia" ? "ia" : x.de === "yo" ? "yo" : null;
    const texto = corto(x.texto, 800);
    const outfits = de === "ia" ? conNombre(x.outfits, 3) : [];
    return de && (texto || outfits.length) ? { de, texto, outfits } : null;
  }).filter(Boolean).slice(-MAX_HISTORIAL);
  return {
    mensaje, ropero, historial,
    clima: corto(o.clima, 600), estilo: corto(o.estilo, 600),
    recientes: lista(o.recientes, 60), gustan: combos(o.gustan, 15), noGustan: combos(o.noGustan, 15),
    // Lo que ya vio hoy (en Outfits y en otras conversaciones; D-159).
    hoy: conNombre(o.hoy, 9),
    memoria: memoriaDe(o.memoria), presupuesto: corto(o.presupuesto, 160)
  };
}
// Lo que va después de la ropa: el contexto del día, cada mensaje de antes (uno
// por bloque, para que queden en caché) y el mensaje nuevo.
export function bloquesCharla(e, refs) {
  const rs = refsDe(refs);
  const hoy = e.hoy || [];
  const contexto = [
    e.clima ? `El clima: ${e.clima}` : "Sin el clima de hoy.",
    e.estilo ? `Mi estilo (de mis inspiraciones): ${e.estilo}` : "",
    loQueSabes(e.memoria),
    e.recientes.length ? `Me puse hace poco: ${rs(e.recientes)}.` : "",
    hoy.length ? `Hoy ya vi estas opciones (en Outfits o en otra conversación contigo): ${hoy.map(o => `${o.nombre ? `«${o.nombre}» ` : ""}(${rs(o.prendas)})`).join("; ")}.` : "",
    e.gustan.length ? `Combinaciones que me gustaron: ${e.gustan.map(x => `(${rs(x)})`).join("; ")}.` : "",
    e.noGustan.length ? `No me gustaron: ${e.noGustan.map(x => `(${rs(x)})`).join("; ")}.` : "",
    e.presupuesto ? `Mi presupuesto de ropa: ${e.presupuesto}` : ""
  ].filter(Boolean).join("\n");
  // Cada outfit de antes, con su número y su nombre (para "la opción 2").
  const opcion = (o, i) => `opción ${i + 1}${o.nombre ? ` «${o.nombre}»` : ""}: ${rs(o.prendas)}`;
  const turnos = e.historial.map(h => (h.de === "yo" ? `Yo: ${h.texto}`
    : `Tú: ${h.texto}${h.outfits.length ? ` (outfits que me armaste: ${h.outfits.map(opcion).join("; ")})` : ""}`));
  return { contexto, turnos, mensaje: `${turnos.length ? "Ahora te digo" : "Te digo"}: ${e.mensaje}` };
}
const outfitsDe = (v, refs, max, sin) => (Array.isArray(v) ? v : []).slice(0, max * 2).map(f => {
  const q = obj(f);
  const ids = deRefs(q.prendas, refs, 8);
  return ids.length >= 2 && !ids.some(id => sin.has(id)) ? { nombre: corto(q.nombre, 40), prendas: ids, porque: corto(q.porque, 200), capas: corto(q.capas, 160) } : null;
}).filter(Boolean).slice(0, max);
const faltanDe = v => (Array.isArray(v) ? v : []).slice(0, 6).map(f => {
  const q = obj(f);
  const tipo = corto(q.tipo, 40);
  return GRUPOS[q.grupo] && tipo ? { grupo: q.grupo, tipo, color: COLORES.includes(q.color) ? q.color : "", porque: corto(q.porque, 200) } : null;
}).filter(Boolean).slice(0, 2);
// Lo que contestó la IA → con tus ids, sin lo que está para lavar.
export function limpiarCharla(x, refs, e) {
  const o = obj(x);
  const lavar = new Set(e.ropero.filter(p => p.lavar).map(p => p.id));
  const outfits = outfitsDe(o.outfits, refs, 3, lavar);
  const recordar = (Array.isArray(o.recordar) ? o.recordar : []).map(t => corto(t, 120)).filter(Boolean).slice(0, 2);
  const respuesta = corto(o.respuesta, 900) || (outfits.length ? "" : "No te entendí bien: ¿me lo dices de otra forma?");
  return { respuesta, outfits, faltan: faltanDe(o.faltan), recordar };
}

// ---- "¿Qué opinas?" de un outfit (/opinar) ----
export const VEREDICTOS = ["muy-bien", "bien", "cambiaria"];
export const ESQUEMA_OPINAR = {
  type: "object",
  additionalProperties: false,
  required: ["veredicto", "funciona", "cambios", "consejo"],
  properties: {
    veredicto: { type: "string", enum: VEREDICTOS },
    funciona: { type: "string", description: "Qué funciona, en una o dos frases" },
    cambios: {
      type: "array",
      description: "De 0 a 2 cambios con su ropa: la prenda del outfit que sale y una suya, de la misma parte, que entra",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sale", "entra", "porque"],
        properties: {
          sale: { type: "string", description: "Referencia de una prenda del outfit" },
          entra: { type: "string", description: "Referencia de una prenda suya que no está en el outfit" },
          porque: { type: "string", description: "Una frase" }
        }
      }
    },
    consejo: { type: "string", description: "Un consejo para llevarlo; vacío si nada" }
  }
};
export function instruccionesOpinar() {
  return `${ESTILISTA}. La persona armó un outfit con su ropa y te pregunta qué opinas. Le dices, con tu criterio de estilista, qué funciona y qué cambiarías, siempre con SU ropa (cada prenda con su referencia: p1, p2…).

Reglas:
- Sé honesto y amable. Si está bien, dilo: no cambies por cambiar.
- veredicto: "muy-bien" (no le cambiarías nada), "bien" (funciona; algún detalle) o "cambiaria" (algo no va).
- funciona: qué funciona, en una o dos frases.
- cambios: como mucho 2. Cada uno: una prenda del outfit que sale y una suya de la misma parte (arriba por arriba, zapatos por zapatos…) que entra, con por qué. Solo si mejora de verdad. Nunca algo "para lavar" ni una referencia que no existe.
- Mira el clima, la ocasión, los colores (neutros con uno o dos fuertes; un solo estampado), qué tan formal es cada prenda y las proporciones (el corte y las mangas).
- consejo: cómo llevarlo (las capas, meter la camisa, arremangar…), en una frase; vacío si nada.
- Español de Bolivia, simple y corto.`;
}
// { outfit [ids], ropero, clima, ocasion, estilo, memoria } → limpio, o null.
export function entradaOpinar(c) {
  const o = obj(c);
  const ropero = roperoDe(o);
  const { lista } = listasDe(ropero);
  const outfit = lista(o.outfit, 8);
  if (outfit.length < 2) return null;
  return { ropero, outfit, clima: corto(o.clima, 600), ocasion: corto(o.ocasion, 60), estilo: corto(o.estilo, 600), memoria: memoriaDe(o.memoria) };
}
export function textoOpinar(e, refs) {
  const rs = refsDe(refs);
  return [
    `Mi outfit: ${rs(e.outfit)}.`,
    e.ocasion ? `Para: ${e.ocasion}.` : "",
    e.clima ? `El clima: ${e.clima}` : "",
    e.estilo ? `Mi estilo (de mis inspiraciones): ${e.estilo}` : "",
    loQueSabes(e.memoria),
    "¿Qué opinas?"
  ].filter(Boolean).join("\n");
}
// Lo que contestó la IA → solo cambios posibles: sale del outfit, entra una
// tuya de la misma parte (que no está en el outfit ni para lavar).
export function limpiarOpinar(x, refs, e) {
  const o = obj(x);
  const por = new Map(e.ropero.map(p => [p.id, p]));
  const en = new Set(e.outfit), salen = new Set();
  const cambios = (Array.isArray(o.cambios) ? o.cambios : []).map(k => {
    const q = obj(k);
    const [sale] = deRefs([q.sale], refs, 1), [entra] = deRefs([q.entra], refs, 1);
    const s = por.get(sale), n = por.get(entra);
    if (!s || !n || !en.has(sale) || en.has(entra) || n.lavar || s.grupo !== n.grupo || salen.has(sale)) return null;
    salen.add(sale);
    return { sale, entra, porque: corto(q.porque, 200) };
  }).filter(Boolean).slice(0, 2);
  return { veredicto: VEREDICTOS.includes(o.veredicto) ? o.veredicto : "bien", funciona: corto(o.funciona, 400), cambios, consejo: corto(o.consejo, 200) };
}

// ---- El repaso del ropero (/opinion) ----
export const ESQUEMA_OPINION = {
  type: "object",
  additionalProperties: false,
  required: ["resumen", "comentarios", "sugerencias", "noComprar", "dejar", "colores", "consejos"],
  properties: {
    resumen: { type: "string", description: "Cómo ves su ropero: 2 o 3 frases" },
    comentarios: {
      type: "array",
      description: "Tu comentario a los datos que importan, uno por dato",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["hecho", "texto"],
        properties: { hecho: { type: "string", description: "La referencia del dato (h1, h2…)" }, texto: { type: "string", description: "Una frase: qué significa y qué harías" } }
      }
    },
    sugerencias: {
      type: "array",
      description: "De 3 a 6 prendas que sumarías, de la más útil a la menos",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["grupo", "tipo", "color", "porque", "combina"],
        properties: {
          grupo: { type: "string", enum: Object.keys(GRUPOS) },
          tipo: { type: "string", description: "Qué prenda, corta (por ejemplo \"Pantalón chino\")" },
          color: { type: "string", enum: COLORES },
          porque: { type: "string", description: "Una o dos frases" },
          combina: { type: "array", items: { type: "string" }, description: "Referencias de sus prendas con las que va (hasta 6)" }
        }
      }
    },
    noComprar: { type: "array", items: { type: "string" }, description: "De 0 a 3 cosas que ya tiene de sobra, en pocas palabras" },
    dejar: {
      type: "array",
      description: "De 0 a 3 prendas suyas que podría dejar de lado",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["prenda", "porque"],
        properties: { prenda: { type: "string", description: "Su referencia" }, porque: { type: "string", description: "Una frase" } }
      }
    },
    colores: {
      type: "object",
      additionalProperties: false,
      required: ["van", "sumar", "porque"],
      properties: {
        van: { type: "array", items: { type: "string", enum: COLORES }, description: "Los colores que le van con lo que tiene (hasta 5)" },
        sumar: { type: "array", items: { type: "string", enum: COLORES }, description: "Los que sumarías (hasta 3)" },
        porque: { type: "string", description: "Una frase" }
      }
    },
    consejos: { type: "array", items: { type: "string" }, description: "De 0 a 3 consejos prácticos de cortes, capas o el clima" }
  }
};
export function instruccionesOpinion() {
  return `${ESTILISTA}. Haces un repaso de todo su ropero y le das tu opinión de experta, con tu propio criterio. Te paso su ropa (cada prenda con su referencia: p1, p2…, y cuántas veces se la puso), los datos que contó la app (h1, h2…: son exactos, no cambies sus números ni inventes otros) y lo que se repite en sus inspiraciones de Pinterest.

Reglas:
- resumen: 2 o 3 frases, honestas y amables.
- comentarios: comenta los datos que importan, por su referencia, en una frase cada uno: qué significa para sus outfits y qué harías. No repitas el número.
- sugerencias: de 3 a 6 prendas que sumarías para que sus outfits sean mejores y más versátiles: básicos que combinan con mucho de lo suyo, lo que equilibra lo que le sobra, lo que le falta para el clima de su ciudad y para sus ocasiones. Distintas entre sí y que no tenga ya. combina: las referencias de sus prendas con las que va.
- Tu criterio primero: no sugieras algo solo porque está en sus inspiraciones; si coincide, dilo en porque.
- noComprar: lo que ya tiene de sobra, en pocas palabras.
- dejar: como mucho 3 prendas suyas que casi no combinan con lo demás o no usa; es solo un consejo.
- colores: los que le van con lo que tiene y los que sumarías (de la lista), con por qué en una frase.
- consejos: como mucho 3, prácticos: cortes y proporciones, capas, el clima (en La Paz: mañanas frías, sol fuerte al mediodía, lluvias de diciembre a marzo).
- Si tiene un presupuesto, lo más útil primero.
- Español de Bolivia, simple.`;
}
export const MAX_HECHOS = 15;
// { ropero (con veces), hechos [{ id: "h1", texto }], pines, estilo, memoria,
// presupuesto, ciudad } → limpio, o null (con menos de 3 prendas no hay repaso).
export function entradaOpinion(c) {
  const o = obj(c);
  const ropero = roperoDe(o);
  if (ropero.length < 3) return null;
  const vistos = new Set();
  const hechos = (Array.isArray(o.hechos) ? o.hechos : []).map(h => {
    const x = obj(h);
    const id = String(x.id || "");
    return /^h\d{1,2}$/.test(id) && !vistos.has(id) && vistos.add(id) && corto(x.texto, 200) ? { id, texto: corto(x.texto, 200) } : null;
  }).filter(Boolean).slice(0, MAX_HECHOS);
  return { ropero, hechos, pines: corto(o.pines, 600), estilo: corto(o.estilo, 600), memoria: memoriaDe(o.memoria), presupuesto: corto(o.presupuesto, 160), ciudad: corto(o.ciudad, 60) };
}
export function textoOpinion(e) {
  return [
    e.hechos.length ? `Los datos de mi ropero (de la app):\n${e.hechos.map(h => `${h.id}. ${h.texto}`).join("\n")}` : "",
    e.pines ? `Lo que se repite en mis inspiraciones de Pinterest: ${e.pines}` : "Todavía no tengo inspiraciones de Pinterest.",
    e.estilo ? `Mi estilo (de mis inspiraciones): ${e.estilo}` : "",
    loQueSabes(e.memoria),
    e.presupuesto ? `Mi presupuesto de ropa: ${e.presupuesto}` : "",
    e.ciudad ? `Vivo en ${e.ciudad}.` : "",
    "Dame tu opinión de mi ropero."
  ].filter(Boolean).join("\n");
}
// Lo que contestó la IA → solo lo que existe: datos de la app, tus prendas y colores de la lista.
export function limpiarOpinion(x, refs, e) {
  const o = obj(x);
  const hechos = new Set(e.hechos.map(h => h.id)), vistos = new Set();
  const comentarios = (Array.isArray(o.comentarios) ? o.comentarios : []).map(k => {
    const q = obj(k);
    const h = String(q.hecho || "").trim().toLowerCase();
    return hechos.has(h) && !vistos.has(h) && vistos.add(h) && corto(q.texto, 300) ? { hecho: h, texto: corto(q.texto, 300) } : null;
  }).filter(Boolean);
  const claves = new Set();
  const sugerencias = (Array.isArray(o.sugerencias) ? o.sugerencias : []).map(k => {
    const q = obj(k);
    const tipo = corto(q.tipo, 40);
    const k2 = `${q.grupo}|${tipo.toLowerCase()}|${q.color}`;
    if (!GRUPOS[q.grupo] || !tipo || !COLORES.includes(q.color) || claves.has(k2)) return null;
    claves.add(k2);
    return { grupo: q.grupo, tipo, color: q.color, porque: corto(q.porque, 300), combina: deRefs(q.combina, refs, 6) };
  }).filter(Boolean).slice(0, 6);
  const dejadas = new Set();
  const dejar = (Array.isArray(o.dejar) ? o.dejar : []).map(k => {
    const q = obj(k);
    const [id] = deRefs([q.prenda], refs, 1);
    return id && !dejadas.has(id) && dejadas.add(id) ? { prenda: id, porque: corto(q.porque, 200) } : null;
  }).filter(Boolean).slice(0, 3);
  const c = obj(o.colores);
  const textos = (v, n, max) => (Array.isArray(v) ? v : []).map(t => corto(t, max)).filter(Boolean).slice(0, n);
  return {
    resumen: corto(o.resumen, 600), comentarios, sugerencias, noComprar: textos(o.noComprar, 3, 120), dejar,
    colores: { van: solo(c.van, COLORES, 5), sumar: solo(c.sumar, COLORES, 3), porque: corto(c.porque, 200) },
    consejos: textos(o.consejos, 3, 240)
  };
}

