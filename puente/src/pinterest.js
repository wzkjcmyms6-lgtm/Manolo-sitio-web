// ---------- Puente de Manolo: Pinterest, sin red (D-148) ----------
// Entender un link de Pinterest (un pin, un tablero o el link corto pin.it que
// copia la app del iPhone), leer el RSS de un tablero público (los últimos
// pines con su título, link e imagen) y revisar las imágenes que el puente
// trae para el teléfono (solo de i.pinimg.com). Pinterest no da permiso CORS:
// por eso lo lee el puente. Solo lectura: nunca publica nada.
// Pruebas: tests/puente-pinterest.test.js.

// Hosts de Pinterest: pinterest.com, www.pinterest.com, es.pinterest.com,
// pinterest.es, pinterest.com.mx, pinterest.co.uk… y el link corto pin.it.
export const esHostPinterest = h => /^(?:[a-z0-9-]{1,20}\.)?pinterest\.[a-z]{2,3}(?:\.[a-z]{2})?$/.test(String(h || "").toLowerCase());
const USUARIO = /^[A-Za-z0-9_.-]{2,40}$/;
// Lo que no es un usuario (primer tramo del link) ni un tablero (el segundo).
const NO_USUARIO = new Set(["pin", "search", "ideas", "today", "explore", "business", "settings", "login", "signup", "categories", "topics", "shopping", "news_hub", "videos", "board", "homefeed", "me", "notifications", "url_shortener", "oembed.json", "_", "resource", "discover"]);
const NO_TABLERO = new Set(["pins", "boards", "followers", "following", "feed.rss", "more_ideas", "activity", "likes", "tried", "collages"]);
const tableroOk = t => !!t && t.length <= 100 && !/[\s/?#]/.test(t) && !t.startsWith("_") && !NO_TABLERO.has(t.toLowerCase()) && !/\.rss$/i.test(t);

function tramos(pathname) {
  try { return pathname.split("/").filter(Boolean).map(s => decodeURIComponent(s)); } catch (e) { return null; }
}
// Un texto (puede traer más palabras, como lo que pega el iPhone: "Mira este
// pin https://pin.it/2Ab3") → { tipo: "pin", id } | { tipo: "tablero",
// usuario, tablero } | { tipo: "perfil", usuario } | { tipo: "corto", url } | null.
export function leerLink(texto) {
  const s = String(texto == null ? "" : texto).trim();
  if (!s || s.length > 2000) return null;
  const m = /https?:\/\/[^\s<>"']+/i.exec(s);
  if (!m) {
    // "usuario/tablero" escrito a mano.
    const a = /^@?([A-Za-z0-9_.-]{2,40})\/([^/\s?#]{1,100})\/?$/.exec(s);
    return a && !NO_USUARIO.has(a[1].toLowerCase()) && tableroOk(a[2]) ? { tipo: "tablero", usuario: a[1], tablero: a[2] } : null;
  }
  let u;
  try { u = new URL(m[0].replace(/[).,;!]+$/, "")); } catch (e) { return null; }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (host === "pin.it") return /^\/[A-Za-z0-9]{3,20}\/?$/.test(u.pathname) ? { tipo: "corto", url: `https://pin.it/${u.pathname.replace(/\//g, "")}` } : null;
  if (!esHostPinterest(host)) return null;
  const p = tramos(u.pathname);
  if (!p || !p.length) return null;
  // El código del pin: un número o, desde 2026-11, un código de letras (en el
  // RSS de los tableros: 55 caracteres, como "e1_AfqPS…"); hasta 100 (D-168).
  if (p[0] === "pin") return p[1] && /^[A-Za-z0-9_-]{1,100}$/.test(p[1]) ? { tipo: "pin", id: p[1] } : null;
  if (p[0] === "url_shortener") return p[1] && /^[A-Za-z0-9]{3,20}$/.test(p[1]) ? { tipo: "corto", url: `https://api.pinterest.com/url_shortener/${p[1]}/redirect/` } : null;
  if (!USUARIO.test(p[0]) || NO_USUARIO.has(p[0].toLowerCase())) return null;
  if (p.length === 1) return { tipo: "perfil", usuario: p[0] };
  return tableroOk(p[1]) ? { tipo: "tablero", usuario: p[0], tablero: p[1] } : null;
}
export const urlPin = id => `https://www.pinterest.com/pin/${encodeURIComponent(id)}/`;
export const urlRss = (usuario, tablero) => `https://www.pinterest.com/${encodeURIComponent(usuario)}/${encodeURIComponent(tablero)}.rss`;
export const urlOembed = id => `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(urlPin(id))}`;

// El link corto (pin.it → api.pinterest.com/url_shortener/… → el pin o el
// tablero): se siguen las redirecciones sin bajar las páginas, hasta 5.
// pedir(url) → { status, location } (en el Worker: fetch con redirect "manual").
export async function resolverCorto(url, pedir) {
  let actual = url;
  for (let i = 0; i < 5; i++) {
    const r = await pedir(actual);
    if (!r || !(r.status >= 300 && r.status < 400) || !r.location) return null;
    let siguiente;
    try { siguiente = new URL(r.location, actual).href; } catch (e) { return null; }
    const l = leerLink(siguiente);
    if (!l) return null;                  // fuera de Pinterest: no se sigue
    if (l.tipo !== "corto") return l;
    actual = l.url;
  }
  return null;
}

// ---- Las imágenes (i.pinimg.com) ----
const IMG = /^https:\/\/i\.pinimg\.com\/(\d{2,4}x|originals)\/((?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(?:jpe?g|png|webp|gif))$/i;
// Una imagen de pin → la misma en 736 px (la original da 403; 736 alcanza para la IA).
export function imagenGrande(url) {
  const m = IMG.exec(String(url || "").trim());
  return m ? `https://i.pinimg.com/736x/${m[2]}` : null;
}
// Lo que el puente acepta traer para el teléfono: solo imágenes de i.pinimg.com.
export const imagenValida = url => IMG.test(String(url || "").trim());
// Si la de 736 no está, la de 474 o la de 236.
export const imagenesPosibles = url => {
  const m = IMG.exec(String(url || "").trim());
  return m ? ["736x", "474x", "236x"].map(t => `https://i.pinimg.com/${t}/${m[2]}`) : [];
};
export const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_IMAGEN = 6e6;

// ---- El RSS de un tablero ----
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decodificar(s) {
  return String(s == null ? "" : s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (t, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return Object.prototype.hasOwnProperty.call(ENT, e.toLowerCase()) ? ENT[e.toLowerCase()] : t;
  });
}
const sinCdata = s => String(s).replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");
const corto = (s, max) => String(s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
// xml → [{ id, url, titulo, img, fecha }] (sin repetir, como máximo `max`).
export function leerRss(xml, max) {
  const tope = max || 50;
  const items = String(xml || "").split(/<item[\s>]/i).slice(1);
  const out = [], vistos = new Set();
  for (const it of items) {
    if (out.length >= tope) break;
    const tag = n => { const m = new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, "i").exec(it); return m ? sinCdata(m[1]) : ""; };
    const l = leerLink(decodificar(tag("link")).trim()) || leerLink(decodificar(tag("guid")).trim());
    if (!l || l.tipo !== "pin" || vistos.has(l.id)) continue;
    const desc = decodificar(tag("description"));
    const src = (/<img[^>]+src\s*=\s*["']([^"']+)["']/i.exec(desc) || [])[1];
    const img = imagenGrande(decodificar(src || ""));
    if (!img) continue;
    vistos.add(l.id);
    const fecha = Date.parse(decodificar(tag("pubDate")).trim());
    out.push({ id: l.id, url: urlPin(l.id), titulo: corto(decodificar(tag("title")), 120), img, fecha: isFinite(fecha) ? fecha : 0 });
  }
  return out;
}
// Lo que devuelve oEmbed de un pin → { id, url, titulo, img } o null.
export function pinDeOembed(id, j) {
  const o = j && typeof j === "object" ? j : {};
  const img = imagenGrande(o.thumbnail_url);
  return img ? { id, url: urlPin(id), titulo: corto(decodificar(o.title || ""), 120), img } : null;
}
// El nombre del tablero (el título del canal del RSS).
export function tituloRss(xml) {
  const m = /<channel[\s>][\s\S]*?<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i.exec(String(xml || ""));
  return m ? corto(decodificar(sinCdata(m[1])), 80) : "";
}
