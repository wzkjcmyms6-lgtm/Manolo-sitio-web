// ---------- Ropa: lo que opina tu estilista, la lógica (D-160) ----------
// Sin pantalla ni red (tests/ropa-opinion-motor.test.js). Lo que ve Manolo en
// tu ropero (sin lo que ya no tienes): frases con números de verdad, cada una
// con su referencia (h1, h2…) para que tu estilista las comente sin cambiar
// los números (cuánto de cada parte, un color que domina, los zapatos todos
// oscuros o claros, todo liso, nada muy formal, nada para el calor o el frío,
// lo que no te pones hace 3 meses, lo que más te pones, tus colores, lo que
// tienes de sobra y cuántas combinaciones salen). Tu ropa con las veces que
// te la pusiste, lo que se repite en tus pines en palabras, cada repaso
// guardado (users/{uid}/ropa_opiniones), para "¿Qué opinas?", cambiar una
// prenda por otra, y el aviso del día en Outfits (D-161): lo que te sugirió
// que le serviría al clima o a la ocasión del día, si todavía no lo tienes.
// Para las ideas de Inspiración (D-164): "Así lo usarías", un outfit de ejemplo
// con tu ropa y la prenda que te sugirió (con las reglas de Outfits).
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./ropa-motor.js"), require("./ropa-compras-motor.js"), require("./ropa-numeros-motor.js"), require("./ropa-estilista-motor.js"), require("./ropa-insp-motor.js"), require("./ropa-outfit-motor.js"));
  } else root.RopaOpinionMotor = factory(root.RopaMotor, root.RopaComprasMotor, root.RopaNumerosMotor, root.RopaEstilistaMotor, root.RopaInspMotor, root.RopaOutfitMotor);
})(typeof self !== "undefined" ? self : this, function (M, K, N, E, I, O) {
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

// ---- El aviso del día en Outfits (D-161) ----
// Lo que tu estilista sugirió en su último repaso y le serviría a las opciones
// del día: por el clima (la lluvia, el frío, ir en capas, el calor, el viento
// o el sol fuerte) o por la ocasión (trabajo, algo formal, la noche o hacer
// deporte). Se mira el tipo de prenda (no su porqué: es texto libre). Sin lo
// que ya tienes (igual o parecido), lo que ya compraste o ya no quieres (en
// tu lista de deseos) y lo que ocultaste. Uno solo: el primer motivo que
// toca, con la primera sugerencia que le sirve. Sin IA: no cuesta nada.
// Una sugerencia como cosa de la lista de deseos: { grupo, tipo, colores [id] }.
const cosaDe = s => ({ grupo: s.grupo, tipo: s.tipo, colores: s.color && M.COLOR[s.color] ? [s.color] : [] });
// ¿Ya tienes algo igual o parecido (el mismo tipo, del mismo color o sin color)?
function laTienes(s, ropero) {
  const v = { grupo: s.grupo, tipo: s.tipo, colores: cosaDe(s).colores, estampado: "", tela: "" };
  return (ropero || []).some(p => p && p.estado !== "fuera" && ["igual", "parecida"].includes(I.cuanto(I.parecido(v, p))));
}
const tipo = s => M.plano(s.tipo);
const en = (s, grupo, re) => s.grupo === grupo && re.test(tipo(s));
// Del clima del día (RopaClima.necesidades), en este orden. sirve: cuánto le
// sirve (0, nada; con frío, un abrigo más que unas botas).
const POR_CLIMA = [
  { id: "lluvia", hay: n => !!n.tormenta || n.lluvia === "si",
    sirve: s => (en(s, "zapatos", /bota|botin|impermeable|cerrad|lluvia/) || en(s, "abrigos", /impermeable|rompeviento|cortaviento|parka|piloto|gabardina|trench|lluvia/) ? 2 : 0) || (en(s, "accesorios", /paraguas/) ? 1 : 0) },
  { id: "frio", hay: n => n.abrigo === "abrigo" || n.base === "frio" || !!n.nieve,
    sirve: s => (s.grupo === "abrigos" ? 3 : 0) || (en(s, "arriba", /chompa|sueter|polar|buzo|cardigan|chaleco|cuello alto|lana|termic|hoodie|poleron|sudadera/) ? 2 : 0)
      || (en(s, "zapatos", /bota|botin/) || en(s, "accesorios", /bufanda|chalina|gorro|guante/) ? 1 : 0) },
  { id: "capas", hay: n => !!n.capas,
    sirve: s => ((s.grupo === "abrigos" && !/parka|plumon|pluma|acolchad/.test(tipo(s))) || en(s, "arriba", /cardigan|sobrecamisa|chaleco|chompa|sueter|camisa/) ? 1 : 0) },
  { id: "calor", hay: n => n.base === "calor",
    sirve: s => (en(s, "arriba", /polera|musculosa|camiseta|lino|manga corta|top|guayabera/) || en(s, "abajo", /short|bermuda|falda|lino/)
      || en(s, "cuerpo", /vestido|enterizo|mono/) || en(s, "zapatos", /sandalia|alpargata|chancla/) ? 1 : 0) },
  { id: "viento", hay: n => !!n.viento, sirve: s => (en(s, "abrigos", /rompeviento|cortaviento/) ? 1 : 0) },
  { id: "sol", hay: n => !!n.sol, sirve: s => (en(s, "accesorios", /gorra|sombrero|lentes|gafas/) ? 1 : 0) }
];
// De la ocasión elegida (su tipo: RopaOutfitMotor.tipoDe).
const POR_OCASION = {
  trabajo: /saco|blazer|camisa|pantalon de (vestir|tela)|chino|vestido|mocasin|oxford|derby|zapato/,
  formal: /saco|blazer|traje|camisa|pantalon de vestir|vestido|corbata|mocasin|oxford|derby|zapato/,
  noche: /camisa|blazer|vestido|botin|cuero/,
  deporte: /zapatilla|deport|calza|legging|buzo|short/
};
// op: el último repaso (normalizar); ropero: tus prendas (normalizadas); o: {
// nec (el clima del día; sin clima, nada), ocasion (su tipo), deseos (tu
// lista, normalizada), ocultos ([claves]) }. → { i (cuál sugerencia), s,
// clave, nombre, motivo } o null.
function avisoDelDia(op, ropero, o) {
  const x = o || {};
  const sug = op && op.ia ? op.ia.sugerencias : [];
  if (!sug.length) return null;
  const ocultos = new Set(x.ocultos || []);
  const deseos = x.deseos || [];
  // Ya la compraste o ya no la quieres (y no la volviste a pedir).
  const noVa = k => deseos.some(d => d.clave === k && (d.estado === "comprado" || d.estado === "descartado")) && !deseos.some(d => d.clave === k && d.estado === "quiero");
  const sirven = sug.map((s, i) => ({ i, s, clave: K.clave(cosaDe(s)) })).filter(c => !ocultos.has(c.clave) && !noVa(c.clave) && !laTienes(c.s, ropero));
  const oc = POR_OCASION[x.ocasion];
  const motivos = (x.nec ? POR_CLIMA.filter(m => m.hay(x.nec)) : []).concat(oc ? [{ id: x.ocasion, sirve: s => (oc.test(tipo(s)) ? 1 : 0) }] : []);
  for (const m of motivos) {
    let mejor = null, max = 0;
    sirven.forEach(y => { const n = m.sirve(y.s); if (n > max) { max = n; mejor = y; } });
    if (mejor) return Object.assign(mejor, { nombre: K.normalizarDeseo("x", cosaDe(mejor.s)).nombre, motivo: m.id });
  }
  return null;
}
const FRASE = {
  lluvia: d => `Para la lluvia de ${d}`, frio: d => `Para el frío de ${d}`, capas: d => `Para ir en capas ${d}`,
  calor: d => `Para el calor de ${d}`, viento: d => `Para el viento de ${d}`, sol: d => `Para el sol fuerte de ${d}`,
  trabajo: () => "Para el trabajo", formal: () => "Para algo formal", noche: () => "Para la noche", deporte: () => "Para hacer deporte"
};
// "Para la lluvia de hoy, tu estilista te sugirió:" (o "de mañana").
const fraseAviso = (a, manana) => `${(FRASE[a && a.motivo] || (() => "Para hoy"))(manana ? "mañana" : "hoy")}, tu estilista te sugirió:`;
// Lo que ocultaste ([claves], hasta 30; lo más nuevo al final).
const ocultar = (lista, k) => [...new Set((Array.isArray(lista) ? lista : []).filter(x => typeof x === "string" && x && x !== k).concat(k ? [k] : []))].slice(-30);

// ---- "Así lo usarías" (D-164) ----
// La prenda que te sugirió, como si ya la tuvieras (id "__idea"), en un outfit
// con tu ropa: lo arman las reglas de Outfits (un día templado, casual; sin IA,
// no cuesta nada). ctx: { usos, hoy, outfits } (para lo que te gusta). → [ids]
// (con "__idea") o [] si no sale.
const IDEA = "__idea";
const NEUTRO = { base: "templado", abrigo: "", capas: false, lluvia: "", tormenta: false, nieve: false, viento: false, sol: false };
function ideaComoPrenda(s) {
  return M.normalizar(IDEA, { v: 1, grupo: s.grupo, tipo: s.tipo, colores: cosaDe(s).colores.map(id => ({ id })), estampado: "liso", tela: "", estilo: [], clima: [], formalidad: null, estado: "activa", fotos: [], creado: 0 });
}
function ideaEnOutfit(s, ropero, ctx) {
  if (!s || !M.GRUPO[s.grupo]) return [];
  const tuyas = (ropero || []).filter(p => p && p.estado !== "fuera" && p.id !== IDEA);
  const r = O.armar(tuyas.concat([ideaComoPrenda(s)]), Object.assign({ nec: NEUTRO, ocasion: "casual", n: 1, evitar: [] }, ctx || {}, { base: IDEA }));
  const o = r.opciones[0];
  return o && o.prendas.includes(IDEA) && o.prendas.length >= 2 ? o.prendas : [];
}

return { MAX_HECHOS, hechos, roperoParaRepaso, pinesTexto, normalizar, ordenar, veredicto, cambiar, cosaDe, laTienes, avisoDelDia, fraseAviso, ocultar, IDEA, ideaComoPrenda, ideaEnOutfit };
});
