const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../js/biblia-planes.js");

const HOY = "2026-11-14";
// leidos: { fecha: [claves] } a partir de una lista de [fecha, …claves].
const L = (...dias) => Object.fromEntries(dias.map(([f, ...ks]) => [f, ks]));

test("los calendarios de los planes reparten todos los capítulos", () => {
  const anio = P.calendario({ tipo: "anio" });
  assert.equal(anio.length, 365);
  assert.equal(anio.flat().length, 1189);
  assert.ok(anio.every(d => d.length === 3 || d.length === 4), "3 o 4 capítulos por día");
  assert.deepEqual(anio[0], ["Gen.1", "Gen.2", "Gen.3"]);
  assert.equal(anio[364][anio[364].length - 1], "Rev.22");
  const nt = P.calendario({ tipo: "nt90" });
  assert.equal(nt.length, 90);
  assert.equal(nt.flat().length, 260);
  assert.equal(nt[0][0], "Matt.1");
  const ev = P.calendario({ tipo: "evangelios30" });
  assert.equal(ev.flat().length, 89);
  const sal = P.calendario({ tipo: "salmos30" });
  assert.deepEqual(sal[0], ["Ps.1", "Ps.2", "Ps.3", "Ps.4", "Ps.5"]);
  assert.equal(sal.flat().length, 150);
  assert.equal(P.calendario({ tipo: "proverbios" }), null, "diario: sin calendario");
  const ritmo = P.calendario({ tipo: "ritmo", porDia: 4, desde: "Matt" });
  assert.equal(ritmo.length, Math.ceil(1189 / 4));
  assert.deepEqual(ritmo[0], ["Matt.1", "Matt.2", "Matt.3", "Matt.4"]);
  assert.ok(ritmo.flat().includes("Gen.1"), "da la vuelta hasta Génesis");
  assert.equal(ritmo.flat().length, 1189);
});

test("texto de una lectura", () => {
  assert.equal(P.texto(["Gen.1", "Gen.2", "Gen.3"]), "Génesis 1-3");
  assert.equal(P.texto(["Gen.50", "Exod.1", "Exod.2"]), "Génesis 50, Éxodo 1-2");
  assert.equal(P.texto(["Ps.119"]), "Salmos 119");
  assert.equal(P.texto(["Ps.1", "Ps.3"]), "Salmos 1, 3");
});

test("la lectura de hoy, el avance y el día", () => {
  const plan = P.nuevo({ tipo: "evangelios30", hoy: "2026-11-12", ahora: 1 });
  assert.deepEqual(plan, { tipo: "evangelios30", inicio: "2026-11-12", activo: true, creado: 1 });
  const cal = P.calendario(plan);
  // Leyó los días 1 y 2 completos.
  const leidos = L(["2026-11-12", ...cal[0]], ["2026-11-13", ...cal[1]]);
  const e = P.estado(plan, leidos, HOY);
  assert.equal(e.dia, 3);
  assert.deepEqual(e.lectura, cal[2], "hoy, el tercer día");
  assert.deepEqual(e.atrasados, []);
  assert.equal(e.progreso.leidos, cal[0].length + cal[1].length);
  assert.equal(e.terminado, false);
  // Leyó uno de hoy: queda el resto.
  const e2 = P.estado(plan, Object.assign({}, leidos, { [HOY]: [cal[2][0]] }), HOY);
  assert.deepEqual(e2.lectura, cal[2].slice(1));
  assert.equal(e2.hechasHoy, 1);
  // Lo leído antes de empezar el plan no cuenta.
  const e3 = P.estado(plan, { "2026-11-01": cal[0] }, "2026-11-12");
  assert.deepEqual(e3.lectura, cal[0]);
});

