// ---------- Ropa: la lógica del ropero (sin pantalla, D-145 / D-146) ----------
// Grupos y tipos de prenda, colores con nombre en español (y sacar el color
// de una foto, sin IA), el nombre de cada prenda ("Polera blanca",
// "Zapatillas negras"), normalizar y revisar lo que se guarda, filtros,
// búsqueda, orden y las veces que te pusiste cada prenda.
// Datos en users/{uid}/ropa y users/{uid}/ropa_usos (docs/ROPA.md).
// Pruebas: tests/ropa-motor.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RopaMotor = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

// ---- Grupos y tipos (g: género y número del nombre, para los colores) ----
// m: masculino, f: femenino; mp / fp: plural.
const GRUPOS = [
  { id: "arriba", nombre: "Arriba", tipos: [["Polera", "f"], ["Polera con cuello", "f"], ["Camisa", "f"], ["Blusa", "f"], ["Chompa", "f"], ["Chompa con capucha", "f"], ["Top", "m"], ["Musculosa", "f"]] },
  { id: "abajo", nombre: "Abajo", tipos: [["Pantalón", "m"], ["Jean", "m"], ["Pantalón de tela", "m"], ["Short", "m"], ["Falda", "f"], ["Buzo", "m"], ["Leggings", "mp"]] },
  { id: "cuerpo", nombre: "Cuerpo entero", tipos: [["Vestido", "m"], ["Enterizo", "m"], ["Overol", "m"]] },
  { id: "abrigos", nombre: "Abrigos", tipos: [["Chamarra", "f"], ["Abrigo", "m"], ["Saco", "m"], ["Chaleco", "m"], ["Rompevientos", "m"], ["Parka", "f"]] },
  { id: "zapatos", nombre: "Zapatos", tipos: [["Zapatillas", "fp"], ["Zapatos", "mp"], ["Botas", "fp"], ["Botines", "mp"], ["Sandalias", "fp"], ["Mocasines", "mp"]] },
  { id: "accesorios", nombre: "Accesorios", tipos: [["Cinturón", "m"], ["Gorra", "f"], ["Sombrero", "m"], ["Bufanda", "f"], ["Guantes", "mp"], ["Reloj", "m"], ["Lentes", "mp"], ["Corbata", "f"], ["Mochila", "f"], ["Cartera", "f"]] }
];
const GRUPO = Object.fromEntries(GRUPOS.map(g => [g.id, g]));
const TIPO_G = {};
GRUPOS.forEach(g => g.tipos.forEach(([t, gen]) => { TIPO_G[t] = gen; }));

const CLIMAS = [["frio", "Frío"], ["templado", "Templado"], ["calor", "Calor"]];
const ESTILOS = [["casual", "Casual"], ["formal", "Formal"], ["deportivo", "Deportivo"], ["elegante", "Elegante"], ["urbano", "Urbano"], ["clasico", "Clásico"]];
const ESTAMPADOS = [["liso", "Liso"], ["rayas", "Rayas"], ["cuadros", "Cuadros"], ["puntos", "Puntos"], ["floral", "Floral"], ["estampado", "Estampado"], ["logo", "Con logo"]];
const TELAS = ["Algodón", "Jean", "Lana", "Lino", "Poliéster", "Cuero", "Gamuza", "Seda", "Punto", "Corduroy", "Polar", "Sintético"];
const FORMALIDAD = { 1: "Muy informal", 2: "Informal", 3: "Intermedio", 4: "Formal", 5: "Muy formal" };
const ESTADOS = ["activa", "lavar", "fuera"];
const nombreDe = (lista, id) => (lista.find(x => x[0] === id) || [null, ""])[1];

