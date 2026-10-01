const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/actividad-motor.js");

// Recorrido simulado hacia el norte: 1 grado de latitud ≈ 111.195 m.
const M_POR_GRADO = 111195;
const T0 = Date.UTC(2026, 9, 1, 12, 0, 0);
const base = { lat: -16.5, lon: -68.15 };
function pt(metros, seg, extra) {
  return Object.assign({ lat: base.lat + metros / M_POR_GRADO, lon: base.lon, t: T0 + seg * 1000, acc: 5 }, extra || {});
}
// Corre a v m/s durante s segundos, un punto por segundo, desde (m0, t0).
function correr(st, v, s, m0 = 0, t0 = 0, extra) {
  for (let i = 0; i <= s; i++) M.punto(st, pt(m0 + v * i, t0 + i, extra && extra(i)));
}

test("haversine: distancias conocidas", () => {
  assert.ok(Math.abs(M.haversine({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }) - M_POR_GRADO) < 5);
  assert.equal(M.haversine(base, base), 0);
});

test("estados: listo → activo ⇄ pausado → finalizado; puntos fuera de 'activo' se ignoran", () => {
  const st = M.crear("running");
  assert.equal(M.punto(st, pt(0, 0)), "ignorado");
  M.iniciar(st, T0);
  assert.equal(st.estado, "activo");
  M.pausar(st, T0 + 10000);
  assert.equal(M.punto(st, pt(10, 11)), "ignorado");
  M.reanudar(st, T0 + 20000);
  M.finalizar(st, T0 + 30000);
  assert.equal(st.estado, "finalizado");
  const m = M.metricas(st, T0 + 99999);
  assert.equal(m.tiempoTotalS, 30);
  assert.equal(m.tiempoActivoS, 20, "la pausa no cuenta");
  assert.throws(() => M.crear("natacion"));
});

test("distancia, tiempo en movimiento y ritmo medio corriendo a 3 m/s", () => {
  const st = M.crear("running");
  M.iniciar(st, T0);
  correr(st, 3, 600); // 1.800 m en 10 min
  M.finalizar(st, T0 + 600000);
  const m = M.metricas(st, T0 + 600000);
  assert.ok(Math.abs(m.distanciaM - 1800) < 10, `distancia ${m.distanciaM}`);
  assert.ok(Math.abs(m.tiempoMovS - 600) < 3, `movimiento ${m.tiempoMovS}`);
  assert.ok(Math.abs(m.ritmoMedioSKm - 333.3) < 3, `ritmo ${m.ritmoMedioSKm}`); // 5:33 /km
  assert.equal(m.parciales.length, 1);
  assert.ok(Math.abs(m.parciales[0].s - 333.3) < 3, "primer km en ~5:33");
  assert.equal(m.huecoM, 0);
});

test("ritmo actual: se calcula con los últimos segundos y vuelve a 0 al parar", () => {
  const st = M.crear("running");
  M.iniciar(st, T0);
  correr(st, 4, 60);
  const m = M.metricas(st, T0 + 60000);
  assert.ok(Math.abs(m.velActualMs - 4) < 0.2, `vel ${m.velActualMs}`);
  assert.ok(Math.abs(m.ritmoActualSKm - 250) < 15);
  assert.equal(M.metricas(st, T0 + 60000 + 25000).velActualMs, 0, "quieto 25 s → sin ritmo");
});

test("GPS impreciso, duplicados y saltos imposibles no suman", () => {
  const st = M.crear("running");
  M.iniciar(st, T0);
  assert.equal(M.punto(st, pt(0, 0)), "aceptado");
  assert.equal(M.punto(st, pt(10, 3, { acc: 80 })), "impreciso");
  assert.equal(M.estadoGps(st, T0 + 3000), "impreciso", "se avisa que el GPS está impreciso");
  assert.equal(M.punto(st, pt(500, 5)), "salto", "500 m en 5 s");
  assert.equal(M.punto(st, pt(0, 0)), "duplicado");
  assert.equal(M.punto(st, { lat: 200, lon: 0, t: T0 }), "invalido");
  assert.equal(st.distanciaM, 0);
});

test("parado con el GPS temblando no suma distancia ni tiempo en movimiento", () => {
  const st = M.crear("running");
  M.iniciar(st, T0);
  for (let i = 0; i <= 120; i++) M.punto(st, pt((i % 2) * 2.5, i, { acc: 8 })); // va y viene 2,5 m
  const m = M.metricas(st, T0 + 120000);
  assert.equal(m.distanciaM, 0);
  assert.equal(m.tiempoMovS, 0);
  assert.equal(m.tiempoActivoS, 120);
});

test("pausa: no se une con una recta; el trazo sigue en un tramo nuevo", () => {
  const st = M.crear("running");
  M.iniciar(st, T0);
  correr(st, 3, 100);                     // 300 m
  M.pausar(st, T0 + 100000);
  M.reanudar(st, T0 + 160000);
  correr(st, 3, 100, 1000, 160);          // retoma 700 m más allá
  M.finalizar(st, T0 + 260000);
  const m = M.metricas(st, T0 + 260000);
  assert.ok(Math.abs(m.distanciaM - 600) < 10, `sin la recta de la pausa: ${m.distanciaM}`);
  assert.equal(st.tramos.length, 2);
  assert.equal(m.tiempoActivoS, 200);
});

