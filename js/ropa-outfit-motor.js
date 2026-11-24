// ---------- Ropa: armar outfits con tu ropa (sin pantalla, D-149) ----------
// "¿Qué me pongo hoy?" sin IA (gratis, sin internet y como respaldo de la IA):
// solo con tu ropa (nunca inventa), nada para lavar ni lo que ya no tienes.
// Cada prenda suma o resta: el clima que pide el día (js/ropa-clima.js: la
// ropa de abajo para el mediodía y el abrigo para la mañana, si hay capas),
// qué tan formal es para la ocasión, su estilo, la lluvia (sin sandalias) y
// cuándo te la pusiste (lo de ayer, menos). Cada combinación suma o resta:
// los colores (neutros con un solo color fuerte es lo mejor; tres colores
// fuertes, no), los estampados (uno a la vez), que lo formal no salte de más
// y lo que aprendió de ti (lo que te pusiste o guardaste suma; lo que no te
// gustó, no vuelve). Tu estilo de Pinterest (los colores y estilos que más se
// repiten en tus inspiraciones) suma un poco. Salen 3 opciones distintas
// entre sí. También tus propias ocasiones (cada una se arma como la que
// elegiste de base), "¿Con qué combino esto?" (una prenda que va sí o sí) y
// lo que se manda a la IA.
// Pruebas: tests/ropa-outfit-motor.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./ropa-motor.js"));
  else root.RopaOutfitMotor = factory(root.RopaMotor);
})(typeof self !== "undefined" ? self : this, function (M) {
"use strict";

// ---- Ocasiones ----
const OCASIONES = [
  { id: "casual", nombre: "Casual", formal: 2, estilos: ["casual", "urbano"] },
  { id: "trabajo", nombre: "Trabajo", formal: 3.5, estilos: ["formal", "clasico", "elegante"] },
  { id: "noche", nombre: "Salir de noche", formal: 3, estilos: ["elegante", "urbano"] },
  { id: "deporte", nombre: "Deporte", formal: 1, estilos: ["deportivo"] },
  { id: "formal", nombre: "Evento formal", formal: 4.5, estilos: ["formal", "elegante", "clasico"] }
];
const OCASION = Object.fromEntries(OCASIONES.map(o => [o.id, o]));
// Las tuyas (meta/ropa_ajustes.ocasiones: [{ id, nombre, como }]) se arman
// como la de base que elegiste ("¿A cuál se parece?"), con su nombre.
function ocasion(id, propias) {
  if (OCASION[id]) return OCASION[id];
  const p = (propias || []).find(o => o && o.id === id);
  return p && OCASION[p.como] ? Object.assign({}, OCASION[p.como], { id: p.id, nombre: p.nombre, como: p.como }) : OCASION.casual;
}
// La de base ("casual", "trabajo"…): la tuya se porta como la que elegiste.
const tipoDe = oc => oc.como || oc.id;
// Tus ocasiones, limpias: hasta 8, con nombre (sin repetir ni pisar las de
// siempre), un id "o-…" y una de base.
function ocasionesPropias(x) {
  const nombres = new Set(OCASIONES.map(o => M.plano(o.nombre).trim())), ids = new Set();
  return (Array.isArray(x) ? x : []).map(o => {
    const q = o && typeof o === "object" ? o : {};
    const nombre = M.mayus(String(q.nombre == null ? "" : q.nombre).replace(/\s+/g, " ").trim().slice(0, 24));
    const k = M.plano(nombre).trim();
    if (!nombre || typeof q.id !== "string" || !/^o-[a-z0-9]{1,20}$/.test(q.id) || ids.has(q.id) || nombres.has(k) || !OCASION[q.como]) return null;
    ids.add(q.id); nombres.add(k);
    return { id: q.id, nombre, como: q.como };
  }).filter(Boolean).slice(0, 8);
}

// ---- Colores: neutros y fuertes ----
// Neutros: negro, grises, blancos y cremas, beige y camel, cafés, azul marino,
// verde oliva y el azul de jean. Lo demás es un color fuerte.
const NEUTRAS = new Set(["negro", "gris", "blanco", "beige", "cafe", "azul-marino", "oliva"]);
const esNeutro = id => !M.COLOR[id] || NEUTRAS.has(M.COLOR[id].fam) || id === "azul-jean";
const principal = p => (p.colores[0] ? p.colores[0].id : null);
const familia = id => (M.COLOR[id] ? M.COLOR[id].fam : id);
function fuertes(items) {
  const fams = [];
  items.forEach(p => { const c = principal(p); if (c && !esNeutro(c) && !fams.some(f => f.fam === M.COLOR[c].fam)) fams.push({ fam: M.COLOR[c].fam, id: c }); });
  return fams;
}

// ---- Cada prenda ----
const ORDEN = { frio: 0, templado: 1, calor: 2 };
// El clima de la prenda contra el que hace falta: justo ese +2; al lado, 0;
// opuesto (una chompa gruesa con calor, sandalias con frío) −3; sin clima, 0.
// Un día extremo también le resta a la que llega hasta el otro lado (un jean
// de frío y templado a 30 °C, una polera de templado y calor a 5 °C): −1.5.
function puntosClima(p, quiere, extremo) {
  if (!p.clima.length || !quiere) return 0;
  const ds = p.clima.map(c => Math.abs(ORDEN[c] - ORDEN[quiere]));
  const d = Math.min(...ds);
  return d === 0 ? 2 : d === 1 ? (extremo && Math.max(...ds) === 2 ? -1.5 : 0) : -3;
}
const climaDe = t => (t < 12 ? "frio" : t < 22 ? "templado" : "calor");
// Un día extremo: lo que manda se siente de 26 °C para arriba o de menos de 8 °C.
const extremo = t => typeof t === "number" && (t >= 26 || t < 8);
const DIA = 86400000;
const diasEntre = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DIA);
// Cuándo te la pusiste: ayer o antes de ayer resta; nunca, suma un poco (para
// estrenar). Repetir los zapatos o el abrigo es lo normal: resta mucho menos.
const REPETIR = { zapatos: 0.25, abrigos: 0.25, accesorios: 0 };
function puntosUso(p, ctx) {
  const u = ctx.usos && ctx.usos.get(p.id);
  if (!u || !u.ultima) return 0.3;
  const d = diasEntre(u.ultima, ctx.hoy);
  const f = p.grupo in REPETIR ? REPETIR[p.grupo] : 1;
  return f * (d <= 0 ? -6 : d <= 1 ? -3 : d <= 3 ? -1.5 : d <= 7 ? -0.5 : 0);
}
// Tu estilo de Pinterest ({ colores: [ids], estilos: [ids] }, de "Mi estilo"):
// su color de la familia de los tuyos +0.4; cada estilo que se repite +0.3 (hasta 2).
function puntosEstilo(p, e) {
  const c = principal(p);
  const s = c && (e.colores || []).some(x => familia(x) === familia(c)) ? 0.4 : 0;
  return s + Math.min(2, p.estilo.filter(x => (e.estilos || []).includes(x)).length) * 0.3;
}
// rol: "base" (arriba, abajo, cuerpo), "abrigo", "zapatos" o "accesorio".
function puntosPrenda(p, rol, ctx) {
  const n = ctx.nec || {}, oc = ocasion(ctx.ocasion, ctx.ocasiones);
  let s = 0;
  if (rol === "abrigo") s += puntosClima(p, n.abrigo === "abrigo" ? "frio" : "templado");
  // Los zapatos no te los sacas: van con el momento más frío del día.
  else if (rol === "zapatos") s += puntosClima(p, n.bajo != null ? climaDe(n.bajo) : n.base, extremo(n.bajo)) * 0.5;
  else if (rol !== "accesorio") s += puntosClima(p, n.base, extremo(n.temp));
  s -= Math.abs((p.formalidad || 2.5) - oc.formal) * 1.2 + (p.formalidad ? 0 : 0.3);
  s += Math.min(2, p.estilo.filter(e => oc.estilos.includes(e)).length) * 0.8;
  if (rol === "zapatos") {
    const t = M.plano(p.tipo);
    if ((n.lluvia === "si" || n.tormenta || (n.bajo != null && n.bajo < 15)) && /sandalia/.test(t)) s -= 2;
    if (n.nieve && /bota/.test(t)) s += 2;
    if (tipoDe(oc) === "deporte" && /zapatilla/.test(t)) s += 1.5;
  }
  if (rol === "abrigo" && (n.viento || n.lluvia === "si") && /rompevientos|parka|chamarra/.test(M.plano(p.tipo))) s += 0.8;
  if (ctx.estilo && rol !== "accesorio") s += puntosEstilo(p, ctx.estilo);
  return s + puntosUso(p, ctx);
}

// ---- Lo que aprendió de ti ----
// outfits: [{ prendas: [ids], gusto: "si" | "no" | null, ocasion }] → { pares,
// vetados }. Lo de la misma ocasión (o sin ocasión) cuenta entero; lo de otra
// parecida (un punto de formalidad o menos), la mitad; lo de una muy distinta
// (lo casual para un evento formal), nada. Lo que no te gustó no vuelve nunca.
function gustos(outfits, ocasionId, propias) {
  const pares = new Map(), vetados = new Set();
  const actual = ocasionId ? ocasion(ocasionId, propias) : null;
  const conocida = id => !!OCASION[id] || (propias || []).some(x => x && x.id === id);
  const peso = o => (!actual || !o.ocasion || o.ocasion === ocasionId || !conocida(o.ocasion) ? 1
    : Math.abs(ocasion(o.ocasion, propias).formal - actual.formal) <= 1 ? 0.5 : 0);
  (outfits || []).forEach(o => {
    const ids = [...new Set(o.prendas || [])].sort();
    if (ids.length < 2) return;
    if (o.gusto === "no") vetados.add(ids.join("|"));
    const s = (o.gusto === "si" ? 1 : o.gusto === "no" ? -1 : 0) * peso(o);
    if (!s) return;
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const k = `${ids[i]}|${ids[j]}`;
      pares.set(k, (pares.get(k) || 0) + s);
    }
  });
  return { pares, vetados };
}
const clave = ids => [...new Set(ids)].sort().join("|");

