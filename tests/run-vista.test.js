const test = require("node:test");
const assert = require("node:assert/strict");
const V = require("../js/run-vista.js");
const Gr = require("../js/run-graficos.js");
const A = require("../js/run-analisis.js");
const E = require("../js/run-enriquecer.js");
const M = require("../js/run-metricas.js");
const F = require("../js/run-formatos.js");
const X = require("./run-fixtures.js");

test("formatos es-BO: 13,58 km · 5:32 /km · 3.640 m · tiempos", () => {
  assert.equal(V.km(13580), "13,58 km");
  assert.equal(V.numero(1234567.891, 1), "1.234.567,9");
  assert.equal(V.numero(-12.4, 0), "−12");
  assert.equal(V.metros(3640), "3.640 m");
  assert.deepEqual([V.ritmo(332), V.ritmo(332, true), V.ritmo(0), V.ritmo(2000), V.ritmo(359.6)], ["5:32 /km", "5:32", "--:-- /km", "--:-- /km", "6:00 /km"]);
  assert.deepEqual([V.tiempo(3329), V.tiempo(3723), V.tiempo(59.6)], ["55:29", "1:02:03", "1:00"]);
  assert.deepEqual([V.duracion(3900), V.duracion(2520), V.duracion(7200)], ["1 h 5 min", "42 min", "2 h"]);
  assert.equal(V.velocidad(3600, 25000), "25,0 km/h");
  assert.equal(V.ritmoDe(1500, 5000), 300);
});

test("fecha de la actividad (con hora si la tiene) y datos básicos de cualquier tipo", () => {
  const ini = new Date(2026, 10, 4, 6, 42).getTime();
  assert.equal(V.fechaActividad({ inicio: ini }, true), "miércoles 4 de noviembre de 2026 · 06:42");
  assert.match(V.fechaActividad({ inicio: ini }), /^mié 4 nov( 2026)? · 06:42$/);
  assert.equal(V.fechaActividad({ date: "2025-03-05" }, true), "miércoles 5 de marzo de 2025");
  assert.deepEqual(V.basicos({ distance: 5, duration: 30 }), { distM: 5000, movS: 1800, totalS: 1800, ritmoS: 360 });
  assert.deepEqual(V.basicos({ distanciaM: 10020, tiempoMovS: 3300, tiempoTotalS: 3400, distance: 10.02, duration: 55 }), { distM: 10020, movS: 3300, totalS: 3400, ritmoS: 3300 / 10.02 });
  assert.equal(V.basicos({ distance: 0, duration: 20, tiempoActivoS: 1250 }).movS, 1250, "rutina guiada: tiempo activo");
});

test("trazo SVG y GPX exportado que se vuelve a leer igual", () => {
  const ps = X.puntos({ segundos: 300, vel: 3, fc: 150, cad: 88, subida: 10 });
  const svg = V.svgRuta([ps], { ancho: 300, alto: 150 });
  assert.match(svg, /^<svg class="run-ruta" viewBox="0 0 300 150"/);
  assert.match(svg, /run-ruta-ini/);
  assert.equal(V.svgRuta([[ps[0]]]), "", "un punto no es una ruta");
  const doc = { titulo: "Fondo <largo> & feliz", notes: "nota", inicio: ps[0].t, date: "2026-10-05", deporte: "running" };
  const txt = V.gpx(doc, [ps.slice(0, 150), ps.slice(150)]);
  const a = F.leer(new TextEncoder().encode(txt), "x.gpx");
  assert.equal(a.titulo, "Fondo <largo> & feliz");
  assert.equal(a.deporte, "running");
  assert.equal(a.puntos.length, 301);
  assert.equal(a.pausas.length, 1);
  assert.equal(a.puntos[10].fc, 150);
  assert.equal(V.nombreArchivo(doc), "2026-10-05-fondo-largo-feliz.gpx");
});

test("perfil: serie de ≤ 300 muestras, quieto sin ritmo, cursor e índice", () => {
  const ps = X.puntos({ segundos: 1800, vel: 3, fc: 150, subida: 60 });
  const tramos = M.leerRuta(M.calcular({ deporte: "running", inicio: ps[0].t, puntos: ps, resumen: {} }, {}).ruta);
  const s = Gr.serie(tramos, "running");
  assert.equal(s.d.length, 300);
  assert.ok(Math.abs(s.total - 5400) < 30);
  assert.ok(s.ritmo.slice(5, -5).every(r => Math.abs(r - 333) < 8), "ritmo de ~5:33");
  assert.ok(s.conAlt && s.conFc && s.conGps);
  const svg = Gr.svgPerfil(s, { ancho: 340, alto: 170, modo: "ritmo", bandas: [[1000, 2000, "rg-banda-correr"]] });
  assert.match(svg, /class="rg-linea rg-ritmo"/);
  assert.match(svg, /class="rg-alt"/);
  assert.match(svg, /rg-banda rg-banda-correr/);
  assert.match(svg, /<g class="rg-cursor" hidden>/);
  assert.match(Gr.svgPerfil(s, { modo: "altura" }), /rg-alt-sola/);
  const i = Gr.indicePorX(s, 6 + (340 - 52) / 2, 340);
  assert.ok(Math.abs(s.d[i] - s.total / 2) < s.total / 250);
  const c = Gr.puntoCursor(s, i, "fc", 340, 170);
  assert.ok(c.x > 0 && c.y > 0);
  // Quieto 2 minutos: sin ritmo (corte en la línea)
  const q = X.puntos({ segundos: 600, vel: 3 });
  const ult = q[q.length - 1];
  for (let k = 1; k <= 120; k++) q.push(Object.assign({}, ult, { t: ult.t + k * 1000 }));
  for (let k = 1; k <= 300; k++) q.push(Object.assign({}, ult, { t: ult.t + (120 + k) * 1000, lat: ult.lat + k * 3 / 111195 }));
  const sq = Gr.serie([q.map(p => Object.assign({}, p, { d: null }))], "running");
  assert.ok(sq.ritmo.some(r => r == null) && sq.ritmo.some(r => r != null));
  assert.equal(Gr.serie([[ps[0]]]), null);
});

