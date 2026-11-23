// ---------- Ropa: la lógica de la inspiración (sin pantalla, D-148) ----------
// Cada inspiración (un pin de Pinterest o una imagen que subiste): normalizar
// lo guardado y lo que vio la IA, el nombre de cada prenda que se ve, qué tan
// parecida es a una prenda tuya, "Armar este look con mi ropa" sin IA (lo más
// parecido por grupo, tipo y color, siempre igual y gratis), lo que se repite
// en tus pines ("Mi estilo" sin IA) y lo que se le manda a la IA (sin notas,
// talla ni precio). Datos en users/{uid}/ropa_inspiracion (docs/ROPA.md).
// Pruebas: tests/ropa-insp-motor.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./ropa-motor.js"));
  else root.RopaInspMotor = factory(root.RopaMotor);
})(typeof self !== "undefined" ? self : this, function (M) {
"use strict";

const ID_ESTILOS = M.ESTILOS.map(e => e[0]), ID_CLIMAS = M.CLIMAS.map(c => c[0]), ID_ESTAMPADOS = M.ESTAMPADOS.map(e => e[0]);
const PARECIDOS = ["igual", "parecida", "reemplazo"];
const texto = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max || 80);
const lista = (v, validos, max) => (Array.isArray(v) ? v : []).filter((x, i, a) => validos.includes(x) && a.indexOf(x) === i).slice(0, max || 99);
const obj = x => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
const formal = v => { const f = Math.round(Number(v)); return f >= 1 && f <= 5 ? f : null; };
const colores = v => lista((Array.isArray(v) ? v : []).map(c => (c && typeof c === "object" ? c.id : c)), M.COLORES.map(c => c.id), 3);
const fechaOk = f => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f);
const num = v => (typeof v === "number" && isFinite(v) && v > 0 ? v : 0);

// ---- Lo que vio la IA en una imagen ----
function vista(x) {
  const o = obj(x);
  if (!M.GRUPO[o.grupo]) return null;
  return {
    grupo: o.grupo, tipo: texto(o.tipo, 40) || M.GRUPO[o.grupo].tipos[0][0], colores: colores(o.colores),
    estampado: ID_ESTAMPADOS.includes(o.estampado) ? o.estampado : "liso", tela: texto(o.tela, 40), detalle: texto(o.detalle, 60)
  };
}
function analisis(x) {
  if (!x || typeof x !== "object") return null;
  const o = obj(x);
  return {
    esRopa: o.esRopa !== false,
    resumen: texto(o.resumen, 160),
    prendas: o.esRopa === false ? [] : (Array.isArray(o.prendas) ? o.prendas : []).map(vista).filter(Boolean).slice(0, 8),
    estilo: lista(o.estilo, ID_ESTILOS, 3), clima: lista(o.clima, ID_CLIMAS, 3), formalidad: formal(o.formalidad), ocasion: texto(o.ocasion, 60)
  };
}
// El look guardado (de la IA o de las reglas).
function lookGuardado(x) {
  if (!x || typeof x !== "object") return null;
  const o = obj(x);
  return {
    fecha: fechaOk(o.fecha) ? o.fecha : "",
    origen: o.origen === "ia" ? "ia" : "reglas",
    prendas: (Array.isArray(o.prendas) ? o.prendas : []).map(obj).filter(p => typeof p.id === "string" && p.id && Number(p.pin) >= 1)
      .map(p => ({ pin: Math.round(Number(p.pin)), id: p.id, parecido: PARECIDOS.includes(p.parecido) ? p.parecido : "parecida", porque: texto(p.porque, 140) })),
    faltan: (Array.isArray(o.faltan) ? o.faltan : []).map(obj).filter(f => M.GRUPO[f.grupo] && Number(f.pin) >= 1)
      .map(f => ({ pin: Math.round(Number(f.pin)), grupo: f.grupo, tipo: texto(f.tipo, 40) || M.GRUPO[f.grupo].tipos[0][0], colores: colores(f.colores), porque: texto(f.porque, 140) })),
    consejo: texto(o.consejo, 220)
  };
}

