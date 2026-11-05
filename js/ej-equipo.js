// ---------- Equipo del gimnasio (sin pantalla) ----------
// Perfiles de equipo ("Gimnasio", "Casa"…): barra, discos, mancuernas,
// máquinas y poleas. Los usan los discos por lado, las microcargas, el
// calentamiento, el generador de rutinas y las alternativas.
// Se guardan en meta/ajustes_ejercicio.equipo = { activo, perfiles: { id: perfil } }
// (solo aditivo). Sin nada guardado se usa POR_DEFECTO.
// Pruebas: tests/ej-equipo.test.js.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.EjEquipo = Object.assign(root.EjEquipo || {}, api);
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const POR_DEFECTO = {
  nombre: "Gimnasio",
  barra: 20,           // kg de la barra olímpica
  barraEz: 10,
  barraHex: 25,
  smith: 0,            // la barra de la Smith suele estar compensada
  discos: [25, 20, 15, 10, 5, 2.5, 1.25], // kg de cada disco (hay pares de todos)
  mancuernas: { min: 2, max: 50, paso: 2 },
  kettlebells: { min: 4, max: 32, paso: 4 },
  pasoMaquina: 5,
  pasoPolea: 2.5,
  maquinas: true,
  poleas: true,
  barras: true,        // barra y discos
  mancuernasSi: true,
  dominadas: true,     // barra de dominadas / paralelas
  bandas: true,
  kettlebellsSi: true
};
const CASA = Object.assign({}, POR_DEFECTO, {
  nombre: "Casa", barra: 0, discos: [], mancuernas: { min: 2, max: 20, paso: 2 },
  maquinas: false, poleas: false, barras: false, dominadas: false, bandas: true, kettlebellsSi: false
});

function num(v, def) {
  const n = Number(String(v == null ? "" : v).replace(",", "."));
  return Number.isFinite(n) ? n : def;
}
const r2 = n => Math.round(n * 100) / 100;

// Perfil completo y válido a partir de lo guardado.
function normalizar(p) {
  const o = Object.assign({}, POR_DEFECTO, p || {});
  o.nombre = String(o.nombre || "Gimnasio").trim().slice(0, 30) || "Gimnasio";
  ["barra", "barraEz", "barraHex", "smith"].forEach(k => { o[k] = Math.max(0, Math.min(60, num(o[k], POR_DEFECTO[k]))); });
  o.discos = (Array.isArray(o.discos) ? o.discos : []).map(d => num(d, 0)).filter(d => d > 0 && d <= 50);
  o.discos = Array.from(new Set(o.discos)).sort((a, b) => b - a);
  const rango = (x, def) => {
    const r = Object.assign({}, def, x || {});
    const min = Math.max(0.5, num(r.min, def.min)), max = Math.max(min, num(r.max, def.max)), paso = Math.max(0.5, num(r.paso, def.paso));
    return { min, max, paso };
  };
  o.mancuernas = rango(o.mancuernas, POR_DEFECTO.mancuernas);
  o.kettlebells = rango(o.kettlebells, POR_DEFECTO.kettlebells);
  o.pasoMaquina = Math.max(0.5, num(o.pasoMaquina, 5));
  o.pasoPolea = Math.max(0.5, num(o.pasoPolea, 2.5));
  ["maquinas", "poleas", "barras", "mancuernasSi", "dominadas", "bandas", "kettlebellsSi"].forEach(k => { o[k] = !!o[k]; });
  return o;
}

// El perfil activo de meta/ajustes_ejercicio.equipo (o el de fábrica).
function perfilActivo(ajustes) {
  const e = ajustes && ajustes.equipo;
  if (!e || !e.perfiles) return normalizar(null);
  return normalizar(e.perfiles[e.activo] || Object.values(e.perfiles)[0]);
}
function perfiles(ajustes) {
  const e = ajustes && ajustes.equipo;
  if (!e || !e.perfiles || !Object.keys(e.perfiles).length) return { activo: "gimnasio", perfiles: { gimnasio: normalizar(null), casa: normalizar(CASA) } };
  const out = {};
  Object.keys(e.perfiles).forEach(k => { out[k] = normalizar(e.perfiles[k]); });
  return { activo: out[e.activo] ? e.activo : Object.keys(out)[0], perfiles: out };
}

