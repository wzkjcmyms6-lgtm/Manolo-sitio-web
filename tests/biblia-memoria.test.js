const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/biblia-memoria.js");

const HOY = "2026-11-14";
const J316 = "Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.";

test("un versículo nuevo se repasa hoy; id sin puntos", () => {
  const it = M.nuevo({ libro: "John", cap: 3, vers: "16", texto: J316, version: "RV1909" }, HOY, 5);
  assert.deepEqual([it.caja, it.proximo, it.repasos, it.version], [1, HOY, 0, "RV1909"]);
  assert.equal(M.idDe("Prov", 3, "5,6"), "Prov_3_5+6");
  assert.equal(M.idDe("John", 3, "16-17"), "John_3_16-17");
});

test("cajas de Leitner: bien sube, me costó se queda, mal vuelve a la 1", () => {
  const it = M.nuevo({ libro: "John", cap: 3, vers: "16", texto: J316 }, HOY, 0);
  let x = Object.assign({}, it, M.calificar(it, "bien", HOY));
  assert.deepEqual([x.caja, x.proximo, x.aciertos, x.repasos], [2, "2026-11-16", 1, 1], "caja 2: en 2 días");
  x = Object.assign(x, M.calificar(x, "bien", "2026-11-16"));
  assert.deepEqual([x.caja, x.proximo], [3, "2026-11-20"], "caja 3: en 4 días");
  x = Object.assign(x, M.calificar(x, "duda", "2026-11-20"));
  assert.deepEqual([x.caja, x.proximo], [3, "2026-11-21"], "me costó: mañana otra vez, misma caja");
  x = Object.assign(x, M.calificar(x, "mal", "2026-11-21"));
  assert.deepEqual([x.caja, x.proximo], [1, "2026-11-22"], "no lo sabía: caja 1, mañana");
  let y = Object.assign({}, it, { caja: 6 });
  y = Object.assign(y, M.calificar(y, "bien", HOY));
  assert.deepEqual([y.caja, y.proximo], [6, "2026-12-16"], "la última caja: cada 32 días");
  assert.equal(M.dominado(y), true);
  assert.equal(M.cuando("2026-11-15", HOY), "mañana");
  assert.equal(M.cuando("2026-11-18", HOY), "en 4 días");
  assert.equal(M.cuando("2026-11-10", HOY), "hoy");
});

test("el repaso de hoy: los atrasados primero", () => {
  const items = {
    a: { texto: "a", proximo: "2026-11-14", caja: 2 },
    b: { texto: "b", proximo: "2026-11-10", caja: 3 },
    c: { texto: "c", proximo: "2026-11-15", caja: 1 },
    d: { texto: "", proximo: "2026-11-01", caja: 1 }
  };
  assert.deepEqual(M.paraHoy(items, HOY).map(x => x.id), ["b", "a"]);
});

test("primeras letras y ocultar palabras", () => {
  assert.equal(M.primerasLetras("Jehová es mi pastor; nada me faltará."), "J e m p; n m f.");
  assert.equal(M.primerasLetras("¿Quién nos apartará?"), "¿Q n a?");
  const o1 = M.ocultar("uno dos tres cuatro cinco seis", 1);
  assert.deepEqual(o1.filter(x => x.oculta).map(x => x.w), ["dos", "cinco"]);
  assert.deepEqual(M.ocultar("uno dos tres", 2).map(x => x.oculta), [false, true, true]);
  assert.ok(M.ocultar("uno dos tres", 3).every(x => x.oculta));
  assert.ok(M.ocultar("uno dos", 0).every(x => !x.oculta));
});

test("escribirlo: sin tildes, mayúsculas ni puntuación", () => {
  const perfecto = M.comparar("porque de tal manera amo dios al mundo que ha dado a su hijo unigenito para que todo aquel que en el cree no se pierda mas tenga vida eterna", J316);
  assert.equal(perfecto.pct, 100);
  assert.equal(perfecto.ok, true);
  const falta = M.comparar("Porque de tal manera amó Dios al mundo, que ha dado a su Hijo", J316);
  assert.ok(falta.pct < 60 && !falta.ok, `a medias: ${falta.pct} %`);
  assert.deepEqual(falta.palabras.filter(p => !p.ok).slice(0, 2).map(p => p.w), ["unigénito,", "para"]);
  const casi = M.comparar(J316.replace("unigénito", "único"), J316);
  assert.ok(casi.pct >= 90 && casi.pct < 100 && casi.ok, `una palabra mal: ${casi.pct} %`);
  assert.equal(M.comparar("", J316).pct, 0);
  const signos = M.comparar("Jehová es mi pastor", "Jehová — es mi pastor");
  assert.equal(signos.pct, 100, "un guion suelto no cuenta como palabra");
  assert.equal(M.resultadoDe(95), "bien");
  assert.equal(M.resultadoDe(70), "duda");
  assert.equal(M.resultadoDe(20), "mal");
});
