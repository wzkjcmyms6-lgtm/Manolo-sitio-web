// Pruebas de pantalla de Ropa, fase 3: Inspiración (D-148; docs/ROPA.md).
// La barra de Ropa (Ropero · + · Inspiración); sin puente: subir imágenes,
// la ficha de cada una, borrar con Deshacer y lo que pasa con un link; con
// un puente de mentira que contesta como Pinterest y la IA (sin gastar):
// conectar el tablero con el link corto del iPhone, los pines nuevos con su
// imagen, la IA mirando cada uno, lo que se ve, el look con tu ropa (sin IA
// y con la IA), "Me lo pongo hoy", quitar un pin (no vuelve al actualizar),
// pegar el link de un pin, "Mi estilo" (con la IA y corregido), el tope,
// Ajustes (el tablero) y sin la clave de la IA; la copia de seguridad con
// las inspiraciones y sus imágenes; 390 y 320 px, claro y la compu.
// Uso: node scripts/e2e/ropa-insp.js [carpeta-para-capturas]
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium, servidor, abrir: abrirBase, ok, captura: capturar, terminar } = require("./comun.js");

const CAPTURAS = process.argv[2] || null;
const captura = (p, n) => capturar(p, CAPTURAS, n);
const ZONA = "America/La_Paz";
const FECHA = "2026-11-23T09:00:00-04:00";   // lunes
const HOY = "2026-11-23";
const COL = "users/test/ropa", INSP = "users/test/ropa_inspiracion";
const PUENTE = "https://puente.prueba";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const txt = (p, sel) => p.$eval(sel, el => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const sobra = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const coleccion = (p, c) => p.evaluate(x => Object.fromEntries(window.__fakeStore.colMap(x)), c);
const inspiraciones = p => coleccion(p, INSP);
const fotosIDB = p => p.evaluate(() => window.RopaDatos.Fotos.todas().then(rs => rs.map(r => ({ id: r.id, grupoId: r.grupoId, clase: r.clase, ancho: r.ancho, alto: r.alto, tam: r.blob.size }))));
const toast = p => txt(p, "#ro-toast .undo-toast-msg");
const ir = (p, h) => p.evaluate(x => { location.hash = x; }, h);

// Dibujar un "look" (abrigo, polera, pantalón y zapatos de colores) en la página.
function dibujo() {
  window.__look = (cs, w, h) => new Promise(r => {
    const c = document.createElement("canvas");
    c.width = w || 736; c.height = h || 1104;
    const g = c.getContext("2d"), W = c.width, H = c.height;
    g.fillStyle = "#ece6dc"; g.fillRect(0, 0, W, H);
    const poly = (col, pts) => { g.fillStyle = col; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x * W, y * H) : g.moveTo(x * W, y * H))); g.closePath(); g.fill(); };
    poly(cs[2], [[0.38, 0.52], [0.62, 0.52], [0.66, 0.9], [0.53, 0.9], [0.5, 0.62], [0.47, 0.9], [0.34, 0.9]]);
    poly(cs[1], [[0.36, 0.2], [0.64, 0.2], [0.66, 0.54], [0.34, 0.54]]);
    poly(cs[0], [[0.3, 0.19], [0.42, 0.18], [0.44, 0.75], [0.28, 0.75]]);
    poly(cs[0], [[0.58, 0.18], [0.7, 0.19], [0.72, 0.75], [0.56, 0.75]]);
    poly(cs[3], [[0.32, 0.9], [0.47, 0.9], [0.48, 0.94], [0.3, 0.94]]);
    poly(cs[3], [[0.53, 0.9], [0.68, 0.9], [0.7, 0.94], [0.52, 0.94]]);
    g.fillStyle = "#d8c7b5"; g.beginPath(); g.arc(0.5 * W, 0.12 * H, 0.055 * W, 0, Math.PI * 2); g.fill();
    c.toBlob(b => r(b), "image/jpeg", 0.85);
  });
}
const abrir = (browser, base, estado, o) => abrirBase(browser, base, estado, Object.assign({ zona: ZONA, fecha: FECHA, init: dibujo }, o));
const COLORES = [["#c19a6b", "#efe6cf", "#4f6f9a", "#6b4a32"], ["#1e2a44", "#f4f4f2", "#8c8c8f", "#3d2b1f"], ["#c19a6b", "#efe6cf", "#151515", "#f4f4f2"], ["#2f8a4e", "#d9c6a5", "#4a4a4f", "#151515"], ["#6e1f2c", "#151515", "#1e2a44", "#3d2b1f"]];
// Elige n imágenes en un <input type=file> (como si las sacaras de la galería).
function elegirImagenes(p, sel, n) {
  return p.evaluate(({ sel, n, cs }) => Promise.all(Array.from({ length: n }, (_, k) => window.__look(cs[k % cs.length], 600, 900)))
    .then(bs => {
      const dt = new DataTransfer();
      bs.forEach((b, k) => dt.items.add(new File([b], `inspiracion${k}.jpg`, { type: "image/jpeg" })));
      const inp = document.querySelector(sel);
      inp.files = dt.files;
      inp.dispatchEvent(new Event("change", { bubbles: true }));
    }), { sel, n, cs: COLORES });
}

// ---- Lo que "ve" la IA de mentira (en el orden en que le llegan las imágenes) ----
const v = (grupo, tipo, colores, extra) => Object.assign({ grupo, tipo, colores, estampado: "liso", tela: "", detalle: "" }, extra || {});
const CAMEL = { esRopa: true, resumen: "Casual de invierno: abrigo camel largo con jean recto", estilo: ["casual", "clasico"], clima: ["frio"], formalidad: 2, ocasion: "fin de semana",
  prendas: [v("abrigos", "Abrigo", ["camel"], { tela: "Lana", detalle: "largo" }), v("arriba", "Chompa", ["crema"], { tela: "Punto", detalle: "cuello alto" }), v("abajo", "Jean", ["azul-jean"], { tela: "Jean", detalle: "recto" }), v("zapatos", "Botines", ["cafe"], { tela: "Cuero" }), v("accesorios", "Bufanda", ["negro"])] };
