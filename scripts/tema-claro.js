// Modo claro (D-126): genera css/tema-claro.css a partir de los estilos de
// siempre, sin tocarlos (el modo oscuro queda idéntico).
//
// Cómo: lee los .css que carga index.html, busca cada color escrito a mano
// y, según para qué se usa (texto, fondo, borde, sombra, dibujo), calcula su
// versión clara: los fondos oscuros pasan a los tonos claros de la paleta,
// los textos claros a tinta oscura, los colores de texto pastel se
// oscurecen hasta leerse bien sobre blanco (contraste 4,5:1), las sombras se
// suavizan. Cada regla cambiada se repite con el prefijo
// html[data-modo="claro"] (lo pone js/tema.js). Al final se agrega lo escrito
// a mano en scripts/tema-claro-manual.css.
//
//   npm run tema          → vuelve a escribir css/tema-claro.css
//   tests/tema-claro.test.js falla si el archivo no está al día.
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const SALIDA = "css/tema-claro.css";
const MANUAL = "scripts/tema-claro-manual.css";
const PREFIJO = 'html[data-modo="claro"]';
const SIN_COLORES = new Set(["css/fuentes.css", "css/viewport.css", SALIDA]);

// ---- Paleta clara (las mismas variables de :root en css/style.css) ----
const VARIABLES = `${PREFIJO} {
  color-scheme: light;
  --bg: #f4f2ec;
  --bg-soft: #faf9f6;
  --surface: #ffffff;
  --surface-raised: #f1eee7;
  --ink: #1c1b18;
  --muted: #6b675e;
  --accent-1: #b93c0b;
  --accent-2: #a35200;
  --accent-grad: linear-gradient(135deg, #ff7a30 0%, #ffb84d 100%);
  --gold: #8a5a12;
  --border: #e2ddd2;
  --danger: #b3311c;
  --musculo-1: #f6c177;
  --musculo-2: #ff9a3c;
  --musculo-3: #ff5a1f;
  --radar-anterior: #8a867c;
  --estado-ok: #1a7340;
  --estado-ok-fondo: rgba(26, 115, 64, 0.1);
  --estado-aviso: #9a4d00;
  --estado-aviso-fondo: rgba(240, 168, 71, 0.16);
  --estado-mal: #b3311c;
  --estado-mal-fondo: rgba(226, 89, 63, 0.12);
  --sombra-flotante: 0 10px 30px rgba(60, 50, 30, 0.14);
}`;
// Fondos oscuros → tonos claros, según qué tan oscuros eran (en el modo
// oscuro, más claro = más arriba; aquí la tarjeta es blanca sobre el fondo).
const FONDOS = [
  [0.05, [244, 242, 236]],   // fondo de la página (#0a0a0a)
  [0.075, [250, 249, 246]],  // fondo suave, hojas (#111)
  [0.095, [255, 255, 255]],  // tarjetas (#161616)
  [0.13, [241, 238, 231]],   // elevado: chips, campos (#1c1c1c)
  [0.2, [233, 229, 220]],    // tocado, barras (#262624)
  [0.36, [221, 216, 204]]    // pistas, separadores (#2a2a28…#555)
];
const BORDE = [226, 221, 210];
// Variables que en el modo claro son claras: un fondo con ellas no es "de color".
const NEUTRAS = new Set(["bg", "bg-soft", "surface", "surface-raised", "border", "lib-campo", "ink", "muted"]);
// Dibujos (cuerpo, insignias): se ven igual en los dos modos.
// También la escena del personaje de Hábitos (cielo de día o de noche): en
// el modo claro queda como "isla oscura" (scripts/tema-claro-manual.css).
const DIBUJOS = /\.figura\b|\.mz\b|\.mz-|insignia|tema-muestra|\.hb-(personaje|escena|capa|pj|anillo)/;
// Fondos que oscurecen lo de atrás (al abrir una hoja): siguen oscuros, más suaves.
const VELOS = /overlay|modal|scrim|backdrop|velo/;
const TRAZO = [214, 208, 196];
const TINTA = { h: 45, s: 0.08 };   // tono de la tinta (cálido, como el oscuro)