// ---- Una inspiración ----
// d: { origen, via, pin: { id, url, titulo, img, fecha }, fotos, analisis, ia, iaError, look, oculta, creado }
function normalizar(id, d) {
  const x = obj(d);
  const pin = x.pin && typeof x.pin === "object" && typeof x.pin.id === "string" ? {
    id: x.pin.id, url: /^https:\/\/www\.pinterest\.com\/pin\//.test(x.pin.url || "") ? x.pin.url : `https://www.pinterest.com/pin/${encodeURIComponent(x.pin.id)}/`,
    titulo: texto(x.pin.titulo, 120), img: /^https:\/\/i\.pinimg\.com\//.test(x.pin.img || "") ? x.pin.img : "", fecha: num(x.pin.fecha)
  } : null;
  return {
    id,
    origen: pin ? "pinterest" : "foto",
    via: ["tablero", "link", "foto"].includes(x.via) ? x.via : (pin ? "link" : "foto"),
    pin,
    fotos: (Array.isArray(x.fotos) ? x.fotos : []).filter(f => f && typeof f.id === "string").map(f => ({ id: f.id, mini: typeof f.mini === "string" ? f.mini : "", ancho: f.ancho || 0, alto: f.alto || 0 })),
    analisis: analisis(x.analisis),
    ia: x.ia && fechaOk(x.ia.fecha) ? { fecha: x.ia.fecha } : null,
    iaError: x.iaError && typeof x.iaError === "object" ? { veces: Math.max(0, Math.round(Number(x.iaError.veces) || 0)), mensaje: texto(x.iaError.mensaje, 140) } : null,
    look: lookGuardado(x.look),
    oculta: x.oculta === true,
    creado: num(x.creado),
    editado: num(x.editado)
  };
}
const docDePin = pinId => `pin-${String(pinId).replace(/[^A-Za-z0-9_-]/g, "")}`;
// El título: el del pin, lo que dijo la IA o "Inspiración".
const titulo = p => (p.pin && p.pin.titulo) || (p.analisis && p.analisis.resumen) || "Inspiración";
// Las más nuevas primero (y, del mismo momento, el pin más nuevo primero).
const ordenar = xs => xs.slice().sort((a, b) => b.creado - a.creado || ((b.pin && b.pin.fecha) || 0) - ((a.pin && a.pin.fecha) || 0) || a.id.localeCompare(b.id));
// Las que la IA todavía tiene que mirar (dos fallas seguidas: se deja).
const porAnalizar = xs => xs.filter(p => !p.oculta && !p.analisis && p.fotos.length && !(p.iaError && p.iaError.veces >= 2));
function resumen(xs) {
  const vis = xs.filter(p => !p.oculta);
  return { total: vis.length, sinAnalizar: vis.filter(p => !p.analisis).length, conRopa: vis.filter(p => p.analisis && p.analisis.esRopa && p.analisis.prendas.length).length, ocultas: xs.length - vis.length };
}

// ---- Las prendas que se ven ----
// "Abrigo camel largo", "Botines cafés", "Jean azul recto".
function nombreVista(v) {
  const t = M.titulo({ tipo: v.tipo, colores: v.colores.slice(0, 1).map(id => ({ id })) });
  return [t, v.detalle].filter(Boolean).join(" ");
}
// Para buscar ideas de una prenda que te falta en Pinterest (solo un link).
const buscarEnPinterest = v => `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(M.titulo({ tipo: v.tipo, colores: (v.colores || []).slice(0, 1).map(id => ({ id })) }))}`;