// Cuánto te gustan juntas esas prendas: cada par suma lo suyo (tope ±2 por
// par) y, en total, nunca más de ±3, para que le gane al clima o a la ocasión.
// → { s (los puntos), si (cuánto te gustaron, sumando solo lo bueno) }.
function afinidad(items, g) {
  let s = 0, si = 0;
  if (g) {
    const ids = items.map(p => p.id).sort();
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const v = Math.max(-2, Math.min(2, g.pares.get(`${ids[i]}|${ids[j]}`) || 0));
      s += v;
      if (v > 0) si += v;
    }
  }
  return { s: Math.max(-3, Math.min(3, s * 0.8)), si };
}

// ---- Cada combinación ----
function puntosCombo(items, ctx, g) {
  let s = 0;
  const fs = fuertes(items);
  s += fs.length === 0 ? 0.5 : fs.length === 1 ? 1 : fs.length === 2 ? -1 : -3;
  const estampadas = items.filter(p => p.estampado && p.estampado !== "liso").length;
  if (estampadas >= 2) s -= 2 * (estampadas - 1);
  const fo = items.map(p => p.formalidad).filter(Boolean);
  if (fo.length >= 2) { const salto = Math.max(...fo) - Math.min(...fo); s += salto <= 1 ? 0.5 : salto === 2 ? 0 : -1.5; }
  return s + afinidad(items, g).s;
}

