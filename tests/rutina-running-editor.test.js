// Rutinas de Running: editor en la app (js/rutina-running-editor.js, D-124).
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/rutina-running-editor.js");
const RR = require("../js/rutina-running.js");
const leerCsv = require("../js/importar-rutinas.js").leerCsv;

const c = (tipo, seg, texto) => ({ tipo, seg, texto: texto || "" });

test("rutina nueva: calentamiento, 4 series y enfriamiento (20 min)", () => {
  const b = E.nueva();
  assert.equal(b.length, 3);
  assert.equal(b[1].repetir, 4);
  assert.equal(E.resumen(b), "10 intervalos · 20 min");
  const v = E.validar("Intervalos", b);
  assert.equal(v.ok, true);
  assert.equal(v.intervalos.length, 10);
  assert.equal(v.totalSeg, 1200);
  assert.notEqual(E.nueva(), E.nueva(), "cada vez una copia nueva");
});

test("expandir: las series se repiten en orden", () => {
  const xs = E.expandir([c("caminar", 300, "Calentamiento"), { repetir: 2, intervalos: [c("correr", 60), c("caminar", 90)] }, c("caminar", 300)]);
  assert.deepEqual(xs.map(x => `${x.tipo} ${x.seg}`), ["caminar 300", "correr 60", "caminar 90", "correr 60", "caminar 90", "caminar 300"]);
  assert.deepEqual(E.expandir(null), []);
  assert.equal(E.expandir([{ tipo: "volar", seg: "45", texto: "  x  " }])[0].tipo, "correr", "un tipo raro se vuelve correr");
  assert.equal(E.expandir([{ tipo: "trotar", seg: "45", texto: "  hola   mundo " }])[0].texto, "hola mundo");
});

test("agrupar: lo que se repite seguido queda como serie y nada cambia", () => {
  const xs = E.expandir(E.nueva());
  const b = E.agrupar(xs);
  assert.equal(b.length, 3);
  assert.equal(b[1].repetir, 4);
  assert.deepEqual(E.expandir(b), xs);
  // La plantilla de siempre (CSV): el último "correr" no tiene su pareja.
  const plan = RR.desdeTexto(RR.PLANTILLA, { nombre: "Plan" }, leerCsv);
  plan.dias.forEach(d => {
    const g = E.agrupar(d.intervalos);
    assert.deepEqual(E.expandir(g), d.intervalos.map(x => ({ tipo: x.tipo, seg: x.seg, texto: x.texto })), `día ${d.dia}: igual al expandir`);
    assert.ok(g.length < d.intervalos.length, `día ${d.dia}: queda más corto (${g.length} pasos)`);
  });
  // Nada que se repita: igual que antes, paso por paso.
  const sueltos = [c("caminar", 60), c("correr", 120), c("trotar", 30)];
  assert.deepEqual(E.agrupar(sueltos), sueltos);
  // Intervalos todos iguales no son una serie.
  assert.equal(E.agrupar([c("correr", 60), c("correr", 60), c("correr", 60), c("correr", 60)]).length, 4);
  // Grupos de 3.
  const tres = [c("correr", 60), c("trotar", 60), c("caminar", 60)];
  const g3 = E.agrupar([].concat(tres, tres, tres));
  assert.deepEqual(g3, [{ repetir: 3, intervalos: tres }]);
  assert.deepEqual(E.agrupar([]), []);
});

test("bloquesDe: usa los pasos guardados si coinciden; si no, agrupa", () => {
  const bloques = [c("caminar", 300), { repetir: 3, intervalos: [c("correr", 60), c("caminar", 60)] }];
  const intervalos = E.expandir(bloques);
  assert.deepEqual(E.bloquesDe({ intervalos, bloques }), bloques);
  // Alguien cambió los intervalos (por ejemplo, otra versión de la app): manda la lista.
  const otros = intervalos.slice(0, 3);
  assert.deepEqual(E.expandir(E.bloquesDe({ intervalos: otros, bloques })), otros);
  // Importada de un CSV (sin pasos).
  assert.deepEqual(E.expandir(E.bloquesDe({ intervalos })), intervalos);
  assert.deepEqual(E.bloquesDe(null), []);
});

test("duración en dos casillas", () => {
  assert.deepEqual(E.partes(90), { min: 1, seg: 30 });
  assert.deepEqual(E.partes(0), { min: 0, seg: 0 });
  assert.equal(E.segDe("1", "30"), 90);
  assert.equal(E.segDe("", "45"), 45);
  assert.equal(E.segDe("2", ""), 120);
  assert.equal(E.segDe("0", "90"), 90, "90 segundos también vale");
  assert.equal(E.segDe("1,5", ""), 90, "1,5 minutos");
  assert.ok(Number.isNaN(E.segDe("x", "1")));
  assert.equal(E.mmss(65), "1:05");
});

test("paso nuevo: lo contrario del último, con la duración de antes", () => {
  assert.deepEqual(E.siguientePaso([c("caminar", 300), c("correr", 90), c("caminar", 120)]), { tipo: "correr", seg: 90, texto: "" });
  assert.deepEqual(E.siguientePaso([c("caminar", 300), c("correr", 90)]), { tipo: "caminar", seg: 300, texto: "" });
  assert.deepEqual(E.siguientePaso([]), { tipo: "correr", seg: 60, texto: "" });
  assert.deepEqual(E.siguientePaso([c("descanso", 30)]), { tipo: "correr", seg: 60, texto: "" });
});

