// Importar rutinas desde Excel (.xlsx) o CSV. Todo se procesa en el
// teléfono: el archivo nunca se sube a ningún lado.
//
// - Lee .xlsx sin librerías: un .xlsx es un .zip con archivos de texto (XML);
//   se descomprime con DecompressionStream, que ya trae el navegador.
// - Detecta las columnas aunque tengan otros nombres o no lleven tildes:
//   Día, Rutina, Ejercicio, Series, Reps, Peso, Descanso, Notas.
// - Con columna Día arma una rutina por día (Lunes… o Día 1, Día 2…).
// - Marca las filas que no pudo leer y los valores que tuvo que adivinar.
// - Arma la plantilla .xlsx de ejemplo.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EjImportar = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

// ---------- Texto ----------
function norm(s) {
  return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}
function vacio(v) {
  return v == null || String(v).trim() === "";
}

// ---------- Columnas ----------
// Se prueban en este orden (Ejercicio al final: "nombre" es muy general).
const CAMPOS = [
  ["dia", ["dia", "dias", "day", "jornada", "sesion"]],
  ["rutina", ["rutina", "rutinas", "routine", "workout", "entrenamiento", "plan", "nombre rutina", "grupo"]],
  ["series", ["series", "serie", "sets", "set", "n series", "numero de series"]],
  ["reps", ["reps", "rep", "repeticiones", "repeticion", "repes", "rango", "rango de reps", "reps objetivo"]],
  ["peso", ["peso", "kg", "weight", "carga", "peso kg", "peso objetivo", "kilos"]],
  ["descanso", ["descanso", "rest", "pausa", "descanso s", "descanso seg", "descanso min", "recuperacion"]],
  ["notas", ["notas", "nota", "notes", "comentario", "comentarios", "observaciones", "obs", "indicaciones"]],
  ["ejercicio", ["ejercicio", "ejercicios", "exercise", "nombre", "movimiento", "nombre del ejercicio"]]
];
function campoDe(encabezado) {
  const n = norm(encabezado);
  if (!n) return null;
  const palabras = n.split(" ");
  // 1) nombre exacto; 2) empieza con la palabra; 3) la contiene como palabra.
  for (const [campo, sin] of CAMPOS) if (sin.includes(n)) return campo;
  for (const [campo, sin] of CAMPOS) if (sin.some(x => n.startsWith(x + " "))) return campo;
  for (const [campo, sin] of CAMPOS) if (sin.some(x => !x.includes(" ") && palabras.includes(x))) return campo;
  return null;
}
function detectarColumnas(fila) {
  const cols = {};
  (fila || []).forEach((h, i) => {
    const c = campoDe(h);
    if (c && cols[c] == null) cols[c] = i;
  });
  return cols;
}
function buscarEncabezado(filas) {
  for (let i = 0; i < Math.min(filas.length, 12); i++) {
    const cols = detectarColumnas(filas[i]);
    if (cols.ejercicio != null) return { i, cols };
  }
  return null;
}

// ---------- Valores ----------
const DIAS = { lunes: "1", lun: "1", monday: "1", mon: "1", martes: "2", mar: "2", tuesday: "2", tue: "2",
  miercoles: "3", mie: "3", mier: "3", wednesday: "3", wed: "3", jueves: "4", jue: "4", thursday: "4", thu: "4",
  viernes: "5", vie: "5", friday: "5", fri: "5", sabado: "6", sab: "6", saturday: "6", sat: "6",
  domingo: "0", dom: "0", sunday: "0", sun: "0" };
const NOMBRE_DIA = { "1": "Lunes", "2": "Martes", "3": "Miércoles", "4": "Jueves", "5": "Viernes", "6": "Sábado", "0": "Domingo" };
const ORDEN_SEMANA = ["1", "2", "3", "4", "5", "6", "0"];

