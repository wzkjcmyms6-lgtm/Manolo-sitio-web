// Simulador de la dificultad de Hábitos (lo usan las pruebas y la tabla de
// docs/HABITOS.md). Corre el motor real (js/habitos-engine.js) con historias
// sintéticas: un hábito al X % durante N días, o 5 hábitos con misiones y
// jefes generados cada lunes como lo hace la app.
const E = require("../js/habitos-engine.js");

const INICIO = "2025-01-06"; // un lunes
const hecho = () => ({ e: "hecho", t: null });

// Días cumplidos repartidos parejo: con 0,8 falla 1 de cada 5 (Bresenham).
function patron(p, n, desfase) {
  const out = [];
  let acc = desfase == null ? 0.5 : desfase;
  for (let i = 0; i < n; i++) { acc += p; if (acc >= 1) { acc -= 1; out.push(true); } else out.push(false); }
  return out;
}
// Pseudoaleatorio con semilla (siempre igual).
function azar(semilla) {
  let s = semilla >>> 0 || 7;
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

// Un hábito diario (o con extra: freqType, timesPerWeek, cadaN…) cumplido según `dias` (array de bool).
function habito(id, dias, extra) {
  const registros = {};
  dias.forEach((ok, i) => { if (ok) registros[E.addDias(INICIO, i)] = hecho(); });
  return Object.assign({ id, name: id, inicio: INICIO, registros }, extra);
}
function rangoTras(dias, extra) {
  const h = habito("a", dias, extra);
  return E.evaluar([h], { hoy: E.addDias(INICIO, dias.length) }).habitos.a.rango;
}
const nombre = r => (r && r.tieneRango ? E.NIVELES[r.nivel].nombre : "Sin rango");

// División más común en los últimos `ventana` días evaluados (techo sostenido).
function techo(p, opciones) {
  const o = Object.assign({ dias: 1100, ventana: 365, azar: false, semilla: 11 }, opciones);
  const rnd = azar(o.semilla);
  const dias = o.azar ? Array.from({ length: o.dias }, () => rnd() < p) : patron(p, o.dias);
  const r = rangoTras(dias);
  const desde = E.addDias(INICIO, o.dias - o.ventana);
  const cuenta = {};
  r.serie.filter(x => x.fecha >= desde).forEach(x => { cuenta[x.nivel] = (cuenta[x.nivel] || 0) + 1; });
  const nivel = Number(Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a])[0]);
  return { nivel, nombre: E.NIVELES[nivel].nombre, fuerza: r.fuerza };
}

// 5 hábitos con constancia p (al azar, con semilla), misiones y jefes cada lunes.
// Devuelve el nivel (y XP) en cada día pedido.
function jugador(p, diasPedidos, opciones) {
  const o = Object.assign({ habitos: 5, semilla: 7, misiones: true, jefes: true }, opciones);
  const rnd = azar(o.semilla);
  const max = Math.max(...diasPedidos);
  const docs = Array.from({ length: o.habitos }, (_, i) => ({ id: "h" + i, name: "h" + i, inicio: INICIO, registros: {} }));
  const misiones = {}, jefes = {}, compras = [];
  const out = {};
  for (let k = 0; k < max; k++) {
    const f = E.addDias(INICIO, k);
    if (E.diaSemana(f) === 0) {
      const antes = E.evaluar(docs, { hoy: f, misiones, jefes });
      const sem = E.semanaId(f);
      if (o.misiones) misiones[sem] = E.generarMisiones(antes, f);
      if (o.jefes) { const j = E.generarJefe(antes, f); if (j) jefes[sem] = j; }
    }
    docs.forEach(d => { if (rnd() < p) d.registros[f] = hecho(); });
    if (diasPedidos.includes(k + 1)) {
      const r = E.evaluar(docs, { hoy: E.addDias(f, 1), misiones, jefes, compras });
      out[k + 1] = { nivel: r.nivel.nivel, xp: r.xp, titulo: r.nivel.titulo, monedas: r.monedas.ganadas, areas: r.areas };
    }
  }
  return out;
}

module.exports = { INICIO, patron, azar, habito, rangoTras, nombre, techo, jugador, E };
