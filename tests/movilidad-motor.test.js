const test = require("node:test");
const assert = require("node:assert/strict");
const RUTINAS = require("../js/movilidad-rutinas.js");
const M = require("../js/movilidad-motor.js");

const [LIBERAR, CORRER] = RUTINAS;
const T0 = 1000000;
const s = n => T0 + M.CUENTA_MS + n * 1000;   // instante n segundos después de la cuenta 3-2-1

test("las rutinas están bien escritas y duran lo pedido", () => {
  assert.deepEqual(M.problemas(RUTINAS), []);
  assert.deepEqual(RUTINAS.map(r => r.id), ["liberar-el-cuerpo", "antes-de-correr"]);
  assert.equal(M.duracion(LIBERAR), 120);
  assert.equal(M.pasos(LIBERAR).length, 6);
  assert.equal(M.duracion(CORRER), 300);
  assert.equal(M.pasos(CORRER).length, 12);
  assert.deepEqual(M.pasos(CORRER).slice(0, 6).map(p => p.nombre), M.pasos(LIBERAR).map(p => p.nombre), "Antes de correr empieza con Liberar el cuerpo");
  assert.deepEqual(M.pasos(CORRER).filter(p => p.porLado).map(p => p.nombre), ["World's greatest stretch", "Balanceo de pierna adelante-atrás", "Balanceo de pierna lateral"]);
  assert.equal(M.pasos(CORRER)[6].nota, "En esta parte todo va en movimiento continuo, sin sostener posiciones.");
  assert.equal(M.pasos(CORRER)[5].nota, "", "la nota es solo de la segunda parte");
  assert.deepEqual([M.duracionTexto(120), M.duracionTexto(300), M.duracionTexto(90), M.duracionTexto(45)], ["2 min", "5 min", "1 min 30 s", "45 s"]);
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
  const ps = M.pasos(LIBERAR);
  const st = M.iniciar(M.crear(LIBERAR), T0);
  assert.equal(M.info(st, ps, T0).cuenta, 3);
  assert.equal(M.info(st, ps, T0 + 1200).cuenta, 2);
  assert.equal(M.info(st, ps, T0 + 2500).cuenta, 1);
  const i = M.info(st, ps, s(0));
  assert.deepEqual([i.cuenta, i.indice, i.restante, i.paso.nombre, i.siguiente.nombre], [0, 0, 20, "Gato-vaca", "Postura del niño"]);
  assert.equal(M.pausar(st, T0 + 1000).estado, "activo", "no se pausa durante la cuenta");
});

test("avanza solo, con el tiempo que falta y el avance total", () => {
  const ps = M.pasos(LIBERAR);
  const st = M.iniciar(M.crear(LIBERAR), T0);
  let i = M.info(st, ps, s(5.2));
  assert.deepEqual([i.indice, i.restante], [0, 15]);
  i = M.info(st, ps, s(20));
  assert.deepEqual([i.indice, i.restante, i.paso.nombre], [1, 20, "Postura del niño"]);
  i = M.info(st, ps, s(60));
  assert.equal(i.pct, 0.5);
  i = M.info(st, ps, s(119.5));
  assert.deepEqual([i.indice, i.restante, i.siguiente], [5, 1, null]);
  assert.equal(M.info(st, ps, s(120)).terminado, true);
});

test("por lado: cambia de lado a la mitad", () => {
  const ps = M.pasos(LIBERAR);
  const st = M.iniciar(M.crear(LIBERAR), T0);
  const a = M.info(st, ps, s(60 + 9.9)), b = M.info(st, ps, s(60 + 10));
  assert.equal(a.paso.nombre, "World's greatest stretch");
  assert.deepEqual([a.lado, b.lado], [1, 2]);
  assert.deepEqual(M.cambios(a, b), ["lado"]);
  assert.equal(M.info(st, ps, s(5)).lado, null, "los demás no tienen lado");
});

test("pausar y reanudar: el tiempo no corre en pausa", () => {
  const ps = M.pasos(LIBERAR);
  const st = M.iniciar(M.crear(LIBERAR), T0);
  M.pausar(st, s(10));
  assert.equal(M.info(st, ps, s(500)).restante, 10);
  M.reanudar(st, s(500));
  const i = M.info(st, ps, s(505));
  assert.deepEqual([i.indice, i.restante], [0, 5]);
});

test("saltar: al siguiente ejercicio; en el último, termina", () => {
  const ps = M.pasos(LIBERAR);
  const st = M.iniciar(M.crear(LIBERAR), T0);
  M.saltar(st, ps, s(3));
  let i = M.info(st, ps, s(3));
  assert.deepEqual([i.indice, i.restante], [1, 20]);
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
  const ps = M.pasos(LIBERAR);
  const st = M.iniciar(M.crear(LIBERAR), T0);
  const en = t => M.info(st, ps, t);
  assert.deepEqual(M.cambios(en(T0 + 2900), en(s(0))), ["paso"], "termina la cuenta: empieza el primero");
  assert.deepEqual(M.cambios(en(s(19.9)), en(s(20))), ["paso"]);
  assert.deepEqual(M.cambios(en(s(20)), en(s(21))), []);
  assert.deepEqual(M.cambios(en(s(119)), en(s(120))), ["fin"]);
  assert.deepEqual(M.cambios(null, en(s(1))), []);
});

test("sesión guardada, racha y últimas", () => {
  const st = M.iniciar(M.crear(CORRER), T0);
  M.saltar(st, M.pasos(CORRER), s(1));
  assert.deepEqual(M.sesion(CORRER, st, "2026-10-30", 123), { v: 1, rutinaId: "antes-de-correr", nombre: "Antes de correr", fecha: "2026-10-30", completada: 123, duracionSeg: 300, saltados: 1 });
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
