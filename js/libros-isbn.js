// ---------- Libros: leer el código de barras de un libro (ISBN / EAN-13) ----------
// Fase 5d (D-111). Lector propio y liviano (unos 9 KB, sin librerías): se
// carga recién al tocar "Escanear". Recibe los píxeles de una foto o de un
// cuadro de la cámara y recorre líneas a lo largo de la imagen: filas, y si
// no encuentra, columnas (código de costado) y diagonales; cada una en los
// dos sentidos (código al revés). Cada línea se pasa a barras y espacios de
// cuatro maneras (por los bordes; con un umbral para toda la línea; con uno
// local, por si hay sombra; y más nítida, por si está movida), se busca la
// guarda de inicio y se leen los 12 dígitos por el ancho de sus barras; el
// primero sale de la paridad de los 6 de la izquierda y el dígito de
// control confirma (y además, que haya blanco antes y después, y que los
// dígitos se parezcan bien). Gana el código que más líneas leyeron igual.
// Un ISBN de 13 empieza con 978 o 979.
// Sin DOM: tests/libros-isbn.test.js (códigos dibujados: chicos, borrosos,
// con ruido, sombra, girados y de costado).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LibrosIsbn = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

// Anchos en módulos de cada dígito. L: espacio, barra, espacio, barra.
const L = ["3211", "2221", "2122", "1411", "1132", "1231", "1114", "1312", "1213", "3112"].map(s => s.split("").map(Number));
const G = L.map(p => p.slice().reverse());   // G: los mismos anchos al revés
// Paridad (L o G) de los 6 dígitos de la izquierda → el primer dígito.
const PRIMERO = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];
const IZQ = [["L", L], ["G", G]], DER = [["R", L]];

function digitoControl(d12) {
  let s = 0;
  for (let i = 0; i < 12; i++) s += Number(d12[i]) * (i % 2 ? 3 : 1);
  return (10 - (s % 10)) % 10;
}
const ean13Valido = c => /^\d{13}$/.test(String(c)) && digitoControl(String(c)) === Number(String(c)[12]);
const esIsbn13 = c => ean13Valido(c) && /^97[89]/.test(String(c));
// "0-439-02348-3" → "9780439023481" (null si no es un ISBN-10 válido).
function isbn10a13(i10) {
  const t = String(i10 || "").replace(/[-\s]/g, "").toUpperCase();
  if (!/^\d{9}[\dX]$/.test(t)) return null;
  let s = 0;
  for (let i = 0; i < 10; i++) s += (t[i] === "X" ? 10 : Number(t[i])) * (10 - i);
  if (s % 11) return null;
  const d12 = `978${t.slice(0, 9)}`;
  return d12 + digitoControl(d12);
}