// ---- Colores ----
const NOMBRES = { white: [255, 255, 255], black: [0, 0, 0] };
const RE_COLOR = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b|rgba?\(\s*[\d.]+%?\s*[, ]\s*[\d.]+%?\s*[, ]\s*[\d.]+%?\s*(?:[,/]\s*[\d.]+%?\s*)?\)|(?<![-\w])(?:white|black)(?![-\w])/g;

function leerColor(txt) {
  const t = txt.trim().toLowerCase();
  if (NOMBRES[t]) return { r: NOMBRES[t][0], g: NOMBRES[t][1], b: NOMBRES[t][2], a: 1 };
  if (t[0] === "#") {
    let h = t.slice(1);
    if (h.length === 3 || h.length === 4) h = h.split("").map(x => x + x).join("");
    const n = parseInt(h.slice(0, 6), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: h.length === 8 ? Math.round((parseInt(h.slice(6), 16) / 255) * 1000) / 1000 : 1 };
  }
  const m = t.match(/rgba?\(([^)]*)\)/);
  if (!m) return null;
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map(x => (x.endsWith("%") ? (parseFloat(x) / 100) * 255 : parseFloat(x)));
  const a = m[1].split(/[\s,/]+/).filter(Boolean)[3];
  return { r: p[0], g: p[1], b: p[2], a: a == null ? 1 : a.endsWith("%") ? parseFloat(a) / 100 : parseFloat(a) };
}
function escribir(c) {
  const r = Math.round(c.r), g = Math.round(c.g), b = Math.round(c.b);
  if (c.a >= 1) return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
  return `rgba(${r}, ${g}, ${b}, ${Math.round(c.a * 1000) / 1000})`;
}
const canal = v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
const luminancia = c => 0.2126 * canal(c.r) + 0.7152 * canal(c.g) + 0.0722 * canal(c.b);
const contraste = (a, b) => { const x = luminancia(a), y = luminancia(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const BLANCO = { r: 255, g: 255, b: 255, a: 1 };
const REF = { r: 241, g: 238, b: 231, a: 1 };   // --surface-raised claro: el fondo más oscuro con texto
const neutro = c => (Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b)) / 255 < 0.09;

function aHsl(c) {
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}
function deHsl(h, s, l, a) {
  const f = n => {
    const k = (n + h / 30) % 12;
    const x = s * Math.min(l, 1 - l);
    return 255 * (l - x * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return { r: f(0), g: f(8), b: f(4), a: a == null ? 1 : a };
}
// Oscurece (bajando la luz, mismo tono) hasta tener el contraste pedido con blanco.
function oscurecer(c, minimo) {
  if (contraste(c, REF) >= minimo) return c;
  const x = aHsl(c);
  for (let l = x.l; l > 0; l -= 0.01) {
    const y = deHsl(x.h, x.s, l, c.a);
    if (contraste(y, REF) >= minimo) return y;
  }
  return deHsl(x.h, x.s, 0, c.a);
}
// Un gris claro de texto → un gris oscuro con la misma "distancia".
function tintaDe(c) {
  const x = aHsl(c);
  return oscurecer(deHsl(TINTA.h, TINTA.s, Math.max(0.08, Math.min(0.42, 1 - x.l)), c.a), 4.5);
}
function fondoDe(c) {
  const L = aHsl(c).l;
  const f = FONDOS.find(([max]) => L <= max);
  return f ? { r: f[1][0], g: f[1][1], b: f[1][2], a: c.a } : null;
}

// ---- Cada propiedad, a qué tipo de color corresponde ----
function tipoDe(prop) {
  const p = prop.toLowerCase();
  // Una variable con un color (--ejd-azul, --rut…) casi siempre es de texto
  // o de una barra: se oscurece igual que un texto.
  if (p.startsWith("--")) return "texto";
  if (p === "color" || p === "-webkit-text-fill-color" || p === "caret-color" || p === "text-decoration-color" || p === "text-decoration") return "texto";
  if (p === "background" || p === "background-color" || p === "background-image") return "fondo";
  if (p.startsWith("border") || p.startsWith("outline") || p === "column-rule" || p === "column-rule-color") return "borde";
  if (p === "box-shadow" || p === "text-shadow" || p === "filter") return "sombra";
  if (p === "fill" || p === "stop-color") return "relleno";
  if (p === "stroke") return "trazo";
  return null;
}

// El color nuevo (o null si queda igual). ctx.fondoFuerte: la misma regla
// pone un fondo de color (un botón naranja con texto blanco no cambia).
function transformar(tipo, c, ctx) {
  const L = luminancia(c);
  const gris = neutro(c);
  if (tipo === "texto") {
    // Una "pastilla" invertida (fondo var(--ink) con texto oscuro): en claro,
    // la tinta es oscura, así que el texto pasa a blanco.
    if (ctx && ctx.fondoTinta && gris && L < 0.2) return BLANCO;
    if (ctx && ctx.fondoFuerte) return null;
    if (gris) return L < 0.2 ? null : tintaDe(c);
    return contraste(c, REF) < 4.5 ? oscurecer(c, 4.5) : null;
  }
  if (tipo === "fondo") {
    if (!gris) {
      // Un fondo de color muy oscuro (un brillo café detrás de un título) →
      // el mismo tono, claro.
      const x = aHsl(c);
      return x.l < 0.2 ? deHsl(x.h, Math.min(x.s, 0.75), 0.92, c.a) : null;
    }
    if (L > 0.7) return c.a < 1 ? { r: 0, g: 0, b: 0, a: Math.round(c.a * 0.7 * 1000) / 1000 } : null;
    if (c.a < 1 && ctx && ctx.velo) return { r: 0, g: 0, b: 0, a: Math.round(c.a * 0.6 * 1000) / 1000 };
    return fondoDe(c);
  }
  if (tipo === "borde") {
    if (!gris) return null;
    if (L > 0.7) return c.a < 1 ? { r: 0, g: 0, b: 0, a: Math.round(Math.min(1, c.a * 1.2) * 1000) / 1000 } : null;
    return aHsl(c).l <= 0.36 ? { r: BORDE[0], g: BORDE[1], b: BORDE[2], a: c.a } : null;
  }
  if (tipo === "sombra") {
    if (!gris || L > 0.2) return null;
    const a = Math.round(Math.min(0.16, c.a * 0.35) * 1000) / 1000;
    return { r: 60, g: 50, b: 30, a };
  }
  if (tipo === "relleno") {
    if (gris) return L < 0.2 ? fondoDe(c) : tintaDe(c);
    return contraste(c, REF) < 3 ? oscurecer(c, 3) : null;
  }
  if (tipo === "trazo") {
    if (gris) return L < 0.2 ? { r: TRAZO[0], g: TRAZO[1], b: TRAZO[2], a: c.a } : tintaDe(c);
    return contraste(c, REF) < 3 ? oscurecer(c, 3) : null;
  }
  return null;
}

// ¿La regla pone un fondo de color que se queda (acento, degradado, rojo)?
// Un color que en el modo claro cambia (un café muy oscuro) no cuenta.
function fondoFuerte(decls) {
  return decls.some(d => {
    if (tipoDe(d.prop) !== "fondo") return false;
    const v = d.valor.toLowerCase();
    const vars = (v.match(/var\(--([\w-]+)/g) || []).map(x => x.slice(6));
    if (vars.some(x => !NEUTRAS.has(x) && !/-fondo$/.test(x))) return true;
    return (v.match(RE_COLOR) || []).some(t => { const c = leerColor(t); return c && c.a >= 0.6 && !neutro(c) && !transformar("fondo", c, null); });
  });
}

// El valor con sus colores cambiados (o null si nada cambia).
function valorClaro(prop, valor, ctx) {
  const tipo = tipoDe(prop);
  if (!tipo || !RE_COLOR.test(valor)) { RE_COLOR.lastIndex = 0; return null; }
  RE_COLOR.lastIndex = 0;
  let cambio = false;
  // Lo que está dentro de url(...) no se toca ("img/black.png" no es un color).
  const re = new RegExp("url\\([^)]*\\)|" + RE_COLOR.source, "g");
  const nuevo = valor.replace(re, t => {
    if (/^url\(/i.test(t)) return t;
    const c = leerColor(t);
    if (!c) return t;
    const x = transformar(tipo, c, ctx);
    if (!x) return t;
    const s = escribir(x);
    if (s.toLowerCase() !== t.toLowerCase()) cambio = true;
    return s;
  });
  return cambio ? nuevo : null;
}

// ---- Leer CSS (sin comentarios) ----
function parsear(css) {
  const s = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let i = 0;
  const n = s.length;
  function saltarCadena() {
    const q = s[i++];
    while (i < n && s[i] !== q) { if (s[i] === "\\") i++; i++; }
    i++;
  }
  function hastaCierre() {
    const ini = i;
    let prof = 0;
    while (i < n) {
      const ch = s[i];
      if (ch === '"' || ch === "'") { saltarCadena(); continue; }
      if (ch === "{") prof++;
      else if (ch === "}") { if (!prof) break; prof--; }
      i++;
    }
    const cuerpo = s.slice(ini, i);
    i++;
    return cuerpo;
  }
  function bloque() {
    const out = [];
    while (i < n) {
      while (i < n && /\s/.test(s[i])) i++;
      if (i >= n) break;
      if (s[i] === "}") { i++; break; }
      const ini = i;
      while (i < n && s[i] !== "{" && s[i] !== ";" && s[i] !== "}") {
        if (s[i] === '"' || s[i] === "'") saltarCadena(); else i++;
      }
      const prelude = s.slice(ini, i).trim();
      if (s[i] === ";") { i++; continue; }
      if (s[i] === "}") continue;
      i++;
      if (/^@(media|supports)\b/i.test(prelude)) out.push({ tipo: "at", prelude, hijos: bloque() });
      else if (prelude.startsWith("@")) hastaCierre();
      else out.push({ tipo: "regla", selector: prelude, decls: declaraciones(hastaCierre()) });
    }
    return out;
  }
  return bloque();
}
function declaraciones(cuerpo) {
  const out = [];
  let prof = 0, ini = 0, q = null;
  const partes = [];
  for (let k = 0; k < cuerpo.length; k++) {
    const ch = cuerpo[k];
    if (q) { if (ch === "\\") k++; else if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") q = ch;
    else if (ch === "(") prof++;
    else if (ch === ")") prof--;
    else if (ch === ";" && !prof) { partes.push(cuerpo.slice(ini, k)); ini = k + 1; }
  }
  partes.push(cuerpo.slice(ini));
  partes.forEach(p => {
    const k = p.indexOf(":");
    if (k < 1) return;
    const prop = p.slice(0, k).trim();
    let valor = p.slice(k + 1).trim();
    if (!prop || !valor) return;
    let imp = "";
    const m = valor.match(/\s*!important\s*$/i);
    if (m) { imp = " !important"; valor = valor.slice(0, m.index).trim(); }
    out.push({ prop, valor, imp });
  });
  return out;
}

// ---- Selectores con el prefijo ----
function partirSelector(sel) {
  const out = [];
  let prof = 0, ini = 0;
  for (let k = 0; k < sel.length; k++) {
    const ch = sel[k];
    if (ch === "(" || ch === "[") prof++;
    else if (ch === ")" || ch === "]") prof--;
    else if (ch === "," && !prof) { out.push(sel.slice(ini, k)); ini = k + 1; }
  }
  out.push(sel.slice(ini));
  return out.map(x => x.trim().replace(/\s+/g, " ")).filter(Boolean);
}
// Con :where() el prefijo no suma especificidad: cada regla clara pesa lo
// mismo que la original, y entre ellas manda el orden de siempre.
const DONDE = ':where([data-modo="claro"])';
function prefijar(sel) {
  return partirSelector(sel).map(p => {
    if (/^:root\b/.test(p)) return ":root" + DONDE + p.slice(5);
    if (/^html(?![-\w])/.test(p)) return "html" + DONDE + p.slice(4);
    return `:where(html[data-modo="claro"]) ${p}`;
  }).join(",\n");
}
// "Componente" de un selector: el prefijo de su primera clase o id
// (.txn-save → txn). Sirve para no romper el orden entre reglas vecinas.
function componentes(sel) {
  return new Set(partirSelector(sel).map(p => { const m = /[.#]([a-zA-Z0-9]+)/.exec(p); return m ? m[1].toLowerCase() : "*"; }));
}
// Propiedades que se pisan entre sí (background y background-color…).
function familia(prop) {
  const p = prop.toLowerCase();
  if (p.startsWith("background")) return "background";
  if (p.startsWith("border") || p.startsWith("outline")) return "border";
  if (p.startsWith("--")) return p;
  return p;
}

// ---- Generar ----
// pisadas: componente → propiedades que ya tienen una regla clara antes. Una
// regla de después del mismo componente que pone esa propiedad con variables
// (sin colores fijos) se repite tal cual, para que siga ganando como en el
// modo oscuro (p. ej. .txn-save pone texto blanco; .txn-save-otro, después,
// vuelve a var(--ink)).
function cambios(nodos, pisadas) {
  const out = [];
  nodos.forEach(nd => {
    if (nd.tipo === "at") {
      const hijos = cambios(nd.hijos, pisadas);
      if (hijos.length) out.push(`${nd.prelude} {\n${hijos.map(h => "  " + h.replace(/\n/g, "\n  ")).join("\n")}\n}`);
      return;
    }
    if (/^:root$/.test(nd.selector.trim())) return;   // las variables van arriba
    if (DIBUJOS.test(nd.selector)) return;
    const ctx = {
      fondoFuerte: fondoFuerte(nd.decls),
      fondoTinta: nd.decls.some(d => tipoDe(d.prop) === "fondo" && /var\(--ink\)/.test(d.valor)),
      velo: VELOS.test(nd.selector)
    };
    const comps = componentes(nd.selector);
    const ds = [];
    nd.decls.forEach(d => {
      if (!tipoDe(d.prop)) return;
      const fam = familia(d.prop);
      const v = valorClaro(d.prop, d.valor, ctx);
      if (v != null) {
        ds.push(`  ${d.prop}: ${v}${d.imp};`);
        comps.forEach(c => { if (!pisadas.has(c)) pisadas.set(c, new Set()); pisadas.get(c).add(fam); });
      } else if ([...comps].some(c => pisadas.has(c) && pisadas.get(c).has(fam))) {
        ds.push(`  ${d.prop}: ${d.valor}${d.imp};`);
      }
    });
    if (ds.length) out.push(`${prefijar(nd.selector)} {\n${ds.join("\n")}\n}`);
  });
  return out;
}
function archivosCss() {
  const html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
  const out = [];
  const re = /<link[^>]+rel="stylesheet"[^>]+href="([^"?]+\.css)/g;
  let m;
  while ((m = re.exec(html))) {
    // El paquete de estilos (D-127) se lee como su lista, en orden.
    const lista = m[1] === "css/app.paquete.css" ? require("./paquete.js").leerLista().css : [m[1]];
    lista.forEach(rel => { if (!rel.startsWith("vendor/") && !SIN_COLORES.has(rel)) out.push(rel); });
  }
  return out;
}
function generar() {
  const partes = [
    "/* ---------- Modo claro (D-126) ----------",
    "   GENERADO por scripts/tema-claro.js a partir de los estilos de siempre:",
    "   no se edita a mano (npm run tema). Lo escrito a mano está en",
    "   scripts/tema-claro-manual.css (va al final). */",
    VARIABLES
  ];
  const pisadas = new Map();
  archivosCss().forEach(rel => {
    const reglas = cambios(parsear(fs.readFileSync(path.join(RAIZ, rel), "utf8")), pisadas);
    if (reglas.length) partes.push(`\n/* ---- ${rel} ---- */`, reglas.join("\n"));
  });
  const manual = path.join(RAIZ, MANUAL);
  if (fs.existsSync(manual)) partes.push(`\n/* ---- ${MANUAL} (a mano) ---- */`, fs.readFileSync(manual, "utf8").trim());
  return partes.join("\n") + "\n";
}

if (require.main === module) {
  const nuevo = generar();
  const destino = path.join(RAIZ, SALIDA);
  const viejo = fs.existsSync(destino) ? fs.readFileSync(destino, "utf8") : "";
  if (process.argv.includes("--revisar")) {
    if (viejo !== nuevo) { console.error(`${SALIDA} no está al día: corre "npm run tema".`); process.exit(1); }
    console.log(`${SALIDA} al día.`);
  } else {
    fs.writeFileSync(destino, nuevo);
    console.log(`${SALIDA}: ${nuevo.length} bytes${viejo === nuevo ? " (sin cambios)" : ""}.`);
  }
}

module.exports = { componentes, familia, NEUTRAS, DIBUJOS, VELOS, leerColor, escribir, luminancia, contraste, neutro, oscurecer, tintaDe, fondoDe, tipoDe, transformar, fondoFuerte, valorClaro, parsear, declaraciones, partirSelector, prefijar, generar, archivosCss, PREFIJO, SALIDA };
