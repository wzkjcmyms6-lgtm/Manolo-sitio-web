// Repaso de frases, favoritas y etiquetas (js/libros-frases.js, D-109).
const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("../js/libros-frases.js");

const HOY = "2026-11-15";
const frase = (id, d) => Object.assign({ id, libroId: "a", texto: `Frase ${id}`, fecha: "2026-10-01", fav: false, etiquetas: [], repaso: null }, d);

test("calificar: las que te encantan vuelven pronto; «Bien» se espacia; «Menos» se guarda", () => {
  assert.deepEqual(F.calificar(frase("a"), "encanta", HOY), { n: 1, int: 3, ultimo: HOY, proximo: "2026-11-18", nota: "encanta" });
  let r = F.calificar(frase("b"), "bien", HOY);
  assert.deepEqual([r.int, r.proximo], [7, "2026-11-22"]);
  r = F.calificar(frase("b", { repaso: r }), "bien", "2026-11-22");
  assert.deepEqual([r.n, r.int], [2, 14], "se duplica");
  assert.equal(F.calificar(frase("c", { repaso: { int: 40 } }), "bien", HOY).int, 60, "hasta 60 días");
  assert.equal(F.calificar(frase("d", { repaso: { int: 3, nota: "encanta" } }), "bien", HOY).int, 7, "después de «Me encanta», «Bien» vuelve a 7");
  assert.deepEqual([F.calificar(frase("e"), "menos", HOY).int, F.calificar(frase("e"), "rara", HOY).nota], [90, "bien"]);
  assert.deepEqual([F.cuando("2026-11-18", HOY), F.cuando("2026-11-16", HOY), F.cuando(HOY, HOY)], ["en 3 días", "mañana", "hoy"]);
});

test("las de hoy: hasta tu número, primero favoritas; no cambian durante el día", () => {
  const lista = [
    frase("vieja", { repaso: { proximo: "2026-11-10", ultimo: "2026-11-03", int: 7, nota: "bien" } }),
    frase("nueva1"), frase("nueva2"),
    frase("fav", { fav: true }),
    frase("futura", { repaso: { proximo: "2026-12-01", ultimo: "2026-11-01", int: 30 } }),
    frase("vacia", { texto: "" })
  ];
  const h = F.paraHoy(lista, HOY, 3);
  assert.equal(h.pendientes.length, 3);
  assert.equal(h.pendientes[0].id, "fav", "la favorita primero");
  assert.ok(!h.pendientes.some(x => x.id === "futura" || x.id === "vacia"));
  assert.deepEqual(F.paraHoy(lista, HOY, 3).pendientes.map(x => x.id), h.pendientes.map(x => x.id), "mismo día, mismo orden");
  // Repasaste una: quedan 2 (no aparece otra en su lugar).
  const r = F.calificar(h.pendientes[0], "encanta", HOY);
  const despues = lista.map(x => (x.id === h.pendientes[0].id ? Object.assign({}, x, { repaso: r }) : x));
  const h2 = F.paraHoy(despues, HOY, 3);
  assert.deepEqual([h2.hechas.length, h2.pendientes.length], [1, 2]);
  assert.deepEqual(h2.pendientes.map(x => x.id), h.pendientes.slice(1).map(x => x.id));
  assert.equal(F.paraHoy(lista, HOY, 1).pendientes.length, 1, "1 por día");
  assert.equal(F.paraHoy(lista, HOY, 9).max, 3, "como mucho 3");
  assert.deepEqual(F.paraHoy([], HOY, 3).pendientes, []);
});

test("favoritas y etiquetas", () => {
  const lista = [frase("a", { fav: true, etiquetas: ["fe", "hábitos"] }), frase("b", { etiquetas: ["hábitos"] }), frase("c")];
  assert.deepEqual(F.etiquetasUsadas(lista), [{ etiqueta: "hábitos", n: 2 }, { etiqueta: "fe", n: 1 }]);
  assert.deepEqual(F.filtrar(lista, { fav: true }).map(x => x.id), ["a"]);
  assert.deepEqual(F.filtrar(lista, { etiqueta: "hábitos" }).map(x => x.id), ["a", "b"]);
  assert.deepEqual(F.filtrar(lista, {}).length, 3);
});

test("QA fase 8 (D-115): con 3.000 frases elige las mismas que el orden de antes, y rápido", () => {
  // Datos variados y fijos: favoritas, repasos con distintas notas y fechas.
  const fs = [];
  for (let i = 0; i < 3000; i++) {
    const r = i % 7 === 0 ? null : { n: 1 + (i % 4), int: 7, ultimo: "2026-11-01", proximo: i % 3 ? "2026-11-10" : "2026-12-01", nota: ["encanta", "bien", "menos"][i % 3] };
    fs.push(frase(`q${i}`, { fav: i % 11 === 0, repaso: r }));
  }
  // El orden de antes: puntaje y mezcla del día calculados dentro de la comparación.
  const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
  const puntaje = f => (f.fav ? 3 : 0) + (f.repaso && f.repaso.nota === "encanta" ? 2 : 0) + (!f.repaso ? 1 : 0);
  const semilla = hash(HOY);
  const antes = fs.filter(f => !f.repaso || !f.repaso.proximo || f.repaso.proximo <= HOY)
    .sort((a, b) => puntaje(b) - puntaje(a) || (hash(a.id + semilla) - hash(b.id + semilla))).slice(0, 3).map(f => f.id);
  const t0 = Date.now();
  const r = F.paraHoy(fs, HOY, 3);
  const ms = Date.now() - t0;
  assert.deepEqual(r.pendientes.map(f => f.id), antes);
  assert.ok(ms < 200, `paraHoy con 3.000 frases tardó ${ms} ms`);
});