// ---- Qué tan parecida es una prenda tuya a una que se ve ----
// Familias de tipos: nombres distintos de lo mismo.
const FAMILIA_TIPO = {
  polera: "polera", "polera con cuello": "polera", camiseta: "polera", remera: "polera", "t-shirt": "polera", top: "top", musculosa: "top",
  camisa: "camisa", blusa: "camisa",
  chompa: "chompa", "chompa con capucha": "chompa", sueter: "chompa", sweater: "chompa", buzo: "buzo",
  pantalon: "pantalon", jean: "pantalon", "pantalon de tela": "pantalon", chino: "pantalon", "pantalon cargo": "pantalon", leggings: "leggings", short: "short", falda: "falda",
  vestido: "vestido", enterizo: "enterizo", overol: "enterizo",
  chamarra: "chamarra", chaqueta: "chamarra", casaca: "chamarra", parka: "chamarra", rompevientos: "chamarra", abrigo: "abrigo", saco: "saco", blazer: "saco", chaleco: "chaleco",
  zapatillas: "zapatillas", tenis: "zapatillas", zapatos: "zapatos", mocasines: "zapatos", botas: "botas", botines: "botas", sandalias: "sandalias",
  cinturon: "cinturon", gorra: "sombrero", sombrero: "sombrero", bufanda: "bufanda", guantes: "guantes", reloj: "reloj", lentes: "lentes", corbata: "corbata", mochila: "bolso", cartera: "bolso", bolso: "bolso"
};
const familiaTipo = t => { const p = M.plano(t).trim(); return FAMILIA_TIPO[p] || FAMILIA_TIPO[p.split(" ")[0]] || p.split(" ")[0]; };
const fam = id => (M.COLOR[id] ? M.COLOR[id].fam : id);
// v: lo que se ve; p: tu prenda (normalizada). → { puntos (0 a 10), tipo, color }
function parecido(v, p) {
  if (!v || !p || v.grupo !== p.grupo) return { puntos: 0, tipo: "no", color: "no" };
  let puntos = 2;
  const tipo = M.plano(v.tipo) === M.plano(p.tipo) ? "igual" : familiaTipo(v.tipo) === familiaTipo(p.tipo) ? "familia" : "otro";
  puntos += tipo === "igual" ? 4 : tipo === "familia" ? 3 : 0;
  const cv = v.colores, cp = p.colores.map(c => (typeof c === "string" ? c : c.id));
  let color = "sin";
  if (cv.length && cp.length) {
    if (cv[0] === cp[0]) color = "igual";
    else if (fam(cv[0]) === fam(cp[0])) color = "familia";
    else if (cv.some(c => cp.some(d => fam(c) === fam(d)))) color = "cerca";
    else color = "no";
    puntos += { igual: 3, familia: 2, cerca: 1, no: 0 }[color];
  }
  if (v.estampado && p.estampado && v.estampado === p.estampado) puntos += 0.5;
  if (v.tela && p.tela && M.plano(v.tela) === M.plano(p.tela)) puntos += 0.5;
  return { puntos, tipo, color };
}
// "igual" (mismo tipo y mismo color), "parecida" (mismo tipo, otro tono de la
// familia o sin color) o "reemplazo" (mismo tipo de otro color, u otro tipo
// del mismo grupo y del mismo color); si no, no sirve.
function cuanto(r) {
  if (r.tipo === "no") return null;   // otro grupo
  if (r.tipo !== "otro") return r.color === "igual" ? "igual" : r.color === "no" ? "reemplazo" : "parecida";
  return r.color === "igual" || r.color === "familia" ? "reemplazo" : null;
}
// "Armar este look con mi ropa" sin IA: para cada prenda que se ve, la tuya
// más parecida (cada una una sola vez; las mejores parejas primero). Las
// para lavar valen un poco menos; las que ya no tienes no cuentan.
function armarLocal(a, ropero) {
  const vistas = (a && a.prendas) || [];
  const tuyas = (ropero || []).filter(p => p.estado !== "fuera");
  const parejas = [];
  vistas.forEach((v, k) => tuyas.forEach(p => {
    const r = parecido(v, p);
    const c = cuanto(r);
    if (c) parejas.push({ k, p, c, puntos: r.puntos - (p.estado === "lavar" ? 0.75 : 0) });
  }));
  parejas.sort((x, y) => y.puntos - x.puntos || x.k - y.k || (x.p.id < y.p.id ? -1 : 1));
  const usadas = new Set(), cubiertas = new Map();
  parejas.forEach(x => {
    if (usadas.has(x.p.id) || cubiertas.has(x.k)) return;
    usadas.add(x.p.id);
    cubiertas.set(x.k, { pin: x.k + 1, id: x.p.id, parecido: x.c, porque: "" });
  });
  const prendas = [...cubiertas.values()].sort((x, y) => x.pin - y.pin);
  const faltan = vistas.map((v, k) => ({ v, k })).filter(({ k, v }) => !cubiertas.has(k) && v.grupo !== "accesorios")
    .map(({ v, k }) => ({ pin: k + 1, grupo: v.grupo, tipo: v.tipo, colores: v.colores.slice(), porque: "" }));
  return { origen: "reglas", prendas, faltan, consejo: "" };
}
// ¿A cuál de tus inspiraciones se parece un outfit? (D-149) items: las
// prendas del outfit (normalizadas). De cada inspiración cuenta las prendas
// que se ven (sin accesorios) que el outfit tiene igual (1) o parecida (0,7),
// cada prenda tuya una vez: tienen que ser 2 o más y la mitad o más. Si la IA
// ya armó ese look con tu ropa y el outfit lleva 2 o más de esas mismas
// prendas, esa va primero. → { id, puntos } (la que más se parece) o null.
function parecidaA(items, inspiraciones) {
  const tuyas = items || [], ids = new Set(tuyas.map(p => p.id));
  let mejor = null;
  (inspiraciones || []).forEach(x => {
    if (!x || x.oculta || !x.analisis || !x.analisis.esRopa) return;
    const vistas = x.analisis.prendas.filter(v => v.grupo !== "accesorios");
    if (vistas.length < 2) return;
    const delLook = x.look ? x.look.prendas.filter(l => ids.has(l.id)).length : 0;
    let suma = 0, n = 0;
    const usadas = new Set();
    vistas.forEach(v => {
      let el = null;
      tuyas.forEach(p => {
        if (usadas.has(p.id)) return;
        const c = cuanto(parecido(v, p));
        const val = c === "igual" ? 1 : c === "parecida" ? 0.7 : 0;
        if (val && (!el || val > el.val)) el = { id: p.id, val };
      });
      if (el) { usadas.add(el.id); suma += el.val; n++; }
    });
    const parte = suma / vistas.length;
    const puntos = Math.max(delLook >= 2 ? 1 + delLook / 10 : 0, n >= 2 && parte >= 0.5 ? parte : 0);
    if (puntos > 0 && (!mejor || puntos > mejor.puntos)) mejor = { id: x.id, puntos: Math.round(puntos * 100) / 100 };
  });
  return mejor;
}
// El look guardado con tu ropero de hoy: sin las prendas que borraste.
function lookVigente(look, ropero) {
  if (!look) return null;
  const ids = new Set((ropero || []).filter(p => p.estado !== "fuera").map(p => p.id));
  const prendas = look.prendas.filter(x => ids.has(x.id));
  return Object.assign({}, look, { prendas, cambio: prendas.length !== look.prendas.length });
}

