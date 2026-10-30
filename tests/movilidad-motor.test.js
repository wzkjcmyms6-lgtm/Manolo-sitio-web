const test = require("node:test");
const assert = require("node:assert/strict");
const RUTINAS = require("../js/movilidad-rutinas.js");
const M = require("../js/movilidad-motor.js");

const [CUERPO, DESPUES] = RUTINAS;
const T0 = 1000000;
const s = n => T0 + M.CUENTA_MS + n * 1000;   // instante n segundos después de la cuenta 3-2-1

test("solo dos rutinas de 3 minutos, bien escritas", () => {
  assert.deepEqual(M.problemas(RUTINAS), []);
  assert.deepEqual(RUTINAS.map(r => [r.id, r.nombre]), [["liberar-el-cuerpo", "Todo el cuerpo"], ["despues-de-correr", "Después de correr"]]);
  assert.equal(M.duracion(CUERPO), 180);
  assert.equal(M.pasos(CUERPO).length, 6);
  assert.equal(M.duracion(DESPUES), 180);
  assert.equal(M.pasos(DESPUES).length, 5);
  assert.deepEqual(M.pasos(CUERPO).filter(p => p.porLado).map(p => p.nombre), ["World's greatest stretch"]);
  assert.ok(M.pasos(DESPUES).every(p => p.porLado && p.segundos === 36), "cinco estiramientos de 18 s por lado");
  assert.equal(M.pasos(DESPUES)[0].nota, "Sostén cada estiramiento sin rebotar: hasta sentir tensión, nunca dolor.");
  assert.equal(M.pasos(CUERPO)[0].nota, "");
  assert.ok(!M.pasos(DESPUES).some(p => /balanceo|skipping|trotando/i.test(p.nombre)), "después de correr, nada en movimiento");
  assert.deepEqual([M.duracionTexto(180), M.duracionTexto(300), M.duracionTexto(90), M.duracionTexto(45)], ["3 min", "5 min", "1 min 30 s", "45 s"]);
});

test("problemas: avisa lo que está mal escrito", () => {
  const mal = [{ id: "a", nombre: "A", partes: [{ ejercicios: [{ nombre: "X", instruccion: "", segundos: 2.5, porLado: "sí" }] }] }, { id: "a", nombre: "", partes: [] }];
  const p = M.problemas(mal);
  assert.ok(p.some(x => /falta la instrucción/.test(x)));
  assert.ok(p.some(x => /segundos/.test(x)));
  assert.ok(p.some(x => /porLado/.test(x)));
  assert.ok(p.some(x => /repetido/.test(x)));
  assert.ok(p.some(x => /no tiene partes/.test(x)));
});

test("cuenta 3-2-1 y luego el primer ejercicio", () => {
  const ps = M.pasos(CUERPO);
  const st = M.iniciar(M.crear(CUERPO), T0);
  assert.equal(M.info(st, ps, T0).cuenta, 3);
  assert.equal(M.info(st, ps, T0 + 1200).cuenta, 2);
  assert.equal(M.info(st, ps, T0 + 2500).cuenta, 1);
  const i = M.info(st, ps, s(0));
  assert.deepEqual([i.cuenta, i.indice, i.restante, i.paso.nombre, i.siguiente.nombre], [0, 0, 30, "Gato-vaca", "Postura del niño"]);
  assert.equal(M.pausar(st, T0 + 1000).estado, "activo", "no se pausa durante la cuenta");
});

test("avanza solo, con el tiempo que falta y el avance total", () => {
  const ps = M.pasos(CUERPO);
  const st = M.iniciar(M.crear(CUERPO), T0);
  let i = M.info(st, ps, s(5.2));
  assert.deepEqual([i.indice, i.restante], [0, 25]);
  i = M.info(st, ps, s(30));
  assert.deepEqual([i.indice, i.restante, i.paso.nombre], [1, 30, "Postura del niño"]);
  i = M.info(st, ps, s(90));
  assert.equal(i.pct, 0.5);
  i = M.info(st, ps, s(179.5));
  assert.deepEqual([i.indice, i.restante, i.siguiente], [5, 1, null]);
  assert.equal(M.info(st, ps, s(180)).terminado, true);
});

