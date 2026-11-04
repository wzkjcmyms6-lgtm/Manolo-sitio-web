const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../js/run-guardar.js");
const E = require("../js/run-enriquecer.js");
const M = require("../js/run-metricas.js");

const INI = new Date(2026, 10, 3, 6, 40).getTime();
function nueva(extra, campos) {
  return Object.assign({
    deporte: "running", titulo: null, descripcion: "Fondo suave", origen: { formato: "fit", app: "strava", archivo: "activities/1.fit.gz", idExterno: "1" },
    campos: Object.assign({ date: M.fechaLocal(INI), inicio: INI, fin: INI + 3600000, distanciaM: 10020, distance: 10.02, duration: 58, tiempoMovS: 3480, conRuta: true }, campos),
    ruta: { v: 2, enc: "abc" }
  }, extra);
}

test("documento: título automático, notas, origen limpio y lo de siempre", () => {
  const d = G.documento(nueva(), 123);
  assert.deepEqual([d.v, d.fuente, d.deporte, d.titulo, d.notes, d.importado, d.distance, d.duration], [2, "importado", "running", "Carrera por la mañana", "Fondo suave", 123, 10.02, 58]);
  assert.deepEqual(d.origen, { formato: "fit", app: "strava", archivo: "activities/1.fit.gz", idExterno: "1" });
  assert.equal(G.documento(nueva({ titulo: "Mi fondo", subtipo: "trail" }), 1).titulo, "Mi fondo");
  assert.equal(G.documento(nueva({ subtipo: "trail" }), 1).subtipo, "trail");
  assert.equal(G.idPara(nueva()), "imp_1");
  assert.equal(G.idPara(nueva({ origen: {} })), `imp_${Math.round(INI / 1000)}_10020`);
});

test("clasificar: el mismo archivo, la misma hora y distancia, o nada que ver", () => {
  assert.deepEqual(G.clasificar(nueva(), []), { accion: "nueva" });
  assert.equal(G.clasificar(nueva(), [{ id: "imp_1" }]).accion, "duplicada");
  assert.equal(G.clasificar(nueva({ origen: {} }), [{ id: "x", fuente: "importado", inicio: INI + 90000, distanciaM: 10100 }]).accion, "duplicada", "±2 min y ±3 %");
  assert.equal(G.clasificar(nueva({ origen: {} }), [{ id: "x", fuente: "importado", inicio: INI + 180000, distanciaM: 10020 }]).accion, "nueva", "3 min después: otra");
  assert.equal(G.clasificar(nueva({ origen: {} }), [{ id: "x", fuente: "gps", inicio: INI, distance: 12 }]).accion, "nueva", "distancia muy distinta");
  assert.equal(G.clasificar(nueva({ origen: {} }), [{ id: "x", fuente: "gps", inicio: INI + 1000, distance: 10.1 }]).accion, "duplicada", "una carrera vieja con GPS");
});

test("clasificar: ofrece fusionar con una rutina guiada o una carrera a mano", () => {
  const rutina = { id: "r1", fuente: "rutina", inicio: INI + 120000, fin: INI + 3000000, distance: 0, duration: 46, rutina: { nombre: "Plan 5K · Día 2" } };
  assert.deepEqual(G.clasificar(nueva({ origen: {} }), [rutina]), { accion: "fusionar", id: "r1", con: "rutina" });
  assert.equal(G.clasificar(nueva({ origen: {} }), [Object.assign({}, rutina, { inicio: INI - 7200000, fin: INI - 3600000 })]).accion, "nueva", "rutina de otra hora");
  const manual = { id: "m1", date: M.fechaLocal(INI), distance: 10, duration: 60, rpe: 6, notes: "Con lluvia" };
  assert.deepEqual(G.clasificar(nueva({ origen: {} }), [manual]), { accion: "fusionar", id: "m1", con: "manual" });
  assert.equal(G.clasificar(nueva({ origen: {} }), [Object.assign({}, manual, { distance: 5 })]).accion, "nueva");
  assert.equal(G.clasificar(nueva({ origen: {} }), [Object.assign({}, manual, { date: "2026-11-02" })]).accion, "nueva");
});

test("fusión: conserva rutina, RPE, notas y fecha; guarda los km anteriores", () => {
  const manual = { id: "m1", date: "2026-11-03", distance: 10, duration: 60, rpe: 6, notes: "Con lluvia" };
  const doc = G.documento(nueva(), 999);
  const f = G.fusion(manual, doc);
  assert.equal(f.rpe, undefined);
  assert.equal(f.date, undefined);
  assert.deepEqual(f.previo, { distance: 10, duration: 60 });
  assert.equal(f.notes, "Con lluvia\nFondo suave");
  assert.equal(f.fuente, "importado");
  assert.equal(f.distance, 10.02);
  assert.equal(f.titulo, "Carrera por la mañana");
  const r = G.fusion({ fuente: "rutina", rutina: { nombre: "X" }, distance: 0, duration: 46 }, doc);
  assert.deepEqual([r.fuente, r.conImportado, r.rutina, r.notes], ["rutina", true, undefined, "Fondo suave"]);
  const ops = G.operaciones(nueva(), { accion: "fusionar", id: "m1" }, manual, 5);
  assert.deepEqual(ops.ops.map(o => [o.tipo, o.ruta]), [["update", "running/m1"], ["set", "rutas/m1"]]);
  const ops2 = G.operaciones(nueva({ deporte: "bicicleta", ruta: null }), { accion: "nueva" }, null, 5);
  assert.deepEqual(ops2.ops.map(o => [o.tipo, o.ruta]), [["set", "bicicleta/imp_1"]]);
});

