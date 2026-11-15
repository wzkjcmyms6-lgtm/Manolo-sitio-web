// Leer el código de barras de un libro (js/libros-isbn.js, D-111). Las
// imágenes se dibujan acá: el código con sus 95 módulos, y encima lo que
// pasa en una foto de verdad (desenfoque, ruido, sombra, giro, perspectiva).
const test = require("node:test");
const assert = require("node:assert/strict");
const I = require("../js/libros-isbn.js");

function azar(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function desenfocar(v, W, H, sigma) {
  const r = Math.ceil(sigma * 3), k = [];
  let suma = 0;
  for (let i = -r; i <= r; i++) { const e = Math.exp(-(i * i) / (2 * sigma * sigma)); k.push(e); suma += e; }
  for (let i = 0; i < k.length; i++) k[i] /= suma;
  const tmp = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0;
    for (let i = -r; i <= r; i++) s += v[y * W + Math.min(W - 1, Math.max(0, x + i))] * k[i + r];
    tmp[y * W + x] = s;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0;
    for (let i = -r; i <= r; i++) s += tmp[Math.min(H - 1, Math.max(0, y + i)) * W + x] * k[i + r];
    v[y * W + x] = s;
  }
}
// o: modulo (px), margen (módulos), ancho, alto, angulo (°), cx, cy,
// desenfoque, ruido, claro, oscuro, gradiente, perspectiva, brillo, extra.
function imagen(codigo, o = {}) {
  const mod = o.modulo || 3, margen = o.margen == null ? 11 : o.margen;
  const bits = (codigo ? I.modulos(codigo) : []).concat(o.extra || []);
  const total = bits.length + 2 * margen;
  const altoBarras = o.altoBarras || Math.round(total * mod * 0.55);
  const W = o.ancho || Math.round(total * mod + 40), H = o.alto || Math.round(altoBarras + 40);
  const ang = ((o.angulo || 0) * Math.PI) / 180, cos = Math.cos(ang), sin = Math.sin(ang);
  const cx = o.cx == null ? W / 2 : o.cx, cy = o.cy == null ? H / 2 : o.cy;
  const v = new Float32Array(W * H), SS = 3;
  const medioU = (bits.length * mod) / 2, medioV = altoBarras / 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const px0 = x + 0.5 - cx, py0 = y + 0.5 - cy;
    if (Math.abs(px0 * cos + py0 * sin) > medioU + 2 || Math.abs(-px0 * sin + py0 * cos) > medioV + 2) continue;
    let s = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const px = x + (sx + 0.5) / SS - cx, py = y + (sy + 0.5) / SS - cy;
      const u = px * cos + py * sin, w = -px * sin + py * cos;
      let t = (u + medioU) / (2 * medioU);
      if (o.perspectiva) t += o.perspectiva * t * (1 - t);
      const m = Math.floor(t * bits.length);
      if (Math.abs(w) <= medioV && m >= 0 && m < bits.length && bits[m]) s++;
    }
    v[y * W + x] = s / (SS * SS);
  }
  if (o.desenfoque) desenfocar(v, W, H, o.desenfoque);
  const rnd = azar(o.semilla || 7);
  const data = new Uint8ClampedArray(W * H * 4);
  const claro = o.claro == null ? 235 : o.claro, oscuro = o.oscuro == null ? 25 : o.oscuro;
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = Math.floor(i / W);
    let g = (claro - (claro - oscuro) * v[i]) * (o.gradiente ? 1 - o.gradiente * (1 - x / W) : 1);
    if (o.brillo) g += (255 - g) * o.brillo.k * Math.exp(-((x - o.brillo.x) ** 2 + (y - o.brillo.y) ** 2) / o.brillo.r ** 2);
    if (o.ruido) g += (rnd() + rnd() + rnd() - 1.5) * 2 * o.ruido;
    data[i * 4] = g;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = Math.min(255, g + 8);   // un poco de color, como el papel
    data[i * 4 + 3] = 255;
  }
  return { data, width: W, height: H };
}
const LIBROS = ["9788478884452", "9780439023481", "9788401337208", "9780441013593", "9791032305690"];
const lee = (codigo, o, opciones) => (I.leerImagen(imagen(codigo, o), opciones) || {}).codigo || null;
function todos(o, nombre) {
  LIBROS.forEach((c, j) => assert.equal(lee(c, Object.assign({ semilla: j + 3 }, o)), c, `${nombre}: ${c}`));
}

test("dígito de control, EAN-13, ISBN-13 e ISBN-10 → 13", () => {
  assert.equal(I.digitoControl("978847888445"), 2);
  assert.deepEqual(LIBROS.map(I.ean13Valido), [true, true, true, true, true]);
  assert.deepEqual([I.ean13Valido("9788478884453"), I.ean13Valido("978847888445"), I.ean13Valido("97884788844a2")], [false, false, false]);
  assert.deepEqual([I.esIsbn13("9788478884452"), I.esIsbn13("9791032305690"), I.esIsbn13("4006381333931"), I.esIsbn13("9771234567003")], [true, true, false, false], "un libro empieza con 978 o 979");
  assert.deepEqual([I.isbn10a13("0-439-02348-3"), I.isbn10a13("84-7888-445-9"), I.isbn10a13("080442957X"), I.isbn10a13("8478884458"), I.isbn10a13("12345")],
    ["9780439023481", "9788478884452", "9780804429573", null, null], "con su control (X vale 10)");
});

