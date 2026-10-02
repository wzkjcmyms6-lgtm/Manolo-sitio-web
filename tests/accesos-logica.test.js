const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../js/accesos-logica.js");

const user = {
  uid: "abc123",
  email: "lentina@manolo-panel.local",
  metadata: { lastSignInTime: "Wed, 30 Sep 2026 22:15:00 GMT" }
};

test("un inicio de sesión = una clave fija (idempotente)", () => {
  const ms = Date.parse("Wed, 30 Sep 2026 22:15:00 GMT");
  assert.equal(A.claveLogin("abc123", user.metadata.lastSignInTime), `abc123_${ms}`);
  // Reabrir la app no cambia lastSignInTime → misma clave, no se duplica.
  assert.equal(A.eventoLogin(user).id, A.eventoLogin({ ...user }).id);
  assert.equal(A.claveLogin("", user.metadata.lastSignInTime), null);
  assert.equal(A.claveLogin("abc123", "no es fecha"), null);
});

test("el evento solo lleva uid, usuario, tipo y leído: nada sensible", () => {
  const ev = A.eventoLogin(user);
  assert.deepEqual(Object.keys(ev.datos).sort(), ["leido", "tipo", "uid", "usuario"]);
  assert.equal(ev.datos.usuario, "Lentina");
  assert.equal(ev.datos.tipo, "login");
  assert.equal(ev.datos.leido, false);
  assert.ok(!JSON.stringify(ev).includes("@"), "sin correo");
  assert.equal(A.eventoLogin(null), null);
  assert.equal(A.eventoLogin({ uid: "x", metadata: {} }), null);
});

test("nombre de usuario sin dominio y con largo máximo", () => {
  assert.equal(A.nombreUsuario("manolo@manolo-panel.local"), "Manolo");
  assert.equal(A.nombreUsuario(""), "Usuario");
  assert.equal(A.nombreUsuario("a".repeat(100) + "@x").length, A.USUARIO_MAX);
});

test("bandeja del admin: sin sus propios accesos, nuevos primero, cuenta no leídos", () => {
  const docs = [
    { id: "1", uid: "yo", usuario: "Juan", creado: { seconds: 300 }, leido: false },
    { id: "2", uid: "otro", usuario: "Lentina", creado: { seconds: 100 }, leido: true },
    { id: "3", uid: "otro", usuario: "Lentina", creado: { toMillis: () => 200000 }, leido: false },
    { id: "4", uid: "otra", usuario: "Ana", creado: null, leido: false }
  ];
  const b = A.bandeja(docs, "yo");
  assert.deepEqual(b.lista.map(x => x.id), ["4", "3", "2"]);
  assert.equal(b.noLeidos, 2);
});

test("fecha y hora legibles", () => {
  const ms = new Date(2026, 8, 30, 22, 5).getTime();
  assert.equal(A.fechaHora(ms), "30/09/2026 · 22:05");
  assert.equal(A.fechaHora(null), "Ahora");
});

test("abrir la app cuenta como entrada, como mucho una cada 30 minutos", () => {
  const AL2 = require("../js/accesos-logica.js");
  const user = { uid: "abc", email: "lentina@manolo-panel.local" };
  const ahora = Date.UTC(2026, 9, 2, 15, 0);
  const ev = AL2.eventoApertura(user, ahora, 0);
  assert.equal(ev.id, "abc_" + ahora);
  assert.deepEqual(ev.datos, { uid: "abc", usuario: "Lentina", tipo: "login", leido: false });
  assert.equal(AL2.eventoApertura(user, ahora + 10 * 60000, ahora), null);
  assert.ok(AL2.eventoApertura(user, ahora + 31 * 60000, ahora));
  // Si el reloj del teléfono retrocedió, igual registra.
  assert.ok(AL2.eventoApertura(user, ahora - 5 * 60000, ahora));
  assert.equal(AL2.eventoApertura(null, ahora, 0), null);
});