// ---- Colores ----
// f: las 4 formas del nombre [m, f, mp, fp] (si es igual siempre, una sola);
// fam: familia (dos tonos de la misma familia cuentan como un solo color);
// manual: solo para elegir a mano (no se detecta en una foto).
const COLORES = [
  { id: "negro", hex: "#151515", f: ["negro", "negra", "negros", "negras"], fam: "negro" },
  { id: "gris-oscuro", hex: "#4a4a4f", f: ["gris oscuro", "gris oscuro", "gris oscuro", "gris oscuro"], fam: "negro" },
  { id: "gris", hex: "#8c8c8f", f: ["gris", "gris", "grises", "grises"], fam: "gris" },
  { id: "gris-claro", hex: "#c9c9cc", f: ["gris claro", "gris claro", "gris claro", "gris claro"], fam: "blanco" },
  { id: "blanco", hex: "#f4f4f2", f: ["blanco", "blanca", "blancos", "blancas"], fam: "blanco" },
  { id: "crema", hex: "#efe6cf", f: ["crema"], fam: "blanco" },
  { id: "beige", hex: "#d9c6a5", f: ["beige"], fam: "beige" },
  { id: "camel", hex: "#c19a6b", f: ["camel"], fam: "beige" },
  { id: "cafe", hex: "#6b4a32", f: ["café", "café", "cafés", "cafés"], fam: "cafe" },
  { id: "cafe-oscuro", hex: "#3d2b1f", f: ["café oscuro", "café oscuro", "café oscuro", "café oscuro"], fam: "cafe" },
  { id: "azul-marino", hex: "#1e2a44", f: ["azul marino"], fam: "azul-marino" },
  { id: "azul", hex: "#2d5db3", f: ["azul", "azul", "azules", "azules"], fam: "azul" },
  { id: "azul-jean", hex: "#4f6f9a", f: ["azul jean"], fam: "azul" },
  { id: "celeste", hex: "#8fc3ea", f: ["celeste", "celeste", "celestes", "celestes"], fam: "celeste" },
  { id: "turquesa", hex: "#2aa8a6", f: ["turquesa"], fam: "celeste" },
  { id: "verde", hex: "#2f8a4e", f: ["verde", "verde", "verdes", "verdes"], fam: "verde" },
  { id: "verde-oscuro", hex: "#1f4d34", f: ["verde oscuro"], fam: "verde" },
  { id: "verde-oliva", hex: "#6b7134", f: ["verde oliva"], fam: "oliva" },
  { id: "amarillo", hex: "#f1cb44", f: ["amarillo", "amarilla", "amarillos", "amarillas"], fam: "amarillo" },
  { id: "mostaza", hex: "#c9a12a", f: ["mostaza"], fam: "amarillo" },
  { id: "naranja", hex: "#ee8a3a", f: ["naranja"], fam: "naranja" },
  { id: "rojo", hex: "#c43a31", f: ["rojo", "roja", "rojos", "rojas"], fam: "rojo" },
  { id: "bordo", hex: "#6e1f2c", f: ["bordó"], fam: "rojo" },
  { id: "rosado", hex: "#f2a7bf", f: ["rosado", "rosada", "rosados", "rosadas"], fam: "rosa" },
  { id: "fucsia", hex: "#d23c8a", f: ["fucsia"], fam: "rosa" },
  { id: "lila", hex: "#b8a2d9", f: ["lila"], fam: "morado" },
  { id: "morado", hex: "#5e3a8a", f: ["morado", "morada", "morados", "moradas"], fam: "morado" },
  { id: "dorado", hex: "#c8a24a", f: ["dorado", "dorada", "dorados", "doradas"], fam: "amarillo", manual: true },
  { id: "plateado", hex: "#bdbdc2", f: ["plateado", "plateada", "plateados", "plateadas"], fam: "gris", manual: true }
];
const COLOR = Object.fromEntries(COLORES.map(c => [c.id, c]));
const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const FORMA = { m: 0, f: 1, mp: 2, fp: 3 };
// El nombre del color para un tipo de prenda ("negras" para Zapatillas).
function colorPara(colorId, tipo) {
  const c = COLOR[colorId];
  if (!c) return "";
  const i = FORMA[TIPO_G[tipo] || "m"];
  return c.f.length === 1 ? c.f[0] : c.f[i];
}
const nombreColor = id => (COLOR[id] ? cap(COLOR[id].f[0]) : "");