test("los 95 módulos: guardas al inicio, en el medio y al final", () => {
  const m = I.modulos("9788478884452");
  assert.equal(m.length, 95);
  assert.deepEqual([m.slice(0, 3), m.slice(45, 50), m.slice(92)], [[1, 0, 1], [0, 1, 0, 1, 0], [1, 0, 1]]);
  assert.equal(I.corridas(m).length, 59, "30 barras y 29 espacios");
  // Una fila perfecta de 3 px por módulo, con blanco a los lados, y al revés.
  const fila = Uint8Array.from([].concat(...new Array(11 * 3).fill([230]), ...m.map(b => [b ? 20 : 230, b ? 20 : 230, b ? 20 : 230]), ...new Array(11 * 3).fill([230])));
  assert.equal(I.leerFila(fila), "9788478884452");
  assert.equal(I.leerFila(fila.slice().reverse()), "9788478884452", "el código al revés también");
  assert.equal(I.leerFila(new Uint8Array(400).fill(200)), null, "una fila lisa no es nada");
});

test("fotos normales: nítida, chica, borrosa, con ruido, poco contraste y sombra", () => {
  todos({ modulo: 3 }, "nítida");
  todos({ modulo: 1.4 }, "chica (1,4 px por barra fina)");
  todos({ modulo: 3, desenfoque: 1.6 }, "borrosa");
  todos({ modulo: 2.3, desenfoque: 0.8, ruido: 12 }, "chica, borrosa y con ruido");
  todos({ modulo: 3, ruido: 30 }, "mucho ruido");
  todos({ modulo: 3, claro: 185, oscuro: 95, gradiente: 0.5, ruido: 8 }, "poco contraste y sombra");
  todos({ modulo: 3, brillo: { x: 200, y: 120, r: 70, k: 0.8 }, ruido: 6 }, "un reflejo");
  todos({ modulo: 3, perspectiva: 0.4 }, "en perspectiva");
});

test("girado, al revés, de costado y en diagonal", () => {
  todos({ modulo: 3, angulo: 10 }, "girado 10°");
  todos({ modulo: 3, angulo: 24, alto: 420 }, "girado 24°");
  todos({ modulo: 3, angulo: 180 }, "al revés");
  todos({ modulo: 3, angulo: 90, ancho: 260, alto: 420 }, "de costado");
  todos({ modulo: 3, angulo: 270, ancho: 260, alto: 420, ruido: 12 }, "de costado al otro lado");
  todos({ modulo: 3, angulo: 45, ancho: 400, alto: 400 }, "en diagonal");
});

test("en una foto grande, con el precio al lado y casi sin margen", () => {
  const r = I.leerImagen(imagen("9788478884452", { modulo: 2.2, ancho: 1600, alto: 1200, cx: 1100, cy: 820, ruido: 10, desenfoque: 0.8 }));
  assert.equal(r.codigo, "9788478884452");
  assert.ok(r.votos >= 2, "lo leen varias líneas");
  const precio = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 1];
  todos({ modulo: 3, extra: precio }, "con el precio (EAN-5) a la derecha");
  todos({ modulo: 3, margen: 4, ancho: 309 }, "4 barras finas de margen y el borde de la foto");
});

test("un código que no es de libro se lee igual (y la pantalla avisa)", () => {
  assert.equal(lee("4006381333931", { modulo: 3 }), "4006381333931");
  assert.equal(I.esIsbn13("4006381333931"), false);
});

test("no inventa: sin código, dígito de control malo, barras al azar", () => {
  assert.equal(lee(null, { ancho: 800, alto: 600, ruido: 30 }), null);
  assert.equal(lee("9788478884453", { modulo: 3 }), null, "con el control equivocado no vale");
  for (let s = 1; s <= 12; s++) {
    const rnd = azar(s * 97), extra = [];
    for (let i = 0; i < 300; i++) { const a = 1 + Math.floor(rnd() * 4); for (let j = 0; j < a; j++) extra.push(i % 2); }
    assert.equal(lee(null, { extra, modulo: 1.5 + (s % 4) * 0.5, angulo: s * 9, ancho: 700, alto: 700, ruido: 8, semilla: s }), null, `barras al azar ${s}`);
  }
});

test("zona: busca solo en el recuadro (la cámara en vivo)", () => {
  const img = imagen("9788478884452", { modulo: 2.5, ancho: 900, alto: 700, cx: 450, cy: 350 });
  const opciones = { filas: 12, columnas: false, diagonales: false, basta: 2 };
  assert.equal((I.leerImagen(img, Object.assign({ zona: { x: 60, y: 250, ancho: 780, alto: 200 } }, opciones)) || {}).codigo, "9788478884452");
  assert.equal(I.leerImagen(img, Object.assign({ zona: { x: 0, y: 0, ancho: 900, alto: 120 } }, opciones)), null, "fuera del recuadro, no");
});

test("rápido: una foto grande sin código se recorre entera en poco tiempo", () => {
  const img = imagen(null, { ancho: 2000, alto: 1500, ruido: 20 });
  const t = Date.now();
  assert.equal(I.leerImagen(img), null);
  assert.ok(Date.now() - t < 2500, `${Date.now() - t} ms`);
});