// ---- Armar ----
// ropero: prendas normalizadas (RopaMotor.normalizar); ctx: { nec (de
// RopaClima.necesidades), ocasion (id), ocasiones (las tuyas), usos (Map de
// RopaMotor.usos), hoy, outfits (los guardados, para los gustos), estilo ({
// colores, estilos } de tus inspiraciones, o nada), base (id: va sí o sí),
// evitar ([[ids]]: lo que ya viste), n }. → { opciones: [{ prendas, puntos,
// nombre, porque, capas }], falta } (falta: lo que impide armar, en palabras).
const TOPE = { arriba: 10, abajo: 8, cuerpo: 6, zapatos: 6, abrigos: 6 };
function armar(ropero, ctx) {
  const c = Object.assign({ n: 3, evitar: [] }, ctx || {});
  const listas = (ropero || []).filter(p => p.estado === "activa");
  const base = c.base ? (ropero || []).find(p => p.id === c.base) : null;
  if (c.base && (!base || base.estado !== "activa")) return { opciones: [], falta: base && base.estado === "lavar" ? "Esa prenda está para lavar." : "Esa prenda ya no está en tu ropero." };
  // Un accesorio como base: el outfit de siempre, con ese accesorio.
  if (base && base.grupo === "accesorios") return armar(ropero, Object.assign({}, c, { base: null, conAccesorio: base }));
  const g = gustos(c.outfits, c.ocasion || "casual", c.ocasiones);
  const evitar = new Set((c.evitar || []).map(clave));
  const de = grupo => listas.filter(p => p.grupo === grupo);
  const top = (grupo, rol) => {
    if (base && base.grupo === grupo) return [{ p: base, s: puntosPrenda(base, rol, c) + 3 }];
    return de(grupo).map(p => ({ p, s: puntosPrenda(p, rol, c) })).sort((a, b) => b.s - a.s || (a.p.id < b.p.id ? -1 : 1)).slice(0, TOPE[grupo]);
  };
  const arriba = top("arriba", "base"), abajo = top("abajo", "base"), cuerpo = top("cuerpo", "base");
  const zapatos = top("zapatos", "zapatos"), abrigos = top("abrigos", "abrigo");
  const nec = c.nec || {};
  // El abrigo: hace falta (frío o capas), conviene (fresco) o no va (calor), salvo que sea la prenda base.
  const abrigoVa = base && base.grupo === "abrigos" ? "si" : nec.abrigo === "abrigo" ? "si" : nec.abrigo === "liviano" ? "puede" : "no";
  const opcAbrigo = abrigoVa === "no" || !abrigos.length ? [null] : abrigoVa === "si" ? abrigos : [null].concat(abrigos);
  const opcZapatos = zapatos.length ? zapatos : [null];
  const cuerpos = [];
  if (!(base && ["arriba", "abajo"].includes(base.grupo))) cuerpo.forEach(x => cuerpos.push([x]));
  if (!(base && base.grupo === "cuerpo")) arriba.forEach(a => abajo.forEach(b => cuerpos.push([a, b])));
  if (!cuerpos.length) {
    return { opciones: [], falta: !arriba.length && !cuerpo.length ? "Te falta ropa de arriba (poleras, camisas…) en el ropero." : "Te falta ropa de abajo (pantalones, jeans…) en el ropero." };
  }
  const combos = [];
  cuerpos.forEach(cu => opcZapatos.forEach(z => opcAbrigo.forEach(ab => {
    const partes = cu.concat([z, ab]).filter(Boolean);
    const items = partes.map(x => x.p);
    const k = clave(items.map(p => p.id));
    if (g.vetados.has(k) || evitar.has(k)) return;
    let s = partes.reduce((t, x) => t + x.s, 0) + puntosCombo(items, c, g);
    if (ab && abrigoVa === "puede") s += 0.5;
    combos.push({ items, s, k });
  })));
  combos.sort((a, b) => b.s - a.s || (a.k < b.k ? -1 : 1));
  // Tres distintas: que cambien al menos dos prendas; si no alcanza, una.
  const elegidas = [];
  const distinta = (a, b, min) => a.items.filter(p => !b.items.includes(p)).length >= min;
  [2, 1].forEach(min => combos.forEach(x => {
    if (elegidas.length < c.n && !elegidas.includes(x) && elegidas.every(e => distinta(x, e, min))) elegidas.push(x);
  }));
  const opciones = elegidas.map(x => {
    const items = conAccesorios(x.items, listas, c);
    return { prendas: ordenar(items).map(p => p.id), puntos: Math.round(x.s * 10) / 10, nombre: nombre(items), porque: porque(items, c, g), capas: capas(items, nec) };
  });
  return { opciones, falta: opciones.length ? "" : "No encontré combinaciones nuevas: prueba con otra ocasión." };
}
// Los accesorios que pide el día (sol: gorra o sombrero y lentes; mucho frío:
// bufanda o guantes) y un cinturón para el trabajo o lo formal.
function conAccesorios(items, listas, c) {
  const nec = c.nec || {}, out = items.slice(), t = tipoDe(ocasion(c.ocasion, c.ocasiones));
  const acc = listas.filter(p => p.grupo === "accesorios");
  const uno = re => acc.filter(p => re.test(M.plano(p.tipo)) && !out.includes(p)).sort((a, b) => puntosPrenda(b, "accesorio", c) - puntosPrenda(a, "accesorio", c))[0];
  if (c.conAccesorio && !out.includes(c.conAccesorio)) out.push(c.conAccesorio);
  // Sol fuerte: lentes (no de noche) y, para lo casual o el deporte, gorra o sombrero (al trabajo, solo sombrero).
  if (nec.sol && t !== "noche") {
    const cabeza = ["casual", "deporte"].includes(t) ? uno(/gorra|sombrero/) : t === "trabajo" ? uno(/sombrero/) : null;
    if (cabeza) out.push(cabeza);
    const y = uno(/lentes/);
    if (y) out.push(y);
  }
  if (nec.bajo != null && nec.bajo < 6) { const x = uno(/bufanda|guantes/); if (x) out.push(x); }
  if (["trabajo", "formal"].includes(t) && items.some(p => p.grupo === "abajo" && !/short|buzo|leggings/.test(M.plano(p.tipo)))) { const x = uno(/cinturon/); if (x) out.push(x); }
  return out;
}
const ORDEN_GRUPO = { abrigos: 0, cuerpo: 1, arriba: 1, abajo: 2, zapatos: 3, accesorios: 4 };
const ordenar = items => items.slice().sort((a, b) => ORDEN_GRUPO[a.grupo] - ORDEN_GRUPO[b.grupo]);
// "Todo neutro", "Con un toque de bordó", "Celeste y amarillo".
function nombre(items) {
  const fs = fuertes(items.filter(p => p.grupo !== "accesorios"));
  if (!fs.length) return "Todo neutro";
  const nom = f => M.nombreColor(f.id).toLowerCase();
  return fs.length === 1 ? `Con un toque de ${nom(fs[0])}` : `${M.nombreColor(fs[0].id)} y ${nom(fs[1])}`;
}
// Por qué: lo que más pesa, en una o dos frases.
function porque(items, c, g) {
  const r = [];
  const nec = c.nec || {}, oc = ocasion(c.ocasion, c.ocasiones);
  const abrigo = items.find(p => p.grupo === "abrigos");
  if (abrigo && nec.capas) r.push(`${M.titulo(abrigo)} para la mañana fría`);
  else if (abrigo && nec.abrigo) r.push(`${M.titulo(abrigo)} para el frío`);
  else if (nec.base === "calor") r.push("Liviano para el calor");
  // Lo que ya te gustó junto pesa más que los colores (va antes): si es de verdad
  // (dos pares que te gustaron, o uno dos veces), no por una sola vez.
  const ya = afinidad(items, g).si >= 2;
  if (ya) r.push("combina prendas que ya te gustaron juntas");
  const fs = fuertes(items.filter(p => p.grupo !== "accesorios"));
  // Un color fuerte que se repite en tus inspiraciones: lo dice.
  const tuyo = c.estilo && fs.find(f => (c.estilo.colores || []).some(x => familia(x) === f.fam));
  r.push(tuyo ? `con el ${M.nombreColor(tuyo.id).toLowerCase()} de tus inspiraciones`
    : fs.length ? (fs.length === 1 ? `colores neutros con un toque de ${M.nombreColor(fs[0].id).toLowerCase()}` : "dos colores que se lucen") : "colores neutros que combinan solos");
  const estreno = items.find(p => p.grupo !== "accesorios" && !(c.usos && c.usos.get(p.id)));
  if (estreno && !ya) r.push(`estrenas ${M.titulo(estreno).toLowerCase()}`);
  if ((oc.como || oc.id !== "casual") && r.length < 3) r.push(`va bien para ${oc.nombre.toLowerCase()}`);
  const t = r.slice(0, 2).join("; ");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) + "." : "";
}
// Cómo llevar las capas (si las hay).
function capas(items, nec) {
  const abrigo = items.find(p => p.grupo === "abrigos");
  if (abrigo && nec.capas) return `Para la mañana, ${M.titulo(abrigo).toLowerCase()}; al mediodía ya no hace falta.`;
  return "";
}