test("barras de parciales: el más rápido y el más lento (solo km completos)", () => {
  const f = Gr.barrasParciales([{ d: 1000, tm: 330 }, { d: 1000, tm: 300 }, { d: 1000, tm: 360, dz: 12, fc: 160 }, { d: 200, tm: 50 }]);
  assert.deepEqual(f.map(x => [x.km, x.completo, !!x.rapido, !!x.lento]), [[1, true, false, false], [2, true, true, false], [3, true, false, true], [4, false, false, false]]);
  assert.equal(f[1].ancho, 1);
  assert.equal(f[2].ancho, 0.35);
  assert.equal(f[3].ritmo, 250, "el parcial corto se muestra por km");
  assert.equal(Gr.barrasParciales([{ d: 1000, tm: 300 }])[0].rapido, false, "con uno solo no hay más rápido");
});

test("zonas: rangos en lpm y porcentaje; desde la ruta con los ajustes de hoy", () => {
  const lim = M.limitesZonas(200, 0);
  const z = Gr.zonas([60, 120, 300, 100, 20], lim);
  assert.deepEqual(z.map(x => [x.z, x.desde, x.hasta]), [[1, null, 119], [2, 120, 139], [3, 140, 159], [4, 160, 179], [5, 180, null]]);
  assert.equal(Math.round(z[2].pct * 100), 50);
  assert.deepEqual(Gr.zonas([0, 0, 0, 0, 0], lim), []);
  const ini = Date.UTC(2026, 0, 1);
  const tramos = [Array.from({ length: 61 }, (_, s) => ({ t: ini + s * 1000, fc: s < 30 ? 130 : 185 }))];
  assert.deepEqual(Gr.zonasDeRuta(tramos, lim), [0, 29, 0, 0, 31]);
  assert.equal(Gr.zonasDeRuta(tramos, null), null);
});

test("logros: puesto entre las actividades hasta ese día (como era al correrla)", () => {
  const d = (id, dia, t5, t1) => ({ id, inicio: Date.UTC(2026, 9, dia), mejores: Object.assign({ "5000": t5 }, t1 ? { "1000": t1 } : {}) });
  const todos = [d("a", 1, 1500, 280), d("b", 5, 1450, 270), d("c", 9, 1480, 290), d("e", 20, 1400, 260)];
  assert.deepEqual(A.logros(todos[1], todos).map(l => [l.clave, l.puesto]), [["1000", 1], ["5000", 1]]);
  assert.deepEqual(A.logros(todos[2], todos).map(l => [l.clave, l.puesto]), [["1000", 3], ["5000", 2]], "la de día 9: 2.ª en 5K (la de día 20 todavía no existía)");
  assert.deepEqual(A.logros(todos[3], todos).map(l => l.puesto), [1, 1]);
  assert.deepEqual(A.logros({ id: "x", distance: 5 }, todos), []);
  assert.equal(A.esfuerzos(todos, "5000")[0].id, "e");
  assert.deepEqual([A.textoPuesto(1), A.textoPuesto(2), A.MEDALLA[3]], ["Mejor marca", "2.ª mejor", "🥉"]);
});

test("corregir desnivel: muestras cada ≥ 20 m, lotes de 100, histéresis de 1 m", () => {
  const ps = X.puntos({ segundos: 1000, vel: 3 });
  const m = E.muestrasDesnivel([ps], M.haversine, 1000);
  assert.ok(m.length >= 140 && m.length <= 152, `${m.length} muestras`);
  assert.equal(m[0].d, 0);
  const urls = E.urlsElevacion(m);
  assert.equal(urls.length, Math.ceil(m.length / 100));
  assert.match(urls[0], /^https:\/\/api\.open-meteo\.com\/v1\/elevation\?latitude=-16\.5,/);
  assert.equal(urls[0].split("latitude=")[1].split("&")[0].split(",").length, 100);
  assert.ok(!/\d\.\d{5,}/.test(urls[0]), "4 decimales como máximo");
  const largo = E.muestrasDesnivel([X.puntos({ segundos: 20000, vel: 3 })], M.haversine, 1000);
  assert.ok(largo.length <= 1002, "una ruta larga se muestrea más espaciada");
  assert.deepEqual(E.desnivelDe([3600, 3600.5, 3602, 3605, 3604.5, 3600, 3601]), { pos: 6, neg: 5 });
  assert.equal(E.desnivelDe([1]), null);
});

test("logros de todas a la vez: igual que uno por uno", () => {
  const d = (id, dia, t5, t1) => ({ id, inicio: Date.UTC(2026, 9, dia), mejores: Object.assign({ "5000": t5 }, t1 ? { "1000": t1 } : {}) });
  const todos = [d("a", 1, 1500, 280), d("b", 5, 1450, 270), d("c", 9, 1480, 290), d("e", 20, 1400, 260), d("f", 22, 1600, 300), d("g", 23, 1460)];
  const m = A.logrosPorId(todos);
  todos.forEach(x => assert.deepEqual(m[x.id] || [], A.logros(x, todos), x.id));
  assert.equal(m.f, undefined, "la 4.ª no tiene logro");
});
