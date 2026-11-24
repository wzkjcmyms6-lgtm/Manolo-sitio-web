// ---------- Ropa: lo que opina tu estilista, la lógica (D-160) ----------
// Sin pantalla ni red (tests/ropa-opinion-motor.test.js). Lo que ve Manolo en
// tu ropero (sin lo que ya no tienes): frases con números de verdad, cada una
// con su referencia (h1, h2…) para que tu estilista las comente sin cambiar
// los números (cuánto de cada parte, un color que domina, los zapatos todos
// oscuros o claros, todo liso, nada muy formal, nada para el calor o el frío,
// lo que no te pones hace 3 meses, lo que más te pones, tus colores, lo que
// tienes de sobra y cuántas combinaciones salen). Tu ropa con las veces que
// te la pusiste, lo que se repite en tus pines en palabras, cada repaso
// guardado (users/{uid}/ropa_opiniones) y, para "¿Qué opinas?", cambiar una
// prenda por otra.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./ropa-motor.js"), require("./ropa-compras-motor.js"), require("./ropa-numeros-motor.js"), require("./ropa-estilista-motor.js"));
  } else root.RopaOpinionMotor = factory(root.RopaMotor, root.RopaComprasMotor, root.RopaNumerosMotor, root.RopaEstilistaMotor);
})(typeof self !== "undefined" ? self : this, function (M, K, N, E) {
"use strict";

const MAX_HECHOS = 15;
const obj = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const texto = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const num = v => (typeof v === "number" && isFinite(v) && v >= 0 ? v : 0);
const ids = (v, max) => [...new Set((Array.isArray(v) ? v : []).filter(x => typeof x === "string" && x))].slice(0, max || 8);
const fechaOk = f => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f);
// "a, b y c"
const lista = xs => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

// ---- Lo que ve Manolo ----
const CUANTAS = {
  arriba: n => `${n} de arriba`, abajo: n => `${n} de abajo`, cuerpo: n => `${n} de cuerpo entero`,
  abrigos: n => (n === 1 ? "1 abrigo" : `${n} abrigos`), zapatos: n => (n === 1 ? "1 par de zapatos" : `${n} pares de zapatos`),
  accesorios: n => (n === 1 ? "1 accesorio" : `${n} accesorios`)
};
// Cómo se dice cada parte en plural y si es "las" (prendas) o "los" (abrigos, zapatos).
const PARTE = {
  arriba: { tus: "prendas de arriba", f: 3 }, abajo: { tus: "prendas de abajo", f: 3 }, cuerpo: { tus: "prendas de cuerpo entero", f: 3 },
  abrigos: { tus: "abrigos", f: 2 }, zapatos: { tus: "pares de zapatos", f: 2 }
};
const fam = p => { const c = p.colores[0]; return c && M.COLOR[c.id] ? M.COLOR[c.id].fam : ""; };
// Qué tan claro es un color (0 a 1).
function luz(p) {
  const c = p.colores[0];
  if (!c || !M.COLOR[c.id]) return null;
  const [r, g, b] = M.hexARgb(M.COLOR[c.id].hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
// ropero: normalizadas (RopaMotor.normalizar); usosDocs: { "AAAA-MM-DD": { prendas } };
// hoy: "AAAA-MM-DD". → [{ id: "h1", texto }], hasta 15.
function hechos(ropero, usosDocs, hoy) {
  const tuyas = (ropero || []).filter(p => p && p.estado !== "fuera");
  const out = [];
  const sumar = t => { if (t && out.length < MAX_HECHOS) out.push(t); };
  const de = g => tuyas.filter(p => p.grupo === g);
  const cuantas = Object.fromEntries(M.GRUPOS.map(g => [g.id, de(g.id).length]));
  const total = tuyas.length;
  if (!total) return [];
  // Cuánto de cada parte.
  sumar(`Tienes ${total === 1 ? "1 prenda" : `${total} prendas`}: ${lista(M.GRUPOS.filter(g => cuantas[g.id]).map(g => CUANTAS[g.id](cuantas[g.id])))}.`);
  if (cuantas.arriba >= 4 && cuantas.abajo * 3 <= cuantas.arriba) sumar(`Tienes ${cuantas.arriba} de arriba y ${cuantas.abajo ? `solo ${cuantas.abajo}` : "nada"} de abajo.`);
  else if (cuantas.abajo >= 4 && cuantas.arriba * 2 <= cuantas.abajo) sumar(`Tienes más de abajo (${cuantas.abajo}) que de arriba (${cuantas.arriba}).`);
  if (total >= 6 && !cuantas.zapatos) sumar("No tienes zapatos cargados.");
  if (total >= 6 && !cuantas.abrigos) sumar("No tienes abrigos (chamarras, sacos, camperas…).");
  // Un color que domina una parte (4 o más y la mitad o más).
  Object.keys(PARTE).forEach(g => {
    const xs = de(g);
    if (xs.length < 4) return;
    const m = new Map();
    xs.forEach(p => { const f = fam(p); if (f) m.set(f, (m.get(f) || 0) + 1); });
    const top = [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
    if (!top || top[1] * 2 < xs.length || !M.COLOR[top[0]]) return;
    const formas = M.COLOR[top[0]].f;   // ["negro", "negra", "negros", "negras"] (o una sola)
    sumar(`${top[1]} de tus ${xs.length} ${PARTE[g].tus} son ${formas.length === 1 ? formas[0] : formas[PARTE[g].f]}.`);
  });
  // Los zapatos: todos oscuros o todos claros.
  const zs = de("zapatos").map(luz).filter(x => x != null);
  if (zs.length >= 2 && zs.length === cuantas.zapatos) {
    if (zs.every(x => x < 0.3)) sumar(`Tus ${cuantas.zapatos} pares de zapatos son oscuros.`);
    else if (zs.every(x => x > 0.7)) sumar(`Tus ${cuantas.zapatos} pares de zapatos son claros.`);
  }
  // Todo liso.
  if (total >= 8 && tuyas.every(p => !p.estampado || p.estampado === "liso")) sumar("Toda tu ropa es lisa: nada con estampado.");
  // Lo formal y el clima.
  const ropa = tuyas.filter(p => p.grupo !== "accesorios");
  if (ropa.length >= 5 && !ropa.some(p => (p.formalidad || 0) >= 4)) sumar("No tienes nada muy formal (para una reunión o un evento).");
  if (ropa.length >= 6 && !ropa.some(p => (p.clima || []).includes("calor"))) sumar("No tienes nada marcado para el calor.");
  if (ropa.length >= 6 && !cuantas.abrigos && !ropa.some(p => (p.clima || []).includes("frio"))) sumar("No tienes nada marcado para el frío.");
  // Lo que te pones y lo que no (de lo que anotaste).
  const n = N.numeros(tuyas, usosDocs || {}, hoy);
  const anotaste = Object.keys(usosDocs || {}).some(f => fechaOk(f) && Array.isArray(usosDocs[f].prendas) && usosDocs[f].prendas.length);
  if (!anotaste) sumar("Todavía no anotaste qué te pones: no sé qué usas más.");
  else {
    if (n.masUsadas.length) {
      const nombres = n.masUsadas.slice(0, 3).map(x => { const p = tuyas.find(y => y.id === x.id); return p ? `${M.titulo(p)} (${x.veces} veces)` : ""; }).filter(Boolean);
      if (nombres.length) sumar(`Lo que más te pones (en 3 meses): ${lista(nombres)}.`);
    }
    if (n.sinUsar.length) sumar(`${n.sinUsar.length === 1 ? "Hay 1 prenda que no te pusiste" : `Hay ${n.sinUsar.length} prendas que no te pusiste`} en 3 meses o más (según lo que anotaste).`);
  }
  // Tus colores.
  const cs = n.colores.filter(c => c.fam !== "otros").slice(0, 3);
  if (cs.length >= 2) sumar(`Tus colores: ${lista(cs.map(c => `${c.nombre.toLowerCase()} (${Math.round(c.pct * 100)} %)`))}.`);
  // De sobra.
  K.deSobra(tuyas, 3).slice(0, 2).forEach(x => sumar(`Tienes ${x.n} parecidas a «${x.nombre}» (del mismo tipo y color).`));
  // Cuántas combinaciones salen (arriba con abajo que van juntas, y lo de cuerpo entero).
  if (cuantas.arriba && cuantas.abajo) {
    let pares = 0;
    de("arriba").forEach(a => de("abajo").forEach(b => { if (K.vanJuntas([a, b])) pares++; }));
    sumar(`Con tu ropa salen ${pares === 1 ? "1 combinación" : `${pares} combinaciones`} de arriba y abajo que van juntas${cuantas.cuerpo ? ` (y ${cuantas.cuerpo} de cuerpo entero)` : ""}.`);
  }
  return out.slice(0, MAX_HECHOS).map((t, i) => ({ id: `h${i + 1}`, texto: t }));
}

// ---- Tu ropa para el repaso: con las veces que te la pusiste ----
function roperoParaRepaso(ropero, usosDocs) {
  const usos = M.usos(usosDocs || {});
  return E.roperoParaCharla(ropero).map(p => Object.assign(p, { veces: usos.get(p.id) ? usos.get(p.id).n : 0 }));
}
// Lo que se repite en tus pines (de "Qué te falta"), en palabras (hasta 600 letras).
function pinesTexto(faltan) {
  const t = (faltan || []).slice(0, 8).map(f => `${f.nombre} (en ${f.n} pines${f.otroColor ? "; tengo uno de otro color" : ""})`).join("; ");
  return t.length > 600 ? `${t.slice(0, 599)}…` : t;
}

// ---- Cada repaso guardado (users/{uid}/ropa_opiniones) ----
const GRUPOS_OK = ["arriba", "abajo", "cuerpo", "abrigos", "zapatos", "accesorios"];
// Lo guardado → { id, fecha, creado, n (cuántas prendas tenías), hechos, ia }.
function normalizar(id, d) {
  const x = obj(d), ia = obj(x.ia), col = obj(ia.colores);
  const colores = v => [...new Set((Array.isArray(v) ? v : []).filter(c => typeof c === "string" && M.COLOR[c]))].slice(0, 5);
  return {
    id, fecha: fechaOk(x.fecha) ? x.fecha : "", creado: num(x.creado), n: num(x.n),
    hechos: (Array.isArray(x.hechos) ? x.hechos : []).map(h => ({ id: texto(obj(h).id, 4), texto: texto(obj(h).texto, 200) })).filter(h => /^h\d{1,2}$/.test(h.id) && h.texto).slice(0, MAX_HECHOS),
    ia: {
      resumen: texto(ia.resumen, 600),
      comentarios: (Array.isArray(ia.comentarios) ? ia.comentarios : []).map(c => ({ hecho: texto(obj(c).hecho, 4), texto: texto(obj(c).texto, 300) })).filter(c => c.hecho && c.texto).slice(0, MAX_HECHOS),
      sugerencias: (Array.isArray(ia.sugerencias) ? ia.sugerencias : []).map(s => {
        const q = obj(s);
        const tipo = M.mayus(texto(q.tipo, 40));
        return GRUPOS_OK.includes(q.grupo) && tipo ? { grupo: q.grupo, tipo, color: M.COLOR[q.color] ? q.color : "", porque: texto(q.porque, 300), combina: ids(q.combina, 6) } : null;
      }).filter(Boolean).slice(0, 6),
      noComprar: (Array.isArray(ia.noComprar) ? ia.noComprar : []).map(t => texto(t, 160)).filter(Boolean).slice(0, 3),
      dejar: (Array.isArray(ia.dejar) ? ia.dejar : []).map(d => ({ prenda: texto(obj(d).prenda, 60), porque: texto(obj(d).porque, 300) })).filter(d => d.prenda).slice(0, 3),
      colores: { van: colores(col.van), sumar: colores(col.sumar).slice(0, 3), porque: texto(col.porque, 300) },
      consejos: (Array.isArray(ia.consejos) ? ia.consejos : []).map(t => texto(t, 300)).filter(Boolean).slice(0, 3)
    }
  };
}
// La más nueva primero.
const ordenar = xs => (xs || []).slice().sort((a, b) => b.creado - a.creado || (a.id < b.id ? 1 : -1));

// ---- "¿Qué opinas?" ----
const VEREDICTO = { "muy-bien": "Va muy bien", bien: "Va bien", cambiaria: "Yo cambiaría algo" };
const veredicto = v => VEREDICTO[v] || VEREDICTO.bien;
// Cambiar una prenda por otra (en el mismo lugar); si ya estaba, no se repite.
function cambiar(lista, sale, entra) {
  const xs = ids(lista, 12);
  if (!xs.includes(sale) || !entra) return xs;
  return [...new Set(xs.map(id => (id === sale ? entra : id)))];
}

return { MAX_HECHOS, hechos, roperoParaRepaso, pinesTexto, normalizar, ordenar, veredicto, cambiar };
});
