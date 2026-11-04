// ---------- Running: lectura de archivos GPX, TCX y FIT (sin pantalla) ----------
// Convierte un archivo de reloj o app en una "actividad normalizada":
//   { formato, deporte ("running" | "bicicleta" | "otro" | null si el archivo
//     no lo dice), subtipo ("cinta" | "trail" | "pista" | "virtual" | null),
//     deporteOriginal, titulo, descripcion, dispositivo, inicio (ms),
//     puntos: [{ t (ms), lat, lon, alt (m), d (m acumulados del reloj),
//                fc (lpm), cad (por minuto, tal cual viene) }],
//     pausas: [[desde, hasta]] (ms, del reloj), vueltas: [{ inicio, tiempoS,
//     tiempoRelojS, distM, fcMedia, fcMax, kcal, ascensoM, descensoM }],
//     resumen: { distM, tiempoTotalS, tiempoRelojS, ascensoM, descensoM,
//                kcal, fcMedia, fcMax, cadMedia, velMaxMs } }
// Lo que el archivo no trae queda en null: nunca se inventa (D-064).
// Sin DOM ni librerías: GPX y TCX con expresiones regulares, FIT con un
// lector binario propio (perfil público del formato FIT). Lo comprimido
// (.gz, .zip) lo resuelve js/run-zip.js antes de llegar aquí.
// Pruebas: tests/run-formatos.test.js (el FIT de prueba se arma en el test).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RunFormatos = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const num = v => (typeof v === "number" && isFinite(v) ? v : null);
const aNum = s => {
  if (s == null) return null;
  const n = parseFloat(String(s).trim());
  return isFinite(n) ? n : null;
};
const aFecha = s => {
  if (!s) return null;
  const t = Date.parse(String(s).trim());
  return isFinite(t) ? t : null;
};

class ErrorArchivo extends Error {
  constructor(mensaje) { super(mensaje); this.name = "ErrorArchivo"; }
}

// ---- ¿Qué es este archivo? (por contenido; el nombre puede mentir) ----
function tipoDe(bytes, nombre) {
  const b = bytes || new Uint8Array(0);
  if (b.length >= 2 && b[0] === 0x1f && b[1] === 0x8b) return "gz";
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return "zip";
  if (b.length >= 12 && b[8] === 0x2e && b[9] === 0x46 && b[10] === 0x49 && b[11] === 0x54) return "fit";
  const inicio = new TextDecoder("utf-8").decode(b.subarray(0, Math.min(b.length, 4096)));
  if (/<gpx[\s>]/i.test(inicio)) return "gpx";
  if (/<TrainingCenterDatabase[\s>]/.test(inicio)) return "tcx";
  const n = String(nombre || "").toLowerCase();
  if (/\.csv$/.test(n)) return "csv";
  if (/\.gpx$/.test(n)) return "gpx";
  if (/\.tcx$/.test(n)) return "tcx";
  if (/\.fit$/.test(n)) return "fit";
  return null;
}

// ---- Deporte ----
// Textos de GPX/TCX/CSV ("running", "Run", "Biking", "Carrera", "9"...).
function deporteDeTexto(s) {
  const t = String(s == null ? "" : s).trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!t) return { deporte: null, subtipo: null };
  // Códigos numéricos que usan algunos GPX exportados (9 = carrera, 1 = bici).
  if (t === "9") return { deporte: "running", subtipo: null };
  if (t === "1") return { deporte: "bicicleta", subtipo: null };
  if (/^\d+$/.test(t)) return { deporte: "otro", subtipo: null };
  if (/cinta|treadmill/.test(t)) return { deporte: "running", subtipo: "cinta" };
  if (/virtual\s*run|carrera virtual/.test(t)) return { deporte: "running", subtipo: "virtual" };
  if (/trail|montana/.test(t) && /run|carrera|correr/.test(t)) return { deporte: "running", subtipo: "trail" };
  if (/(^|[^a-z])(run|running|carrera|correr|trote|jog)/.test(t) || t === "track running") return { deporte: "running", subtipo: /track|pista/.test(t) ? "pista" : null };
  if (/virtual\s*ride|bici(cleta)? virtual/.test(t)) return { deporte: "bicicleta", subtipo: "virtual" };
  if (/(bik|ride|cycl|cicl|bici|mtb|gravel|velo)/.test(t)) return { deporte: "bicicleta", subtipo: null };
  return { deporte: "otro", subtipo: null };
}
// FIT: sport 1 = correr, 2 = bici; sub_sport 1 = cinta, 3 = trail, 4 = pista,
// 6 = bici bajo techo, 58 = virtual.
function deporteDeFit(sport, sub) {
  if (sport == null) return { deporte: null, subtipo: null };
  if (sport === 1) return { deporte: "running", subtipo: sub === 1 ? "cinta" : sub === 3 ? "trail" : sub === 4 ? "pista" : sub === 58 ? "virtual" : null };
  if (sport === 2) return { deporte: "bicicleta", subtipo: sub === 6 ? "cinta" : sub === 58 ? "virtual" : null };
  if (sport === 0) return { deporte: null, subtipo: null };
  return { deporte: "otro", subtipo: null };
}