const OFICINA = { esRopa: true, resumen: "Oficina relajada: saco azul marino con camisa blanca", estilo: ["formal", "clasico"], clima: ["templado"], formalidad: 4, ocasion: "oficina",
  prendas: [v("abrigos", "Saco", ["azul-marino"]), v("arriba", "Camisa", ["blanco"]), v("abajo", "Pantalón de tela", ["gris"]), v("zapatos", "Mocasines", ["cafe-oscuro"])] };
const URBANO = { esRopa: true, resumen: "Urbano: chamarra camel, polera crema y zapatillas blancas", estilo: ["urbano", "casual"], clima: ["templado"], formalidad: 2, ocasion: "salir con amigos",
  prendas: [v("abrigos", "Chamarra", ["camel"]), v("arriba", "Polera", ["crema"]), v("abajo", "Jean", ["negro"]), v("zapatos", "Zapatillas", ["blanco"])] };
const PAISAJE = { esRopa: false, resumen: "Un paisaje", prendas: [], estilo: [], clima: [], formalidad: null, ocasion: "" };
const ESTILO = { resumen: "Te gustan los neutros con un toque clásico: abrigos largos, camel y crema, y jeans rectos.", claves: ["colores neutros", "capas", "cortes rectos"], colores: ["camel", "crema", "azul-jean"], prendas: ["Abrigo largo", "Jean recto"] };

// Tu ropero (con miniaturas hechas en la página).
const PRENDAS = [
  ["abrigo", "abrigos", "Abrigo", "beige", { tela: "Lana" }],
  ["chamarra", "abrigos", "Chamarra", "camel"],
  ["chompa", "arriba", "Chompa", "blanco", { estado: "lavar" }],
  ["polera", "arriba", "Polera", "crema"],
  ["jean", "abajo", "Jean", "azul-jean", { tela: "Jean", notas: "la favorita", precio: 300, talla: "32", marca: "Levi's" }],
  ["zapas", "zapatos", "Zapatillas", "blanco"]
];
const HEX = { beige: "#d9c6a5", camel: "#c19a6b", blanco: "#f4f4f2", crema: "#efe6cf", "azul-jean": "#4f6f9a" };
async function ropero(browser, base) {
  const p = await abrir(browser, base, { __SEED__: {} }, { hash: "#inicio" });
  const minis = await p.evaluate(hs => Promise.all(hs.map(h => window.__look([h, h, h, h], 200, 200).then(b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); })))), PRENDAS.map(x => HEX[x[3]] || "#888"));
  await p.context().close();
  const docs = {};
  PRENDAS.forEach(([id, grupo, tipo, color, extra], k) => {
    docs[id] = Object.assign({ v: 1, grupo, tipo, colores: [{ id: color }], estado: "activa", creado: k + 1, fotos: [{ id: `f-${id}`, mini: minis[k], ancho: 200, alto: 200 }] }, extra || {});
  });
  return docs;
}
// Las imágenes de los pines (JPEG de verdad, para el puente de mentira).
async function imagenesDePines(browser, base) {
  const p = await abrir(browser, base, { __SEED__: {} }, { hash: "#inicio" });
  const b64 = await p.evaluate(cs => Promise.all(cs.map(c => window.__look(c).then(b => new Promise(r => { const f = new FileReader(); f.onload = () => r(String(f.result).split(",")[1]); f.readAsDataURL(b); })))), COLORES);
  await p.context().close();
  return b64.map(x => Buffer.from(x, "base64"));
}

