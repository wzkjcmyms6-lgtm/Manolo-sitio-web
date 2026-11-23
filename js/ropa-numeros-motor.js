// ---------- Ropa: tus números (sin pantalla, D-151) ----------
// Lo que más te pones (los últimos 90 días, desde 2 veces), lo que no te
// pones hace 3 meses o más (o nunca, si la tienes hace 3 meses o más), tus
// colores (el principal de cada prenda, por familia) y el que más te pones,
// cuánto te sale cada uso (precio ÷ veces que te la pusiste: lo que mejor y
// lo que menos rinde, y lo que no estrenaste), lo que invertiste y los días
// que anotaste lo que te pusiste. Sin lo que ya no tienes.
// Sin DOM: tests/ropa-numeros-motor.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./ropa-motor.js"));
  else root.RopaNumerosMotor = factory(root.RopaMotor);
})(typeof self !== "undefined" ? self : this, function (M) {
"use strict";

const DIA = 86400000;
const ms = f => Date.UTC(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10)));
const fechaDe = t => new Date(t).toISOString().slice(0, 10);
const sumarDias = (f, n) => fechaDe(ms(f) + n * DIA);
const diasEntre = (a, b) => Math.round((ms(b) - ms(a)) / DIA);
const SIN_USAR = 90;   // "hace 3 meses o más"
const DESDE_OK = Date.UTC(2020, 0, 1);   // antes de esto, la fecha en que la agregaste no se sabe
const conPrecio = p => typeof p.precio === "number" && isFinite(p.precio) && p.precio > 0;

// El color principal de una prenda, por familia → { fam, hex, nombre } o null.
function familiaDe(p) {
  const c = p.colores[0];
  if (!c || !M.COLOR[c.id]) return null;
  const fam = M.COLOR[c.id].fam, base = M.COLOR[fam];
  return { fam, hex: base ? base.hex : M.COLOR[c.id].hex, nombre: base ? M.nombreColor(fam) : M.nombreColor(c.id) };
}

// ropero: normalizadas (RopaMotor.normalizar); usosDocs: { "AAAA-MM-DD": {
// prendas: [ids] } }; hoy: "AAAA-MM-DD". → { total, porGrupo, dias30,
// invertido, conPrecio, masUsadas [{ id, veces }], sinUsar [{ id, ultima,
// dias (desde la última vez, o desde que la tienes; null si no se sabe) }],
// colores [{ fam, hex, nombre, n, pct }] (hasta 7 y "otros"), colorMasPuesto
// ({ fam, nombre, veces } o null), rinde { mejor, peor, sinEstrenar } }.
function numeros(ropero, usosDocs, hoy) {
  const tuyas = (ropero || []).filter(p => p.estado !== "fuera");
  const usos = M.usos(usosDocs || {});
  const desde90 = sumarDias(hoy, -(SIN_USAR - 1)), desde30 = sumarDias(hoy, -29);
  const veces90 = id => { const u = usos.get(id); return u ? u.fechas.filter(f => f >= desde90 && f <= hoy).length : 0; };
  const r = M.resumen(tuyas);
  const dias30 = Object.keys(usosDocs || {}).filter(f => f >= desde30 && f <= hoy && Array.isArray(usosDocs[f].prendas) && usosDocs[f].prendas.length).length;

  const masUsadas = tuyas.map(p => ({ id: p.id, veces: veces90(p.id) })).filter(x => x.veces >= 2)
    .sort((a, b) => b.veces - a.veces || (a.id < b.id ? -1 : 1)).slice(0, 5);

  const sinUsar = tuyas.map(p => {
    const u = usos.get(p.id);
    const ultima = u && u.ultima ? u.ultima : "";
    const desde = ultima || (p.creado >= DESDE_OK ? fechaDe(p.creado) : "");
    return { id: p.id, ultima, dias: desde ? diasEntre(desde, hoy) : null };
  }).filter(x => (x.dias == null ? !x.ultima : x.dias >= SIN_USAR))
    .sort((a, b) => (b.dias == null ? Infinity : b.dias) - (a.dias == null ? Infinity : a.dias) || (a.id < b.id ? -1 : 1));

  const porFam = new Map();
  const vecesFam = new Map();
  tuyas.forEach(p => {
    const f = familiaDe(p);
    if (!f) return;
    const x = porFam.get(f.fam) || Object.assign({ n: 0 }, f);
    x.n++;
    porFam.set(f.fam, x);
    vecesFam.set(f.fam, (vecesFam.get(f.fam) || 0) + veces90(p.id));
  });
  const conColor = [...porFam.values()].reduce((s, x) => s + x.n, 0);
  let colores = [...porFam.values()].sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, "es"));
  if (colores.length > 8) {
    const resto = colores.slice(7);
    colores = colores.slice(0, 7).concat([{ fam: "otros", hex: "", nombre: "Otros", n: resto.reduce((s, x) => s + x.n, 0) }]);
  }
  colores = colores.map(x => Object.assign({}, x, { pct: conColor ? x.n / conColor : 0 }));
  const famTop = [...vecesFam.entries()].filter(e => e[1] > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const colorMasPuesto = famTop ? { fam: famTop[0], nombre: porFam.get(famTop[0]).nombre, veces: famTop[1] } : null;

  const precios = tuyas.filter(conPrecio).map(p => { const n = usos.get(p.id) ? usos.get(p.id).n : 0; return { id: p.id, precio: p.precio, veces: n, porUso: n ? Math.round((p.precio / n) * 100) / 100 : null }; });
  const usadas = precios.filter(x => x.veces >= 1).sort((a, b) => a.porUso - b.porUso || b.veces - a.veces || (a.id < b.id ? -1 : 1));
  // Con 4 o más: las 3 que mejor rinden y las 3 que menos (sin repetir); si no, una sola lista.
  const mejor = usadas.length >= 4 ? usadas.slice(0, 3) : usadas;
  const peor = usadas.length >= 4 ? usadas.slice(Math.max(3, usadas.length - 3)).reverse() : [];
  const sinEstrenar = precios.filter(x => !x.veces).sort((a, b) => b.precio - a.precio || (a.id < b.id ? -1 : 1)).slice(0, 5);

  return {
    total: r.total, porGrupo: r.porGrupo, lavar: r.lavar, dias30,
    invertido: Math.round(precios.reduce((s, x) => s + x.precio, 0) * 100) / 100, conPrecio: precios.length,
    masUsadas, sinUsar, colores, colorMasPuesto, rinde: { mejor, peor, sinEstrenar }
  };
}

// "hace 4 meses", "hace 1 año"…: cuánto hace (en días) en palabras.
function haceCuanto(dias) {
  if (dias == null) return "";
  if (dias < 60) return `hace ${dias} días`;
  if (dias < 365) return `hace ${Math.floor(dias / 30)} meses`;
  const a = Math.floor(dias / 365);
  return `hace ${a === 1 ? "1 año" : `${a} años`}`;
}

return { SIN_USAR, familiaDe, numeros, haceCuanto, sumarDias };
});