// Equipo que se puede usar con el perfil (ids de equipo de la base).
function disponibles(perfil) {
  const p = normalizar(perfil);
  const s = new Set(["peso_corporal", "otro"]);
  if (p.barras) ["barra", "barra_ez", "barra_hex"].forEach(x => s.add(x));
  if (p.mancuernasSi) s.add("mancuerna");
  if (p.maquinas) { s.add("maquina"); s.add("smith"); }
  if (p.poleas) s.add("polea");
  if (p.bandas) s.add("banda");
  if (p.kettlebellsSi) s.add("kettlebell");
  s.add("fitball");
  return s;
}

// Cómo se carga un ejercicio según su equipo.
function modo(ficha, perfil) {
  const p = normalizar(perfil);
  const eq = ficha && ficha.equipo;
  if (eq === "barra") return { tipo: "barra", barra: p.barra };
  if (eq === "barra_ez") return { tipo: "barra", barra: p.barraEz };
  if (eq === "barra_hex") return { tipo: "barra", barra: p.barraHex };
  if (eq === "smith") return { tipo: "barra", barra: p.smith };
  if (eq === "mancuerna") return { tipo: "lista", rango: p.mancuernas };
  if (eq === "kettlebell") return { tipo: "lista", rango: p.kettlebells };
  if (eq === "maquina") return { tipo: "paso", paso: p.pasoMaquina };
  if (eq === "polea") return { tipo: "paso", paso: p.pasoPolea };
  return { tipo: "paso", paso: ficha && ficha.tipo === "peso_corporal" ? 1.25 : 0.5 };
}

// La menor subida posible (microcarga) para ese ejercicio con tu equipo.
function microcarga(ficha, perfil) {
  const p = normalizar(perfil);
  const m = modo(ficha, p);
  if (m.tipo === "barra") return p.discos.length ? 2 * Math.min(...p.discos) : 2.5;
  if (m.tipo === "lista") return m.rango.paso;
  return m.paso;
}

// Redondea un peso a uno que puedes armar. hacia: "cerca" | "abajo" | "arriba".
function redondear(kg, ficha, perfil, hacia) {
  const p = normalizar(perfil);
  const m = modo(ficha, p);
  const k = num(kg, 0);
  if (!(k > 0)) return 0;
  const f = hacia === "abajo" ? Math.floor : hacia === "arriba" ? Math.ceil : Math.round;
  if (m.tipo === "barra") {
    const paso = microcarga(ficha, p);
    if (k <= m.barra) return m.barra;
    return r2(m.barra + f(r2((k - m.barra) / paso)) * paso);
  }
  if (m.tipo === "lista") {
    const { min, max, paso } = m.rango;
    const v = min + f(r2((k - min) / paso)) * paso;
    return r2(Math.min(max, Math.max(min, v)));
  }
  return r2(Math.max(m.paso, f(r2(k / m.paso)) * m.paso));
}

// Discos por lado para llegar a kg con una barra. → { discos: [kg…], resto }
// resto > 0 si no se puede armar exacto (falta un disco más chico).
function discosPorLado(kg, barra, discos) {
  const b = num(barra, 20);
  let lado = r2((num(kg, 0) - b) / 2);
  const out = [];
  if (lado <= 0) return { discos: out, resto: 0, lado: 0 };
  (discos || POR_DEFECTO.discos).slice().sort((a, c) => c - a).forEach(d => {
    while (lado >= d - 1e-9) { out.push(d); lado = r2(lado - d); }
  });
  return { discos: out, resto: lado, lado: r2((num(kg, 0) - b) / 2) };
}
function textoDiscos(r) {
  if (!r.discos.length) return "solo la barra";
  const grupos = [];
  r.discos.forEach(d => {
    const g = grupos.find(x => x.d === d);
    if (g) g.n++; else grupos.push({ d, n: 1 });
  });
  const t = grupos.map(g => `${g.n > 1 ? g.n + " × " : ""}${String(g.d).replace(".", ",")}`).join(" + ");
  return r.resto > 0 ? `${t} (faltan ${String(r.resto).replace(".", ",")} kg por lado)` : t;
}

return { POR_DEFECTO, CASA, normalizar, perfilActivo, perfiles, disponibles, modo, microcarga, redondear, discosPorLado, textoDiscos };
});