// ---- Para la IA ----
// Lo que se le manda (sin notas, talla, precio ni fotos; sin lo que está para
// lavar ni lo que ya no tienes).
const roperoParaIA = ropero => (ropero || []).filter(p => p.estado === "activa").map(p => ({
  id: p.id, grupo: p.grupo, tipo: p.tipo, colores: p.colores.map(x => x.id), estampado: p.estampado, tela: p.tela, corte: p.corte || "", manga: p.manga || "",
  estilo: p.estilo.slice(), clima: p.clima.slice(), formalidad: p.formalidad, marca: p.marca, lavar: false
}));
// Lo que te pusiste en los últimos días (para no repetir).
function recientes(usosDocs, hoy, dias) {
  const ids = new Set();
  Object.keys(usosDocs || {}).forEach(f => {
    const d = diasEntre(f, hoy);
    if (d >= 0 && d <= (dias || 7) && Array.isArray(usosDocs[f].prendas)) usosDocs[f].prendas.forEach(id => ids.add(id));
  });
  return [...ids];
}
// Las opciones que contestó la IA (ya con ids) → solo las que se pueden
// poner: completas (arriba y abajo, o cuerpo entero; zapatos si tienes), sin
// repetir grupos, con la prenda base y sin lo vetado o ya visto.
function validas(opciones, ropero, ctx) {
  const c = ctx || {};
  const por = new Map((ropero || []).filter(p => p.estado === "activa").map(p => [p.id, p]));
  const hayZapatos = [...por.values()].some(p => p.grupo === "zapatos");
  const g = gustos(c.outfits);
  const evitar = new Set((c.evitar || []).map(clave));
  const vistas = new Set();
  return (opciones || []).map(o => {
    const items = [...new Set(o.prendas || [])].map(id => por.get(id)).filter(Boolean);
    const cuantas = grupo => items.filter(p => p.grupo === grupo).length;
    const completa = (cuantas("cuerpo") === 1 && !cuantas("abajo")) || (cuantas("cuerpo") === 0 && cuantas("arriba") >= 1 && cuantas("abajo") === 1);
    if (!completa || cuantas("arriba") > 2 || cuantas("zapatos") > 1 || cuantas("abrigos") > 1 || (hayZapatos && !cuantas("zapatos"))) return null;
    if (c.base && !items.some(p => p.id === c.base)) return null;
    const k = clave(items.map(p => p.id));
    if (g.vetados.has(k) || evitar.has(k) || vistas.has(k)) return null;
    vistas.add(k);
    return Object.assign({}, o, { prendas: ordenar(items).map(p => p.id) });
  }).filter(Boolean);
}

return { OCASIONES, OCASION, ocasion, tipoDe, ocasionesPropias, puntosEstilo, NEUTRAS, esNeutro, fuertes, puntosClima, extremo, puntosPrenda, puntosCombo, afinidad, gustos, clave, armar, nombre, roperoParaIA, recientes, validas, diasEntre };
});