// ---- XML sin DOM ----
function entidades(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&").trim();
}
// Contenido de la primera etiqueta <nombre> (con o sin prefijo de espacio de nombres).
const RE_ETIQUETA = {};
function etiqueta(xml, nombre) {
  const re = RE_ETIQUETA[nombre] || (RE_ETIQUETA[nombre] = new RegExp(`<(?:[\\w-]+:)?${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${nombre}>`));
  const m = re.exec(xml);
  return m ? entidades(m[1]) : null;
}
function atributo(attrs, nombre) {
  const m = new RegExp(`(?:^|\\s)${nombre}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attrs);
  return m ? (m[1] != null ? m[1] : m[2]) : null;
}

function vacio(formato) {
  return {
    formato, deporte: null, subtipo: null, deporteOriginal: null, titulo: null, descripcion: null,
    dispositivo: null, inicio: null, puntos: [], pausas: [], vueltas: [],
    resumen: { distM: null, tiempoTotalS: null, tiempoRelojS: null, ascensoM: null, descensoM: null, kcal: null, fcMedia: null, fcMax: null, cadMedia: null, velMaxMs: null }
  };
}
function cerrar(a) {
  a.puntos.sort((x, y) => x.t - y.t);
  if (a.inicio == null && a.puntos.length) a.inicio = a.puntos[0].t;
  if (a.inicio == null) throw new ErrorArchivo("El archivo no tiene horas: no se puede saber cuándo fue.");
  return a;
}

// ---- GPX ----
function leerGpx(texto) {
  const a = vacio("gpx");
  const gpx = /<gpx\b([^>]*)>/i.exec(texto);
  if (!gpx) throw new ErrorArchivo("No es un GPX válido.");
  a.dispositivo = atributo(gpx[1], "creator");
  const trk = /<trk\b[^>]*>([\s\S]*?)<\/trk>/.exec(texto);
  const cab = trk ? trk[1].split(/<trkseg\b/)[0] : "";
  a.titulo = etiqueta(cab, "name") || null;
  a.descripcion = etiqueta(cab, "desc") || null;
  a.deporteOriginal = etiqueta(cab, "type");
  Object.assign(a, deporteDeTexto(a.deporteOriginal));
  if (!a.deporteOriginal) { a.deporte = null; a.subtipo = null; }
  const meta = /<metadata\b[^>]*>([\s\S]*?)<\/metadata>/.exec(texto);
  const tMeta = meta ? aFecha(etiqueta(meta[1], "time")) : null;

  const segs = texto.match(/<trkseg\b[^>]*>[\s\S]*?<\/trkseg>/g) || [];
  let finAnterior = null;
  segs.forEach(seg => {
    const re = /<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/g;
    let m, primero = null, ultimo = null;
    while ((m = re.exec(seg))) {
      const cuerpo = m[2] || "";
      const t = aFecha(etiqueta(cuerpo, "time"));
      if (t == null) continue;
      const p = {
        t, lat: aNum(atributo(m[1], "lat")), lon: aNum(atributo(m[1], "lon")),
        alt: aNum(etiqueta(cuerpo, "ele")), d: null,
        fc: aNum(etiqueta(cuerpo, "hr") || etiqueta(cuerpo, "heartrate")),
        cad: aNum(etiqueta(cuerpo, "cad") || etiqueta(cuerpo, "cadence"))
      };
      a.puntos.push(p);
      if (primero == null) primero = t;
      ultimo = t;
    }
    // Un tramo nuevo después de otro es una pausa del reloj.
    if (primero != null && finAnterior != null && primero > finAnterior) a.pausas.push([finAnterior, primero]);
    if (ultimo != null) finAnterior = ultimo;
  });
  if (!a.puntos.length) {
    if (/<rte\b/.test(texto)) throw new ErrorArchivo("Es una ruta planificada (sin horas), no una actividad.");
    throw new ErrorArchivo("El GPX no tiene puntos con hora.");
  }
  a.inicio = a.puntos.reduce((m, p) => Math.min(m, p.t), Infinity);
  if (tMeta != null && tMeta < a.inicio && a.inicio - tMeta < 60000) a.inicio = tMeta;
  return cerrar(a);
}

// ---- TCX ----
function leerTcx(texto) {
  const a = vacio("tcx");
  const act = /<Activity\b([^>]*)>([\s\S]*?)<\/Activity>/.exec(texto);
  if (!act) throw new ErrorArchivo("El TCX no tiene ninguna actividad.");
  a.deporteOriginal = atributo(act[1], "Sport");
  Object.assign(a, deporteDeTexto(a.deporteOriginal));
  if (/^other$/i.test(a.deporteOriginal || "")) { a.deporte = null; a.subtipo = null; }
  const cuerpo = act[2];
  a.descripcion = etiqueta(cuerpo.split(/<Lap\b/)[0], "Notes");
  const creador = /<Creator\b[^>]*>([\s\S]*?)<\/Creator>/.exec(cuerpo);
  if (creador) a.dispositivo = etiqueta(creador[1], "Name");
  const idT = aFecha(etiqueta(cuerpo, "Id"));

  const vueltas = cuerpo.match(/<Lap\b[^>]*>[\s\S]*?<\/Lap>/g) || [];
  let tot = { d: 0, t: 0, kcal: 0, fcPeso: 0, fcMax: null, conD: false, conKcal: false, conFc: false };
  let finAnterior = null;
  vueltas.forEach(lap => {
    const inicio = aFecha(atributo(/<Lap\b([^>]*)>/.exec(lap)[1], "StartTime"));
    const cab = lap.split(/<Track\b/)[0];
    const v = {
      inicio,
      tiempoS: aNum(etiqueta(cab, "TotalTimeSeconds")),
      tiempoRelojS: aNum(etiqueta(cab, "TotalTimeSeconds")),
      distM: aNum(etiqueta(cab, "DistanceMeters")),
      fcMedia: aNum(etiqueta(etiqueta(cab, "AverageHeartRateBpm") || "", "Value")),
      fcMax: aNum(etiqueta(etiqueta(cab, "MaximumHeartRateBpm") || "", "Value")),
      kcal: aNum(etiqueta(cab, "Calories")),
      ascensoM: null, descensoM: null
    };
    a.vueltas.push(v);
    if (v.distM != null) { tot.d += v.distM; tot.conD = true; }
    if (v.tiempoS != null) tot.t += v.tiempoS;
    if (v.kcal != null) { tot.kcal += v.kcal; tot.conKcal = tot.conKcal || v.kcal > 0; }
    if (v.fcMedia != null && v.tiempoS) { tot.fcPeso += v.fcMedia * v.tiempoS; tot.conFc = true; }
    if (v.fcMax != null) tot.fcMax = Math.max(tot.fcMax || 0, v.fcMax);

    (lap.match(/<Track\b[^>]*>[\s\S]*?<\/Track>/g) || []).forEach(track => {
      let primero = null, ultimo = null;
      (track.match(/<Trackpoint\b[^>]*>[\s\S]*?<\/Trackpoint>/g) || []).forEach(tp => {
        const t = aFecha(etiqueta(tp, "Time"));
        if (t == null) return;
        const pos = etiqueta(tp, "Position");
        a.puntos.push({
          t,
          lat: pos ? aNum(etiqueta(pos, "LatitudeDegrees")) : null,
          lon: pos ? aNum(etiqueta(pos, "LongitudeDegrees")) : null,
          alt: aNum(etiqueta(tp, "AltitudeMeters")),
          d: aNum(etiqueta(tp, "DistanceMeters")),
          fc: aNum(etiqueta(etiqueta(tp, "HeartRateBpm") || "", "Value")),
          cad: aNum(etiqueta(tp, "RunCadence") || etiqueta(tp, "Cadence"))
        });
        if (primero == null) primero = t;
        ultimo = t;
      });
      if (primero != null && finAnterior != null && primero - finAnterior > 1000) a.pausas.push([finAnterior, primero]);
      if (ultimo != null) finAnterior = ultimo;
    });
  });
  const r = a.resumen;
  if (tot.conD) r.distM = tot.d;
  if (tot.t > 0) r.tiempoRelojS = tot.t;
  if (tot.conKcal) r.kcal = Math.round(tot.kcal);
  if (tot.conFc && tot.t > 0) r.fcMedia = Math.round(tot.fcPeso / tot.t);
  if (tot.fcMax != null) r.fcMax = tot.fcMax;
  a.inicio = a.vueltas.length && a.vueltas[0].inicio != null ? a.vueltas[0].inicio : idT;
  if (a.vueltas.length < 2) a.vueltas = [];
  if (!a.puntos.length && r.distM == null) throw new ErrorArchivo("El TCX no tiene puntos ni distancia.");
  if (a.puntos.length) a.inicio = Math.min(a.inicio != null ? a.inicio : Infinity, a.puntos.reduce((m, p) => Math.min(m, p.t), Infinity));
  return cerrar(a);
}

// ---- FIT (binario) ----
// Mensajes que se leen: 0 file_id, 12 sport, 18 session, 19 lap, 20 record,
// 21 event. Escalas del perfil: posición en semicírculos (× 180 / 2³¹),
// altitud /5 − 500, distancia /100, velocidad y tiempos /1000; hora en s
// desde 1989-12-31 (631065600 s después de 1970).
const FIT_EPOCA = 631065600;
const SEMI = 180 / 2147483648;
// Tipo base → [tamaño, lector, valor inválido]
const BASE = {
  0x00: [1, "u8", 0xff], 0x01: [1, "s8", 0x7f], 0x02: [1, "u8", 0xff], 0x07: [1, "str", null],
  0x0a: [1, "u8", 0x00], 0x0d: [1, "u8", 0xff],
  0x83: [2, "s16", 0x7fff], 0x84: [2, "u16", 0xffff], 0x8b: [2, "u16", 0x0000],
  0x85: [4, "s32", 0x7fffffff], 0x86: [4, "u32", 0xffffffff], 0x8c: [4, "u32", 0x00000000],
  0x88: [4, "f32", null], 0x89: [8, "f64", null],
  0x8e: [8, "s64", null], 0x8f: [8, "u64", null], 0x90: [8, "u64", null]
};
function leerValor(dv, pos, tipo, tam, le) {
  const b = BASE[tipo] || BASE[tipo & 0x1f] || [1, "u8", 0xff];
  const [baseTam, lector, invalido] = b;
  if (lector === "str") {
    let s = "";
    for (let i = 0; i < tam; i++) { const c = dv.getUint8(pos + i); if (!c) break; s += String.fromCharCode(c); }
    try { return decodeURIComponent(escape(s)) || null; } catch (e) { return s || null; }
  }
  if (tam < baseTam) return null;
  let v;
  switch (lector) {
    case "u8": v = dv.getUint8(pos); break;
    case "s8": v = dv.getInt8(pos); break;
    case "u16": v = dv.getUint16(pos, le); break;
    case "s16": v = dv.getInt16(pos, le); break;
    case "u32": v = dv.getUint32(pos, le); break;
    case "s32": v = dv.getInt32(pos, le); break;
    case "f32": v = dv.getFloat32(pos, le); break;
    case "f64": v = dv.getFloat64(pos, le); break;
    default: return null; // 64 bits enteros: no hacen falta
  }
  if (invalido != null && v === invalido) return null;
  if ((tipo === 0x0a || tipo === 0x8b || tipo === 0x8c) && v === 0) return null;
  return isFinite(v) ? v : null;
}
const QUIERO = {
  0: { 1: "fabricante", 2: "producto", 4: "creado" },
  12: { 0: "sport", 1: "sub", 3: "nombre" },
  18: { 2: "inicio", 5: "sport", 6: "sub", 7: "total", 8: "reloj", 9: "dist", 11: "kcal", 15: "velMax", 16: "fcMedia", 17: "fcMax", 18: "cad", 22: "asc", 23: "desc", 125: "velMaxE" },
  19: { 2: "inicio", 7: "total", 8: "reloj", 9: "dist", 11: "kcal", 15: "fcMedia", 16: "fcMax", 21: "asc", 22: "desc" },
  20: { 253: "ts", 0: "lat", 1: "lon", 2: "alt", 78: "altE", 3: "fc", 4: "cad", 53: "cadF", 5: "dist", 6: "vel", 73: "velE" },
  21: { 253: "ts", 0: "evento", 1: "tipo" }
};
const FABRICANTES = { 1: "Garmin", 23: "Suunto", 32: "Wahoo", 69: "Stryd", 89: "Tacx", 260: "Zwift", 263: "Polar", 265: "Strava", 266: "COROS", 294: "COROS", 255: "Desarrollo" };

function leerFit(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 12) throw new ErrorArchivo("El archivo FIT está incompleto.");
  const cab = dv.getUint8(0);
  const fin = Math.min(bytes.length, cab + dv.getUint32(4, true));
  const defs = {};
  const sesiones = [], vueltas = [], registros = [], eventos = [];
  let fileId = null, sport = null, ultimoTs = null;
  let pos = cab;
  while (pos < fin) {
    const h = dv.getUint8(pos++);
    let local, tsComprimido = null;
    if (h & 0x80) { // cabecera de hora comprimida
      local = (h >> 5) & 0x03;
      const off = h & 0x1f;
      if (ultimoTs != null) {
        let ts = (ultimoTs & ~0x1f) + off;
        if (off < (ultimoTs & 0x1f)) ts += 0x20;
        tsComprimido = ts;
        ultimoTs = ts;
      }
    } else if (h & 0x40) { // definición
      local = h & 0x0f;
      const conDev = !!(h & 0x20);
      const le = dv.getUint8(pos + 1) === 0;
      const global = dv.getUint16(pos + 2, le);
      const n = dv.getUint8(pos + 4);
      pos += 5;
      const campos = [];
      for (let i = 0; i < n; i++, pos += 3) campos.push([dv.getUint8(pos), dv.getUint8(pos + 1), dv.getUint8(pos + 2)]);
      let extra = 0;
      if (conDev) {
        const nd = dv.getUint8(pos++);
        for (let i = 0; i < nd; i++, pos += 3) extra += dv.getUint8(pos + 1);
      }
      defs[local] = { le, global, campos, extra };
      continue;
    } else {
      local = h & 0x0f;
    }
    const def = defs[local];
    if (!def) throw new ErrorArchivo("El archivo FIT está dañado (mensaje sin definición).");
    const quiero = QUIERO[def.global];
    const msj = quiero ? {} : null;
    def.campos.forEach(([numCampo, tam, tipo]) => {
      if (msj && quiero[numCampo] && pos + tam <= bytes.length) msj[quiero[numCampo]] = leerValor(dv, pos, tipo, tam, def.le);
      if (numCampo === 253 && pos + 4 <= bytes.length) {
        const ts = leerValor(dv, pos, tipo, tam, def.le);
        if (ts != null) ultimoTs = ts;
      }
      pos += tam;
    });
    pos += def.extra;
    if (!msj) continue;
    if (tsComprimido != null && msj.ts == null && (def.global === 20 || def.global === 21)) msj.ts = tsComprimido;
    switch (def.global) {
      case 0: fileId = msj; break;
      case 12: sport = msj; break;
      case 18: sesiones.push(msj); break;
      case 19: vueltas.push(msj); break;
      case 20: registros.push(msj); break;
      case 21: eventos.push(msj); break;
    }
  }

  const a = vacio("fit");
  const ms = s => (s == null ? null : (s + FIT_EPOCA) * 1000);
  const ses = sesiones[0] || {};
  const sp = ses.sport != null ? ses.sport : sport && sport.sport;
  const sub = ses.sub != null ? ses.sub : sport && sport.sub;
  Object.assign(a, deporteDeFit(sp, sub));
  a.deporteOriginal = sp == null ? null : `fit:${sp}${sub != null ? "/" + sub : ""}`;
  if (sport && sport.nombre) a.titulo = null; // el nombre del perfil del reloj no es un título
  if (fileId && fileId.fabricante != null) a.dispositivo = FABRICANTES[fileId.fabricante] || `Fabricante ${fileId.fabricante}`;

  registros.forEach(r => {
    if (r.ts == null) return;
    const alt = r.altE != null ? r.altE / 5 - 500 : r.alt != null ? r.alt / 5 - 500 : null;
    let cad = r.cad;
    if (cad != null && r.cadF != null) cad += r.cadF / 128;
    a.puntos.push({
      t: ms(r.ts),
      lat: r.lat != null ? r.lat * SEMI : null,
      lon: r.lon != null ? r.lon * SEMI : null,
      alt, d: r.dist != null ? r.dist / 100 : null,
      fc: r.fc != null ? r.fc : null,
      cad: cad != null ? cad : null
    });
  });
  // Pausas del reloj: evento 0 (temporizador), tipo 1/4 (parar) → 0 (seguir).
  let parado = null;
  eventos.sort((x, y) => (x.ts || 0) - (y.ts || 0)).forEach(e => {
    if (e.evento !== 0 || e.ts == null) return;
    if ((e.tipo === 1 || e.tipo === 4) && parado == null) parado = ms(e.ts);
    else if (e.tipo === 0 && parado != null) { if (ms(e.ts) > parado) a.pausas.push([parado, ms(e.ts)]); parado = null; }
  });
  a.vueltas = vueltas.length > 1 ? vueltas.map(v => ({
    inicio: ms(v.inicio), tiempoS: v.total != null ? v.total / 1000 : null, tiempoRelojS: v.reloj != null ? v.reloj / 1000 : null,
    distM: v.dist != null ? v.dist / 100 : null, fcMedia: v.fcMedia, fcMax: v.fcMax, kcal: v.kcal,
    ascensoM: v.asc, descensoM: v.desc
  })) : [];
  const r = a.resumen;
  if (sesiones.length) {
    // Varias sesiones (multideporte): se suman las del mismo deporte.
    const mismas = sesiones.filter(s => s.sport == null || s.sport === sp);
    const suma = k => { const v = mismas.map(s => s[k]).filter(x => x != null); return v.length ? v.reduce((x, y) => x + y, 0) : null; };
    const dist = suma("dist"), total = suma("total"), reloj = suma("reloj");
    r.distM = dist != null ? dist / 100 : null;
    r.tiempoTotalS = total != null ? total / 1000 : null;
    r.tiempoRelojS = reloj != null ? reloj / 1000 : null;
    r.ascensoM = suma("asc");
    r.descensoM = suma("desc");
    r.kcal = suma("kcal");
    r.fcMedia = ses.fcMedia != null ? ses.fcMedia : null;
    r.fcMax = mismas.reduce((m, s) => (s.fcMax != null ? Math.max(m || 0, s.fcMax) : m), null);
    r.cadMedia = ses.cad != null ? ses.cad : null;
    const vm = ses.velMaxE != null ? ses.velMaxE : ses.velMax;
    r.velMaxMs = vm != null ? vm / 1000 : null;
    a.inicio = ms(ses.inicio);
  }
  if (a.inicio == null && a.puntos.length) a.inicio = a.puntos.reduce((m, p) => Math.min(m, p.t), Infinity);
  if (a.inicio == null && fileId && fileId.creado != null) a.inicio = ms(fileId.creado);
  if (!a.puntos.length && r.distM == null) throw new ErrorArchivo("El FIT no tiene registros de la actividad (¿es un archivo de ajustes del reloj?).");
  return cerrar(a);
}

// Lee bytes ya descomprimidos. Lanza ErrorArchivo con un mensaje en español simple.
function leer(bytes, nombre) {
  const tipo = tipoDe(bytes, nombre);
  try {
    if (tipo === "fit") return leerFit(bytes);
    const texto = new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "").trim();
    if (tipo === "gpx") return leerGpx(texto);
    if (tipo === "tcx") return leerTcx(texto);
  } catch (e) {
    if (e instanceof ErrorArchivo) throw e;
    throw new ErrorArchivo("El archivo está dañado o incompleto.");
  }
  throw new ErrorArchivo("No es un archivo de actividad (se aceptan GPX, TCX, FIT y ZIP).");
}

return { leer, leerGpx, leerTcx, leerFit, tipoDe, deporteDeTexto, deporteDeFit, ErrorArchivo, FIT_EPOCA };
});
