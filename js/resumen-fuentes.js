// ---------- Resúmenes: los datos de cada sección (D-136) ----------
// Junta lo que cada sección ya tiene en memoria (todas escuchan sus datos
// completos al abrir la app) y lo deja en el formato común de
// js/resumen-motor.js. No lee nada nuevo de Firestore: instantáneo, sin
// costo y sin internet. Una sección que no cargó (o que no usas) queda en
// null y su parte no se muestra.
(function () {
"use strict";
const R = window.ResumenMotor;
if (!R) return;

// Movilidad y Biblia avisan sus datos con "manolo:fuente".
const recibidos = { movilidad: null, biblia: null };
window.addEventListener("manolo:fuente", e => {
  const d = e.detail || {};
  if (d.fuente === "movilidad" || d.fuente === "biblia") recibidos[d.fuente] = Array.isArray(d.datos) ? d.datos : [];
});
// Cada sección por separado: si una falla, las demás siguen.
const probar = fn => { try { return fn(); } catch (e) { console.warn("Resúmenes:", e); return null; } };
function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Running y Bici (js/run-datos.js): km y minutos en movimiento; las marcas
// de Running que fueron récord absoluto ese día.
function actividades(col) {
  const RD = window.RunDatos, V = window.RunVista, A = window.RunAnalisis;
  if (!RD || !V || !RD.cargada(col)) return null;
  const docs = RD.lista(col);
  const logros = col === "running" && A ? A.logrosPorId(docs) : {};
  return docs.filter(d => d && R.fechaOk(d.date)).map(d => {
    const b = V.basicos(d);
    return { id: d.id, fecha: d.date, km: b.distM / 1000, min: b.movS / 60, desnivel: Number(d.desnivelPosM) || 0,
      titulo: d.titulo || (d.rutina && d.rutina.nombre) || "", mejores: d.mejores && typeof d.mejores === "object" ? d.mejores : null,
      records: (logros[d.id] || []).filter(l => l.puesto === 1).map(l => ({ nombre: l.nombre, t: l.t, puesto: 1 })) };
  });
}

// Gimnasio (js/gimnasio.js): series que cuentan, kg movidos y récords.
function gimnasio() {
  const G = window.Gimnasio, S = window.EjSesiones;
  if (!G || !G.historial) return null;
  const hist = G.historial();
  if (!Array.isArray(hist) || !hist.length) return null;
  return hist.filter(w => w && R.fechaOk(w.date)).map(w => ({
    fecha: w.date, nombre: w.name || "Entreno", min: Number(w.durationMin) || 0,
    series: S ? (w.exercises || []).reduce((s, ex) => s + S.seriesEfectivas(ex).length, 0) : 0,
    volumen: Number(probar(() => G.volumen(w))) || 0, records: Number(w.prs) || 0,
    ejercicios: (w.exercises || []).map(ex => ex && ex.name).filter(Boolean)
  }));
}

function movilidad() {
  const xs = recibidos.movilidad;
  if (!xs) return null;
  return xs.filter(s => s && R.fechaOk(s.fecha)).map(s => ({ fecha: s.fecha, min: (Number(s.duracionSeg) || 0) / 60, nombre: s.nombre || "Rutina" }));
}

// Hábitos (js/habitos.js): lo cumplido y lo que tocaba cada día, como lo
// cuenta Hábitos (con perdones y comodines), y cada hábito día por día.
function habitos() {
  const A = window.HabitosApp, HE = window.HabitosEngine;
  if (!A || !HE) return null;
  const st = A.estado();
  if (!st || !st.cargado || !st.res) return null;
  const res = st.res;
  const ids = Object.keys(res.habitos || {});
  if (!ids.length) return null;
  const inicio = ids.map(id => res.habitos[id].habito.inicio).filter(R.fechaOk).sort()[0];
  const dias = {};
  if (inicio) {
    for (let f = inicio, n = 0; f <= res.hoy && n < 4000; f = R.sumar(f, 1), n++) {
      const c = HE.cumplimientoGlobal(res, f, f);
      if (c.esperados > 0) dias[f] = { h: c.hechos, e: c.esperados };
    }
  }
  const lista = ids.map(id => res.habitos[id]).filter(rh => rh && rh.habito && !rh.habito.archivado).map(rh => {
    const h = rh.habito;
    const x = { id: h.id, nombre: h.name || "Hábito", emoji: h.emoji || "" };
    if (h.freqType === "semana") {
      x.semanas = {};
      (rh.semanas || []).forEach(s => { if (s && s.meta) x.semanas[s.lunes] = { h: Math.min(s.meta, Number(s.hechas) || 0), e: s.meta }; });
    } else {
      x.dias = {};
      Object.keys(rh.dias || {}).forEach(f => { const c = rh.dias[f] && rh.dias[f].clase; if (c === "cumple") x.dias[f] = 1; else if (c === "fallo") x.dias[f] = 0; });
    }
    return x;
  });
  return { dias, perfectos: (res.diasPerfectos || []).map(p => p.fecha).filter(R.fechaOk), lista };
}

// Libros (js/libros.js): páginas por día y los terminados (con relecturas).
function libros() {
  const D = window.LibrosDatos, E = window.LibrosEstadisticas, P = window.LibrosProgreso;
  if (!D || !E || !P || !D.listo()) return null;
  const ls = D.lista();
  if (!ls.length) return null;
  const pd = E.porDia(ls);
  const dias = {};
  Object.keys(pd).forEach(f => { if (pd[f].paginas > 0) dias[f] = pd[f].paginas; });
  const terminados = P.terminaciones(ls).filter(t => R.fechaOk(t.fechaFin)).map(t => ({
    id: t.id, titulo: t.libro.titulo, autor: t.libro.autor || "", fecha: t.fechaFin, calificacion: t.libro.calificacion || null,
    paginas: t.paginas || null, genero: t.libro.genero || null, relectura: t.n > 1
  }));
  return { dias, terminados };
}

// Biblia: capítulos leídos (js/biblia-lector.js) y versículos guardados (js/biblia.js).
function biblia() {
  const L = window.BibliaLector;
  const lista = recibidos.biblia;
  if (!lista && !L) return null;
  const leidos = L ? L.leidos() : {};
  const caps = [];
  Object.keys(leidos || {}).forEach(f => { if (R.fechaOk(f)) (leidos[f] || []).forEach(clave => caps.push({ fecha: f, clave })); });
  const vers = (lista || []).filter(x => x && !x.leido && R.fechaOk(x.fecha)).map(x => ({ fecha: x.fecha, cita: x.cita || "", libro: x.libro || "" }));
  if (!caps.length && !vers.length) return null;
  // Nombres de los libros de la Biblia que aparecen ("John" → "Juan").
  const B = window.BibliaMotor, nombres = {};
  caps.forEach(c => { const id = String(c.clave).split(".")[0]; if (!nombres[id] && B && B.libro) { const l = B.libro(id); if (l) nombres[id] = l.nombre; } });
  return { caps, vers, nombres };
}

// Finanzas (js/finanzas/app.js): gastos e ingresos que cuentan, en centavos.
function finanzas() {
  const F = window.FinanzasResumen;
  if (!F || !F.movimientos) return null;
  const movs = F.movimientos();
  if (!movs || !movs.length) return null;
  return { movs, cats: F.categorias ? F.categorias() : {} };
}

// Mi mañana (Medir tiempos): la suma de tus pasos de la mañana cada día.
function manana() {
  const D = window.TiemposDatos, A = window.TiemposActividades, S = window.TiemposStats;
  if (!D || !A || !S || !D.listo()) return null;
  const ids = A.pasosManana(D.ajustes()).map(a => a.id);
  if (!ids.length) return null;
  const xs = S.mananaPorDia(D.ds(), ids, 100000).map(x => ({ fecha: x.fecha, seg: x.total }));
  return xs.length ? xs : null;
}

function lugares() {
  const L = window.LugaresApp;
  if (!L || !L.listo()) return null;
  const xs = L.lista().filter(l => l && l.visitas && l.visitas.length).map(l => ({
    id: l.id, nombre: l.nombre || "Lugar", calificacion: l.calificacion || null, zona: l.zona || "", tipo: l.tipo || "",
    visitas: l.visitas.map(v => v.fecha).filter(R.fechaOk)
  }));
  return xs.length ? xs : null;
}

// Ropa (js/ropa-datos.js, D-151): lo que te pusiste cada día y tus prendas
// (su nombre, la familia de su color, cuándo la compraste y su precio).
// También las que ya no tienes: te las pusiste y las compraste igual.
function ropa() {
  const D = window.RopaDatos, M = window.RopaMotor, N = window.RopaNumerosMotor;
  if (!D || !M || !N || !D.cargada()) return null;
  const docs = D.usosDocs();
  const usos = Object.keys(docs).filter(R.fechaOk).map(f => ({ fecha: f, prendas: Array.isArray(docs[f].prendas) ? docs[f].prendas.slice() : [] })).filter(u => u.prendas.length);
  const prendas = D.lista().map(p => {
    const c = N.familiaDe(p);
    return { id: p.id, nombre: M.titulo(p), color: c ? c.nombre : "", compra: p.compra || "", precio: p.precio || 0 };
  });
  return usos.length || prendas.some(p => p.compra) ? { usos, prendas } : null;
}

// Lo que Hábitos y Libros ya calculan para un año ("Manolo Wrapped" de
// Hábitos y "Tu año en libros"), para "Tu año" (js/resumen-anio.js).
function extrasDelAnio(anio) {
  const out = {};
  const A = window.HabitosApp, HE = window.HabitosEngine;
  const st = A && A.estado ? A.estado() : null;
  if (st && st.cargado && st.res && HE && HE.wrapped) out.habitos = probar(() => HE.wrapped(st.res, anio, A.areasDef ? A.areasDef() : null));
  const D = window.LibrosDatos, E = window.LibrosEstadisticas;
  if (D && E && D.listo() && D.lista().length) {
    out.libros = probar(() => {
      const la = E.anio(D.lista(), D.frases(), anio);
      if (la && la.fraseFav && la.fraseFav.libroId) { const l = D.uno(la.fraseFav.libroId); la.fraseFav.libro = l ? l.titulo : ""; }
      return la;
    });
  }
  return out;
}

// Todo junto, en el formato de js/resumen-motor.js. o: { anio } suma lo que
// Hábitos y Libros calculan para ese año.
function datos(o) {
  const op = o || {};
  return {
    extras: op.anio ? extrasDelAnio(op.anio) : {},
    hoy: hoyLocal(),
    running: probar(() => actividades("running")),
    bici: probar(() => actividades("bicicleta")),
    gimnasio: probar(gimnasio),
    movilidad: probar(movilidad),
    habitos: probar(habitos),
    libros: probar(libros),
    biblia: probar(biblia),
    finanzas: probar(finanzas),
    manana: probar(manana),
    lugares: probar(lugares),
    ropa: probar(ropa)
  };
}

// Avisa (una vez cada tanto) cuando llega algo nuevo de cualquier sección,
// para que una pantalla abierta se vuelva a dibujar.
const oyentes = [];
let espera = null;
function avisar() {
  if (espera) return;
  espera = setTimeout(() => { espera = null; oyentes.forEach(fn => probar(fn)); }, 400);
}
["manolo:fuente", "manolo:actividades", "libros:datos"].forEach(ev => window.addEventListener(ev, avisar));
if (window.RopaDatos) window.RopaDatos.al(avisar);

window.ResumenFuentes = { datos, alCambiar: fn => { oyentes.push(fn); } };
})();
