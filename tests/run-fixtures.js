// Archivos de prueba sintéticos para Running: GPX, TCX, FIT (armado aquí,
// byte a byte, con el perfil público del formato) y ZIP (con y sin ZIP64).
const zlib = require("node:zlib");

// Recorrido: hacia el norte desde La Paz a velocidad constante.
// opciones: { segundos, vel (m/s), alt0, subida (m en total), fc, cad, inicio (ms),
//             pausaEn (s), pausaS (s), salto (índice con salto de GPS) }
function puntos(o) {
  const op = Object.assign({ segundos: 600, vel: 3, alt0: 3600, subida: 0, fc: null, cad: null, inicio: Date.UTC(2026, 9, 5, 11, 0, 0) }, o);
  const lat0 = -16.5, lon0 = -68.13, mPorGrado = 6371008.8 * Math.PI / 180;
  const out = [];
  let extra = 0;
  for (let s = 0; s <= op.segundos; s++) {
    if (op.pausaEn != null && s === op.pausaEn) extra += op.pausaS;
    const d = s * op.vel;
    out.push({
      t: op.inicio + (s + extra) * 1000,
      lat: lat0 + d / mPorGrado,
      lon: lon0,
      alt: op.alt0 + op.subida * s / op.segundos,
      d,
      fc: op.fc,
      cad: op.cad
    });
  }
  if (op.salto != null) out[op.salto].lat += 0.005; // ~550 m de golpe
  return out;
}

const iso = t => new Date(t).toISOString();

