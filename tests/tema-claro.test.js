// Modo claro (D-126): el generador de css/tema-claro.css (scripts/tema-claro.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const T = require("../scripts/tema-claro.js");

const c = s => T.leerColor(s);
const REF = c("#f1eee7");   // la superficie clara más oscura con texto
const hex = x => T.escribir(x);

test("leer y escribir colores", () => {
  assert.deepEqual(c("#fff"), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(c("#0a0a0a"), { r: 10, g: 10, b: 10, a: 1 });
  assert.deepEqual(c("rgba(255, 184, 77, 0.12)"), { r: 255, g: 184, b: 77, a: 0.12 });
  assert.deepEqual(c("rgb(10 10 10 / 0.5)"), { r: 10, g: 10, b: 10, a: 0.5 });
  assert.deepEqual(c("white"), { r: 255, g: 255, b: 255, a: 1 });
  assert.equal(c("#ffffff80").a, 0.502);
  assert.equal(hex({ r: 255, g: 122, b: 48, a: 1 }), "#ff7a30");
  assert.equal(hex({ r: 0, g: 0, b: 0, a: 0.33 }), "rgba(0, 0, 0, 0.33)");
  assert.equal(Math.round(T.contraste(c("#000"), c("#fff"))), 21);
});

test("fondos: lo oscuro pasa a los tonos claros de la paleta", () => {
  assert.equal(hex(T.transformar("fondo", c("#0a0a0a"))), "#f4f2ec", "fondo de la página");
  assert.equal(hex(T.transformar("fondo", c("#111111"))), "#faf9f6", "hojas");
  assert.equal(hex(T.transformar("fondo", c("#161616"))), "#ffffff", "tarjetas");
  assert.equal(hex(T.transformar("fondo", c("#1c1c1c"))), "#f1eee7", "elevado");
  assert.equal(hex(T.transformar("fondo", c("rgba(10, 10, 10, 0.85)"))), "rgba(244, 242, 236, 0.85)", "barra translúcida");
  assert.equal(hex(T.transformar("fondo", c("rgba(255, 255, 255, 0.06)"))), "rgba(0, 0, 0, 0.042)", "un velo blanco pasa a uno oscuro suave");
  assert.equal(hex(T.transformar("fondo", c("rgba(0, 0, 0, 0.55)"), { velo: true })), "rgba(0, 0, 0, 0.33)", "el fondo detrás de una hoja sigue oscuro, más suave");
  assert.equal(T.transformar("fondo", c("#ff7a30")), null, "un fondo de color se queda");
  assert.equal(T.transformar("fondo", c("rgba(255, 122, 48, 0.12)")), null, "un tinte de color se queda");
  const cafe = T.transformar("fondo", c("#241109"));
  assert.ok(T.luminancia(cafe) > 0.7, "un café muy oscuro pasa a un tinte claro del mismo tono");
});

test("textos: claros a tinta, pastel más oscuro, y siempre legibles", () => {
  const tinta = T.transformar("texto", c("#f5f4f1"));
  assert.ok(T.contraste(tinta, REF) >= 4.5 && T.luminancia(tinta) < 0.05, "texto casi blanco → tinta oscura");
  const gris = T.transformar("texto", c("#9a978f"));
  assert.ok(T.contraste(gris, REF) >= 4.5, "gris → gris oscuro legible");
  for (const pastel of ["#7fe0a6", "#5fcf8a", "#ffb84d", "#4da3ff", "#f1a193", "#ffd166"]) {
    const x = T.transformar("texto", c(pastel));
    assert.ok(x && T.contraste(x, REF) >= 4.5, `${pastel} → ${hex(x)} se lee sobre claro`);
  }
  assert.equal(T.transformar("texto", c("#0a0a0a")), null, "texto oscuro (en botones de color) se queda");
  assert.equal(T.transformar("texto", c("#fff"), { fondoFuerte: true }), null, "blanco sobre un botón naranja se queda");
  assert.equal(hex(T.transformar("texto", c("#0a0a0a"), { fondoTinta: true })), "#ffffff", "pastilla invertida (fondo var(--ink)): texto blanco");
});

test("bordes, sombras y dibujos", () => {
  assert.equal(hex(T.transformar("borde", c("#2a2a28"))), "#e2ddd2");
  assert.equal(hex(T.transformar("borde", c("rgba(255, 255, 255, 0.1)"))), "rgba(0, 0, 0, 0.12)");
  assert.equal(T.transformar("borde", c("rgba(255, 122, 48, 0.45)")), null, "un borde de color se queda");
  assert.equal(hex(T.transformar("sombra", c("rgba(0, 0, 0, 0.45)"))), "rgba(60, 50, 30, 0.158)", "sombras más suaves");
  assert.equal(T.transformar("sombra", c("rgba(255, 122, 48, 0.35)")), null, "un brillo de color se queda");
  assert.equal(hex(T.transformar("trazo", c("#2a2a28"))), "#d6d0c4", "líneas de los gráficos");
  const relleno = T.transformar("relleno", c("#ffd166"));
  assert.ok(T.contraste(relleno, REF) >= 3, "un relleno pastel se oscurece hasta 3:1");
});

test("qué propiedad es qué", () => {
  assert.equal(T.tipoDe("color"), "texto");
  assert.equal(T.tipoDe("background-color"), "fondo");
  assert.equal(T.tipoDe("border-left"), "borde");
  assert.equal(T.tipoDe("outline"), "borde");
  assert.equal(T.tipoDe("box-shadow"), "sombra");
  assert.equal(T.tipoDe("stroke"), "trazo");
  assert.equal(T.tipoDe("--ejd-azul"), "texto", "una variable con color se trata como texto");
  assert.equal(T.tipoDe("width"), null);
});

test("fondo de color que se queda (para no tocar el texto encima)", () => {
  const d = (prop, valor) => ({ prop, valor, imp: "" });
  assert.equal(T.fondoFuerte([d("background", "var(--accent-grad)")]), true);
  assert.equal(T.fondoFuerte([d("background", "var(--musculo-3)")]), true);
  assert.equal(T.fondoFuerte([d("background", "#ff7a30")]), true);
  assert.equal(T.fondoFuerte([d("background", "var(--surface)")]), false);
  assert.equal(T.fondoFuerte([d("background", "var(--estado-ok-fondo)")]), false, "un fondo suave de estado no cuenta");
  assert.equal(T.fondoFuerte([d("background", "radial-gradient(#241109, transparent), #000")]), false, "un café oscuro que cambia no cuenta");
  assert.equal(T.fondoFuerte([d("color", "#ff7a30")]), false);
});

test("valores con varios colores y sin colores", () => {
  assert.equal(T.valorClaro("border", "1px solid #2a2a28"), "1px solid #e2ddd2");
  assert.equal(T.valorClaro("box-shadow", "0 0 0 2px rgba(255, 184, 77, 0.18), 0 10px 30px rgba(0, 0, 0, 0.45)"), "0 0 0 2px rgba(255, 184, 77, 0.18), 0 10px 30px rgba(60, 50, 30, 0.158)");
  assert.equal(T.valorClaro("color", "var(--ink)"), null);
  assert.equal(T.valorClaro("width", "#fff"), null, "una propiedad sin color no se toca");
  assert.equal(T.valorClaro("background", "url(img/black.png)"), null, "«black» dentro de una url no es un color");
});

test("selectores: :where() no suma especificidad", () => {
  assert.equal(T.prefijar(".a, .b > .c"), ':where(html[data-modo="claro"]) .a,\n:where(html[data-modo="claro"]) .b > .c');
  assert.equal(T.prefijar(":root"), ':root:where([data-modo="claro"])');
  assert.equal(T.prefijar("html.vv-corrida .topbar"), 'html:where([data-modo="claro"]).vv-corrida .topbar');
  assert.equal(T.prefijar("body.in-finanzas .x"), ':where(html[data-modo="claro"]) body.in-finanzas .x');
  assert.deepEqual(T.partirSelector(":is(.a, .b) .c, .d"), [":is(.a, .b) .c", ".d"]);
  assert.deepEqual([...T.componentes(".txn-save, #txn-add, a")], ["txn", "*"]);
});

test("leer CSS: comentarios, @media, cadenas con ; e !important", () => {
  const css = `/* hola { } */ .a { color: #fff; background: url("x;y.png"); }
    @media (max-width: 400px) { .b { border: 1px solid #2a2a28 !important } }
    @keyframes k { from { color: #fff } } .c{}`;
  const n = T.parsear(css);
  assert.equal(n.length, 3);
  assert.equal(n[0].selector, ".a");
  assert.deepEqual(n[0].decls.map(d => d.prop), ["color", "background"]);
  assert.equal(n[0].decls[1].valor, 'url("x;y.png")');
  assert.equal(n[1].tipo, "at");
  assert.equal(n[1].hijos[0].decls[0].imp, " !important");
  assert.equal(n[2].selector, ".c", "@keyframes se salta");
});

test("css/tema-claro.css está al día (npm run tema)", () => {
  const archivo = path.join(__dirname, "..", T.SALIDA);
  assert.ok(fs.existsSync(archivo), "falta css/tema-claro.css: corre npm run tema");
  assert.equal(fs.readFileSync(archivo, "utf8"), T.generar(), "css/tema-claro.css no está al día: corre npm run tema");
});

test("index.html carga el modo claro al final y apaga la hoja en oscuro", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const head = html.slice(0, html.indexOf("</head>"));
  const iHoja = head.indexOf('id="tema-claro-css"');
  const iJs = head.indexOf('src="js/tema.js');
  const ultimaHoja = head.lastIndexOf('rel="stylesheet"');
  assert.ok(iHoja > 0 && iJs > iHoja, "css/tema-claro.css y después js/tema.js");
  assert.ok(head.lastIndexOf('rel="stylesheet"', iHoja) === ultimaHoja || ultimaHoja < iJs, "la hoja clara es la última (gana a las demás con el mismo peso)");
  assert.ok(!/<script[^>]+src="js\/tema\.js[^"]*"[^>]*(defer|async)/.test(head), "js/tema.js sin defer: elige el modo antes de pintar");
});
