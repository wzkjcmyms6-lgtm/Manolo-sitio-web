// Biblia en audio (D-123): escuchar el capítulo en el lector, a 375 px.
// La voz del teléfono se reemplaza por una falsa que anota lo que "dice" y
// avisa al terminar cada trozo (onend), como speechSynthesis.
// Uso: node scripts/e2e/biblia-audio.js [carpeta-para-capturas]
const { chromium, servidor, abrir, ok, captura: capturar, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const HOY = "2026-11-15";
const MUESTRA = "En el principio creó Dios los cielos y la tierra.";

// Voz falsa: V.ms = cuánto dura cada trozo; V.frenarEn = texto desde el que
// cada trozo dura "para siempre"; V.modo: normal | error (cada trozo falla) |
// muda (speak no hace nada).
function vozFalsa() {
  const voces = [
    { name: "Samantha", lang: "en-US", voiceURI: "com.apple.voice.compact.en-US.Samantha" },
    { name: "Mónica", lang: "es-ES", voiceURI: "com.apple.voice.compact.es-ES.Monica" },
    { name: "Paulina", lang: "es-MX", voiceURI: "com.apple.voice.compact.es-MX.Paulina" },
    { name: "Paulina (mejorada)", lang: "es-MX", voiceURI: "com.apple.voice.enhanced.es-MX.Paulina" },
    { name: "Eddy (español (México))", lang: "es-MX", voiceURI: "com.apple.eloquence.es-MX.Eddy" }
  ];
  const V = window.__voz = { dichos: [], cancelados: 0, ms: 100000, modo: "normal", frenarEn: null };
  let cola = [], actual = null, timer = null;
  const ss = {
    speaking: false, pending: false, paused: false,
    getVoices: () => voces.slice(),
    addEventListener() {}, removeEventListener() {},
    speak(u) {
      if (V.modo === "muda") return;
      cola.push(u);
      if (!actual) empezar(); else ss.pending = true;
    },
    cancel() {
      V.cancelados++;
      const a = actual;
      cola = [];
      actual = null;
      clearTimeout(timer);
      ss.speaking = false;
      ss.pending = false;
      if (a && a.onerror) setTimeout(() => a.onerror({ error: "interrupted" }), 0);
    },
    pause() {}, resume() {}
  };
  function empezar() {
    actual = cola.shift() || null;
    ss.pending = cola.length > 0;
    ss.speaking = !!actual;
    if (!actual) return;
    const u = actual;
    if (V.frenarEn && u.text === V.frenarEn) V.ms = 100000;
    V.dichos.push({ texto: u.text, voz: u.voice ? u.voice.voiceURI : null, rate: u.rate, lang: u.lang });
    const fallar = V.modo === "error";
    timer = setTimeout(() => {
      if (actual !== u) return;
      actual = null;
      ss.speaking = false;
      if (fallar) { if (u.onerror) u.onerror({ error: "synthesis-failed" }); }
      else if (u.onend) u.onend({});
      if (!actual) empezar();
    }, fallar ? 5 : V.ms);
  }
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: ss });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; this.rate = 1; this.voice = null; this.lang = ""; };
}