test("pérdida de señal: la recta se cuenta como estimada y abre otro tramo", () => {
  const st = M.crear("running");
  M.iniciar(st, T0);
  correr(st, 3, 60);                       // 180 m
  correr(st, 3, 60, 300, 100);             // 40 s sin señal (180 → 300 m), luego sigue
  const m = M.metricas(st, T0 + 160000);
  assert.ok(Math.abs(m.huecoM - 120) < 5, `estimado ${m.huecoM}`);
  assert.ok(Math.abs(m.distanciaM - 480) < 10);
  assert.equal(st.tramos.length, 2);
  assert.equal(M.estadoGps(st, T0 + 160000 + 20000), "sin señal");
});

test("desnivel con altitud del GPS; sin altitud queda como no disponible", () => {
  const st = M.crear("running");
  M.iniciar(st, T0);
  correr(st, 3, 100, 0, 0, i => ({ alt: 3600 + i * 0.2 + (i % 3) * 0.5 })); // sube 20 m con ruido
  const m = M.metricas(st, T0 + 100000);
  assert.ok(m.desnivelPosM >= 15 && m.desnivelPosM <= 21, `subida ${m.desnivelPosM}`);
  assert.ok(m.desnivelNegM <= 1);
  const sin = M.crear("running");
  M.iniciar(sin, T0);
  correr(sin, 3, 10);
  assert.equal(M.metricas(sin, T0 + 10000).desnivelPosM, null);
});

test("bicicleta: más rápida que correr sin marcarse como salto; parciales de 5 km", () => {
  const st = M.crear("bicicleta");
  M.iniciar(st, T0);
  correr(st, 8, 700);                      // 5,6 km a 28,8 km/h
  const m = M.metricas(st, T0 + 700000);
  assert.ok(Math.abs(m.distanciaM - 5600) < 25);
  assert.equal(m.parciales.length, 1);
  assert.ok(Math.abs(m.velMediaMs * 3.6 - 28.8) < 0.5);
  assert.ok(m.velMaxMs * 3.6 < 31);
});

test("estado serializable: se guarda en el teléfono y se recupera igual", () => {
  const st = M.crear("running");
  M.iniciar(st, T0);
  correr(st, 3, 50);
  const copia = JSON.parse(JSON.stringify(st));
  correr(st, 3, 50, 150, 50);
  correr(copia, 3, 50, 150, 50);
  assert.deepEqual(M.metricas(copia, T0 + 100000), M.metricas(st, T0 + 100000));
});

test("polilínea: ida y vuelta, con negativos y números grandes", () => {
  const filas = [[-16.5, -68.15, 0], [-16.50003, -68.14997, 1], [-16.49, -68.2, 3600], [10, 20, 1e7]];
  const vuelta = M.decodificar(M.codificar(filas, [1e5, 1e5, 1]), [1e5, 1e5, 1]);
  filas.forEach((f, i) => f.forEach((v, j) => assert.ok(Math.abs(vuelta[i][j] - v) < 1e-5, `${v} → ${vuelta[i][j]}`)));
});

test("resumen para guardar: campos de siempre + GPS, y ruta compacta que se puede leer", () => {
  const st = M.crear("running");
  M.iniciar(st, T0);
  correr(st, 3, 400, 0, 0, i => ({ alt: 3600 + i * 0.1 }));
  M.pausar(st, T0 + 400000);
  M.reanudar(st, T0 + 420000);
  correr(st, 3, 100, 1300, 420);
  M.finalizar(st, T0 + 520000);
  const { documento: d, ruta } = M.resumen(st, { rpe: 6 });
  assert.equal(d.fuente, "gps");
  assert.equal(d.date, M.fechaLocal(T0));
  assert.ok(Math.abs(d.distance - 1.5) < 0.02, "km como antes");
  assert.equal(d.duration, 8.3, "minutos activos como antes");
  assert.equal(d.tiempoTotalS, 520);
  assert.equal(d.tiempoActivoS, 500);
  assert.equal(d.parciales.length, 1);
  assert.equal(d.rpe, 6);
  assert.ok(d.desnivelPosM > 0);
  assert.ok(!("huecoM" in d), "sin huecos no se guarda el campo");
  const tramos = M.leerRuta(ruta);
  assert.equal(tramos.length, 2);
  assert.equal(tramos[0].length + tramos[1].length, ruta.n);
  assert.ok(Math.abs(tramos[1][0].t - (T0 + 420000)) < 1000);
  assert.ok(tramos[0][5].alt > 3600);
  assert.ok(ruta.enc.length / ruta.n < 12, `${(ruta.enc.length / ruta.n).toFixed(1)} caracteres por punto`);
});
