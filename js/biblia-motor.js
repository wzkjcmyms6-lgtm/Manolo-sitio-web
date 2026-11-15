// ---------- Biblia: motor sin pantalla ----------
// Los 66 libros (nombres de la Reina-Valera y cantidad de capítulos),
// validación de cada registro, búsqueda, racha y calendario.
// Sin DOM ni Firebase: tests/biblia-motor.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BibliaMotor = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

// [código, nombre, capítulos]. El código (estilo OSIS) es lo que se guarda:
// así un cambio de nombre no rompe los registros.
const AT = [
  ["Gen", "Génesis", 50], ["Exod", "Éxodo", 40], ["Lev", "Levítico", 27], ["Num", "Números", 36], ["Deut", "Deuteronomio", 34],
  ["Josh", "Josué", 24], ["Judg", "Jueces", 21], ["Ruth", "Rut", 4], ["1Sam", "1 Samuel", 31], ["2Sam", "2 Samuel", 24],
  ["1Kgs", "1 Reyes", 22], ["2Kgs", "2 Reyes", 25], ["1Chr", "1 Crónicas", 29], ["2Chr", "2 Crónicas", 36], ["Ezra", "Esdras", 10],
  ["Neh", "Nehemías", 13], ["Esth", "Ester", 10], ["Job", "Job", 42], ["Ps", "Salmos", 150], ["Prov", "Proverbios", 31],
  ["Eccl", "Eclesiastés", 12], ["Song", "Cantares", 8], ["Isa", "Isaías", 66], ["Jer", "Jeremías", 52], ["Lam", "Lamentaciones", 5],
  ["Ezek", "Ezequiel", 48], ["Dan", "Daniel", 12], ["Hos", "Oseas", 14], ["Joel", "Joel", 3], ["Amos", "Amós", 9],
  ["Obad", "Abdías", 1], ["Jonah", "Jonás", 4], ["Mic", "Miqueas", 7], ["Nah", "Nahúm", 3], ["Hab", "Habacuc", 3],
  ["Zeph", "Sofonías", 3], ["Hag", "Hageo", 2], ["Zech", "Zacarías", 14], ["Mal", "Malaquías", 4]
];
const NT = [
  ["Matt", "Mateo", 28], ["Mark", "Marcos", 16], ["Luke", "Lucas", 24], ["John", "Juan", 21], ["Acts", "Hechos", 28],
  ["Rom", "Romanos", 16], ["1Cor", "1 Corintios", 16], ["2Cor", "2 Corintios", 13], ["Gal", "Gálatas", 6], ["Eph", "Efesios", 6],
  ["Phil", "Filipenses", 4], ["Col", "Colosenses", 4], ["1Thess", "1 Tesalonicenses", 5], ["2Thess", "2 Tesalonicenses", 3], ["1Tim", "1 Timoteo", 6],
  ["2Tim", "2 Timoteo", 4], ["Titus", "Tito", 3], ["Phlm", "Filemón", 1], ["Heb", "Hebreos", 13], ["Jas", "Santiago", 5],
  ["1Pet", "1 Pedro", 5], ["2Pet", "2 Pedro", 3], ["1John", "1 Juan", 5], ["2John", "2 Juan", 1], ["3John", "3 Juan", 1],
  ["Jude", "Judas", 1], ["Rev", "Apocalipsis", 22]
];
const LIBROS = AT.map((l, i) => ({ id: l[0], nombre: l[1], capitulos: l[2], testamento: "AT", orden: i }))
  .concat(NT.map((l, i) => ({ id: l[0], nombre: l[1], capitulos: l[2], testamento: "NT", orden: AT.length + i })));
const POR_ID = {};
LIBROS.forEach(l => { POR_ID[l.id] = l; });
const MAX_VERSICULO = 176; // Salmo 119
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

const libro = id => POR_ID[id] || null;
// Minúsculas y sin tildes, para buscar sin preocuparse por acentos.
const normalizar = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const fechaOk = f => /^\d{4}-\d{2}-\d{2}$/.test(f || "") && !isNaN(new Date(f + "T12:00:00Z").getTime());
const texto = (s, max) => String(s == null ? "" : s).replace(/\r\n?/g, "\n").trim().slice(0, max);