const texto = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const visible = (p, sel) => p.$eval(sel, el => !!el.offsetParent && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height > 0).catch(() => false);
const leidos = p => p.evaluate(() => { const d = window.__fakeStore.colMap("users/test/meta").get("biblia_leidos"); return (d && d.dias) || {}; });
const ultimo = p => p.evaluate(() => { const d = window.__voz.dichos; return d[d.length - 1] || {}; });
const estado = p => p.evaluate(() => window.BibliaAudioUI.estado());
const verso = (p, cap, v) => p.evaluate(([c, n]) => BibliaAudio.paraVoz(BibliaTexto.mostrar(BibliaLector.datos().caps[c - 1][n - 1], { actual: true, numero: n })), [cap, v]);
const voz = (p, cambios) => p.evaluate(c => Object.assign(window.__voz, c), cambios);
const sonando = (p, v) => p.$$eval(".bbl-v.is-sonando", els => els.map(e => Number(e.dataset.v))).then(xs => xs.length === 1 && xs[0] === v);

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const p = await abrir(browser, base, {}, { hash: "#biblia", zona: ZONA, fecha: `${HOY}T07:00:00-04:00`, ancho: 375, alto: 812, init: vozFalsa });
  const consola = [];
  p.on("console", m => { if ((m.type() === "error" || m.type() === "warning") && !/Failed to load resource|net::ERR/.test(m.text())) consola.push(`${m.type()}: ${m.text()}`); });
  await p.waitForTimeout(1000);
  await p.evaluate(() => window.BibliaLector.abrir("Ps", 117));
  await p.waitForTimeout(1000);

  console.log("\nEl botón de audífonos y la barra");
  const arriba = await p.$eval('.bbl-barra [data-bba="abrir"]', b => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, visible: !!b.offsetParent }; }).catch(() => null);
  ok(arriba && arriba.visible && arriba.w >= 40 && arriba.h >= 44, `botón «Escuchar» arriba en el lector (${arriba ? `${Math.round(arriba.w)}×${Math.round(arriba.h)}` : "no está"})`);
  const cabe = await p.$eval(".bbl-barra", b => [...b.children].every(x => x.getBoundingClientRect().right <= innerWidth + 0.5) && b.scrollWidth <= b.clientWidth + 1);
  ok(cabe, "los cinco botones de arriba caben a 375 px");
  await p.click('[data-bba="abrir"]');
  await p.waitForTimeout(250);
  ok(await visible(p, ".bba") && (await p.getAttribute(".bba-play", "aria-label")) === "Pausar", "aparece la barra y suena (el botón grande dice «Pausar»)");
  const d0 = await ultimo(p);
  ok(d0.texto === "Salmo 117.", `empieza diciendo «${d0.texto}»`);
  ok(d0.voz === "com.apple.voice.enhanced.es-MX.Paulina" && d0.rate === 1, `con la mejor voz en español (${d0.voz}) a 1×`);
  ok(/Salmos 117/.test(await texto(p, ".bba-t")) && /Empezando/.test(await texto(p, ".bba-v")), "la barra dice Salmos 117 · Empezando…");
  await captura(p, "biblia-audio-375.png");

  await p.click('[data-bba="adelante"]');
  await p.waitForTimeout(350);
  ok((await ultimo(p)).texto === await verso(p, 117, 1) && await sonando(p, 1), "⏭ pasa al versículo 1 y lo resalta");
  ok(/Versículo 1 de 2/.test(await texto(p, ".bba-v")), "«Versículo 1 de 2»");
  await p.click('[data-bba="adelante"]');
  await p.waitForTimeout(350);
  ok((await ultimo(p)).texto === await verso(p, 117, 2) && await sonando(p, 2) && /Versículo 2 de 2/.test(await texto(p, ".bba-v")), "⏭ otra vez: versículo 2");
  await p.click('[data-bba="atras"]');
  await p.waitForTimeout(350);
  ok((await ultimo(p)).texto === await verso(p, 117, 1) && await sonando(p, 1), "⏮ vuelve al versículo 1");
  await p.click('[data-bba="play"]');
  await p.waitForTimeout(200);
  ok((await p.getAttribute(".bba-play", "aria-label")) === "Escuchar" && !(await p.evaluate(() => speechSynthesis.speaking)), "⏸ pausa (la voz se calla)");
  ok(!(await p.$eval('[data-bba="abrir"]', b => b.classList.contains("is-activo"))) && /Versículo 1 de 2/.test(await texto(p, ".bba-v")), "en pausa queda en el versículo 1");
  await p.click('[data-bba="vel"]');
  await p.waitForTimeout(150);
  ok((await texto(p, ".bba-vel")) === "1,1×" && (await p.evaluate(() => JSON.parse(localStorage.getItem("manolo-biblia-audio")).vel)) === 1.1, "la velocidad cambia a 1,1× y queda guardada");
  await p.click('[data-bba="play"]');
  await p.waitForTimeout(250);
  const d1 = await ultimo(p);
  ok(d1.texto === await verso(p, 117, 1) && d1.rate === 1.1, "▶ sigue desde el versículo 1, a 1,1×");
  const chicos = await p.$$eval(".bba button", els => els.filter(e => e.offsetParent).map(e => ({ t: e.getAttribute("aria-label") || e.textContent, w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height })).filter(x => x.h < 44 || x.w < 44));
  ok(!chicos.length, `botones de la barra de 44 px o más${chicos.length ? `: ${JSON.stringify(chicos)}` : ""}`);

  console.log("\nCapítulo completo: se marca como leído y sigue con el siguiente");
  await p.click('[data-bba="cerrar"]');
  await p.waitForTimeout(200);
  ok(!(await visible(p, ".bba")) && !(await p.evaluate(() => speechSynthesis.speaking)) && !(await p.$(".bbl-v.is-sonando")), "✕ cierra la barra y corta la voz");
  await voz(p, { ms: 30, frenarEn: "Salmo 118." });
  await p.click('[data-bba="abrir"]');
  await p.waitForTimeout(1500);
  ok(((await leidos(p))[HOY] || []).includes("Ps.117"), "al oír el Salmo 117 completo queda como leído hoy");
  ok(/Escuchaste Salmos 117: quedó como leído hoy/.test(await texto(p, ".bba-toast")) && await visible(p, ".bba-toast .undo-toast-btn"), "aviso con «Deshacer»");
  ok((await texto(p, "#bbl-donde-t")) === "Salmos 118" && (await ultimo(p)).texto === "Salmo 118.", "y sigue solo con el Salmo 118");
  await captura(p, "biblia-audio-sigue-375.png");
  await p.click(".bba-toast .undo-toast-btn");
  await p.waitForTimeout(400);
  ok(!((await leidos(p))[HOY] || []).includes("Ps.117"), "«Deshacer» lo quita");

  console.log("\nVoz y opciones");
  await p.click('[data-bba="ajustes"]');
  await p.waitForTimeout(400);
  const ops = await p.$$eval('.bba-hoja select[data-bba-op="voz"] option', os => os.map(o => o.textContent));
  ok(ops.length === 4 && ops[0] === "Paulina · México (mejorada)" && ops[3] === "Eddy · México" && !ops.some(o => /Samantha/.test(o)), `solo voces en español, la mejor primero (${ops.join(" | ")})`);
  await p.selectOption('.bba-hoja select[data-bba-op="voz"]', "com.apple.voice.compact.es-ES.Monica");
  await p.waitForTimeout(350);
  const d2 = await ultimo(p);
  ok(d2.voz === "com.apple.voice.compact.es-ES.Monica" && d2.texto === "Salmo 118.", "elegir Mónica: lo que suena sigue con esa voz");
  await p.click(".bba-hoja [data-bba-probar]");
  await p.waitForTimeout(350);
  const d3 = await ultimo(p);
  ok(d3.texto === MUESTRA && d3.voz === "com.apple.voice.compact.es-ES.Monica" && (await estado(p)).estado === "pausado", "«Probar la voz» pausa el capítulo y dice una frase de muestra");
  await p.click('.bba-hoja [data-bba-vel="0.9"]');
  await p.click('.bba-hoja [data-bba-op="seguir"]');
  await p.waitForTimeout(150);
  const pr = await p.evaluate(() => JSON.parse(localStorage.getItem("manolo-biblia-audio")));
  ok(pr.vel === 0.9 && pr.seguir === false && pr.marcar === true && pr.voz === "com.apple.voice.compact.es-ES.Monica", "velocidad, voz y «Seguir con el siguiente» quedan guardadas en el teléfono");
  const chicosH = await p.$$eval(".bba-hoja button, .bba-hoja select", els => els.filter(e => e.offsetParent).map(e => ({ t: (e.getAttribute("aria-label") || e.textContent).trim().slice(0, 20), h: e.getBoundingClientRect().height })).filter(x => x.h < 44));
  ok(!chicosH.length, `la hoja tiene botones de 44 px o más${chicosH.length ? `: ${JSON.stringify(chicosH)}` : ""}`);
  ok(await p.$eval('.bba-hoja select', s => parseFloat(getComputedStyle(s).fontSize) >= 16), "la lista de voces tiene letra de 16 px (el iPhone no hace zoom)");
  await captura(p, "biblia-audio-hoja-375.png");
  await p.click(".bba-hoja .budget-sheet-close");
  await p.waitForTimeout(350);

  console.log("\nSin «Seguir»: termina el capítulo y se detiene");
  await voz(p, { ms: 12, frenarEn: null });
  await p.click('[data-bba="play"]');
  await p.waitForTimeout(2200);
  ok((await texto(p, "#bbl-donde-t")) === "Salmos 118" && /Terminó el capítulo/.test(await texto(p, ".bba-v")), "se queda en el Salmo 118: «Terminó el capítulo»");
  ok((await p.getAttribute(".bba-play", "aria-label")) === "Escuchar otra vez" && !(await p.$(".bbl-v.is-sonando")), "el botón ofrece «Escuchar otra vez» y nada queda resaltado");
  ok(((await leidos(p))[HOY] || []).includes("Ps.118"), "el Salmo 118 quedó como leído hoy");
  const rates = await p.evaluate(() => window.__voz.dichos.filter(d => /^Salmo 118/.test(d.texto) || d.texto.length > 20).slice(-5).map(d => d.rate));
  ok(rates.every(r => r === 0.9), "todo a 0,9×");

  console.log("\nDesde un versículo elegido");
  await voz(p, { ms: 100000 });
  await p.click("#bbl-v5");
  await p.waitForTimeout(250);
  ok(await visible(p, ".bbl-selbar") && !(await visible(p, ".bba")) && await visible(p, '[data-bbs="escuchar"]'), "al elegir un versículo: barra de versículos con «Escuchar» (la del audio se esconde)");
  await captura(p, "biblia-audio-elegir-375.png");
  await p.click('[data-bbs="escuchar"]');
  await p.waitForTimeout(350);
  ok(!(await visible(p, ".bbl-selbar")) && await visible(p, ".bba") && (await ultimo(p)).texto === await verso(p, 118, 5) && await sonando(p, 5), "«Escuchar» lee desde el versículo 5");
  ok(/Versículo 5 de 29/.test(await texto(p, ".bba-v")), "«Versículo 5 de 29»");

  console.log("\nCambiar de capítulo mientras suena");
  await p.keyboard.press("ArrowRight");
  await p.waitForTimeout(900);
  ok((await texto(p, "#bbl-donde-t")) === "Salmos 119" && (await ultimo(p)).texto === "Salmo 119." && (await estado(p)).estado === "sonando", "el audio sigue al capítulo nuevo (Salmo 119 desde el comienzo)");

  console.log("\nSalir de la app pausa");
  await p.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
  await p.waitForTimeout(150);
  ok((await estado(p)).estado === "pausado" && /Se pausó al salir/.test(await texto(p, ".bba-v")), "se pausa y lo dice");
  await p.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" }); document.dispatchEvent(new Event("visibilitychange")); });

  console.log("\nSi la voz falla: pausa, sin marcar nada");
  await voz(p, { modo: "error" });
  await p.click('[data-bba="play"]');
  await p.waitForTimeout(600);
  const e1 = await estado(p);
  ok(e1.estado === "pausado" && /No se pudo leer en voz alta/.test(await texto(p, ".bba-v")), "tres errores seguidos: pausa con aviso");
  ok(!((await leidos(p))[HOY] || []).includes("Ps.119") && e1.v <= 3, `no se salta el capítulo ni lo marca (quedó en el versículo ${e1.v})`);

  console.log("\nSi la voz se calla sin avisar: el vigía");
  await voz(p, { modo: "muda" });
  await p.click('[data-bba="play"]');
  await p.waitForTimeout(7600);
  const e2 = await estado(p);
  ok(e2.estado === "pausado" && /La voz se detuvo/.test(await texto(p, ".bba-v")), "lo intenta otra vez y, si sigue callada, pausa con aviso");
  ok(!((await leidos(p))[HOY] || []).includes("Ps.119"), "tampoco marca nada");

  console.log("\nCerrar el lector corta el audio");
  await voz(p, { modo: "normal", ms: 100000 });
  await p.click('[data-bba="play"]');
  await p.waitForTimeout(250);
  ok((await estado(p)).estado === "sonando", "suena otra vez");
  await p.click('[data-bbl="cerrar"]');
  await p.waitForTimeout(300);
  ok(!(await p.evaluate(() => speechSynthesis.speaking)) && (await estado(p)).estado === "parado", "al cerrar el lector la voz se calla");
  await p.evaluate(() => window.BibliaLector.abrir("Ps", 23));
  await p.waitForTimeout(800);
  ok(!(await visible(p, ".bba")) && !(await p.$(".bbl-v.is-sonando")), "al volver a abrirlo no queda nada sonando");
  ok(!consola.length && !p.errores.length, `sin errores ni advertencias${consola.length ? ` (${consola[0]})` : ""}`);
  await p.context().close();

  console.log("\nTeléfono angosto (320 px)");
  const q = await abrir(browser, base, {}, { hash: "#biblia", zona: ZONA, fecha: `${HOY}T07:00:00-04:00`, ancho: 320, alto: 568, init: vozFalsa });
  await q.waitForTimeout(1000);
  await q.evaluate(() => window.BibliaLector.abrir("1Thess", 5));
  await q.waitForTimeout(1000);
  const cabe320 = await q.$eval(".bbl-barra", b => [...b.children].every(x => x.getBoundingClientRect().right <= innerWidth + 0.5) && b.scrollWidth <= b.clientWidth + 1);
  ok(cabe320, "los botones de arriba caben a 320 px");
  await q.click('[data-bba="abrir"]');
  await q.waitForTimeout(300);
  const barra320 = await q.$eval(".bba", b => b.scrollWidth <= b.clientWidth + 1 && [...b.querySelectorAll("button")].every(x => x.getBoundingClientRect().right <= innerWidth + 0.5));
  ok(barra320, "la barra del audio cabe a 320 px");
  ok((await ultimo(q)).texto === "Primera de Tesalonicenses, capítulo 5.", "dice «Primera de Tesalonicenses, capítulo 5.»");
  await captura(q, "biblia-audio-320.png");

  console.log("\nPausar mientras abre el siguiente capítulo");
  await q.route(/rv1909\/Prov\.json/, async r => { await new Promise(res => setTimeout(res, 1500)); await r.continue(); });
  await q.click('[data-bba="cerrar"]');
  await q.evaluate(() => window.BibliaLector.abrir("Ps", 150));
  await q.waitForTimeout(700);
  await voz(q, { ms: 10 });
  await q.click('[data-bba="abrir"]');
  await q.waitForTimeout(500);
  ok(/Abriendo Proverbios 1/.test(await texto(q, ".bba-v")), `al terminar el Salmo 150: «${await texto(q, ".bba-v")}»`);
  // Mientras baja Proverbios, el Salmo 150 recién marcado repinta el lector:
  // antes eso mostraba el texto de Salmos con el título de Proverbios.
  ok(!/Bienaventurado el varón/.test(await texto(q, "#bbl-texto")), "mientras abre otro libro no muestra el texto del libro anterior");
  await q.click('[data-bba="play"]');
  await q.waitForTimeout(2000);
  const habloProv = await q.evaluate(() => window.__voz.dichos.some(d => /^Proverbios/.test(d.texto)));
  ok((await texto(q, "#bbl-donde-t")) === "Proverbios 1" && (await estado(q)).estado === "pausado" && !habloProv, "si pausas mientras abre, Proverbios 1 llega en pausa (no empieza solo)");
  await voz(q, { ms: 100000 });
  await q.click('[data-bba="play"]');
  await q.waitForTimeout(200);
  ok((await ultimo(q)).texto === "Proverbios, capítulo 1.", "▶ lo empieza desde el comienzo");
  ok(!q.errores.length, "sin errores de página");
  await q.context().close();
  await terminar(browser, srv);
})();