test("validar: nombre, duraciones, series y límites, con dónde está el error", () => {
  const sinNombre = E.validar("  ", E.nueva());
  assert.equal(sinNombre.ok, false);
  assert.deepEqual(sinNombre.errores[0], { texto: "Ponle un nombre a la rutina.", paso: null, sub: null, campo: "nombre" });
  const corto = E.validar("R", [c("correr", 3)]);
  assert.deepEqual(corto.errores[0], { texto: "El paso 1 dura muy poco (mínimo 5 segundos).", paso: 0, sub: null, campo: "dur" });
  const largo = E.validar("R", [c("correr", 7300)]);
  assert.match(largo.errores[0].texto, /dura más de 2 horas/);
  const enSerie = E.validar("R", [c("caminar", 60), { repetir: 3, intervalos: [c("correr", 60), c("caminar", 0)] }]);
  assert.deepEqual(enSerie.errores[0], { texto: "En la serie del paso 2, el intervalo 2 dura muy poco (mínimo 5 segundos).", paso: 1, sub: 1, campo: "dur" });
  assert.match(E.validar("R", [{ repetir: 0, intervalos: [c("correr", 60)] }]).errores[0].texto, /se repite de 1 a 50 veces/);
  assert.match(E.validar("R", [{ repetir: 51, intervalos: [c("correr", 60)] }]).errores[0].texto, /se repite de 1 a 50 veces/);
  assert.match(E.validar("R", [{ repetir: 2, intervalos: [] }]).errores.map(e => e.texto).join(" "), /no tiene intervalos/);
  assert.match(E.validar("R", []).errores[0].texto, /Agrega al menos un intervalo/);
  // 201 intervalos.
  const muchos = E.validar("R", [{ repetir: 50, intervalos: [c("correr", 10), c("caminar", 10), c("trotar", 10), c("descanso", 10)] }, c("correr", 10)]);
  assert.match(muchos.errores[0].texto, /Son 201 intervalos; el máximo es 200/);
  // Más de 4 horas.
  const horas = E.validar("R", [{ repetir: 3, intervalos: [c("correr", 3600), c("caminar", 1800)] }]);
  assert.match(horas.errores[0].texto, /dura 270 minutos; el máximo es 4 horas/);
  // Una serie de una sola vez vale (es como no repetirla).
  assert.equal(E.validar("R", [{ repetir: 1, intervalos: [c("correr", 60), c("caminar", 60)] }]).ok, true);
});

test("lo que se guarda: lo de siempre más los pasos", () => {
  const b = [c("caminar", 300, "Calentamiento"), { repetir: 2, intervalos: [c("correr", 60), c("caminar", 90)] }];
  const v = E.validar(" Mi rutina ", b);
  const g = E.aGuardar(" Mi rutina ", v);
  assert.deepEqual(Object.keys(g).sort(), ["bloques", "intervalos", "nombre", "totalSeg", "v"]);
  assert.equal(g.nombre, "Mi rutina");
  assert.equal(g.totalSeg, 600);
  assert.equal(g.intervalos.length, 5);
  assert.deepEqual(g.bloques, b);
  // La rutina en vivo usa la lista de siempre: el resumen de siempre.
  assert.equal(RR.resumen(g), "5 intervalos · 10 min");
});

test("la cola: después de una, arriba de todas", () => {
  const rs = [{ id: "a", orden: 1 }, { id: "b", orden: 2 }, { id: "c", orden: 5 }];
  assert.equal(E.ordenDespues(rs, "a"), 1.5);
  assert.equal(E.ordenDespues(rs, "c"), 6, "después de la última: al final");
  assert.equal(E.ordenDespues(rs, "zz"), 6);
  assert.equal(E.ordenPrimero(rs), 0);
  assert.equal(E.ordenPrimero([]), 0);
  const nueva = rs.concat([{ id: "d", orden: E.ordenDespues(rs, "a") }]);
  assert.deepEqual(RR.ordenarCola(nueva).map(r => r.id), ["a", "d", "b", "c"]);
});

test("copias: nombre con (copia) y un día de plan pasa a ser el día siguiente", () => {
  assert.equal(E.nombreCopia("Series", ["Series"]), "Series (copia)");
  assert.equal(E.nombreCopia("Series", ["Series", "Series (copia)"]), "Series (copia 2)");
  assert.equal(E.nombreCopia("Series (copia)", ["Series", "Series (copia)"]), "Series (copia 2)");
  assert.equal(E.nombreCopia("", []), "Rutina (copia)");
  assert.ok(E.nombreCopia("x".repeat(80), []).length <= RR.LIMITES.nombre);
  const rs = [
    { id: "p1", plan: "plan_1", dia: 1, nombre: "5K", intervalos: [c("correr", 60)] },
    { id: "p2", plan: "plan_1", dia: 2, nombre: "5K", intervalos: [c("correr", 90)] },
    { id: "s", nombre: "Series", intervalos: [c("correr", 60), c("caminar", 60)], bloques: [c("correr", 60), c("caminar", 60)] }
  ];
  const d = E.copia(rs[0], rs);
  assert.deepEqual({ plan: d.plan, dia: d.dia, nombre: d.nombre }, { plan: "plan_1", dia: 3, nombre: "5K" });
  assert.notEqual(d.intervalos, rs[0].intervalos, "una copia, no la misma lista");
  const s = E.copia(rs[2], rs);
  assert.equal(s.nombre, "Series (copia)");
  assert.equal(s.totalSeg, 120);
  assert.deepEqual(s.bloques, rs[2].bloques);
  assert.equal("plan" in s, false);
});
