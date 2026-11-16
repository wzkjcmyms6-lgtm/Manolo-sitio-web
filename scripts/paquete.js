// La app abre más rápido (D-127): junta los módulos en un solo archivo.
//
// Antes, index.html cargaba ~170 archivos .js y ~16 .css. Con la app
// instalada, cada archivo pasa por el service worker uno por uno y esa
// fila era lo que más tardaba al abrir (medido: casi la mitad del tiempo).
// Ahora:
//   - js/app.paquete.js: todos los módulos de js/paquete.json, en el mismo
//     orden. Cada uno corre como su propio <script> (un error en uno no
//     frena a los demás, como antes) y conserva su nombre en los errores
//     (sourceURL).
//   - css/app.paquete.css: los estilos de js/paquete.json, en orden.
//   - Aparte siguen: Firebase (vendor), css/fuentes.css, el modo claro
//     (css/tema-claro.css + js/tema.js) y lo que se carga al usarlo
//     (importar rutinas, ISBN, el buscador de la Biblia).
// Se edita siempre el archivo de cada módulo; después:
//   npm run listo   (= paquete + tema + sw)
// tests/paquete.test.js falla si los paquetes no están al día.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const RAIZ = path.join(__dirname, "..");
const LISTA = "js/paquete.json";
const JS = "js/app.paquete.js";
const CSS = "css/app.paquete.css";

function leerLista() {
  const l = JSON.parse(fs.readFileSync(path.join(RAIZ, LISTA), "utf8"));
  return { js: l.js || [], css: l.css || [] };
}
const leer = rel => fs.readFileSync(path.join(RAIZ, rel), "utf8");
const huella = texto => crypto.createHash("sha256").update(texto).digest("hex").slice(0, 12);

function generarJs(lista) {
  const partes = lista.map(rel => `[${JSON.stringify(rel)},${JSON.stringify(leer(rel))}]`);
  return `// GENERADO por scripts/paquete.js (npm run paquete): no se edita a mano.
// Los módulos de js/paquete.json, cada uno como su propio <script>.
(function () {
var M = [
${partes.join(",\n")}
];
for (var i = 0; i < M.length; i++) {
  var s = document.createElement("script");
  s.textContent = M[i][1] + "\\n//# sourceURL=" + M[i][0];
  document.head.appendChild(s);
}
})();
`;
}
function generarCss(lista) {
  return "/* GENERADO por scripts/paquete.js (npm run paquete): no se edita a mano.\n   Los estilos de js/paquete.json, en orden. */\n"
    + lista.map(rel => `\n/* ---- ${rel} ---- */\n${leer(rel).trim()}\n`).join("");
}
// index.html con el ?v= de cada paquete igual a su huella.
function conVersiones(html, vJs, vCss) {
  return html
    .replace(/(src="js\/app\.paquete\.js)(\?v=[\w.-]*)?"/, `$1?v=${vJs}"`)
    .replace(/(href="css\/app\.paquete\.css)(\?v=[\w.-]*)?"/, `$1?v=${vCss}"`);
}
function generar() {
  const l = leerLista();
  const js = generarJs(l.js), css = generarCss(l.css);
  const html = conVersiones(leer("index.html"), huella(js), huella(css));
  return { js, css, html };
}

if (require.main === module) {
  const g = generar();
  const revisar = process.argv.includes("--revisar");
  const cambios = [[JS, g.js], [CSS, g.css], ["index.html", g.html]].filter(([rel, txt]) => !fs.existsSync(path.join(RAIZ, rel)) || leer(rel) !== txt);
  if (revisar) {
    if (cambios.length) { console.error(`No están al día: ${cambios.map(c => c[0]).join(", ")}. Corre "npm run paquete".`); process.exit(1); }
    console.log("Paquetes al día.");
  } else {
    cambios.forEach(([rel, txt]) => fs.writeFileSync(path.join(RAIZ, rel), txt));
    const l = leerLista();
    console.log(`${JS}: ${l.js.length} módulos, ${Math.round(g.js.length / 1024)} KB · ${CSS}: ${l.css.length} archivos, ${Math.round(g.css.length / 1024)} KB${cambios.length ? "" : " (sin cambios)"}.`);
  }
}

module.exports = { LISTA, JS, CSS, leerLista, generarJs, generarCss, conVersiones, huella, generar };
