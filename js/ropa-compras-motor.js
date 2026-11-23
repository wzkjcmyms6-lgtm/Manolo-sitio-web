// ---------- Ropa: compras desde Pinterest (sin pantalla, D-150) ----------
// Qué te falta: lo que se repite en tus inspiraciones (lo que vio la IA en
// cada pin; cada pin cuenta una vez, desde 2 pines, sin accesorios) y no
// tienes ni igual ni parecido (mismo tipo —por familia: chaqueta y chamarra
// son lo mismo— y color de la misma familia). Si lo tienes en otro color,
// igual falta, pero lo dice. Cuántos outfits nuevos te daría con tu ropa, con
// reglas (los colores, los estampados, la formalidad y el clima tienen que
// ir): siempre igual y sin gastar. Qué no comprar: lo que ya tienes de sobra
// (3 o más del mismo tipo y color). La lista de deseos (normalizar y la clave
// de cada cosa, para no repetirla) y lo que gastaste en ropa en el mes.
// Nunca compra nada: solo muestra ideas.
// Pruebas: tests/ropa-compras-motor.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./ropa-motor.js"), require("./ropa-insp-motor.js"), require("./ropa-outfit-motor.js"));
  else root.RopaComprasMotor = factory(root.RopaMotor, root.RopaInspMotor, root.RopaOutfitMotor);
})(typeof self !== "undefined" ? self : this, function (M, I, O) {
"use strict";

const texto = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max || 80);
const fechaOk = f => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f);
const num = v => (typeof v === "number" && isFinite(v) && v > 0 ? v : 0);
const fam = id => (M.COLOR[id] ? M.COLOR[id].fam : "");
// El primer color de una prenda tuya ([{ id }]) o de una que se ve ([id]).
const colorDe = x => { const c = ((x && x.colores) || [])[0]; return typeof c === "string" ? c : c && c.id ? c.id : ""; };
// La clave de una cosa: grupo, tipo (por familia) y color (por familia).
const clave = x => [x.grupo, I.familiaTipo(x.tipo || ""), fam(colorDe(x)) || "sin"].join("|");
const ORDEN_GRUPO = { abrigos: 0, arriba: 1, cuerpo: 2, abajo: 3, zapatos: 4, accesorios: 5 };
// Lo que más se repite de una lista (si empatan, el primero en orden alfabético).
function masComun(xs) {
  const m = new Map();
  xs.forEach(x => m.set(x, (m.get(x) || 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))[0][0];
}
const nombreDe = (tipo, colores) => I.nombreVista({ tipo, colores, detalle: "" });
// "Ver opciones en Pinterest": la búsqueda lista ("abrigo camel outfit").
const buscar = x => `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(`${nombreDe(x.tipo, x.colores || []).toLowerCase()} outfit`)}`;

// ---- Qué te falta ----
// inspiraciones y ropero: normalizadas (RopaInspMotor y RopaMotor). min: en
// cuántos pines tiene que estar (2). → [{ clave, grupo, tipo, colores [id],
// estampado, nombre, n (en cuántos pines), pines [ids], clima [los que más se
// repiten en esos pines], formalidad (la de esos looks), otroColor (si tienes
// del mismo tipo en otro color) }], de lo que más se repite a lo que menos.
function faltan(inspiraciones, ropero, min) {
  const tuyas = (ropero || []).filter(p => p.estado !== "fuera");
  const cosas = new Map();
  (inspiraciones || []).forEach(x => {
    if (!x || x.oculta || !x.analisis || !x.analisis.esRopa) return;
    const a = x.analisis, enEste = new Set();
    a.prendas.forEach(v => {
      if (!M.GRUPO[v.grupo] || v.grupo === "accesorios" || !texto(v.tipo)) return;
      const k = clave(v);
      if (enEste.has(k)) return;   // cada pin cuenta una vez
      enEste.add(k);
      const c = cosas.get(k) || { clave: k, grupo: v.grupo, vistas: [], pines: [], climas: [], formal: [] };
      c.vistas.push(v);
      c.pines.push(x.id);
      c.climas.push(...a.clima);
      if (a.formalidad) c.formal.push(a.formalidad);
      cosas.set(k, c);
    });
  });
  return [...cosas.values()].filter(c => c.pines.length >= (min || 2)).map(c => {
    const tipo = masComun(c.vistas.map(v => texto(v.tipo, 40)));
    const color = masComun(c.vistas.map(v => v.colores[0] || ""));
    const colores = color ? [color] : [];
    const v = { grupo: c.grupo, tipo, colores, estampado: masComun(c.vistas.map(x => x.estampado || "")), tela: "" };
    // ¿Ya tienes una igual o parecida? Entonces no falta.
    let otroColor = false;
    for (const p of tuyas) {
      const r = I.cuanto(I.parecido(v, p));
      if (r === "igual" || r === "parecida") return null;
      if (r === "reemplazo" && I.familiaTipo(p.tipo) === I.familiaTipo(tipo)) otroColor = true;
    }
    const climas = c.climas.length ? [...new Set(c.climas)].sort((a, b) => c.climas.filter(x => x === b).length - c.climas.filter(x => x === a).length).slice(0, 2) : [];
    const formalidad = c.formal.length ? Math.round(c.formal.reduce((s, f) => s + f, 0) / c.formal.length) : null;
    return { clave: c.clave, grupo: c.grupo, tipo, colores, estampado: v.estampado, nombre: nombreDe(tipo, colores), n: c.pines.length, pines: c.pines, clima: climas, formalidad, otroColor };
  }).filter(Boolean).sort((a, b) => b.n - a.n || ORDEN_GRUPO[a.grupo] - ORDEN_GRUPO[b.grupo] || a.nombre.localeCompare(b.nombre, "es"));
}

// ---- Cuántos outfits nuevos te daría ----
const ORDEN_CLIMA = { frio: 0, templado: 1, calor: 2 };
// Dos prendas de climas opuestos (una solo de frío y otra solo de calor) no
// van juntas; de climas vecinos, sí (una polera de calor con un jean, un
// abrigo de frío sobre una camisa de templado).
const opuestas = (a, b) => !!(a.clima && a.clima.length && b.clima && b.clima.length)
  && Math.min(...a.clima.flatMap(x => b.clima.map(y => Math.abs(ORDEN_CLIMA[x] - ORDEN_CLIMA[y])))) >= 2;
// ¿Van juntas? Hasta dos colores fuertes, un solo estampado, la formalidad sin
// saltos de más de 2 y ningún par de climas opuestos.
function vanJuntas(items) {
  if (O.fuertes(items).length > 2) return false;
  if (items.filter(p => p.estampado && p.estampado !== "liso").length > 1) return false;
  const fo = items.map(p => p.formalidad).filter(Boolean);
  if (fo.length >= 2 && Math.max(...fo) - Math.min(...fo) > 2) return false;
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (opuestas(items[i], items[j])) return false;
  return true;
}
// nueva: { grupo, tipo, colores [id], estampado, clima, formalidad } (como las
// de "Qué te falta"). Con tu ropa (sin lo que ya no tienes): lo de arriba con
// cada cosa de abajo con la que va (y al revés); un vestido, con cada par de
// zapatos; zapatos o un abrigo, con cada conjunto (arriba y abajo que van, o
// cuerpo entero) con el que va. → cuántos.
function outfitsNuevos(nueva, ropero) {
  const p = Object.assign({ id: "__nueva", estilo: [], clima: [], formalidad: null, estampado: "liso" }, nueva, { colores: (nueva.colores || []).map(id => ({ id })) });
  const tuyas = (ropero || []).filter(x => x.estado !== "fuera");
  const de = g => tuyas.filter(x => x.grupo === g);
  const arriba = de("arriba"), abajo = de("abajo"), cuerpo = de("cuerpo"), zapatos = de("zapatos");
  if (p.grupo === "arriba") return abajo.filter(b => vanJuntas([p, b])).length;
  if (p.grupo === "abajo") return arriba.filter(a => vanJuntas([a, p])).length;
  if (p.grupo === "cuerpo") return zapatos.length ? zapatos.filter(z => vanJuntas([p, z])).length : 1;
  if (p.grupo === "zapatos" || p.grupo === "abrigos") {
    let n = 0;
    arriba.forEach(a => abajo.forEach(b => { if (vanJuntas([a, b]) && vanJuntas([a, b, p])) n++; }));
    cuerpo.forEach(c => { if (vanJuntas([c, p])) n++; });
    return n;
  }
  return 0;
}

// ---- Qué no comprar ----
// Lo que ya tienes de sobra: min (3) o más del mismo tipo y color (sin lo que
// ya no tienes). → [{ clave, grupo, nombre, n, prendas [ids] }], de lo que más
// tienes a lo que menos.
function deSobra(ropero, min) {
  const m = new Map();
  (ropero || []).filter(p => p.estado !== "fuera").forEach(p => {
    const k = clave(p);
    const g = m.get(k) || { clave: k, grupo: p.grupo, prendas: [] };
    g.prendas.push(p);
    m.set(k, g);
  });
  return [...m.values()].filter(g => g.prendas.length >= (min || 3))
    .map(g => ({ clave: g.clave, grupo: g.grupo, nombre: masComun(g.prendas.map(p => M.titulo(p))), n: g.prendas.length, prendas: g.prendas.map(p => p.id) }))
    .sort((a, b) => b.n - a.n || ORDEN_GRUPO[a.grupo] - ORDEN_GRUPO[b.grupo] || a.nombre.localeCompare(b.nombre, "es"));
}

// ---- Lo que gastaste en ropa ----
// mes: "AAAA-MM". El precio de lo que compraste ese mes (aunque ya no la
// tengas). → { total, n (con precio), sinPrecio }
function gastoDelMes(ropero, mes) {
  let total = 0, n = 0, sinPrecio = 0;
  (ropero || []).forEach(p => {
    if (!p.compra || p.compra.slice(0, 7) !== mes) return;
    if (num(p.precio)) { total += p.precio; n++; } else sinPrecio++;
  });
  return { total: Math.round(total * 100) / 100, n, sinPrecio };
}
// El presupuesto del mes (meta/ropa_ajustes.presupuestoMes): un número de 1 a 100.000, o nada.
const presupuesto = v => (typeof v === "number" && isFinite(v) && v >= 1 && v <= 100000 ? Math.round(v * 100) / 100 : null);

// ---- La lista de deseos (users/{uid}/ropa_deseos) ----
// { grupo, tipo, colores [id], nota, inspiraciones [ids], origen (falta | pin
// | manual), estado (quiero | comprado | descartado), prendaId, compradoFecha,
// creado, editado } → limpio, con su clave y su nombre.
const ESTADOS = ["quiero", "comprado", "descartado"];
function normalizarDeseo(id, d) {
  const x = d && typeof d === "object" ? d : {};
  const grupo = M.GRUPO[x.grupo] ? x.grupo : "arriba";
  const tipo = texto(x.tipo, 40) || "Prenda";
  const colores = [...new Set((Array.isArray(x.colores) ? x.colores : []).filter(c => typeof c === "string" && M.COLOR[c]))].slice(0, 3);
  return {
    id, grupo, tipo, colores, clave: clave({ grupo, tipo, colores }), nombre: nombreDe(tipo, colores), nota: texto(x.nota, 200),
    inspiraciones: [...new Set((Array.isArray(x.inspiraciones) ? x.inspiraciones : []).filter(s => typeof s === "string" && s))].slice(0, 24),
    origen: ["falta", "pin", "manual"].includes(x.origen) ? x.origen : "manual", estado: ESTADOS.includes(x.estado) ? x.estado : "quiero",
    prendaId: typeof x.prendaId === "string" ? x.prendaId : "", compradoFecha: fechaOk(x.compradoFecha) ? x.compradoFecha : "",
    creado: num(x.creado), editado: num(x.editado)
  };
}

return { clave, colorDe, buscar, faltan, vanJuntas, outfitsNuevos, deSobra, gastoDelMes, presupuesto, normalizarDeseo, ESTADOS };
});