// ---- Color de una foto (sin IA) ----
function hexARgb(hex) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbALab(r, g, b) {
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const dE = (a, b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
const LAB = COLORES.filter(c => !c.manual).map(c => ({ c, lab: rgbALab(...hexARgb(c.hex)) }));
// El color de la paleta más parecido a un color cualquiera.
function colorCercano(r, g, b) {
  const lab = rgbALab(r, g, b);
  let mejor = LAB[0], d = Infinity;
  LAB.forEach(x => { const e = dE(lab, x.lab); if (e < d) { d = e; mejor = x; } });
  return mejor.c;
}
// datos: RGBA (como getImageData().data) de una foto chica (ancho × alto).
// → [{ id, nombre, hex, peso }] (1 a 3 colores, el principal primero).
// El fondo (lo que domina el borde) se descarta si la prenda no es del mismo
// color; el centro pesa más que las orillas (la prenda suele estar al medio).
function coloresDeFoto(datos, ancho, alto) {
  const W = ancho | 0, H = alto | 0;
  if (!datos || !W || !H || datos.length < W * H * 4) return [];
  const px = [];
  const borde = Math.max(1, Math.round(Math.min(W, H) * 0.06));
  const cx = (W - 1) / 2, cy = (H - 1) / 2, maxD = Math.sqrt(cx * cx + cy * cy) || 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (datos[i + 3] < 128) continue;
      const lab = rgbALab(datos[i], datos[i + 1], datos[i + 2]);
      const enBorde = x < borde || y < borde || x >= W - borde || y >= H - borde;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxD;
      px.push({ lab, enBorde, w: 1 - 0.6 * dist * dist });
    }
  }
  if (!px.length) return [];
  // El fondo: el color de la paleta que más se repite en el borde (si llega a la mitad).
  const cercanoLab = lab => { let mejor = LAB[0], d = Infinity; LAB.forEach(x => { const e = dE(lab, x.lab); if (e < d) { d = e; mejor = x; } }); return mejor.c; };
  px.forEach(p => { p.c = cercanoLab(p.lab); });
  const enBorde = px.filter(p => p.enBorde);
  const cuentaBorde = {};
  enBorde.forEach(p => { cuentaBorde[p.c.id] = (cuentaBorde[p.c.id] || 0) + 1; });
  const fondoId = Object.keys(cuentaBorde).sort((a, b) => cuentaBorde[b] - cuentaBorde[a])[0];
  let usar = px;
  if (fondoId && cuentaBorde[fondoId] >= enBorde.length * 0.5) {
    const deFondo = enBorde.filter(p => p.c.id === fondoId);
    const media = [0, 1, 2].map(k => deFondo.reduce((s, p) => s + p.lab[k], 0) / deFondo.length);
    const sinFondo = px.filter(p => dE(p.lab, media) > 10);
    if (sinFondo.length >= px.length * 0.15) usar = sinFondo;
  }
  const peso = {};
  let total = 0;
  usar.forEach(p => { peso[p.c.id] = (peso[p.c.id] || 0) + p.w; total += p.w; });
  let lista = Object.keys(peso).map(id => ({ id, peso: peso[id] / total })).sort((a, b) => b.peso - a.peso);
  // Dos tonos de la misma familia (sombra y luz) cuentan como el más fuerte.
  const out = [];
  lista.forEach(x => {
    const fam = COLOR[x.id].fam;
    const igual = out.find(o => COLOR[o.id].fam === fam);
    if (igual) igual.peso += x.peso; else out.push({ id: x.id, peso: x.peso });
  });
  out.sort((a, b) => b.peso - a.peso);
  lista = out.filter((x, i) => i === 0 || x.peso >= 0.18).slice(0, 3);
  return lista.map(x => ({ id: x.id, nombre: nombreColor(x.id), hex: COLOR[x.id].hex, peso: Math.round(x.peso * 100) / 100 }));
}