// ---- El puente de mentira (Pinterest y la IA) ----
const img = n => `https://i.pinimg.com/736x/0${n}/aa/bb/pin${n}.jpg`;
const PIN = (id, n, titulo, fecha) => ({ id, url: `https://www.pinterest.com/pin/${id}/`, titulo, img: img(n), fecha });
function puenteFalso(jpegs, o) {
  const est = Object.assign({
    permitido: true, lista: true, version: 2, gasto: { mes: "2026-11", usd: 0.4, veces: 9, tope: 8 }, demora: 120,
    pines: [PIN("111", 1, "Look urbano con chamarra", 1000), PIN("222", 2, "Oficina en azul", 2000), PIN("333", 3, "Abrigo camel y jean", 3000)],
    suelto: PIN("555", 5, "Verde y gris para el frío", 5000),
    analisis: [CAMEL, OFICINA, URBANO, PAISAJE, CAMEL], fallo: {}, pedidos: []
  }, o || {});
  est.de = ruta => est.pedidos.filter(x => x.ruta === ruta);
  est.rutas = async ctx => {
    await ctx.route(`${PUENTE}/**`, async route => {
      const req = route.request();
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      const ruta = new URL(req.url()).pathname;
      const cuerpo = req.postData() ? JSON.parse(req.postData()) : null;
      est.pedidos.push({ ruta, auth: req.headers().authorization, cuerpo });
      const json = (status, c) => route.fulfill({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(c) });
      const n = est.de(ruta).length;   // en el orden en que llegan
      if (est.fallo[ruta]) return json(est.fallo[ruta][0], est.fallo[ruta][1]);
      if (ruta === "/quien") return json(200, { permitido: est.permitido, uid: "test", lista: est.lista, version: est.version, gasto: est.gasto });
      if (ruta === "/pinterest/tablero") {
        await new Promise(r => setTimeout(r, est.demora));
        return json(200, { usuario: "juanito_99", tablero: "manolo", titulo: "Manolo", pines: est.pines });
      }
      if (ruta === "/pinterest/pin") {
        if (/manolo|Tablero1/.test(cuerpo.link)) return json(400, { error: "es-tablero", mensaje: "Ese link es de un tablero: conéctalo en Ajustes de Ropa." });
        return json(200, { pin: est.suelto });
      }
      if (ruta === "/pinterest/imagen") {
        const k = Number((/\/0(\d)\//.exec(cuerpo.url) || [])[1]);
        return jpegs[k - 1] ? route.fulfill({ status: 200, headers: CORS, contentType: "image/jpeg", body: jpegs[k - 1] }) : json(404, { error: "imagen" });
      }
      const sumar = c => { est.gasto = Object.assign({}, est.gasto, { usd: Math.round((est.gasto.usd + c) * 100) / 100, veces: est.gasto.veces + 1 }); };
      if (ruta === "/inspiracion") {
        await new Promise(r => setTimeout(r, est.demora));
        sumar(0.02);
        return json(200, { inspiracion: est.analisis[(n - 1) % est.analisis.length], gasto: est.gasto });
      }
      if (ruta === "/look") {
        await new Promise(r => setTimeout(r, est.demora));
        sumar(0.04);
        // Como el puente de verdad: con los ids del ropero que llegó.
        const usados = new Set(), prendas = [], faltan = [];
        cuerpo.pin.prendas.forEach((x, k) => {
          const mia = cuerpo.ropero.find(r => !usados.has(r.id) && r.grupo === x.grupo && r.tipo === x.tipo) || cuerpo.ropero.find(r => !usados.has(r.id) && r.grupo === x.grupo && !r.lavar);
          if (mia) { usados.add(mia.id); prendas.push({ pin: k + 1, id: mia.id, parecido: mia.tipo === x.tipo ? "parecida" : "reemplazo", porque: `Tu ${mia.tipo.toLowerCase()} hace de ${x.tipo.toLowerCase()}.` }); }
          else if (x.grupo !== "accesorios") faltan.push({ pin: k + 1, grupo: x.grupo, tipo: x.tipo, colores: x.colores, porque: "No tienes algo así." });
        });
        return json(200, { look: { prendas, faltan, consejo: "Arremanga el abrigo para que se vea la chompa." }, gasto: est.gasto });
      }
      if (ruta === "/estilo") { sumar(0.01); return json(200, { estilo: ESTILO, gasto: est.gasto }); }
      return json(404, { error: "ruta" });
    });
  };
  return est;
}
const conPuente = est => ({ "manolo.puente": PUENTE, __SEED__: est.seed || {} });

// ---------- Sin puente ----------
async function sinPuente(browser, base, ancho) {
  console.log(`\nInspiración sin puente (${ancho} px)`);
  const p = await abrir(browser, base, { __SEED__: {} }, { hash: "#ropa", ancho });
  await p.waitForTimeout(400);
  ok(/Ropero/.test(await txt(p, "#bottom-nav-links")) && /Inspiración/.test(await txt(p, "#bottom-nav-links")) && await p.isVisible("#bottom-nav-links [data-ropa-mas]"), "la barra de Ropa: Ropero · + · Inspiración");
  ok(!(await p.$(".ro-fab")) && !(await p.isVisible("#panel-ropa .back-link")), "sin el botón flotante ni «Inicio» arriba (la casita de la barra de arriba vuelve)");
  await p.click("#bottom-nav-links [data-ropa-mas]");
  await p.waitForTimeout(400);
  const mas = await txt(p, ".ro-hoja-mas");
  ok(/A tu ropero/.test(mas) && /Sacar o elegir fotos/.test(mas) && /Inspiración/.test(mas) && /Subir imágenes/.test(mas) && /Link de Pinterest/.test(mas), "el +: a tu ropero (fotos o sin foto) o inspiración (imágenes o link)");
  if (ancho === 390) await captura(p, "insp-mas-390.png");
  // Un link sin puente: explica y deja subir una captura.
  await p.click(".ro-hoja-mas [data-rin-link]");
  await p.waitForTimeout(500);
  ok(/todavía no está conectado/.test(await txt(p, ".rin-hoja-link")) && await p.$(".rin-hoja-link [data-rin-fotos]"), "un link sin puente: lo explica y deja subir una captura");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  await p.click('#bottom-nav-links a[data-hash="ropa-inspiracion"]');
  await p.waitForTimeout(500);
  ok(await p.isVisible("#panel-ropa-inspiracion") && /Guarda aquí lo que te gusta/.test(await txt(p, "#rin-app")), "Inspiración vacía: invita a subir");
  ok(/todavía no está conectado/.test(await txt(p, ".rin-tablero")), "el tablero: hace falta el puente");
  ok(!(await p.isVisible("#verse-banner")), "sin el versículo arriba");
  // Subir tres imágenes desde la pantalla vacía.
  await elegirImagenes(p, "#rin-app [data-rin-fotos]", 3);
  await p.waitForFunction(() => document.querySelectorAll("#rin-app .rin-card").length === 3, null, { timeout: 10000 }).catch(() => {});
  ok(/Listo: 3 inspiraciones nuevas/.test(await toast(p)), "«Listo: 3 inspiraciones nuevas»");
  const ds = await inspiraciones(p);
  const ids = Object.keys(ds);
  ok(ids.length === 3 && ids.every(id => ds[id].via === "foto" && ds[id].fotos.length === 1 && /^data:image\/jpeg/.test(ds[id].fotos[0].mini)), "se guardan con su miniatura en la nube");
  const fotos = await fotosIDB(p);
  ok(fotos.length === 3 && fotos.every(f => f.clase === "inspiracion" && ids.includes(f.grupoId)), "y la imagen grande en el teléfono (como las prendas)");
  ok(/3 inspiraciones/.test(await txt(p, "#rin-app .ro-resumen")) && !(await p.$("#rin-app .rin-tag")), "cuántas hay (sin «Sin mirar»: no hay IA)");
  ok(!(await p.$("#rin-app .rin-card-t")), "una imagen subida y sin mirar: solo la imagen (sin un título repetido)");
  ok(!(await p.$("#rin-app .rin-estilo-fila, #rin-app .rin-estilo-nota")), "sin IA, «Mi estilo» todavía no aparece");
  ok(await sobra(p) <= 0, "nada se sale a lo ancho");
  await p.waitForTimeout(300);
  await captura(p, `insp-sin-puente-${ancho}.png`);
  // La ficha de una.
  await p.click("#rin-app .rin-card >> nth=0");
  await p.waitForTimeout(500);
  ok(await p.isVisible("#panel-ropa-pin") && /Una imagen que subiste · lunes 23 de noviembre/.test(await txt(p, "#rinp-app .ro-ficha-sub")), "la ficha: de dónde viene y cuándo");
  ok(/Cuando conectes la IA/.test(await txt(p, "#rinp-app .rin-vista")) && !(await p.$("#rinp-app .rin-look")), "sin IA: lo explica (y sin look, que necesita saber qué prendas se ven)");
  ok(await p.$eval("#rinp-app .rin-ficha-foto img", i => /^blob:/.test(i.src) && i.naturalWidth >= 600), "la imagen grande, del teléfono");
  ok(/Inspiración/.test(await txt(p, "#bottom-nav-links a.active")), "la barra sigue marcando Inspiración");
  await captura(p, `insp-ficha-sin-ia-${ancho}.png`);
  await p.click('#rinp-app [data-rinp="borrar"]');
  await p.waitForTimeout(400);
  ok(/Borraste la inspiración/.test(await toast(p)) && Object.keys(await inspiraciones(p)).length === 2, "borrar (con Deshacer)");
  await p.click("#ro-toast .undo-toast-btn");
  await p.waitForTimeout(400);
  ok(Object.keys(await inspiraciones(p)).length === 3 && (await fotosIDB(p)).length === 3, "Deshacer la trae de vuelta, con su imagen");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

// ---------- Con el puente: Pinterest y la IA ----------
async function conPinterest(browser, base, jpegs, seedRopa) {
  console.log("\nInspiración con Pinterest y la IA (un puente de mentira)");
  const est = puenteFalso(jpegs);
  est.seed = { [COL]: seedRopa };
  const p = await abrir(browser, base, conPuente(est), { hash: "#ropa-ajustes", ancho: 390, rutas: est.rutas });
  await p.waitForTimeout(600);
  ok(/Tu tablero de Pinterest/.test(await txt(p, "#roa-app")) && await p.isVisible('#roa-app [data-roa="pin-conectar"]'), "Ajustes: «Conectar tablero»");
  await ir(p, "ropa-inspiracion");
  await p.waitForTimeout(400);
  ok(await p.isVisible('#rin-app [data-rin="conectar"]'), "Inspiración: «Conectar tablero»");
  await p.click('#rin-app [data-rin="conectar"]');
  await p.waitForSelector(".rin-hoja-tablero [name=link]", { timeout: 4000 });
  await p.fill(".rin-hoja-tablero [name=link]", "no es un link");
  await p.click('.rin-hoja-tablero button[type="submit"]');
  await p.waitForTimeout(200);
  ok(/no parece el link de un tablero/.test(await txt(p, ".rin-hoja-tablero [data-rin-error]")) && !est.de("/pinterest/tablero").length, "un texto que no es link: avisa sin preguntar al puente");
  await p.fill(".rin-hoja-tablero [name=link]", "Mira mi tablero https://pin.it/2Ab3Cd4Ef");
  await p.click('.rin-hoja-tablero button[type="submit"]');
  await p.waitForFunction(() => document.querySelectorAll("#rin-app .rin-card").length === 3, null, { timeout: 10000 }).catch(() => {});
  const t = est.de("/pinterest/tablero")[0];
  ok(t && t.cuerpo.link === "Mira mi tablero https://pin.it/2Ab3Cd4Ef" && t.auth === "Bearer token-de-prueba-test", "le pide el tablero al puente (con el link tal cual y tu sesión)");
  ok(est.de("/pinterest/imagen").length === 3, "trae la imagen de cada pin por el puente");
  const meta = (await coleccion(p, "users/test/meta")).ropa_ajustes || {};
  ok(meta.pinterest && meta.pinterest.usuario === "juanito_99" && meta.pinterest.tablero === "manolo" && meta.pinterest.titulo === "Manolo" && meta.pinterest.leido > 0, "guarda tu tablero (usuario, tablero y cuándo lo leyó)");
  let ds = await inspiraciones(p);
  ok(["pin-111", "pin-222", "pin-333"].every(id => ds[id] && ds[id].via === "tablero" && ds[id].pin.url === `https://www.pinterest.com/pin/${id.slice(4)}/` && ds[id].fotos.length === 1), "cada pin con su link, su título y su imagen");
  // La IA mira cada uno, sola.
  await p.waitForFunction(() => window.RopaInspDatos.lista().filter(x => x.analisis).length === 3, null, { timeout: 15000 }).catch(() => {});
  const ins = est.de("/inspiracion");
  ok(ins.length === 3 && ins.every(x => Object.keys(x.cuerpo).sort().join() === "imagen,tipo" && x.cuerpo.tipo === "image/jpeg" && x.cuerpo.imagen.length > 5000), "la IA mira cada pin: le llega solo la imagen");
  await p.waitForTimeout(400);
  ok(/«Manolo»/.test(await txt(p, ".rin-tablero")) && /Actualizado/.test(await txt(p, ".rin-tablero")), "el tablero conectado, con cuándo se leyó");
  ok(/3 inspiraciones/.test(await txt(p, "#rin-app .ro-resumen")) && /5 prendas/.test(await txt(p, "#rin-app .rin-grilla")) && /4 prendas/.test(await txt(p, "#rin-app .rin-grilla")), "las tarjetas dicen cuántas prendas se ven");
  const fila = await txt(p, "#rin-app .rin-estilo-fila");
  ok(/Mi estilo/.test(fila) && /Casual/.test(fila) && /Clásico/.test(fila), `«Mi estilo»: una fila con lo que más se repite, sin IA todavía (${fila})`);
  ok(await p.$eval("#rin-app .rin-estilo-fila", el => el.compareDocumentPosition(document.querySelector("#rin-app .rin-grilla")) & Node.DOCUMENT_POSITION_FOLLOWING), "y los pines justo debajo");
  await captura(p, "insp-tablero-390.png");
  // El pin del abrigo camel.
  ds = await inspiraciones(p);
  const camel = Object.keys(ds).find(id => ds[id].analisis && ds[id].analisis.resumen === CAMEL.resumen);
  await ir(p, `ropa-pin/${camel}`);
  await p.waitForTimeout(600);
  const vista = await txt(p, "#rinp-app .rin-vista");
  ok(/Casual de invierno/.test(vista) && /Abrigo camel largo/.test(vista) && /Chompa crema cuello alto/.test(vista) && /Jean azul recto/.test(vista) && /Botines cafés/.test(vista), `lo que se ve, con nombres de verdad (${vista.slice(0, 120)})`);
  ok(/De tu tablero de Pinterest/.test(await txt(p, "#rinp-app .ro-ficha-sub")) && await p.$eval("#rinp-app .rin-ver", a => a.href === `https://www.pinterest.com/pin/${a.ownerDocument.location.hash.split("pin-")[1]}/` && a.target === "_blank"), "«Ver en Pinterest» abre el pin aparte");
  let look = await txt(p, "#rinp-app .rin-look");
  ok(/Lo más parecido de tu ropero/.test(look) && /Abrigo beige/.test(look) && /Chompa blanca/.test(look) && /Jean azul/.test(look), `sin pedirle nada a la IA: lo más parecido de tu ropero (${look.slice(0, 160)})`);
  ok(/Te falta/.test(look) && /Botines cafés/.test(look) && !/Bufanda/.test(look.split("Te falta")[1] || ""), "y lo que te falta (los accesorios no se piden)");
  ok(await p.$eval("#rinp-app .rin-buscar", a => a.href === "https://www.pinterest.com/search/pins/?q=Botines%20caf%C3%A9s" && a.target === "_blank"), "«Ver ideas» busca en Pinterest (solo un link)");
  ok(!est.de("/look").length, "eso no gasta: no se le pidió nada a la IA");
  await captura(p, "insp-pin-reglas-390.png");
  // Con la IA.
  await p.click('#rinp-app [data-rinp="armar"]');
  await p.waitForFunction(() => /Lo armó la IA/.test((document.querySelector("#rinp-app .rin-look") || {}).innerText || ""), null, { timeout: 8000 }).catch(() => {});
  const pl = est.de("/look")[0];
  const r0 = pl && pl.cuerpo.ropero;
  ok(pl && pl.cuerpo.pin.prendas.length === 5 && r0.length === 6 && r0.every(x => !("notas" in x) && !("precio" in x) && !("talla" in x) && !("fotos" in x)), "a la IA le llega lo que se ve y tu ropero, sin notas, precio, talla ni fotos");
  ok(r0.find(x => x.id === "chompa").lavar === true, "y cuáles están para lavar");
  look = await txt(p, "#rinp-app .rin-look");
  ok(/Lo armó la IA el lunes 23 de noviembre/.test(look) && /Arremanga el abrigo/.test(look) && /Tu abrigo hace de abrigo/.test(look), "el look de la IA, con por qué y un consejo");
  ds = await inspiraciones(p);
  ok(ds[camel].look && ds[camel].look.origen === "ia" && ds[camel].look.fecha === HOY && ds[camel].look.prendas.some(x => x.id === "abrigo"), "el look queda guardado (no se vuelve a pagar)");
  await captura(p, "insp-pin-ia-390.png");
  // Me lo pongo hoy.
  await p.click('#rinp-app [data-rinp="puse"]');
  await p.waitForTimeout(500);
  const usos = (await coleccion(p, "users/test/ropa_usos"))[HOY];
  ok(usos && ["abrigo", "jean"].every(id => usos.prendas.includes(id)), "«Me lo pongo hoy» anota esas prendas en lo que te pusiste hoy");
  ok(/Te lo pusiste hoy/.test(await txt(p, '#rinp-app [data-rinp="puse"]')) && /prendas anotadas/.test(await toast(p)), "y lo dice");
  // Quitar un pin del tablero: no vuelve al actualizar.
  const oficina = Object.keys(ds).find(id => ds[id].analisis && ds[id].analisis.resumen === OFICINA.resumen);
  await ir(p, `ropa-pin/${oficina}`);
  await p.waitForTimeout(500);
  await p.click('#rinp-app [data-rinp="quitar"]');
  await p.waitForTimeout(500);
  ok((await inspiraciones(p))[oficina].oculta === true && /no vuelve/.test(await toast(p)) && /2 inspiraciones/.test(await txt(p, "#rin-app .ro-resumen")), "«Quitar de Manolo»: queda oculta");
  est.pines = est.pines.concat([PIN("444", 4, "Paisaje", 4000)]);
  await p.click('#rin-app [data-rin="actualizar"]');
  await p.waitForFunction(() => window.RopaInspDatos.todas().length === 4, null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(600);
  ds = await inspiraciones(p);
  ok(Object.keys(ds).length === 4 && ds[oficina].oculta === true && ds["pin-444"] && est.de("/pinterest/imagen").length === 4, "«Actualizar» trae solo el pin nuevo; el que quitaste no vuelve");
  await p.waitForFunction(() => window.RopaInspDatos.una("pin-444") && window.RopaInspDatos.una("pin-444").analisis, null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(300);
  ok(/Sin ropa/.test(await txt(p, "#rin-app .rin-grilla")), "una imagen sin ropa: se marca así");
  await p.click('#rin-app [data-rin="ocultas"]');
  await p.waitForTimeout(300);
  ok(/Las que quitaste/.test(await txt(p, "#rin-app")) && (await p.$$("#rin-app .rin-card")).length === 1, "«Las que quitaste (1)»");
  await p.click("#rin-app .rin-card");
  await p.waitForTimeout(400);
  await p.click('#rinp-app [data-rinp="mostrar"]');
  await p.waitForTimeout(400);
  ok((await inspiraciones(p))[oficina].oculta === false, "y se puede volver a mostrar");
  // Pegar el link de un pin (desde el +).
  await p.click("#bottom-nav-links [data-ropa-mas]");
  await p.waitForTimeout(400);
  await p.click(".ro-hoja-mas [data-rin-link]");
  await p.waitForSelector(".rin-hoja-link [name=link]", { timeout: 4000 });
  await p.fill(".rin-hoja-link [name=link]", "https://pin.it/Tablero1");
  await p.click('.rin-hoja-link button[type="submit"]');
  await p.waitForTimeout(400);
  ok(/es de un tablero/.test(await txt(p, ".rin-hoja-link [data-rin-error]")), "si pegas el link de un tablero, lo dice");
  await p.fill(".rin-hoja-link [name=link]", "Mira este pin en Pinterest https://pin.it/PinCorto1");
  await p.click('.rin-hoja-link button[type="submit"]');
  await p.waitForFunction(() => location.hash === "#ropa-pin/pin-555", null, { timeout: 8000 }).catch(() => {});
  await p.waitForFunction(() => window.RopaInspDatos.una("pin-555") && window.RopaInspDatos.una("pin-555").analisis, null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(400);
  ds = await inspiraciones(p);
  ok(ds["pin-555"] && ds["pin-555"].via === "link" && ds["pin-555"].fotos.length === 1 && await p.isVisible("#panel-ropa-pin"), "pegar el link de un pin: se guarda con su imagen y abre su ficha");
  ok(/De un link de Pinterest/.test(await txt(p, "#rinp-app .ro-ficha-sub")) && /Abrigo camel largo/.test(await txt(p, "#rinp-app .rin-vista")), "y la IA ya lo miró");
  // Mi estilo con la IA, y corregido.
  await ir(p, "ropa-inspiracion");
  await p.waitForTimeout(400);
  await p.click('#rin-app [data-rin="estilo"]');
  await p.waitForSelector(".rin-hoja-estilo .rin-estilo-hoja", { timeout: 4000 });
  ok(/Lo que más se repite en 4 inspiraciones/.test(await txt(p, ".rin-hoja-estilo")) && /Que la IA me lo diga/.test(await txt(p, ".rin-hoja-estilo")), "la hoja de «Mi estilo»: lo que se repite y «Que la IA me lo diga»");
  await p.click('.rin-hoja-estilo [data-rin-e="ia"]');
  await p.waitForFunction(() => /neutros con un toque clásico/.test((document.querySelector(".rin-hoja-estilo") || {}).innerText || ""), null, { timeout: 6000 }).catch(() => {});
  const pe = est.de("/estilo")[0];
  ok(pe && pe.cuerpo.pines.length === 4 && pe.cuerpo.pines.every(x => x.prendas.length) && !JSON.stringify(pe.cuerpo).includes("pin-"), "a la IA le llega lo que se ve en tus pines (sin la imagen sin ropa ni ids)");
  ok(/Te gustan los neutros/.test(await txt(p, ".rin-hoja-estilo")) && /capas/.test(await txt(p, ".rin-hoja-estilo")) && /Lo dijo la IA, con 4 inspiraciones/.test(await txt(p, ".rin-hoja-estilo")), "«Mi estilo» de la IA, con sus claves");
  await captura(p, "insp-estilo-390.png");
  await p.click('.rin-hoja-estilo [data-rin-e="corregir"]');
  await p.waitForSelector(".rin-hoja-estilo [name=resumen]", { timeout: 4000 });
  await p.fill(".rin-hoja-estilo [name=resumen]", "Me gustan los neutros, pero también el verde oliva.");
  await p.click('.rin-hoja-estilo button[type="submit"]');
  await p.waitForTimeout(600);
  const m2 = ((await coleccion(p, "users/test/meta")).ropa_ajustes || {}).estilo || {};
  ok(m2.corregido === true && /verde oliva/.test(m2.resumen) && /Corregido por ti/.test(await txt(p, ".rin-hoja-estilo")), "«Corregir»: queda como lo escribiste");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  ok(/verde oliva/.test(await txt(p, "#rin-app .rin-estilo-fila")), "y la fila de «Mi estilo» lo muestra");
  // El tope: la IA no puede, el look sale igual sin IA.
  est.fallo["/look"] = [402, { error: "tope", mensaje: "Llegaste al tope del mes (US$ 8). La IA vuelve el mes que viene, o sube el tope en Ajustes de Ropa." }];
  const urbano = Object.keys(ds).find(id => ds[id].analisis && ds[id].analisis.resumen === URBANO.resumen);
  await ir(p, `ropa-pin/${urbano}`);
  await p.waitForTimeout(500);
  await p.click('#rinp-app [data-rinp="armar"]');
  await p.waitForTimeout(600);
  ok(/tope del mes/.test(await toast(p)) && /Lo más parecido de tu ropero/.test(await txt(p, "#rinp-app .rin-look")) && /Chamarra camel/.test(await txt(p, "#rinp-app .rin-look")), "con el tope lleno: lo dice y queda lo más parecido (sin IA)");
  // Ajustes: el tablero conectado; desconectar con Deshacer.
  await ir(p, "ropa-ajustes");
  await p.waitForTimeout(500);
  ok(/Conectado: «Manolo» \(juanito_99\/manolo\)/.test(await txt(p, "#roa-app .roa-pin")), "Ajustes: el tablero conectado");
  await captura(p, "insp-ajustes-390.png");
  await p.click('#roa-app [data-roa="pin-quitar"]');
  await p.waitForTimeout(400);
  ok(((await coleccion(p, "users/test/meta")).ropa_ajustes || {}).pinterest === null && /Desconectaste/.test(await toast(p)) && Object.keys(await inspiraciones(p)).length === 5, "desconectar: los pines que trajiste se quedan");
  await p.click("#ro-toast .undo-toast-btn");
  await p.waitForTimeout(400);
  ok((((await coleccion(p, "users/test/meta")).ropa_ajustes || {}).pinterest || {}).usuario === "juanito_99", "Deshacer lo vuelve a conectar");
  ok(est.pedidos.every(x => x.auth === "Bearer token-de-prueba-test"), "cada pedido va con tu sesión");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
  return est;
}

// ---------- Más chico, claro, sin la clave y la compu ----------
async function otras(browser, base, jpegs, seedRopa) {
  console.log("\nInspiración a 320 px, en claro, sin la clave de la IA y en la compu");
  // El estado de la prueba anterior, armado de una.
  const insp = {
    "pin-333": { v: 1, via: "tablero", creado: Date.parse(FECHA) - 3600e3, pin: PIN("333", 3, "Abrigo camel y jean", 3000), fotos: [], analisis: CAMEL, ia: { fecha: HOY } },
    "pin-111": { v: 1, via: "tablero", creado: Date.parse(FECHA) - 2 * 3600e3, pin: PIN("111", 1, "Look urbano con chamarra", 1000), fotos: [], analisis: URBANO, ia: { fecha: HOY } },
    "pin-222": { v: 1, via: "tablero", creado: Date.parse(FECHA) - 3 * 86400e3, pin: PIN("222", 2, "Oficina en azul", 2000), fotos: [], analisis: OFICINA, ia: { fecha: HOY } }
  };
  const meta = { ropa_ajustes: { pinterest: { usuario: "juanito_99", tablero: "manolo", titulo: "Manolo", leido: Date.parse(FECHA) - 3600e3 }, estilo: Object.assign({ fecha: HOY, pines: 3 }, ESTILO) } };
  const seed = { [COL]: seedRopa, [INSP]: insp, "users/test/meta": meta };
  // Las imágenes de Pinterest, sin estar en el teléfono: se ven desde Pinterest.
  const imagenes = async ctx => ctx.route(/i\.pinimg\.com/, r => {
    const k = Number((/\/0(\d)\//.exec(r.request().url()) || [])[1]);
    return r.fulfill({ status: 200, contentType: "image/jpeg", body: jpegs[k - 1] });
  });
  const est = puenteFalso(jpegs);
  const rutas = async ctx => { await est.rutas(ctx); await imagenes(ctx); };
  let p = await abrir(browser, base, Object.assign(conPuente(est), { __SEED__: seed }), { hash: "#ropa-inspiracion", ancho: 320, rutas });
  await p.waitForTimeout(900);
  ok(await sobra(p) <= 0, "320 px: Inspiración no se sale a lo ancho");
  ok(await p.$eval("#rin-app .rin-card img", i => /^https:\/\/i\.pinimg\.com\//.test(i.src)), "si la imagen no está en este teléfono, se ve desde Pinterest");
  ok(!est.de("/pinterest/tablero").length, "el tablero leído hace una hora no se vuelve a leer solo");
  await captura(p, "insp-320.png");
  await ir(p, "ropa-pin/pin-333");
  await p.waitForTimeout(700);
  ok(await sobra(p) <= 0, "320 px: la ficha del pin tampoco");
  await captura(p, "insp-pin-320.png");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
  // En claro.
  p = await abrir(browser, base, Object.assign(conPuente(est), { __SEED__: seed }), { hash: "#ropa-pin/pin-333", ancho: 390, rutas, esquema: "light" });
  await p.waitForTimeout(900);
  await captura(p, "insp-pin-claro-390.png");
  await ir(p, "ropa-inspiracion");
  await p.waitForTimeout(500);
  await captura(p, "insp-claro-390.png");
  ok(!p.errores.length, `en claro, sin errores${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
  // Sin la clave de la IA: Pinterest anda, la IA no.
  const sinClave = puenteFalso(jpegs, { lista: false });
  const viejo = Object.assign({}, meta.ropa_ajustes.pinterest, { leido: Date.parse(FECHA) - 8 * 3600e3 });
  p = await abrir(browser, base, Object.assign(conPuente(sinClave), { __SEED__: { [COL]: seedRopa, "users/test/meta": { ropa_ajustes: { pinterest: viejo } } } }), { hash: "#ropa-inspiracion", ancho: 390, rutas: sinClave.rutas });
  await p.waitForFunction(() => window.RopaInspDatos.todas().length === 3, null, { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(600);
  ok(sinClave.de("/pinterest/tablero").length === 1 && Object.keys(await inspiraciones(p)).length === 3, "sin la clave: el tablero leído hace 8 horas se lee solo y trae los pines");
  ok(!sinClave.de("/inspiracion").length && !(await p.$("#rin-app .rin-tag")), "pero la IA no los mira (ni se marcan «Sin mirar»)");
  await p.click("#rin-app .rin-card >> nth=0");
  await p.waitForTimeout(400);
  ok(/Cuando conectes la IA/.test(await txt(p, "#rinp-app .rin-vista")), "la ficha lo explica");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
  // El puente no contesta (sin internet o caído): lo dice, con «Reintentar».
  const caido = puenteFalso(jpegs, { fallo: { "/quien": [503, { error: "caida", mensaje: "No responde." }] } });
  p = await abrir(browser, base, Object.assign(conPuente(caido), { __SEED__: seed }), { hash: "#ropa-inspiracion", ancho: 390, rutas: caido.rutas });
  await p.waitForTimeout(700);
  ok(/No pude hablar con el puente/.test(await txt(p, ".rin-tablero")) && await p.$('.rin-tablero [data-rin="reintentar"]') && /«Manolo»/.test(await txt(p, ".rin-tablero")), "si el puente no contesta, lo dice (y no que falta conectarlo), con «Reintentar»");
  delete caido.fallo["/quien"];
  await p.click('.rin-tablero [data-rin="reintentar"]');
  await p.waitForTimeout(600);
  ok(/Actualizar/.test(await txt(p, ".rin-tablero")) && !/No pude hablar/.test(await txt(p, ".rin-tablero")), "«Reintentar» y vuelve");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
  // La compu.
  p = await abrir(browser, base, Object.assign(conPuente(est), { __SEED__: seed }), { hash: "#ropa-inspiracion", ancho: 1280, alto: 900, rutas });
  await p.waitForTimeout(900);
  const pills = await txt(p, "#panel-ropa-inspiracion .fin-outer-tabs");
  ok(/Ropero/.test(pills) && /\+ Agregar/.test(pills) && /Inspiración/.test(pills) && await p.$('#panel-ropa-inspiracion .fin-outer-tabs a[href="#ropa-ajustes"]'), `la compu: Ropero · + Agregar · Inspiración y el engranaje (${pills})`);
  ok(await p.$eval("#rin-app .rin-grilla", el => getComputedStyle(el).columnCount) === "4", "la grilla en 4 columnas");
  ok(await sobra(p) <= 0, "nada se sale a lo ancho");
  await p.click("#panel-ropa-inspiracion .fin-outer-tabs [data-ropa-mas]");
  await p.waitForTimeout(400);
  ok(await p.isVisible(".ro-hoja-mas [data-rin-link]"), "el «+ Agregar» de arriba abre lo mismo");
  await p.keyboard.press("Escape");
  await captura(p, "insp-1280.png");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  await p.context().close();
}

// ---------- La copia de seguridad ----------
async function copia(browser, base) {
  console.log("\nInspiración en la copia de seguridad");
  let p = await abrir(browser, base, { __SEED__: {} }, { hash: "#ropa-inspiracion", ancho: 390 });
  await p.waitForTimeout(400);
  await elegirImagenes(p, "#rin-app [data-rin-fotos]", 1);
  await p.waitForFunction(() => document.querySelectorAll("#rin-app .rin-card").length === 1, null, { timeout: 8000 }).catch(() => {});
  const [id] = Object.keys(await inspiraciones(p));
  await ir(p, "inicio");
  await p.waitForTimeout(300);
  await p.click("#respaldo-abrir");
  await p.waitForTimeout(450);
  await p.click('[data-rsp="preparar"]');
  await p.waitForSelector('[data-rsp="guardar"]', { timeout: 8000 });
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click('[data-rsp="guardar"]')]);
  const archivo = path.join(os.tmpdir(), `insp-copia-${process.pid}.json`);
  await dl.saveAs(archivo);
  const c = JSON.parse(fs.readFileSync(archivo, "utf8"));
  ok(id && c.colecciones.ropa_inspiracion && c.colecciones.ropa_inspiracion[id] && c.fotosRopa.length === 1 && c.fotosRopa[0].grupoId === id && c.fotosRopa[0].clase === "inspiracion", "la copia lleva la inspiración y su imagen");
  await p.context().close();
  p = await abrir(browser, base, { __SEED__: {} }, { hash: "#inicio", ancho: 390 });
  await p.waitForTimeout(400);
  await p.click("#respaldo-abrir");
  await p.waitForTimeout(450);
  await p.setInputFiles(".rsp-hoja .rsp-input", archivo);
  await p.waitForTimeout(900);
  const plan = await txt(p, ".rsp-hoja .lib-hoja-cuerpo");
  ok(/Inspiraciones de Ropa \+1/.test(plan) && /Fotos de Ropa \+1/.test(plan), `el plan muestra la inspiración y su imagen (${plan.slice(0, 140)})`);
  await p.click('[data-rsp="confirmar"]');
  await p.waitForSelector("#rsp-t-listo", { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(400);
  const fotos = await fotosIDB(p);
  ok((await inspiraciones(p))[id] && fotos.length === 1 && fotos[0].grupoId === id && fotos[0].clase === "inspiracion", "restaurar trae la inspiración y su imagen al teléfono");
  ok(!p.errores.length, `sin errores de página${p.errores.length ? `: ${p.errores[0]}` : ""}`);
  fs.unlinkSync(archivo);
  await p.context().close();
}

(async () => {
  const srv = await servidor();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const jpegs = await imagenesDePines(browser, base);
  const seedRopa = await ropero(browser, base);
  for (const ancho of [390, 320]) await sinPuente(browser, base, ancho);
  await conPinterest(browser, base, jpegs, seedRopa);
  await otras(browser, base, jpegs, seedRopa);
  await copia(browser, base);
  await terminar(browser, srv);
})();