// { k: "1".."0", etiqueta } para días de la semana, { n, etiqueta } para
// "Día 1", o { etiqueta } si es otro texto.
function leerDia(v) {
  const n = norm(v);
  if (!n) return null;
  const w = n.split(" ")[0];
  if (DIAS[w]) return { k: DIAS[w], etiqueta: NOMBRE_DIA[DIAS[w]] };
  const m = n.match(/^(?:dia|day|d|sesion|session|entreno|workout)?\s*(\d{1,2})$/);
  if (m) return { n: Number(m[1]), etiqueta: `Día ${Number(m[1])}` };
  return { etiqueta: String(v).trim() };
}

// Número de serie de fecha de Excel → [día, mes] (Excel a veces convierte
// "8-12" en una fecha; un rango siempre es menor-mayor, así que se ordena).
function fechaExcel(serie) {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(serie) * 86400000);
  return [d.getUTCDate(), d.getUTCMonth() + 1];
}
function leerReps(v) {
  if (vacio(v)) return { vacio: true };
  if (typeof v === "number") {
    if (v > 20000 && v < 80000) {
      const [a, b] = fechaExcel(v).sort((x, y) => x - y);
      return { min: a, max: b, aviso: `Excel lo guardó como fecha; lo leí como ${a}-${b}` };
    }
    if (v >= 1 && v <= 100) return { min: Math.round(v), max: Math.round(v) };
  }
  const s = String(v).trim().toLowerCase();
  let m = s.match(/^(\d{1,2})\s*[x×]\s*(\d{1,3})(?:\s*(?:-|–|—|a|to)\s*(\d{1,3}))?/);
  if (m) return { series: Number(m[1]), min: Number(m[2]), max: Number(m[3] || m[2]) };
  m = s.match(/^(\d{1,3})\s*(?:-|–|—|a|to|\/|,|y)\s*(\d{1,3})/);
  if (m) { const a = Number(m[1]), b = Number(m[2]); return { min: Math.min(a, b), max: Math.max(a, b) }; }
  m = s.match(/^(\d{1,3})\b/);
  if (m) return { min: Number(m[1]), max: Number(m[1]) };
  return { error: true };
}
function leerSeries(v) {
  if (vacio(v)) return { vacio: true };
  const m = String(v).trim().match(/^(\d{1,2})/);
  if (!m || Number(m[1]) < 1) return { error: true };
  return { n: Math.min(20, Number(m[1])) };
}
function leerPeso(v) {
  if (vacio(v)) return { vacio: true };
  if (typeof v === "number") return v >= 0 && v <= 1000 ? { kg: Math.round(v * 100) / 100 } : { error: true };
  const s = norm(v);
  if (/^(bw|pc|peso corporal|corporal|libre|sin peso)$/.test(s)) return { vacio: true };
  const m = String(v).replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!m) return { error: true };
  const kg = Number(m[1]);
  return kg <= 1000 ? { kg: Math.round(kg * 100) / 100 } : { error: true };
}
// Segundos. "90", "90 s", "1:30", "2 min", "1.5 min"; un número chico (≤ 10) son minutos.
function leerDescanso(v) {
  if (vacio(v)) return { vacio: true };
  if (typeof v === "number") {
    // Hora de Excel: "1:30" se guarda como 1 h 30 min (0,0625 del día) y se
    // lee como 1:30 min; "0:01:30" (0,00104) como 90 s.
    if (v > 0 && v < 1) { const min = v * 1440; return { seg: Math.round(min >= 10 ? min : v * 86400) }; }
    return { seg: Math.round(v <= 10 ? v * 60 : v) };
  }
  const s = String(v).trim().toLowerCase().replace(",", ".");
  let m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return { seg: Number(m[1]) * 60 + Number(m[2]) };
  m = s.match(/^(\d+(?:\.\d+)?)\s*(min|mins|minutos?|m|')/);
  if (m) return { seg: Math.round(Number(m[1]) * 60) };
  m = s.match(/^(\d+(?:\.\d+)?)/);
  if (m) { const n = Number(m[1]); return { seg: Math.round(n <= 10 ? n * 60 : n) }; }
  return { error: true };
}

// ---------- Interpretar una tabla ----------
// filas: arreglo de filas (arreglos de celdas). opciones.hoja: nombre de la
// hoja (se usa como nombre de rutina si no hay columna Rutina ni Día).
function interpretar(filas, opciones) {
  const op = opciones || {};
  const enc = buscarEncabezado(filas || []);
  if (!enc) return { ok: false, error: "No encontré una columna de ejercicios. La primera fila debe tener los títulos (por ejemplo: Día, Rutina, Ejercicio, Series, Reps, Peso, Descanso, Notas)." };
  const { cols } = enc;
  const grupos = [];
  const porClave = new Map();
  const malas = [];
  let diaPrev = "", rutPrev = "";
  const val = (fila, c) => (cols[c] != null ? fila[cols[c]] : "");
  for (let r = enc.i + 1; r < filas.length; r++) {
    const fila = filas[r] || [];
    if (fila.every(vacio)) continue;
    const numFila = r + 1;
    // Celdas combinadas o vacías: siguen con el día/rutina de arriba.
    let diaTxt = val(fila, "dia"), rut = String(val(fila, "rutina") || "").trim();
    if (cols.dia != null) { if (vacio(diaTxt)) diaTxt = diaPrev; else diaPrev = diaTxt; }
    if (cols.rutina != null) { if (!rut) rut = rutPrev; else rutPrev = rut; }
    const nombre = String(val(fila, "ejercicio") || "").trim();
    if (!nombre) {
      malas.push({ fila: numFila, motivo: "Falta el nombre del ejercicio", texto: fila.filter(x => !vacio(x)).join(" · ") });
      continue;
    }
    const avisos = [];
    const it = { fila: numFila, nombre: nombre.slice(0, 80), series: 3, repsMin: 8, repsMax: 12, peso: null, descansoSeg: 90, notas: String(val(fila, "notas") || "").trim().slice(0, 200) };
    const reps = leerReps(val(fila, "reps"));
    if (reps.error) avisos.push(`No entendí las reps «${val(fila, "reps")}»; puse 8-12`);
    else if (!reps.vacio) { it.repsMin = reps.min; it.repsMax = reps.max; if (reps.aviso) avisos.push(reps.aviso); }
    const series = leerSeries(val(fila, "series"));
    if (series.error) avisos.push(`No entendí las series «${val(fila, "series")}»; puse 3`);
    else if (!series.vacio) it.series = series.n;
    else if (reps.series) it.series = Math.min(20, reps.series);
    const peso = leerPeso(val(fila, "peso"));
    if (peso.error) avisos.push(`No entendí el peso «${val(fila, "peso")}»; lo dejé vacío`);
    else if (!peso.vacio) it.peso = peso.kg;
    const desc = leerDescanso(val(fila, "descanso"));
    if (desc.error) avisos.push(`No entendí el descanso «${val(fila, "descanso")}»; puse 90 s`);
    else if (!desc.vacio) it.descansoSeg = Math.min(900, desc.seg);
    it.avisos = avisos;

    const dia = cols.dia != null ? leerDia(diaTxt) : null;
    const clave = `${dia ? dia.etiqueta : ""}|${rut}`;
    let g = porClave.get(clave);
    if (!g) {
      const nombreRutina = rut ? (dia && dia.etiqueta && !rut.toLowerCase().includes(dia.etiqueta.toLowerCase()) && cols.rutina != null && grupos.some(x => x.rutina === rut) ? `${rut} (${dia.etiqueta})` : rut)
        : dia ? dia.etiqueta : (op.hoja || "Rutina importada");
      g = { nombre: nombreRutina, rutina: rut, dia, items: [] };
      porClave.set(clave, g);
      grupos.push(g);
    }
    g.items.push(it);
  }
  // Días de la semana: se asignan solos. "Día 1, Día 2…" → lunes, martes… (editable).
  const numerados = grupos.filter(g => g.dia && g.dia.n != null).sort((a, b) => a.dia.n - b.dia.n);
  grupos.forEach(g => { g.dias = g.dia && g.dia.k ? [g.dia.k] : []; });
  numerados.forEach((g, i) => { if (i < 7) g.dias = [ORDEN_SEMANA[i]]; });
  return { ok: true, columnas: cols, tieneDia: cols.dia != null, grupos, malas, filaEncabezado: enc.i + 1 };
}

// Varias hojas: cada una que tenga títulos se lee; si hay más de una, el
// nombre de la hoja sirve de nombre de rutina.
function interpretarLibro(hojas, nombreArchivo) {
  const validas = hojas.filter(h => buscarEncabezado(h.filas));
  if (!validas.length) return interpretar(hojas.length ? hojas[0].filas : []);
  const generica = n => /^(hoja|sheet|tabla)\s*\d*$/i.test(String(n || "").trim());
  const res = { ok: true, columnas: {}, tieneDia: false, grupos: [], malas: [] };
  validas.forEach(h => {
    const nombre = validas.length > 1 || !generica(h.nombre) ? h.nombre : String(nombreArchivo || "Rutina importada").replace(/\.(xlsx|csv|txt)$/i, "");
    const r = interpretar(h.filas, { hoja: nombre });
    if (!r.ok) return;
    Object.assign(res.columnas, r.columnas);
    res.tieneDia = res.tieneDia || r.tieneDia;
    res.grupos.push(...r.grupos);
    res.malas.push(...r.malas.map(m => Object.assign({ hoja: validas.length > 1 ? h.nombre : null }, m)));
  });
  return res;
}

// ---------- CSV ----------
function leerCsv(texto) {
  let t = String(texto || "").replace(/^﻿/, "");
  const primera = t.split(/\r?\n/)[0] || "";
  const sep = (primera.match(/;/g) || []).length > (primera.match(/,/g) || []).length ? ";" : (primera.includes("\t") && !primera.includes(",") ? "\t" : ",");
  const filas = [];
  let fila = [], celda = "", comillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"') { if (t[i + 1] === '"') { celda += '"'; i++; } else comillas = false; }
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(celda); celda = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      fila.push(celda); filas.push(fila); fila = []; celda = "";
    } else celda += c;
  }
  if (celda !== "" || fila.length) { fila.push(celda); filas.push(fila); }
  return filas;
}