// ---- Una prenda ----
const texto = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max || 80);
const lista = (v, validos) => (Array.isArray(v) ? v : []).filter((x, i, a) => validos.includes(x) && a.indexOf(x) === i);
const fechaOk = f => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f);
const numOk = v => (typeof v === "number" && isFinite(v) && v >= 0 ? v : null);
const ID_CLIMAS = CLIMAS.map(c => c[0]), ID_ESTILOS = ESTILOS.map(e => e[0]), ID_ESTAMPADOS = ESTAMPADOS.map(e => e[0]);
// Lo guardado (puede venir de versiones viejas o a medias) → una prenda completa.
function normalizar(id, d) {
  const x = d || {};
  const grupo = GRUPO[x.grupo] ? x.grupo : "arriba";
  const colores = (Array.isArray(x.colores) ? x.colores : []).filter(c => c && COLOR[c.id]).slice(0, 3)
    .map(c => ({ id: c.id, nombre: nombreColor(c.id), hex: COLOR[c.id].hex, peso: typeof c.peso === "number" ? c.peso : null }));
  const f = Number(x.formalidad);
  return {
    id,
    grupo,
    tipo: texto(x.tipo, 40) || GRUPO[grupo].tipos[0][0],
    colores,
    estampado: ID_ESTAMPADOS.includes(x.estampado) ? x.estampado : "",
    tela: texto(x.tela, 40),
    estilo: lista(x.estilo, ID_ESTILOS),
    clima: lista(x.clima, ID_CLIMAS),
    formalidad: f >= 1 && f <= 5 ? Math.round(f) : null,
    marca: texto(x.marca, 40),
    talla: texto(x.talla, 12),
    precio: numOk(x.precio),
    compra: fechaOk(x.compra) ? x.compra : "",
    notas: texto(x.notas, 500),
    fotos: (Array.isArray(x.fotos) ? x.fotos : []).filter(p => p && typeof p.id === "string").map(p => ({ id: p.id, mini: typeof p.mini === "string" ? p.mini : "", ancho: p.ancho || 0, alto: p.alto || 0 })),
    estado: ESTADOS.includes(x.estado) ? x.estado : "activa",
    fueraFecha: fechaOk(x.fueraFecha) ? x.fueraFecha : "",
    creado: typeof x.creado === "number" ? x.creado : 0,
    editado: typeof x.editado === "number" ? x.editado : 0
  };
}
// Lo que escribiste en el formulario → errores [{ campo, texto }].
function validar(d) {
  const e = [];
  if (!d || !GRUPO[d.grupo]) e.push({ campo: "grupo", texto: "Elige un grupo." });
  if (!d || !texto(d.tipo)) e.push({ campo: "tipo", texto: "Elige qué prenda es." });
  if (d && d.precio != null && d.precio !== "" && !(Number(d.precio) >= 0 && Number(d.precio) < 1e6)) e.push({ campo: "precio", texto: "Revisa el precio." });
  if (d && d.compra && !fechaOk(d.compra)) e.push({ campo: "compra", texto: "Revisa la fecha." });
  return e;
}
// "Polera blanca", "Zapatillas negras", "Pantalón azul marino"; sin repetir
// ("Jean azul", no "Jean azul jean").
function titulo(p) {
  let c = p && p.colores && p.colores[0] ? colorPara(p.colores[0].id, p.tipo) : "";
  const t = p ? p.tipo : "";
  if (c && t && c.split(" ").length > 1 && plano(c).includes(plano(t.split(" ")[0]))) c = c.split(" ")[0];
  return [t, c].filter(Boolean).join(" ") || "Prenda";
}
// Un renglón con lo más importante: "Algodón · Casual · Frío y templado".
function detalle(p) {
  const climas = p.clima.map(c => nombreDe(CLIMAS, c).toLowerCase());
  const clima = climas.length ? cap(climas.length > 1 ? `${climas.slice(0, -1).join(", ")} y ${climas[climas.length - 1]}` : climas[0]) : "";
  return [p.tela, p.estilo.map(s => nombreDe(ESTILOS, s))[0], clima, p.marca].filter(Boolean).join(" · ");
}