// ---- Una línea ----
// El dígito más parecido a 4 anchos medidos (null si ninguno se parece).
// Dos maneras de comparar: ancho por ancho, o (si la foto está borrosa y las
// barras finas se achican) por la distancia entre bordes del mismo tipo
// (barra + espacio, que casi no cambia), y el ancho de las barras desempata
// el 1 con el 7 y el 2 con el 8.
function mejor(a, tablas, porPares) {
  const m = (a[0] + a[1] + a[2] + a[3]) / 7;
  const x = [a[0] / m, a[1] / m, a[2] / m, a[3] / m];
  let res = null, menor = Infinity;
  for (const [tipo, tabla] of tablas) {
    const der = tipo === "R";                    // barra, espacio, barra, espacio
    for (let d = 0; d < 10; d++) {
      const p = tabla[d];
      const e = porPares
        ? Math.abs(x[0] + x[1] - p[0] - p[1]) + Math.abs(x[1] + x[2] - p[1] - p[2]) +
          0.3 * Math.abs(der ? x[0] + x[2] - p[0] - p[2] : x[1] + x[3] - p[1] - p[3])
        : Math.abs(x[0] - p[0]) + Math.abs(x[1] - p[1]) + Math.abs(x[2] - p[2]) + Math.abs(x[3] - p[3]);
      if (e < menor) { menor = e; res = { d, tipo, e }; }
    }
  }
  return menor <= (porPares ? 1.2 : 1.7) ? res : null;
}
// [1, 1, 0, 0, 0, 1] → [[1, 2], [0, 3], [1, 1]] (1 = barra).
function corridas(bits) {
  const out = [];
  for (let i = 0; i < bits.length; i++) {
    if (out.length && out[out.length - 1][0] === bits[i]) out[out.length - 1][1]++;
    else out.push([bits[i], 1]);
  }
  return out;
}
// Leer un EAN-13 desde la corrida i (la primera barra de la guarda de inicio).
function desde(runs, i, porPares) {
  if (i + 59 > runs.length || runs[i][0] !== 1) return null;    // 3 + 24 + 5 + 24 + 3 corridas
  const mod = (runs[i][1] + runs[i + 1][1] + runs[i + 2][1]) / 3;
  if (mod < 0.7) return null;
  for (let j = 0; j < 3; j++) if (runs[i + j][1] < mod * 0.35 || runs[i + j][1] > mod * 1.8) return null;
  if (i > 0 && runs[i - 1][1] < mod * 3) return null;             // antes, un margen en blanco
  let k = i + 3, ancho = mod * 7, paridad = "", digitos = "", error = 0;
  // Un dígito: 4 corridas que juntas miden unos 7 módulos (el ancho sigue a
  // la perspectiva de a poco).
  const digito = tablas => {
    const a = [runs[k][1], runs[k + 1][1], runs[k + 2][1], runs[k + 3][1]];
    const total = a[0] + a[1] + a[2] + a[3];
    if (total < ancho * 0.7 || total > ancho * 1.4) return null;
    ancho = ancho * 0.6 + total * 0.4;
    k += 4;
    const r = mejor(a, tablas, porPares);
    if (r) error += r.e;
    return r;
  };
  for (let n = 0; n < 6; n++) {
    const r = digito(IZQ);
    if (!r) return null;
    digitos += r.d;
    paridad += r.tipo;
  }
  // Guarda del medio: 5 corridas de un módulo.
  let medio = 0;
  for (let j = 0; j < 5; j++) medio += runs[k + j][1];
  if (medio < ancho * 0.4 || medio > ancho * 1.1) return null;
  for (let j = 0; j < 5; j++) if (runs[k + j][1] < medio * 0.07 || runs[k + j][1] > medio * 0.45) return null;
  k += 5;
  for (let n = 0; n < 6; n++) {
    const r = digito(DER);
    if (!r) return null;
    digitos += r.d;
  }
  // Guarda del final (barra, espacio, barra de un módulo) y después, blanco.
  const m = ancho / 7;
  for (let j = 0; j < 3; j++) if (runs[k + j][1] < m * 0.4 || runs[k + j][1] > m * 1.9) return null;
  if (k + 3 < runs.length && runs[k + 3][1] < m * 3) return null;
  const primero = PRIMERO.indexOf(paridad);
  if (primero < 0) return null;
  const codigo = String(primero) + digitos;
  // En promedio, los 12 dígitos tienen que parecerse bien: unas barras al
  // azar a veces arman un código válido, pero con dígitos forzados.
  if (!ean13Valido(codigo) || error / 12 > (porPares ? 0.7 : 0.75)) return null;
  return codigo;
}
// Lo más oscuro y lo más claro de la línea (sin los extremos sueltos).
function rango(fila) {
  const hist = new Uint32Array(256), n = fila.length;
  for (let i = 0; i < n; i++) hist[fila[i]]++;
  let acc = 0, bajo = 0, alto = 255;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > n * 0.03) { bajo = v; break; } }
  acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * 0.97) { alto = v; break; } }
  return { bajo, alto };
}
// 1) Por los bordes: donde la luz cambia más rápido (aguanta fotos un poco
// borrosas: una barra fina igual deja su borde).
function porBordes(fila, r) {
  const n = fila.length;
  const s = new Float32Array(n), d = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = (fila[i > 0 ? i - 1 : 0] + 2 * fila[i] + fila[i < n - 1 ? i + 1 : n - 1]) / 4;
  for (let i = 1; i < n - 1; i++) d[i] = (s[i + 1] - s[i - 1]) / 2;
  const minimo = Math.max(2, (r.alto - r.bajo) * 0.06);
  const bordes = [];
  for (let i = 2; i < n - 2; i++) {
    const v = d[i];
    if (v > -minimo && v < minimo) continue;
    if (v < 0 ? !(v <= d[i - 1] && v < d[i + 1]) : !(v >= d[i - 1] && v > d[i + 1])) continue;
    const a = d[i - 1], c = d[i + 1], den = a - 2 * v + c;
    const off = den ? (0.5 * (a - c)) / den : 0;
    const borde = { pos: i + Math.max(-0.5, Math.min(0.5, off)), baja: v < 0, fuerza: Math.abs(v) };
    const ult = bordes[bordes.length - 1];
    if (ult && ult.baja === borde.baja) { if (borde.fuerza > ult.fuerza) bordes[bordes.length - 1] = borde; }
    else bordes.push(borde);
  }
  if (bordes.length < 60) return null;
  const runs = [[bordes[0].baja ? 0 : 1, bordes[0].pos]];
  for (let j = 1; j < bordes.length; j++) runs.push([bordes[j - 1].baja ? 1 : 0, bordes[j].pos - bordes[j - 1].pos]);
  runs.push([bordes[bordes.length - 1].baja ? 1 : 0, n - bordes[bordes.length - 1].pos]);
  return runs;
}
// Barras y espacios donde la línea cruza el umbral u(i), con el punto de
// cruce entre dos píxeles (sirve para barras de 1 o 2 píxeles).
function cruces(fila, u) {
  const n = fila.length, runs = [];
  let color = fila[0] < u(0) ? 1 : 0, inicio = 0;
  for (let i = 1; i < n; i++) {
    const c = fila[i] < u(i) ? 1 : 0;
    if (c === color) continue;
    const a = fila[i - 1] - u(i - 1), b = fila[i] - u(i);
    const pos = i - 1 + (a !== b ? Math.min(1, Math.max(0, a / (a - b))) : 0.5);
    runs.push([color, pos - inicio]);
    color = c;
    inicio = pos;
  }
  runs.push([color, n - inicio]);
  return runs;
}
// 2) Con un umbral para toda la línea (entre lo oscuro y lo claro).
function porUmbral(fila, r) {
  const u = (r.bajo + r.alto) / 2;
  return cruces(fila, () => u);
}
// 3) Con un umbral local (el promedio alrededor), por si hay sombra o reflejo.
function porZona(fila, r) {
  const n = fila.length, rad = Math.max(10, Math.round(n / 20)), margen = Math.max(2, (r.alto - r.bajo) * 0.03);
  const acum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) acum[i + 1] = acum[i] + fila[i];
  const u = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - rad), b = Math.min(n, i + rad + 1);
    u[i] = (acum[b] - acum[a]) / (b - a) - margen;
  }
  return cruces(fila, i => u[i]);
}
// 4) Más nítida (le resta su versión borrosa) y con el umbral del medio:
// devuelve el contraste a las barras finas de una foto movida o sin foco.
function porNitidez(fila, r) {
  const n = fila.length, rad = 2, s = new Float32Array(n);
  const acum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) acum[i + 1] = acum[i] + fila[i];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - rad), b = Math.min(n, i + rad + 1);
    s[i] = fila[i] + 1.5 * (fila[i] - (acum[b] - acum[a]) / (b - a));
  }
  const u = (r.bajo + r.alto) / 2;
  return cruces(s, () => u);
}
// Una línea de grises (0 = negro, 255 = blanco) → "978…" o null.
function leerFila(fila) {
  if (fila.length < 100) return null;
  const r = rango(fila);
  if (r.alto - r.bajo < 30) return null;                          // sin contraste
  for (const variante of [porBordes, porUmbral, porZona, porNitidez]) {
    const runs = variante(fila, r);
    if (!runs) continue;
    for (const lista of [runs, runs.slice().reverse()]) {
      for (const porPares of [false, true]) {
        for (let i = 0; i < lista.length; i++) {
          const c = desde(lista, i, porPares);
          if (c) return c;
        }
      }
    }
  }
  return null;
}