test("por lado: cambia de lado a la mitad", () => {
  const ps = M.pasos(CUERPO);
  const st = M.iniciar(M.crear(CUERPO), T0);
  const a = M.info(st, ps, s(90 + 14.9)), b = M.info(st, ps, s(90 + 15));
  assert.equal(a.paso.nombre, "World's greatest stretch");
  assert.deepEqual([a.lado, b.lado], [1, 2]);
  assert.deepEqual(M.cambios(a, b), ["lado"]);
  assert.equal(M.info(st, ps, s(5)).lado, null, "los demás no tienen lado");
  const pd = M.pasos(DESPUES), sd = M.iniciar(M.crear(DESPUES), T0);
  assert.deepEqual([M.info(sd, pd, s(17.9)).lado, M.info(sd, pd, s(18)).lado], [1, 2], "después de correr: 18 s por lado");
});

test("pausar y reanudar: el tiempo no corre en pausa", () => {
  const ps = M.pasos(CUERPO);
  const st = M.iniciar(M.crear(CUERPO), T0);
  M.pausar(st, s(10));
  assert.equal(M.info(st, ps, s(500)).restante, 20);
  M.reanudar(st, s(500));
  const i = M.info(st, ps, s(505));
  assert.deepEqual([i.indice, i.restante], [0, 15]);
});

test("saltar: al siguiente ejercicio; en el último, termina", () => {
  const ps = M.pasos(CUERPO);
  const st = M.iniciar(M.crear(CUERPO), T0);
  M.saltar(st, ps, s(3));
  let i = M.info(st, ps, s(3));
  assert.deepEqual([i.indice, i.restante], [1, 30]);
  M.saltar(st, ps, T0 + 500);
  assert.equal(st.saltados, 1, "durante la cuenta no salta");
  for (let k = 0; k < 4; k++) M.saltar(st, ps, s(3));
  i = M.info(st, ps, s(3));
  assert.equal(i.indice, 5);
  M.saltar(st, ps, s(3));
  assert.equal(M.info(st, ps, s(3)).terminado, true);
  assert.equal(st.saltados, 6);
});

test("cambios: vibrar una sola vez por ejercicio, lado y fin", () => {
  const ps = M.pasos(CUERPO);
  const st = M.iniciar(M.crear(CUERPO), T0);
  const en = t => M.info(st, ps, t);
  assert.deepEqual(M.cambios(en(T0 + 2900), en(s(0))), ["paso"], "termina la cuenta: empieza el primero");
  assert.deepEqual(M.cambios(en(s(29.9)), en(s(30))), ["paso"]);
  assert.deepEqual(M.cambios(en(s(30)), en(s(31))), []);
  assert.deepEqual(M.cambios(en(s(179)), en(s(180))), ["fin"]);
  assert.deepEqual(M.cambios(null, en(s(1))), []);
});

test("sesión guardada, racha y últimas", () => {
  const st = M.iniciar(M.crear(DESPUES), T0);
  M.saltar(st, M.pasos(DESPUES), s(1));
  assert.deepEqual(M.sesion(DESPUES, st, "2026-10-30", 123), { v: 1, rutinaId: "despues-de-correr", nombre: "Después de correr", fecha: "2026-10-30", completada: 123, duracionSeg: 180, saltados: 1 });
  const ses = [
    M.normalizarSesion("a", { fecha: "2026-10-27", completada: 1, rutinaId: "x", nombre: "A" }),
    M.normalizarSesion("b", { fecha: "2026-10-28", completada: 2 }),
    M.normalizarSesion("c", { fecha: "2026-10-29", completada: 3 }),
    M.normalizarSesion("d", { fecha: "2026-10-29", completada: 4 }),
    M.normalizarSesion("e", { fecha: "2026-10-25", completada: 0 }),
    M.normalizarSesion("f", { fecha: "malo" })
  ];
  assert.deepEqual(M.racha(ses, "2026-10-30"), { dias: 3, hoy: false }, "hasta ayer sigue viva");
  assert.deepEqual(M.racha(ses, "2026-10-29"), { dias: 3, hoy: true });
  assert.deepEqual(M.racha(ses, "2026-11-02"), { dias: 0, hoy: false });
  assert.deepEqual(M.ultimas(ses, 3).map(x => x.id), ["d", "c", "b"]);
  assert.equal(M.estaSemana(ses, "2026-10-30"), 4, "lunes 26 a hoy");
  assert.equal(M.fechaCorta("2026-10-30"), "vie 30 oct");
});
