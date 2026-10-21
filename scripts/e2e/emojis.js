// Pruebas de pantalla: selector de emojis del formulario de hábitos.
// Uso: node scripts/e2e/emojis.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const habitos = p => p.evaluate(() => [...window.__fakeStore.colMap("users/test/habitos").values()]);
const actual = p => p.textContent("[data-emoji-actual]").then(t => t.trim());
async function sinFestejos(p) {
  for (let i = 0; i < 5 && await p.$(".hb-celebra [data-continuar]"); i++) { await p.click(".hb-celebra [data-continuar]"); await p.waitForTimeout(450); }
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, {}, { hash: "#habitos", ancho: 375 });

  console.log("\nCategorías de emojis");
  await p.click("#hb-nuevo");
  await p.waitForTimeout(400);
  const grupos = await p.$$eval(".hb-emoji-grupo", els => els.map(e => e.textContent.trim()));
  ok(grupos.join(",") === "Salud,Ejercicio,Comida,Mente,Calma,Trabajo,Hogar,Dinero,Social,Hobbies,Dejar", `11 categorías (${grupos.join(", ")})`);
  ok((await actual(p)) === "💧" && (await p.getAttribute(".hb-emoji-grupo.is-on", "data-emoji-grupo")) === "salud", "nuevo hábito: 💧 elegido y Salud abierta");
  ok((await p.$$(".hb-emojis .hb-emoji-btn")).length === 16, "16 emojis en Salud");
  await captura(p, "emojis-salud.png");
  await p.fill('.hb-form input[name="name"]', "Dejar la cerveza");
  await p.click('[data-emoji-grupo="dejar"]');
  await p.waitForTimeout(250);
  ok((await p.inputValue('.hb-form input[name="name"]')) === "Dejar la cerveza", "cambiar de categoría no borra lo escrito");
  ok((await p.$$eval(".hb-emojis .hb-emoji-btn", els => els.map(e => e.dataset.v))).includes("🍺"), "Dejar trae 🍺, 🚭, 📵…");
  await p.click('.hb-emoji-btn[data-v="🍺"]');
  await p.waitForTimeout(250);
  ok((await actual(p)) === "🍺" && await p.getAttribute('.hb-emoji-btn[data-v="🍺"]', "aria-pressed") === "true", "elegir 🍺 lo marca y lo muestra arriba");
  await captura(p, "emojis-dejar.png");
  await p.click('.hb-form button[type="submit"]');
  await p.waitForTimeout(600);
  await sinFestejos(p);
  ok((await habitos(p)).some(h => h.name === "Dejar la cerveza" && h.emoji === "🍺"), "se guarda con 🍺");

  console.log("\nEmoji propio (teclado)");
  await p.click("#hb-nuevo");
  await p.waitForTimeout(400);
  await p.fill('.hb-form input[name="name"]', "Guitarra eléctrica");
  await p.fill('.hb-form input[name="emojiPropio"]', "🦄 extra");
  await p.waitForTimeout(150);
  ok((await actual(p)) === "🦄" && !(await p.$(".hb-emoji-btn.is-on")), "escribir 🦄 lo muestra arriba (solo el primer emoji)");
  await p.click('.hb-form button[type="submit"]');
  await p.waitForTimeout(600);
  await sinFestejos(p);
  ok((await habitos(p)).some(h => h.name === "Guitarra eléctrica" && h.emoji === "🦄"), "se guarda con 🦄");

  console.log("\nEditar un hábito viejo");
  const id = await p.evaluate(() => [...window.__fakeStore.colMap("users/test/habitos").entries()].find(([, h]) => h.name === "Dejar la cerveza")[0]);
  await p.click(`[data-detalle="${id}"]`);
  await p.waitForTimeout(400);
  await p.click("[data-editar]");
  await p.waitForTimeout(400);
  ok((await actual(p)) === "🍺" && (await p.getAttribute(".hb-emoji-grupo.is-on", "data-emoji-grupo")) === "dejar", "al editar, abre la categoría de su emoji");
  await p.context().close();
  await terminar(browser, srv);
})();