test("atrasado: ponerse al día de a poco o mover el plan", () => {
  const plan = P.nuevo({ tipo: "salmos30", hoy: "2026-11-10" });
  const cal = P.calendario(plan);
  // Solo leyó el primer día; hoy es el quinto.
  const leidos = L(["2026-11-10", ...cal[0]]);
  const e = P.estado(plan, leidos, HOY);
  assert.equal(e.dia, 5);
  assert.deepEqual(e.atrasados, cal[1].concat(cal[2], cal[3]), "3 días atrasado (15 salmos)");
  assert.deepEqual(e.lectura, cal[4], "sin ponerse al día, solo lo de hoy");
  // De a poco en 5 días: hoy suma 3 de los 15 atrasados.
  const conAlDia = Object.assign({}, plan, { alDia: P.ponerseAlDia(HOY, 5) });
  assert.deepEqual(conAlDia.alDia, { hasta: "2026-11-18" });
  const e2 = P.estado(conAlDia, leidos, HOY);
  assert.deepEqual(e2.lectura, cal[1].slice(0, 3).concat(cal[4]));
  assert.deepEqual(e2.extraHoy, cal[1].slice(0, 3));
  assert.deepEqual(e2.alDia, { activo: true, hasta: "2026-11-18" });
  // Al leer las 3 de hoy no aparecen otras: la parte de hoy queda fija.
  const conHoy = Object.assign({}, leidos, { [HOY]: cal[1].slice(0, 3).concat(cal[4]) });
  const e4 = P.estado(conAlDia, conHoy, HOY);
  assert.deepEqual(e4.lectura, [], "hoy, listo");
  assert.equal(e4.hechasHoy, 8);
  assert.equal(e4.atrasados.length, 12, "quedan 12 atrasados para los próximos días");
  // Mañana: 12 atrasados entre 4 días → 3 más.
  assert.deepEqual(P.estado(conAlDia, conHoy, "2026-11-15").extraHoy, cal[1].slice(3).concat(cal[2].slice(0, 1)));
  assert.equal(P.estado(conAlDia, leidos, "2026-11-19").alDia, null, "terminado el plazo, se apaga");
  // Mover: hoy pasa a ser el día 2.
  const corr = P.mover(plan, leidos, HOY);
  assert.equal(corr, 3);
  const e3 = P.estado(Object.assign({}, plan, { corrimiento: corr }), leidos, HOY);
  assert.equal(e3.dia, 2);
  assert.deepEqual(e3.lectura, cal[1]);
  assert.deepEqual(e3.atrasados, []);
  assert.equal(P.fin(Object.assign({}, plan, { corrimiento: corr })), "2026-12-12", "y termina 3 días más tarde");
});

test("plan terminado y plan vencido", () => {
  const plan = P.nuevo({ tipo: "evangelios30", hoy: "2026-10-01" });
  const cal = P.calendario(plan);
  const todo = L(["2026-10-15", ...cal.flat()]);
  assert.equal(P.estado(plan, todo, HOY).terminado, true);
  const vencido = P.estado(plan, L(["2026-10-01", ...cal[0]]), HOY);
  assert.equal(vencido.pasado, true);
  assert.deepEqual(vencido.lectura, [], "no hay lectura nueva");
  assert.equal(vencido.atrasados.length, 89 - cal[0].length, "todo lo que falta, atrasado");
});

test("Proverbios del día", () => {
  const plan = P.nuevo({ tipo: "proverbios", hoy: "2026-11-01" });
  const e = P.estado(plan, L(["2026-11-12", "Prov.12"], ["2026-11-13", "Prov.13"]), HOY);
  assert.deepEqual(e.lectura, ["Prov.14"]);
  assert.equal(e.racha, 2, "12 y 13 seguidos");
  const e2 = P.estado(plan, L(["2026-11-13", "Prov.13"], [HOY, "Prov.14"]), HOY);
  assert.deepEqual(e2.lectura, [], "hoy ya está");
  assert.equal(e2.racha, 2);
  assert.equal(P.estado(plan, L(["2026-11-13", "Prov.12"]), HOY).racha, 0, "otro capítulo no cuenta");
  assert.deepEqual(P.estado(plan, {}, "2026-12-31").lectura, ["Prov.31"]);
});

test("a mi ritmo y validaciones", () => {
  const p = P.nuevo({ tipo: "ritmo", hoy: HOY, porDia: 999, desde: "Xyz" });
  assert.equal(p.porDia, 50);
  assert.equal(p.desde, "Gen");
  assert.equal(P.nuevo({ tipo: "inventado", hoy: HOY }), null);
  assert.match(P.estado(P.nuevo({ tipo: "ritmo", hoy: HOY, porDia: 2, desde: "John" }), {}, HOY).nombre, /2 por día/);
});

test("progreso de los 1.189 capítulos y la racha", () => {
  const leidos = L(["2026-11-01", "Gen.1", "Gen.2"], ["2026-11-02", "Gen.1", "Obad.1"], ["2026-11-03"]);
  const pr = P.progresoBiblia(leidos);
  assert.equal(pr.total.total, 1189);
  assert.equal(pr.total.leidos, 3);
  assert.equal(pr.libros.find(l => l.id === "Obad").pct, 100);
  assert.equal(pr.completos, 1, "Abdías tiene un solo capítulo");
  assert.equal(pr.at.leidos, 3);
  assert.equal(pr.nt.total, 260);
  assert.deepEqual(P.fechasLeidas(leidos), ["2026-11-01", "2026-11-02"], "un día sin capítulos no cuenta");
  assert.equal(P.enElAnio(leidos, "2026"), 3);
});

test("ordenClaves: lo leído en un día, en el orden de la Biblia", () => {
  assert.deepEqual(P.ordenClaves(["Matt.2", "Gen.3", "Matt.1", "Matt.2", "nada", "Ps.23"]), ["Gen.3", "Ps.23", "Matt.1", "Matt.2"]);
  assert.equal(P.texto(P.ordenClaves(["Matt.2", "Matt.1"])), "Mateo 1-2");
});