// ---------- XLSX: leer ----------
function u16(b, o) { return b[o] | (b[o + 1] << 8); }
function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
async function inflar(datos) {
  const flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}
// Lee el índice del .zip y devuelve { nombre: () => Promise<texto> }.
function abrirZip(buffer) {
  const b = new Uint8Array(buffer);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("zip");
  const total = u16(b, eocd + 10);
  let p = u32(b, eocd + 16);
  const archivos = {};
  for (let k = 0; k < total; k++) {
    if (u32(b, p) !== 0x02014b50) throw new Error("zip");
    const metodo = u16(b, p + 10), tam = u32(b, p + 20), nLen = u16(b, p + 28), eLen = u16(b, p + 30), cLen = u16(b, p + 32), local = u32(b, p + 42);
    const nombre = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nLen));
    archivos[nombre] = async () => {
      const ini = local + 30 + u16(b, local + 26) + u16(b, local + 28);
      const datos = b.subarray(ini, ini + tam);
      const crudo = metodo === 0 ? datos : metodo === 8 ? await inflar(datos) : null;
      if (!crudo) throw new Error("zip");
      return new TextDecoder().decode(crudo);
    };
    p += 46 + nLen + eLen + cLen;
  }
  return archivos;
}
function entidades(s) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}
// Atributos de una etiqueta XML. "r:id" queda con su prefijo; otros
// prefijos (x:, s:) se quitan para leer igual archivos de otros programas.
function atributos(txt) {
  const a = {};
  txt.replace(/([\w:]+)="([^"]*)"/g, (_, k, v) => {
    a[k] = v;
    const partes = k.split(":");
    if (partes.length === 2 && partes[0] !== "r" && partes[0] !== "xmlns" && !(partes[1] in a)) a[partes[1]] = v;
    return "";
  });
  return a;
}
function textos(xml) {
  const out = [];
  xml.replace(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g, (_, t) => { out.push(entidades(t)); return ""; });
  return out.join("");
}
function columna(ref) {
  const m = /^([A-Z]+)/.exec(ref || "");
  if (!m) return -1;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
function leerHojaXml(xml, compartidos) {
  const filas = [];
  xml.replace(/<(?:\w+:)?row\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?row>/g, (_, attrsFila, cuerpo) => {
    const fa = atributos(attrsFila);
    const idx = fa.r ? Number(fa.r) - 1 : filas.length;
    const fila = [];
    let siguiente = 0;
    cuerpo.replace(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g, (__, attrs, dentro) => {
      const a = atributos(attrs);
      const col = a.r ? columna(a.r) : siguiente;
      siguiente = col + 1;
      if (!dentro) return "";
      const v = /<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/.exec(dentro);
      let valor = "";
      if (a.t === "s") valor = v ? (compartidos[Number(v[1])] || "") : "";
      else if (a.t === "inlineStr") valor = textos(dentro);
      else if (a.t === "str" || a.t === "e") valor = v ? entidades(v[1]) : "";
      else if (a.t === "b") valor = v ? v[1] === "1" : "";
      else if (v) { const n = Number(v[1]); valor = Number.isFinite(n) ? n : entidades(v[1]); }
      fila[col] = valor;
      return "";
    });
    for (let i = 0; i < fila.length; i++) if (fila[i] === undefined) fila[i] = "";
    filas[idx] = fila;
    return "";
  });
  for (let i = 0; i < filas.length; i++) if (!filas[i]) filas[i] = [];
  return filas;
}
// → [{ nombre, filas }] en el orden del libro.
async function leerXlsx(buffer) {
  const zip = abrirZip(buffer);
  const leer = n => (zip[n] ? zip[n]() : Promise.resolve(""));
  const [libro, rels, ss] = await Promise.all([leer("xl/workbook.xml"), leer("xl/_rels/workbook.xml.rels"), leer("xl/sharedStrings.xml")]);
  const compartidos = [];
  ss.replace(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g, (_, si) => { compartidos.push(textos(si)); return ""; });
  const destinos = {};
  rels.replace(/<(?:\w+:)?Relationship\b([^>]*)\/?>/g, (_, at) => { const a = atributos(at); destinos[a.Id] = a.Target; return ""; });
  const hojas = [];
  const pendientes = [];
  libro.replace(/<(?:\w+:)?sheet\b([^>]*)\/?>/g, (_, at) => {
    const a = atributos(at);
    const id = a["r:id"] || Object.keys(a).filter(k => /:id$/.test(k)).map(k => a[k])[0];
    let destino = destinos[id] || "";
    destino = destino.replace(/^\//, "");
    if (!destino.startsWith("xl/")) destino = "xl/" + destino;
    if (a.state === "hidden") return "";
    pendientes.push(leer(destino).then(xml => ({ nombre: a.name ? entidades(a.name) : "Hoja", filas: leerHojaXml(xml, compartidos) })));
    return "";
  });
  hojas.push(...await Promise.all(pendientes));
  return hojas;
}

// ---------- XLSX: escribir (plantilla) ----------
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
// Zip sin comprimir (método 0): simple y lo abren Excel, Numbers y Google Sheets.
function crearZip(archivos) {
  const enc = new TextEncoder();
  const partes = [], centrales = [];
  let offset = 0;
  const u16b = n => [n & 255, (n >>> 8) & 255];
  const u32b = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  Object.keys(archivos).forEach(nombre => {
    const datos = enc.encode(archivos[nombre]);
    const nb = enc.encode(nombre);
    const crc = crc32(datos);
    const local = new Uint8Array([...u32b(0x04034b50), ...u16b(20), ...u16b(0x0800), ...u16b(0), ...u16b(0), ...u16b(0x21), ...u32b(crc), ...u32b(datos.length), ...u32b(datos.length), ...u16b(nb.length), ...u16b(0)]);
    partes.push(local, nb, datos);
    centrales.push(new Uint8Array([...u32b(0x02014b50), ...u16b(20), ...u16b(20), ...u16b(0x0800), ...u16b(0), ...u16b(0), ...u16b(0x21), ...u32b(crc), ...u32b(datos.length), ...u32b(datos.length), ...u16b(nb.length), ...u16b(0), ...u16b(0), ...u16b(0), ...u16b(0), ...u32b(0), ...u32b(offset)]), nb);
    offset += local.length + nb.length + datos.length;
  });
  const tamCentral = centrales.reduce((s, x) => s + x.length, 0);
  const fin = new Uint8Array([...u32b(0x06054b50), ...u16b(0), ...u16b(0), ...u16b(Object.keys(archivos).length), ...u16b(Object.keys(archivos).length), ...u32b(tamCentral), ...u32b(offset), ...u16b(0)]);
  const todo = partes.concat(centrales, [fin]);
  const out = new Uint8Array(todo.reduce((s, x) => s + x.length, 0));
  let p = 0;
  todo.forEach(x => { out.set(x, p); p += x.length; });
  return out;
}
function xmlEsc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const TITULOS = ["Día", "Rutina", "Ejercicio", "Series", "Reps", "Peso (kg)", "Descanso (s)", "Notas"];
const EJEMPLO = [
  ["Lunes", "Push", "Press de banca (Barra)", 4, "6-8", 60, 120, "Pausa corta abajo"],
  ["Lunes", "Push", "Press militar (Mancuerna)", 3, "8-12", 16, 90, ""],
  ["Lunes", "Push", "Fondos", 3, "8-12", "", 90, "Si es fácil, agrega lastre"],
  ["Miércoles", "Pull", "Dominadas", 4, "6-10", "", 120, ""],
  ["Miércoles", "Pull", "Remo con barra", 3, "8-12", 50, 90, ""],
  ["Miércoles", "Pull", "Curl de bíceps (Mancuerna)", 3, "10-15", 10, 60, ""],
  ["Viernes", "Pierna", "Sentadilla (Barra)", 4, "5-8", 80, 180, "Bajar controlado"],
  ["Viernes", "Pierna", "Peso muerto rumano (Barra)", 3, "8-10", 60, 120, ""],
  ["Viernes", "Pierna", "Elevación de talones de pie (Máquina)", 3, "12-15", "", 60, ""]
];
function plantillaXlsx() {
  const col = i => String.fromCharCode(65 + i);
  const celda = (v, r, i) => {
    const ref = `${col(i)}${r}`;
    if (v === "" || v == null) return "";
    // Reps va como texto (estilo 1) para que Excel no lo convierta en fecha.
    if (typeof v === "number" && i !== 4) return `<c r="${ref}"><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${i === 4 ? ' s="1"' : r === 1 ? ' s="2"' : ""}><is><t>${xmlEsc(v)}</t></is></c>`;
  };
  const filas = [TITULOS].concat(EJEMPLO).map((f, k) => `<row r="${k + 1}">${f.map((v, i) => celda(v, k + 1, i)).join("")}</row>`).join("");
  const anchos = [12, 12, 36, 8, 9, 10, 12, 30];
  const hoja = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"${i === 4 ? ' style="1"' : ""}/>`).join("")}</cols><sheetData>${filas}</sheetData></worksheet>`;
  const archivos = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Rutinas" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`,
    "xl/worksheets/sheet1.xml": hoja
  };
  return crearZip(archivos);
}

return { norm, campoDe, detectarColumnas, leerDia, leerReps, leerSeries, leerPeso, leerDescanso, interpretar, interpretarLibro, leerCsv, leerXlsx, plantillaXlsx, NOMBRE_DIA, ORDEN_SEMANA, TITULOS, EJEMPLO };
});
