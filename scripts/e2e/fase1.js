// Pruebas de pantalla de la Fase 1 (login, nota de hábitos, accesos/admin).
// Uso: node scripts/e2e/fase1.js [carpeta-para-capturas]
// Necesita Playwright con Chromium (en el entorno de Claude Code ya viene).
// Levanta un servidor local, cambia Firebase por scripts/e2e/fake-firebase.js
// y recorre la app a 390 px de ancho como un iPhone.
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const USERS = {
  "juan@manolo-panel.local": { uid: "admin1", pass: "1234" },
  "lentina@manolo-panel.local": { uid: "user2", pass: "abc9" }
};
const nuevaPagina = (browser, base, estado) => abrir(browser, base, estado);
const accesos = p => p.evaluate(() => [...window.__fakeStore.colMap("accesos").entries()]);
// Hábitos puede festejar logros con un aviso a pantalla completa: se cierra.
async function sinFestejos(p) {
  for (let i = 0; i < 5 && await p.$(".hb-celebra [data-continuar]"); i++) {
    await p.click(".hb-celebra [data-continuar]");
    await p.waitForTimeout(450);
  }
}
const captura = (p, nombre) => capturar(p, CAPTURAS, nombre);

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();

  // ---------- Login ----------
  console.log("\nLogin");
  let p = await nuevaPagina(browser, base, { __USERS__: USERS, __SESION__: "" });
  const attr = (sel, a) => p.getAttribute(sel, a);
  ok(await p.isVisible("#login-screen"), "sin sesión se ve la pantalla de login");
  ok(await attr("#login-password", "type") === "password", "la contraseña está oculta");
  ok(await attr("#login-password", "inputmode") === "numeric", "pide teclado numérico");
  ok(await attr("#login-password", "autocomplete") === "current-password", "mantiene el autocompletado de contraseñas");
  await p.fill("#login-password", "12ab");
  await p.click("#login-ver");
  ok(await attr("#login-password", "type") === "text" && await attr("#login-ver", "aria-pressed") === "true", "el ojo muestra la contraseña");
  await p.click("#login-ver");
  ok(await attr("#login-password", "type") === "password", "y la vuelve a ocultar");
  await p.click("#login-teclado");
  ok(await attr("#login-password", "inputmode") === "text", "el botón cambia a teclado de letras");
  await p.reload(); await p.waitForTimeout(500);
  ok(await attr("#login-password", "inputmode") === "text", "el teléfono recuerda el teclado elegido");
  await p.click("#login-teclado");
  ok(await attr("#login-password", "inputmode") === "numeric", "y se puede volver al numérico");
  await captura(p, "f1-login.png");

  await p.fill("#login-username", ""); await p.fill("#login-password", "");
  await p.click("#login-form button[type=submit]"); await p.waitForTimeout(300);
  ok(await p.isVisible("#login-screen") && !(await p.evaluate(() => document.getElementById("login-form").checkValidity())), "vacío: no envía (campos obligatorios)");

  await p.fill("#login-username", "Lentina"); await p.fill("#login-password", "mala");
  await p.click("#login-form button[type=submit]"); await p.waitForTimeout(400);
  ok(await p.isVisible("#login-error") && (await p.textContent("#login-error")).includes("incorrectos"), "contraseña mala: muestra el error");
  ok((await accesos(p)).length === 0, "un login fallido no registra acceso");
  await p.click("#login-ver");
  await p.fill("#login-password", "abc9");
  await p.click("#login-form button[type=submit]"); await p.waitForTimeout(900);
  ok(await p.isVisible("#app-content") && !(await p.isVisible("#login-screen")), "contraseña buena: entra a la app");
  ok(await attr("#login-password", "type") === "password", "al enviar la contraseña vuelve a quedar oculta");
  let acc = await accesos(p);
  ok(acc.length === 1 && /^user2_\d+$/.test(acc[0][0]), "el login correcto crea UN acceso con id uid_hora");
  const ev = acc[0] && acc[0][1];
  ok(ev && JSON.stringify(Object.keys(ev).sort()) === JSON.stringify(["creado", "leido", "tipo", "uid", "usuario"]), "el acceso solo tiene uid, usuario, tipo, creado y leído");
  ok(ev && ev.usuario === "Lentina" && ev.tipo === "login" && ev.leido === false && typeof ev.creado === "number", "datos del acceso correctos (hora del servidor)");
  ok(ev && !JSON.stringify(ev).includes("abc9") && !JSON.stringify(ev).includes("@"), "sin contraseña ni correo en el acceso");
  await p.reload(); await p.waitForTimeout(900);
  ok((await accesos(p)).length === 1, "reabrir la app no duplica el acceso");
  await p.evaluate(() => { localStorage.removeItem("manolo.acceso.enviado"); document.dispatchEvent(new CustomEvent("manolo:inicio-sesion", { detail: { user: auth.currentUser } })); });
  await p.waitForTimeout(400);
  acc = await accesos(p);
  ok(acc.length === 1 && acc[0][1].creado === ev.creado, "un reintento del mismo login no lo duplica ni lo pisa");
  ok(await p.isHidden("[data-avisos]"), "un usuario normal no ve la campana");
  const leer = await p.evaluate(() => db.collection("accesos").get().then(() => "leyó", e => e.code));
  ok(leer === "permission-denied", "un usuario normal no puede leer los accesos (reglas)");
  const hacerse = await p.evaluate(() => db.collection("admins").doc("user2").set({}).then(() => "escribió", e => e.code));
  ok(hacerse === "permission-denied", "nadie puede hacerse admin desde la app");

  // ---------- Hábitos: nota ----------
  console.log("\nHábitos");
  await p.goto(base + "/index.html#habitos"); await p.waitForTimeout(700);
  await p.evaluate(() => {
    window.__fakeStore.colMap("users/user2/habitos").set("viejo", { v: 2, name: "Leer", emoji: "📖", tipo: "sino", freqType: "diario", days: [true, true, true, true, true, true, true], done: [], registros: {}, createdAt: Date.now() - 864e5, inicio: "2026-09-01", orden: 1 });
    window.__fakeStore.notify();
  });
  await p.waitForTimeout(500);
  ok(await p.isVisible(".hb-fila") && !(await p.$(".hb-desc-fila")), "un hábito viejo sin nota se ve igual que antes");
  await sinFestejos(p);
  await p.click("#hb-nuevo"); await p.waitForTimeout(400);
  await p.fill('.hb-form input[name="name"]', "Agradecimiento");
  await p.fill('.hb-form textarea[name="descripcion"]', "Agradecer por mi familia, por mi salud, por mi trabajo y por las oportunidades que tengo.");
  await captura(p, "f1-habito-form.png");
  await p.click('.hb-form button[type="submit"]'); await p.waitForTimeout(600);
  await sinFestejos(p);
  const habitos = () => p.evaluate(() => [...window.__fakeStore.colMap("users/user2/habitos").entries()]);
  let nuevo = (await habitos()).find(([, d]) => d.name === "Agradecimiento");
  ok(nuevo && nuevo[1].descripcion.startsWith("Agradecer por mi familia"), "crear con nota: se guarda la nota");
  const sinNota = (await habitos()).find(([id]) => id === "viejo");
  ok(sinNota && !("descripcion" in sinNota[1]), "el hábito viejo no se tocó");
  ok((await p.textContent(".hb-lista")).includes("Agradecer por mi familia"), "la nota se ve en la lista de hoy");
  await captura(p, "f1-habito-lista.png");
  await sinFestejos(p);
  await p.click(`[data-detalle="${nuevo[0]}"]`); await p.waitForTimeout(500);
  ok(await p.isVisible(".hb-descripcion"), "la nota completa se ve en el detalle");
  await captura(p, "f1-habito-detalle.png");
  await p.click(`[data-editar="${nuevo[0]}"]`); await p.waitForTimeout(400);
  ok((await p.inputValue('.hb-form textarea[name="descripcion"]')).startsWith("Agradecer"), "al editar aparece la nota guardada");
  await p.fill('.hb-form textarea[name="descripcion"]', "Por mi familia.");
  await p.click('.hb-form button[type="submit"]'); await p.waitForTimeout(500);
  nuevo = (await habitos()).find(([id]) => id === nuevo[0]);
  ok(nuevo[1].descripcion === "Por mi familia.", "editar la nota la cambia");
  await p.click(`[data-detalle="${nuevo[0]}"]`); await p.waitForTimeout(400);
  await p.click(`[data-editar="${nuevo[0]}"]`); await p.waitForTimeout(400);
  await p.fill('.hb-form textarea[name="descripcion"]', "  ");
  await p.click('.hb-form button[type="submit"]'); await p.waitForTimeout(500);
  nuevo = (await habitos()).find(([id]) => id === nuevo[0]);
  ok(!("descripcion" in nuevo[1]), "vaciar la nota la quita");
  await p.context().close();

  // ---------- Administrador ----------
  console.log("\nAdministrador");
  const ahora = Date.now();
  p = await nuevaPagina(browser, base, {
    __USERS__: USERS, __SESION__: "admin1",
    __SEED__: {
      admins: { admin1: {} },
      accesos: {
        "user2_1": { uid: "user2", usuario: "Lentina", tipo: "login", creado: ahora - 3600e3, leido: false },
        "user2_0": { uid: "user2", usuario: "Lentina", tipo: "login", creado: ahora - 86400e3, leido: true },
        "admin1_1": { uid: "admin1", usuario: "Juan", tipo: "login", creado: ahora - 60e3, leido: false }
      }
    }
  });
  await p.waitForTimeout(500);
  ok(await p.isVisible(".topbar [data-avisos]"), "el admin ve la campana");
  ok((await p.textContent(".topbar [data-avisos-n]")) === "1", "cuenta 1 sin leer (no cuenta sus propios accesos)");
  await p.click(".topbar [data-avisos]"); await p.waitForTimeout(400);
  ok(await p.isVisible("#avisos-hoja") && (await p.$$(".avisos-item")).length === 2, "la bandeja muestra el historial de otros usuarios");
  ok((await p.textContent(".avisos-item")).includes("Lentina ingresó a Manolo"), "cada aviso dice quién entró, fecha y hora");
  await captura(p, "f1-admin-bandeja.png");
  await p.click('[data-aviso="user2_1"]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => window.__fakeStore.colMap("accesos").get("user2_1").leido === true), "tocar un aviso lo marca como leído");
  ok(await p.isHidden(".topbar [data-avisos-n]"), "y el contador desaparece");
  await p.click("[data-avisos-cerrar].budget-sheet-close"); await p.waitForTimeout(300);
  await p.evaluate(t => { window.__fakeStore.colMap("accesos").set("user2_9", { uid: "user2", usuario: "Lentina", tipo: "login", creado: t, leido: false }); window.__fakeStore.notify(); }, Date.now());
  await p.waitForTimeout(400);
  ok(await p.isVisible("#avisos-toast") && (await p.textContent(".topbar [data-avisos-n]")) === "1", "un acceso nuevo avisa al instante (sin recargar)");
  await captura(p, "f1-admin-aviso.png");
  await p.click("#avisos-toast"); await p.waitForTimeout(400);
  await p.click("#avisos-todo"); await p.waitForTimeout(400);
  ok(await p.evaluate(() => [...window.__fakeStore.colMap("accesos").values()].filter(d => d.uid !== "admin1").every(d => d.leido)), "«Marcar todo como leído» funciona");
  await p.context().close();

  await terminar(browser, srv);
})();