function sumarDias(f, n) {
  const d = new Date(f + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function fechaLarga(f) {
  if (!fechaOk(f)) return f || "";
  const d = new Date(f + "T12:00:00Z");
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
}
function mesTitulo(mes) {
  const [a, m] = mes.split("-").map(Number);
  const n = MESES[m - 1] || "";
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} ${a}`;
}

// Busca un libro por lo que escribas: "juan", "1 juan", "1juan", "salmo",
// "apoc"… Primero el nombre exacto, después el que empiece así.
function buscarLibro(q) {
  const n = normalizar(q).replace(/\s+/g, " ").replace(/^(\d)\s?/, "$1 ");
  if (!n) return null;
  const nombres = LIBROS.map(l => ({ l, n: normalizar(l.nombre) }));
  const exacto = nombres.find(x => x.n === n || normalizar(x.l.id) === n.replace(" ", ""));
  if (exacto) return exacto.l;
  const empieza = nombres.find(x => x.n.startsWith(n) || (n.length >= 4 && n.startsWith(x.n.slice(0, 4)) && x.n.startsWith(n.slice(0, 4))));
  return empieza ? empieza.l : null;
}

// Versículo: "16", "16-18", "1, 3", "1-3, 5". Se guarda normalizado
// ("16-18", "1,3", "1-3,5"). null si no se entiende o no tiene sentido.
function versiculoNormal(v) {
  const s = String(v == null ? "" : v).replace(/[–—]/g, "-").replace(/\s+/g, "");
  if (!/^\d{1,3}(-\d{1,3})?(,\d{1,3}(-\d{1,3})?)*$/.test(s)) return null;
  const ok = s.split(",").every(p => {
    const [a, b] = p.split("-").map(Number);
    return a >= 1 && a <= MAX_VERSICULO && (b === undefined || (b > a && b <= MAX_VERSICULO));
  });
  return ok ? s : null;
}

const cita = e => {
  const l = libro(e.libro);
  const nombre = l ? l.nombre : (e.libro || "¿?");
  return `${nombre} ${e.capitulo || "?"}${e.versiculo ? `:${e.versiculo}` : ""}`;
};

// Temas para tus versículos (fase 3, D-106). Se puede sumar uno propio.
const TEMAS = ["fe", "gratitud", "fortaleza", "paz", "amor", "esperanza", "sabiduría", "perdón", "familia", "oración", "propósito", "provisión"];
const TEMAS_MAX = 8;
// "Fe, gratitud ,  fe" o ["Fe", "gratitud"] → ["fe", "gratitud"] (minúsculas, sin repetir, máx. 8 de 24 letras).
function temasOk(t) {
  const lista = Array.isArray(t) ? t : String(t == null ? "" : t).split(",");
  const out = [];
  lista.forEach(x => {
    const v = String(x == null ? "" : x).replace(/[^0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ \-]/g, "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 24);
    if (v && !out.includes(v) && out.length < TEMAS_MAX) out.push(v);
  });
  return out;
}

// Versión del texto: letras, números, guiones y espacios (máx. 24).
function versionOk(v) {
  const s = String(v == null ? "" : v).trim().replace(/[^0-9A-Za-zÁÉÍÓÚÑáéíóúñ .\-]/g, "").slice(0, 24).trim();
  return s || null;
}

// Datos del formulario → documento. { ok, errores: [{campo, texto}], doc }.
function validar(datos, opciones) {
  const o = opciones || {};
  const errores = [];
  const err = (campo, t) => errores.push({ campo, texto: t });
  const fecha = String(datos.fecha || "").trim();
  if (!fechaOk(fecha)) err("fecha", "Pon la fecha.");
  else if (o.hoy && fecha > o.hoy) err("fecha", "La fecha no puede ser futura.");
  const l = libro(datos.libro);
  if (!l) err("libro", "Elige el libro.");
  const cap = Number(String(datos.capitulo || "").trim());
  if (l && !(Number.isInteger(cap) && cap >= 1 && cap <= l.capitulos)) err("capitulo", `El capítulo de ${l.nombre} va de 1 a ${l.capitulos}.`);
  else if (!l && !(Number.isInteger(cap) && cap >= 1)) err("capitulo", "Pon el capítulo.");
  const vers = versiculoNormal(datos.versiculo);
  if (!vers) err("versiculo", "Pon el versículo (ej: 16, 16-18 o 1,3).");
  const t = texto(datos.texto, 2000);
  if (!t) err("texto", "Escribe o pega el texto del versículo.");
  if (errores.length) return { ok: false, errores, doc: null };
  const doc = { v: 1, fecha, libro: l.id, capitulo: cap, versiculo: vers, texto: t, nota: texto(datos.nota, 1000) };
  // De qué versión es el texto (D-105): "RV1909" si vino del lector, la que
  // elegiste si lo pegaste. Opcional: los registros viejos no lo tienen.
  const version = versionOk(datos.version);
  if (version) doc.version = version;
  const temas = temasOk(datos.temas);
  if (temas.length) doc.temas = temas;
  return { ok: true, errores: [], doc };
}

// Documento guardado → registro para mostrar.
function normalizarDoc(id, d) {
  d = d || {};
  const l = libro(d.libro);
  const e = {
    id, fecha: d.fecha || "", libro: d.libro || "", capitulo: Number(d.capitulo) || 0, versiculo: d.versiculo ? String(d.versiculo) : "",
    texto: d.texto ? String(d.texto) : "", nota: d.nota ? String(d.nota) : "", creado: typeof d.creado === "number" ? d.creado : 0,
    version: d.version ? String(d.version) : "",
    temas: temasOk(d.temas),
    orden: l ? l.orden : 999
  };
  e.cita = cita(e);
  return e;
}

// Lo más reciente arriba (fecha y, el mismo día, el último guardado).
const ordenar = lista => lista.slice().sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado - a.creado) || String(b.id).localeCompare(String(a.id)));

// Filtro por libro y búsqueda (todas las palabras, sin tildes) en el texto,
// la nota y la cita.
function filtrar(lista, f) {
  f = f || {};
  const palabras = normalizar(f.texto).split(/\s+/).filter(Boolean);
  return lista.filter(e => {
    if (f.libro && e.libro !== f.libro) return false;
    if (f.fecha && e.fecha !== f.fecha) return false;
    if (f.tema && !(e.temas || []).includes(f.tema)) return false;
    if (!palabras.length) return true;
    const donde = normalizar(`${e.texto} ${e.nota} ${e.cita}`);
    return palabras.every(p => donde.includes(p));
  });
}

// Temas que ya usaste, con cuántos versículos (los de la lista primero).
function temasUsados(lista) {
  const n = {};
  lista.forEach(e => (e.temas || []).forEach(t => { n[t] = (n[t] || 0) + 1; }));
  return Object.keys(n).sort((a, b) => {
    const ia = TEMAS.indexOf(a), ib = TEMAS.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, "es");
  }).map(t => ({ tema: t, n: n[t] }));
}

// Libros que ya usaste, en el orden de la Biblia, con cuántos registros.
function librosUsados(lista) {
  const n = {};
  lista.forEach(e => { n[e.libro] = (n[e.libro] || 0) + 1; });
  return Object.keys(n).map(id => ({ id, nombre: libro(id) ? libro(id).nombre : id, n: n[id], orden: libro(id) ? libro(id).orden : 999 }))
    .sort((a, b) => a.orden - b.orden);
}

function porMes(lista) {
  const grupos = [];
  ordenar(lista).forEach(e => {
    const mes = e.fecha.slice(0, 7);
    let g = grupos[grupos.length - 1];
    if (!g || g.mes !== mes) { g = { mes, titulo: fechaOk(e.fecha) ? mesTitulo(mes) : "Sin fecha", items: [] }; grupos.push(g); }
    g.items.push(e);
  });
  return grupos;
}

// Racha: días seguidos con al menos un versículo. La actual termina hoy o,
// si hoy todavía no anotaste, ayer (sigue viva hasta que pase el día).
// fechasLeidas (fase 3, D-106): días con algún capítulo marcado como leído
// en el lector; cuentan para la racha igual que un versículo anotado.
function racha(lista, hoy, fechasLeidas) {
  const anotados = new Set(lista.map(e => e.fecha).filter(f => fechaOk(f) && f <= hoy));
  const dias = new Set(anotados);
  (fechasLeidas || []).forEach(f => { if (fechaOk(f) && f <= hoy) dias.add(f); });
  const hoyHecho = dias.has(hoy);
  let actual = 0;
  for (let f = hoyHecho ? hoy : sumarDias(hoy, -1); dias.has(f); f = sumarDias(f, -1)) actual++;
  let mejor = 0, corrida = 0, previo = null;
  [...dias].sort().forEach(f => {
    corrida = previo && sumarDias(previo, 1) === f ? corrida + 1 : 1;
    mejor = Math.max(mejor, corrida);
    previo = f;
  });
  const mes = hoy.slice(0, 7);
  return { actual, mejor, hoyHecho, anotadoHoy: anotados.has(hoy), leidoHoy: (fechasLeidas || []).includes(hoy),
    total: dias.size, esteMes: [...dias].filter(f => f.startsWith(mes)).length };
}

// Calendario de un mes ("AAAA-MM"): semanas de lunes a domingo; cada día
// con cuántos versículos tiene.
function calendario(lista, mes, hoy, fechasLeidas) {
  const n = {};
  lista.forEach(e => { if (e.fecha.startsWith(mes)) n[e.fecha] = (n[e.fecha] || 0) + 1; });
  const leido = new Set((fechasLeidas || []).filter(f => f.startsWith(mes)));
  const primero = `${mes}-01`;
  const dow = (new Date(primero + "T12:00:00Z").getUTCDay() + 6) % 7; // lunes = 0
  const semanas = [];
  let f = sumarDias(primero, -dow);
  do {
    const semana = [];
    for (let i = 0; i < 7; i++, f = sumarDias(f, 1)) {
      semana.push({ fecha: f, dia: Number(f.slice(8, 10)), enMes: f.startsWith(mes), n: n[f] || 0, leido: leido.has(f), futuro: !!hoy && f > hoy, hoy: f === hoy });
    }
    semanas.push(semana);
  } while (f.startsWith(mes));
  return { mes, titulo: mesTitulo(mes), semanas, dias: Object.keys(n).length };
}
function mesSiguiente(mes, n) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

// extras (desde la fase 2, D-105): { marcas: { libro: doc }, leidos: { fecha: [caps] }, lector: {…} }.
function exportarJson(docs, ahora, extras) {
  const x = extras || {};
  const out = {
    app: "Manolo · Biblia", version: 1, exportado: ahora,
    versiculos: Object.keys(docs).sort().map(id => Object.assign({ id }, docs[id], { cita: cita(docs[id]) }))
  };
  if (x.marcas && Object.keys(x.marcas).length) out.marcas = x.marcas;
  if (x.leidos && Object.keys(x.leidos).length) out.capitulosLeidos = x.leidos;
  if (x.lector) out.lector = x.lector;
  if (x.planes && Object.keys(x.planes).length) out.planes = x.planes;
  if (x.memoria && Object.keys(x.memoria).length) out.memorizar = x.memoria;
  return JSON.stringify(out, null, 2);
}

return {
  LIBROS, MAX_VERSICULO, MESES, TEMAS, libro, normalizar, fechaOk, sumarDias, fechaLarga, mesTitulo, buscarLibro, temasOk, temasUsados,
  versiculoNormal, cita, validar, normalizarDoc, ordenar, filtrar, librosUsados, porMes, racha, calendario, mesSiguiente, exportarJson
};
});