test("lotes: ≤ 400 operaciones y ≤ 5 MB", () => {
  const chicas = Array.from({ length: 1000 }, (_, i) => ({ tipo: "set", ruta: `running/${i}`, datos: { i } }));
  assert.deepEqual(G.lotes(chicas).map(l => l.length), [400, 400, 200]);
  const grandes = Array.from({ length: 12 }, (_, i) => ({ tipo: "set", ruta: `rutas/${i}`, datos: { enc: "x".repeat(800000) } }));
  const l = G.lotes(grandes);
  assert.ok(l.every(x => x.reduce((s, o) => s + JSON.stringify(o.datos).length, 0) <= G.LOTE_BYTES));
  assert.equal(l.reduce((s, x) => s + x.length, 0), 12);
});

test("clima: URL según la fecha, coordenadas redondeadas, hora más cercana", () => {
  const ahora = Date.UTC(2026, 10, 4);
  const u1 = E.urlClima(-16.51234, -68.12987, Date.UTC(2026, 10, 2, 11), ahora);
  assert.match(u1, /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?latitude=-16\.51&longitude=-68\.13&start_date=2026-11-02&end_date=2026-11-02/);
  assert.match(E.urlClima(-16.5, -68.1, Date.UTC(2025, 5, 1, 11), ahora), /archive-api\.open-meteo\.com\/v1\/archive/);
  const json = { hourly: { time: ["2026-11-02T10:00", "2026-11-02T11:00", "2026-11-02T12:00"], temperature_2m: [8, 9.04, 11], apparent_temperature: [6, 7, 9], relative_humidity_2m: [70, 65, 60], wind_speed_10m: [5, 6, 7], weather_code: [1, 3, 3] } };
  assert.deepEqual(E.leerClima(json, Date.UTC(2026, 10, 2, 11, 20)), { tC: 9, sensC: 7, hum: 65, vientoKmh: 6, cod: 3 });
  assert.equal(E.leerClima({ hourly: { time: ["2026-11-02T10:00"], temperature_2m: [null] } }, Date.UTC(2026, 10, 2, 10)), null);
  assert.equal(E.leerClima({}, 0), null);
  assert.deepEqual([0, 2, 3, 61, 95].map(E.textoClima), ["Despejado", "Parcialmente nublado", "Nublado", "Lluvia", "Tormenta"]);
});

test("lugar: barrio y ciudad sin 'Municipio'; respuesta verificada de Nominatim", () => {
  const real = { address: { quarter: "Sopocachi", suburb: "Cotahuma", city: "Municipio Nuestra Señora de La Paz", state: "La Paz", country: "Bolivia" } };
  assert.equal(E.leerLugar(real), "Sopocachi, La Paz");
  assert.equal(E.leerLugar({ address: { suburb: "Centro", city: "Cochabamba", state: "Cochabamba" } }), "Centro, Cochabamba");
  assert.equal(E.leerLugar({ address: { city: "Sucre" } }), "Sucre");
  assert.equal(E.leerLugar({}), null);
  assert.match(E.urlLugar(-16.513456, -68.128901), /lat=-16\.513&lon=-68\.129&zoom=14&accept-language=es$/);
});

test("completar: clima y lugar en segundo plano, con caché y respetando 1 pedido/s", async () => {
  const mini = M.codificar([[-16.5134, -68.1289], [-16.52, -68.13]], [1e5, 1e5]);
  const docs = [
    { id: "a", col: "running", inicio: Date.UTC(2026, 10, 2, 11), mini },
    { id: "b", col: "running", inicio: Date.UTC(2026, 10, 3, 11), mini, clima: { tC: 1 } },
    { id: "c", col: "running", inicio: Date.UTC(2026, 10, 3, 11) } // sin ruta: nada
  ];
  const pedidos = [], guardados = [], esperas = [];
  const cache = new Map();
  const fetch = url => {
    pedidos.push(url);
    const json = /open-meteo/.test(url)
      ? { hourly: { time: ["2026-11-02T11:00"], temperature_2m: [9], weather_code: [0] } }
      : { address: { quarter: "Sopocachi", city: "La Paz" } };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(json) });
  };
  const n = await E.completar(docs, {
    fetch, ahora: Date.UTC(2026, 10, 4), leerMini: M.leerMini,
    guardar: (id, col, c) => { guardados.push([id, col, c]); return Promise.resolve(); },
    esperar: ms => { esperas.push(ms); return Promise.resolve(); },
    cache: { get: k => cache.get(k), set: (k, v) => cache.set(k, v) }
  });
  assert.equal(n, 2);
  assert.deepEqual(guardados, [["a", "running", { clima: { tC: 9, cod: 0 }, lugar: "Sopocachi, La Paz" }], ["b", "running", { lugar: "Sopocachi, La Paz" }]]);
  assert.equal(pedidos.filter(u => /nominatim/.test(u)).length, 1, "el segundo lugar sale del caché");
  assert.ok(pedidos.every(u => !/-16\.5134\b|-68\.1289\b/.test(u)), "nunca la coordenada exacta");
  // Sin internet: se detiene sin guardar
  const sinRed = await E.completar([docs[0]], { fetch: () => Promise.reject(new Error("offline")), ahora: 0, leerMini: M.leerMini, guardar: () => { throw new Error("no"); }, esperar: () => Promise.resolve() });
  assert.equal(sinRed, 0);
});