// ---- Lo que se le manda a la IA (sin notas, talla, precio ni fotos) ----
const roperoParaIA = ropero => (ropero || []).filter(p => p.estado !== "fuera").map(p => ({
  id: p.id, grupo: p.grupo, tipo: p.tipo, colores: p.colores.map(c => c.id), estampado: p.estampado, tela: p.tela,
  estilo: p.estilo.slice(), clima: p.clima.slice(), formalidad: p.formalidad, marca: p.marca, lavar: p.estado === "lavar"
}));
const pinParaIA = a => ({ resumen: a.resumen, prendas: a.prendas.map(v => Object.assign({}, v)), estilo: a.estilo.slice(), clima: a.clima.slice(), formalidad: a.formalidad, ocasion: a.ocasion });
const MIN_ESTILO = 3;
const pinesParaEstilo = xs => ordenar(xs).filter(p => !p.oculta && p.analisis && p.analisis.esRopa && p.analisis.prendas.length).slice(0, 80).map(p => pinParaIA(p.analisis));

// ---- "Mi estilo" sin IA: lo que más se repite en tus pines ----
function estiloLocal(xs) {
  const pines = xs.filter(p => !p.oculta && p.analisis && p.analisis.esRopa && p.analisis.prendas.length);
  const contar = () => new Map();
  const sumar = (m, k, datos) => { const x = m.get(k) || Object.assign({ n: 0 }, datos); x.n++; m.set(k, x); };
  const estilos = contar(), familias = contar(), tipos = contar(), climas = contar();
  let fSuma = 0, fN = 0;
  pines.forEach(p => {
    const a = p.analisis;
    a.estilo.forEach(e => sumar(estilos, e, { id: e }));
    a.clima.forEach(c => sumar(climas, c, { id: c }));
    if (a.formalidad) { fSuma += a.formalidad; fN++; }
    // Cada color y cada tipo cuenta una vez por pin.
    const vistosC = new Set(), vistosT = new Set();
    a.prendas.forEach(v => {
      v.colores.forEach(c => { const f = fam(c); if (!vistosC.has(f)) { vistosC.add(f); sumar(familias, f, { id: c }); } });
      const t = familiaTipo(v.tipo);
      if (!vistosT.has(t)) { vistosT.add(t); sumar(tipos, t, { tipo: v.tipo }); }
    });
  });
  const top = (m, n) => [...m.values()].sort((a, b) => b.n - a.n).slice(0, n);
  return {
    n: pines.length,
    estilos: top(estilos, 3).map(x => ({ id: x.id, nombre: M.nombreDe(M.ESTILOS, x.id), n: x.n })),
    colores: top(familias, 5).map(x => ({ id: x.id, nombre: M.nombreColor(x.id), hex: M.COLOR[x.id].hex, n: x.n })),
    prendas: top(tipos, 6).map(x => ({ tipo: x.tipo, n: x.n })),
    climas: top(climas, 3).map(x => ({ id: x.id, nombre: M.nombreDe(M.CLIMAS, x.id), n: x.n })),
    formalidad: fN ? Math.round(fSuma / fN) : null
  };
}
// Lo que contestó la IA de tu estilo (o lo que corregiste) → limpio.
function estiloGuardado(x) {
  if (!x || typeof x !== "object") return null;
  const o = obj(x);
  const textos = (v, n, max) => (Array.isArray(v) ? v : []).map(t => texto(t, max)).filter((t, i, a) => t && a.indexOf(t) === i).slice(0, n);
  const r = {
    resumen: texto(o.resumen, 600), claves: textos(o.claves, 6, 50), colores: lista(o.colores, M.COLORES.map(c => c.id), 5), prendas: textos(o.prendas, 6, 50),
    fecha: fechaOk(o.fecha) ? o.fecha : "", pines: Math.max(0, Math.round(Number(o.pines) || 0)), corregido: o.corregido === true
  };
  return r.resumen ? r : null;
}

// ---- Links de Pinterest (lo que se pega) ----
// Si parece de Pinterest (el puente lo termina de entender).
const esLinkPinterest = s => /(?:^|\s)(?:https?:\/\/)?(?:pin\.it\/[A-Za-z0-9]{3,}|(?:[a-z0-9-]+\.)?pinterest\.[a-z]{2,3}(?:\.[a-z]{2})?\/\S+)/i.test(String(s || ""));

return {
  PARECIDOS, MIN_ESTILO, normalizar, analisis, lookGuardado, docDePin, titulo, ordenar, porAnalizar, resumen,
  nombreVista, buscarEnPinterest, familiaTipo, parecido, cuanto, armarLocal, parecidaA, lookVigente, roperoParaIA, pinParaIA, pinesParaEstilo,
  estiloLocal, estiloGuardado, esLinkPinterest
};
});