function gpx(ps, o) {
  const op = Object.assign({ nombre: "Carrera de prueba", tipo: "running", segmentos: null }, o);
  const pt = p => `<trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}"><ele>${p.alt.toFixed(1)}</ele><time>${iso(p.t)}</time>` +
    (p.fc != null || p.cad != null ? `<extensions><gpxtpx:TrackPointExtension>${p.fc != null ? `<gpxtpx:hr>${p.fc}</gpxtpx:hr>` : ""}${p.cad != null ? `<gpxtpx:cad>${p.cad}</gpxtpx:cad>` : ""}</gpxtpx:TrackPointExtension></extensions>` : "") + `</trkpt>`;
  const segs = op.segmentos || [ps];
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="Reloj de prueba" version="1.1" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
 <metadata><time>${iso(ps[0].t)}</time></metadata>
 <trk><name>${op.nombre}</name>${op.tipo ? `<type>${op.tipo}</type>` : ""}
${segs.map(s => `  <trkseg>${s.map(pt).join("\n")}</trkseg>`).join("\n")}
 </trk>
</gpx>`;
}

function tcx(ps, o) {
  const op = Object.assign({ sport: "Running", vueltas: 1 }, o);
  const porVuelta = Math.ceil(ps.length / op.vueltas);
  let laps = "";
  for (let v = 0; v < op.vueltas; v++) {
    const lp = ps.slice(v * porVuelta, (v + 1) * porVuelta);
    if (!lp.length) continue;
    const dist = lp[lp.length - 1].d - (v ? ps[v * porVuelta - 1].d : 0);
    laps += `<Lap StartTime="${iso(lp[0].t)}"><TotalTimeSeconds>${(lp[lp.length - 1].t - lp[0].t) / 1000}</TotalTimeSeconds><DistanceMeters>${dist}</DistanceMeters><Calories>100</Calories>` +
      (lp[0].fc ? `<AverageHeartRateBpm><Value>${lp[0].fc}</Value></AverageHeartRateBpm><MaximumHeartRateBpm><Value>${lp[0].fc + 10}</Value></MaximumHeartRateBpm>` : "") +
      `<Track>${lp.map(p => `<Trackpoint><Time>${iso(p.t)}</Time><Position><LatitudeDegrees>${p.lat}</LatitudeDegrees><LongitudeDegrees>${p.lon}</LongitudeDegrees></Position><AltitudeMeters>${p.alt}</AltitudeMeters><DistanceMeters>${p.d}</DistanceMeters>` +
        (p.fc ? `<HeartRateBpm><Value>${p.fc}</Value></HeartRateBpm>` : "") +
        (p.cad ? `<Extensions><ns3:TPX><ns3:RunCadence>${p.cad}</ns3:RunCadence></ns3:TPX></Extensions>` : "") + `</Trackpoint>`).join("")}</Track></Lap>`;
  }
  return `   <?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
<Activities><Activity Sport="${op.sport}"><Id>${iso(ps[0].t)}</Id>${laps}<Creator><Name>Forerunner de prueba</Name></Creator></Activity></Activities>
</TrainingCenterDatabase>`;
}

// ---- FIT ----
// Escribe mensajes con tipos base: 0x86 uint32, 0x85 sint32, 0x84 uint16,
// 0x02 uint8, 0x00 enum. opciones: { sport, sub, sesion (bool), vueltas,
// granEndian (definición big-endian para record), comprimidas (horas
// comprimidas para los registros), dev (campos de desarrollador), pausa: [desdeS, hastaS] }
function fit(ps, o) {
  const op = Object.assign({ sport: 1, sub: 0, sesion: true, vueltas: 0, granEndian: false, comprimidas: false, dev: false }, o);
  const EPOCA = 631065600;
  const ts = t => Math.round(t / 1000) - EPOCA;
  const bytes = [];
  const put = (v, tam, be) => { for (let i = 0; i < tam; i++) bytes.push(be ? (v >>> (8 * (tam - 1 - i))) & 0xff : (v >>> (8 * i)) & 0xff); };
  const defs = {};
  const definir = (local, global, campos, be, dev) => {
    bytes.push(0x40 | local | (dev ? 0x20 : 0), 0, be ? 1 : 0);
    put(global, 2, be);
    bytes.push(campos.length);
    campos.forEach(([n, tam, tipo]) => bytes.push(n, tam, tipo));
    if (dev) { bytes.push(1, 0, 2, 0); } // un campo de desarrollador de 2 bytes
    defs[local] = { campos, be, dev };
  };
  const dato = (local, valores, cabecera) => {
    bytes.push(cabecera != null ? cabecera : local);
    defs[local].campos.forEach(([, tam], i) => put(valores[i] >>> 0, tam, defs[local].be));
    if (defs[local].dev) bytes.push(0xaa, 0xbb);
  };
  const semi = g => Math.round(g / 180 * 2147483648) | 0;
  // file_id
  definir(0, 0, [[0, 1, 0x00], [1, 2, 0x84], [2, 2, 0x84], [4, 4, 0x86]]);
  dato(0, [4, 1, 9999, ts(ps[0].t)]);
  // event start
  definir(1, 21, [[253, 4, 0x86], [0, 1, 0x00], [1, 1, 0x00]]);
  dato(1, [ts(ps[0].t), 0, 0]);
  // record
  const camposRec = [[253, 4, 0x86], [0, 4, 0x85], [1, 4, 0x85], [78, 4, 0x86], [5, 4, 0x86], [3, 1, 0x02], [4, 1, 0x02]];
  const camposRecSinTs = camposRec.slice(1);
  definir(2, 20, camposRec, op.granEndian, op.dev);
  if (op.comprimidas) definir(3, 20, camposRecSinTs, op.granEndian, false);
  let ultimo = null;
  ps.forEach((p, i) => {
    const t = ts(p.t);
    if (op.pausa && i === op.pausa[0]) { dato(1, [t - 1, 0, 4]); } // stop_all
    if (op.pausa && i === op.pausa[1]) { dato(1, [t, 0, 0]); }     // start
    const vals = [semi(p.lat), semi(p.lon), Math.round((p.alt + 500) * 5), Math.round(p.d * 100), p.fc != null ? p.fc : 0xff, p.cad != null ? p.cad : 0xff];
    if (op.comprimidas && ultimo != null && t - ultimo > 0 && t - ultimo < 31 && i % 2) {
      dato(3, vals, 0x80 | (3 << 5) | (t & 0x1f));
    } else dato(2, [t].concat(vals));
    ultimo = t;
  });
  const fin = ps[ps.length - 1];
  const totalS = (fin.t - ps[0].t) / 1000;
  if (op.vueltas > 1) {
    definir(4, 19, [[254, 2, 0x84], [253, 4, 0x86], [2, 4, 0x86], [7, 4, 0x86], [8, 4, 0x86], [9, 4, 0x86], [15, 1, 0x02], [16, 1, 0x02], [21, 2, 0x84], [22, 2, 0x84]]);
    const porVuelta = Math.ceil(ps.length / op.vueltas);
    for (let v = 0; v < op.vueltas; v++) {
      const lp = ps.slice(v * porVuelta, (v + 1) * porVuelta + 1);
      if (lp.length < 2) continue;
      const s = (lp[lp.length - 1].t - lp[0].t) / 1000;
      dato(4, [v, ts(lp[lp.length - 1].t), ts(lp[0].t), s * 1000, s * 1000, Math.round((lp[lp.length - 1].d - lp[0].d) * 100), 150, 160, 5, 1]);
    }
  }
  if (op.sesion) {
    definir(5, 18, [[254, 2, 0x84], [253, 4, 0x86], [2, 4, 0x86], [5, 1, 0x00], [6, 1, 0x00], [7, 4, 0x86], [8, 4, 0x86], [9, 4, 0x86], [11, 2, 0x84], [16, 1, 0x02], [17, 1, 0x02], [18, 1, 0x02], [22, 2, 0x84], [23, 2, 0x84]]);
    dato(5, [0, ts(fin.t), ts(ps[0].t), op.sport, op.sub, totalS * 1000, (totalS - (op.pausa ? 60 : 0)) * 1000, Math.round(fin.d * 100), 432, 151, 175, 85, 37, 12]);
  }
  const datos = Buffer.from(bytes);
  const cab = Buffer.alloc(14);
  cab[0] = 14; cab[1] = 0x20;
  cab.writeUInt16LE(2132, 2);
  cab.writeUInt32LE(datos.length, 4);
  cab.write(".FIT", 8, "ascii");
  return new Uint8Array(Buffer.concat([cab, datos, Buffer.from([0, 0])]));
}

// ---- ZIP ----
// entradas: [{ nombre, datos (Uint8Array|string), metodo: 0 | 8 }]; zip64: fuerza el formato ZIP64.
function zip(entradas, o) {
  const op = Object.assign({ zip64: false }, o);
  const partes = [], central = [];
  let off = 0;
  entradas.forEach(e => {
    const datos = Buffer.from(typeof e.datos === "string" ? Buffer.from(e.datos, "utf8") : e.datos);
    const comp = e.metodo === 8 ? zlib.deflateRawSync(datos) : datos;
    const nombre = Buffer.from(e.nombre, "utf8");
    const crc = zlib.crc32(datos) >>> 0;
    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(0x0800, 6); loc.writeUInt16LE(e.metodo || 0, 8);
    loc.writeUInt32LE(crc, 14); loc.writeUInt32LE(comp.length, 18); loc.writeUInt32LE(datos.length, 22);
    loc.writeUInt16LE(nombre.length, 26); loc.writeUInt16LE(0, 28);
    partes.push(loc, nombre, comp);
    const extra = op.zip64 ? Buffer.alloc(28) : Buffer.alloc(0);
    if (op.zip64) {
      extra.writeUInt16LE(1, 0); extra.writeUInt16LE(24, 2);
      extra.writeBigUInt64LE(BigInt(datos.length), 4); extra.writeBigUInt64LE(BigInt(comp.length), 12); extra.writeBigUInt64LE(BigInt(off), 20);
    }
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(45, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0x0800, 8); cd.writeUInt16LE(e.metodo || 0, 10);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(op.zip64 ? 0xffffffff : comp.length, 20); cd.writeUInt32LE(op.zip64 ? 0xffffffff : datos.length, 24);
    cd.writeUInt16LE(nombre.length, 28); cd.writeUInt16LE(extra.length, 30);
    cd.writeUInt32LE(op.zip64 ? 0xffffffff : off, 42);
    central.push(cd, nombre, extra);
    off += 30 + nombre.length + comp.length;
  });
  const cdBuf = Buffer.concat(central);
  const fin = [];
  if (op.zip64) {
    const z = Buffer.alloc(56);
    z.writeUInt32LE(0x06064b50, 0); z.writeBigUInt64LE(44n, 4); z.writeUInt16LE(45, 12); z.writeUInt16LE(45, 14);
    z.writeBigUInt64LE(BigInt(entradas.length), 24); z.writeBigUInt64LE(BigInt(entradas.length), 32);
    z.writeBigUInt64LE(BigInt(cdBuf.length), 40); z.writeBigUInt64LE(BigInt(off), 48);
    const loc = Buffer.alloc(20);
    loc.writeUInt32LE(0x07064b50, 0); loc.writeBigUInt64LE(BigInt(off + cdBuf.length), 8); loc.writeUInt32LE(1, 16);
    fin.push(z, loc);
  }
  const e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0);
  e.writeUInt16LE(op.zip64 ? 0xffff : entradas.length, 8); e.writeUInt16LE(op.zip64 ? 0xffff : entradas.length, 10);
  e.writeUInt32LE(op.zip64 ? 0xffffffff : cdBuf.length, 12); e.writeUInt32LE(op.zip64 ? 0xffffffff : off, 16);
  return new Uint8Array(Buffer.concat(partes.concat([cdBuf], fin, [e])));
}

module.exports = { puntos, gpx, tcx, fit, zip };