// ---- Una imagen ----
// img: { data (RGBA), width, height } → { codigo, votos } o null.
// opciones: filas (líneas por dirección), columnas y diagonales (si no
// encontró en las filas), basta (votos para dejar de buscar) y zona
// ({ x, y, ancho, alto }: solo esa parte, como el recuadro de la cámara).
function leerImagen(img, opciones) {
  const o = Object.assign({ filas: 36, columnas: true, diagonales: true, basta: 3, zona: null }, opciones);
  const { data, width: w, height: h } = img;
  const z = o.zona || { x: 0, y: 0, ancho: w, alto: h };
  // La línea de (x0, y0) con paso (dx, dy), promediada con sus dos vecinas.
  const linea = (x0, y0, dx, dy, n) => {
    const out = new Uint8Array(n);
    for (let t = 0; t < n; t++) {
      const x = Math.round(x0 + dx * t), y = Math.round(y0 + dy * t);
      let s = 0, c = 0;
      for (let j = -1; j <= 1; j++) {
        const xx = x - dy * j, yy = y + dx * j;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const q = (yy * w + xx) * 4;
        s += (data[q] * 299 + data[q + 1] * 587 + data[q + 2] * 114) / 1000;
        c++;
      }
      out[t] = c ? s / c : 255;
    }
    return out;
  };
  const votos = {};
  let ganador = null;
  const anotar = c => {
    if (!c) return false;
    votos[c] = (votos[c] || 0) + 1;
    if (!ganador || votos[c] > votos[ganador]) ganador = c;
    return votos[c] >= o.basta;
  };
  const N = o.filas;
  for (let k = 1; k < N; k++) {
    if (anotar(leerFila(linea(z.x, Math.round(z.y + (z.alto * k) / N), 1, 0, z.ancho)))) break;
  }
  if (!ganador && o.columnas) {
    for (let k = 1; k < N; k++) {
      if (anotar(leerFila(linea(Math.round(z.x + (z.ancho * k) / N), z.y, 0, 1, z.alto)))) break;
    }
  }
  if (!ganador && o.diagonales) {
    for (let k = 1; k < N; k++) {
      // A 45° (x − y = c), desde el borde de la izquierda o el de arriba…
      const c = Math.round(-z.alto + ((z.ancho + z.alto) * k) / N);
      const x0 = Math.max(0, c), y0 = Math.max(0, -c);
      if (anotar(leerFila(linea(z.x + x0, z.y + y0, 1, 1, Math.min(z.ancho - x0, z.alto - y0))))) break;
      // …y a 135° (x + y = c), desde el de la izquierda o el de abajo.
      const c2 = Math.round(((z.ancho + z.alto) * k) / N);
      const x1 = Math.max(0, c2 - (z.alto - 1)), y1 = Math.min(z.alto - 1, c2);
      if (anotar(leerFila(linea(z.x + x1, z.y + y1, 1, -1, Math.min(z.ancho - x1, y1 + 1))))) break;
    }
  }
  return ganador ? { codigo: ganador, votos: votos[ganador] } : null;
}

// ---- Para las pruebas: los 95 módulos de un código (1 = barra) ----
function modulos(codigo) {
  const c = String(codigo);
  const ancho = (p, empieza) => p.reduce((out, a, j) => out.concat(new Array(a).fill((j + empieza) % 2)), []);
  let out = [1, 0, 1];
  const par = PRIMERO[Number(c[0])];
  for (let i = 1; i <= 6; i++) out = out.concat(ancho((par[i - 1] === "L" ? L : G)[Number(c[i])], 0));
  out = out.concat([0, 1, 0, 1, 0]);
  for (let i = 7; i <= 12; i++) out = out.concat(ancho(L[Number(c[i])], 1));
  return out.concat([1, 0, 1]);
}

return { digitoControl, ean13Valido, esIsbn13, isbn10a13, leerFila, leerImagen, corridas, modulos };
});