// ---- Las veces que te la pusiste ----
// docs: { "2026-11-20": { prendas: [ids] }, … } → Map(id → { n, ultima, fechas })
function usos(docs) {
  const m = new Map();
  Object.keys(docs || {}).filter(fechaOk).sort().forEach(f => {
    const ids = Array.isArray(docs[f] && docs[f].prendas) ? docs[f].prendas : [];
    ids.forEach(id => {
      const u = m.get(id) || { n: 0, ultima: "", fechas: [] };
      if (u.fechas[u.fechas.length - 1] !== f) { u.n++; u.fechas.push(f); u.ultima = f; }
      m.set(id, u);
    });
  });
  return m;
}
// "domingo 22 de noviembre" (sin la coma que pone el navegador).
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function fechaLarga(f) {
  if (!fechaOk(f)) return "";
  const [y, m, d] = f.split("-").map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DIAS[dia]} ${d} de ${MESES[m - 1]}`;
}
const costoPorUso = (precio, n) => (typeof precio === "number" && precio > 0 && n > 0 ? Math.round((precio / n) * 100) / 100 : null);

// ---- Buscar, filtrar y ordenar ----
const plano = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function buscar(xs, q) {
  const t = plano(q).trim();
  if (!t) return xs.slice();
  const partes = t.split(/\s+/);
  return xs.filter(p => {
    const todo = plano([titulo(p), p.tipo, GRUPO[p.grupo].nombre, p.colores.map(c => c.nombre).join(" "), p.tela, p.marca, p.notas,
      p.estilo.map(s => nombreDe(ESTILOS, s)).join(" "), nombreDe(ESTAMPADOS, p.estampado), p.talla].join(" "));
    return partes.every(w => todo.includes(w));
  });
}
// f: { grupo, color (familia), clima, formalidad, estado ("activas" | "lavar" | "fuera") }
function filtrar(xs, f) {
  const o = f || {};
  return xs.filter(p => {
    const estado = o.estado || "activas";
    if (estado === "activas" ? p.estado === "fuera" : p.estado !== estado) return false;
    if (o.grupo && p.grupo !== o.grupo) return false;
    if (o.color && !p.colores.some(c => COLOR[c.id].fam === o.color || c.id === o.color)) return false;
    if (o.clima && !p.clima.includes(o.clima)) return false;
    if (o.formalidad && p.formalidad !== Number(o.formalidad)) return false;
    return true;
  });
}
const ORDENES = [["recientes", "Recientes"], ["mas", "Más usadas"], ["menos", "Menos usadas"], ["nombre", "Por nombre"]];
function ordenar(xs, modo, us) {
  const u = id => (us && us.get(id)) || { n: 0, ultima: "" };
  const nom = (a, b) => titulo(a).localeCompare(titulo(b), "es");
  const r = (a, b) => (b.creado || 0) - (a.creado || 0) || nom(a, b);
  const out = xs.slice();
  if (modo === "mas") out.sort((a, b) => u(b.id).n - u(a.id).n || (u(b.id).ultima > u(a.id).ultima ? 1 : u(b.id).ultima < u(a.id).ultima ? -1 : 0) || r(a, b));
  else if (modo === "menos") out.sort((a, b) => u(a.id).n - u(b.id).n || (u(a.id).ultima < u(b.id).ultima ? -1 : u(a.id).ultima > u(b.id).ultima ? 1 : 0) || r(a, b));
  else if (modo === "nombre") out.sort(nom);
  else out.sort(r);
  return out;
}
// Para los chips de color: las familias que hay en tu ropero (con su color de muestra).
function familias(xs) {
  const m = new Map();
  xs.forEach(p => p.colores.forEach(c => {
    const fam = COLOR[c.id].fam;
    const x = m.get(fam) || { id: fam, n: 0, hex: COLOR[fam] ? COLOR[fam].hex : c.hex, nombre: COLOR[fam] ? nombreColor(fam) : c.nombre };
    x.n++;
    m.set(fam, x);
  }));
  return [...m.values()].sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, "es"));
}
// Cuántas hay: { total, porGrupo, lavar, fuera }.
function resumen(xs) {
  const r = { total: 0, porGrupo: {}, lavar: 0, fuera: 0 };
  GRUPOS.forEach(g => { r.porGrupo[g.id] = 0; });
  xs.forEach(p => {
    if (p.estado === "fuera") { r.fuera++; return; }
    r.total++;
    r.porGrupo[p.grupo]++;
    if (p.estado === "lavar") r.lavar++;
  });
  return r;
}

return {
  GRUPOS, GRUPO, CLIMAS, ESTILOS, ESTAMPADOS, TELAS, FORMALIDAD, ESTADOS, COLORES, COLOR, ORDENES,
  nombreDe, colorPara, nombreColor, hexARgb, rgbALab, colorCercano, coloresDeFoto,
  normalizar, validar, titulo, detalle, usos, costoPorUso, fechaLarga, buscar, filtrar, ordenar, familias, resumen, plano
};
});
