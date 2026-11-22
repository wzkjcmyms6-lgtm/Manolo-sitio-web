// ---------- Ropa: tus datos (D-146) ----------
// Escucha users/{uid}/ropa (tus prendas) y users/{uid}/ropa_usos (lo que te
// pusiste cada día) y guarda los cambios. Las fotos grandes viven en este
// teléfono (IndexedDB "manolo-ropa", con FotosLocales de
// js/lugares-fotos.js); en la nube queda la miniatura de cada una.
// Solo se suman campos y documentos: nada de lo tuyo se reescribe.
// window.RopaDatos: lista(), una(id), crudo(id), cargada(), error(), usos(),
// usosDe(id), al(fn), guardar(id, datos), estado(id, estado), borrar(id),
// restaurar(id, doc), meLaPuse(id, fecha, si), puestaHoy(id), Fotos.
(function () {
"use strict";
const M = window.RopaMotor;
if (!M) return;
const Fotos = window.FotosLocales ? window.FotosLocales.crear({ base: "manolo-ropa", campo: "grupoId", media: 480 }) : null;
const usuario = () => db.collection("users").doc(currentUser.uid);
const col = n => usuario().collection(n);
const FV = () => firebase.firestore.FieldValue;

let prendas = [], cargada = false, error = null, usosDocs = {}, usosMap = new Map();
const crudos = new Map();
const oyentes = [];
function avisar() {
  oyentes.forEach(f => { try { f(); } catch (e) { console.error("Ropa:", e); } });
  window.dispatchEvent(new CustomEvent("ropa:datos"));
}
let quitar = [];
function escuchar() {
  quitar.forEach(f => f());
  quitar = [
    col("ropa").onSnapshot(snap => {
      crudos.clear();
      snap.docs.forEach(d => crudos.set(d.id, d.data()));
      prendas = [...crudos.entries()].map(([id, d]) => M.normalizar(id, d));
      cargada = true;
      error = null;
      avisar();
    }, err => { console.warn("Ropa:", err); error = err; avisar(); }),
    col("ropa_usos").onSnapshot(snap => {
      usosDocs = {};
      snap.docs.forEach(d => { usosDocs[d.id] = d.data(); });
      usosMap = M.usos(usosDocs);
      avisar();
    }, err => console.warn("Ropa (usos):", err))
  ];
}
if (typeof onAuthReady === "function") onAuthReady(() => { escuchar(); limpiarBorradores(); });
// Fotos que quedaron a medio agregar (se cerró la app en el medio): se borran
// del teléfono después de una hora.
function limpiarBorradores() {
  if (!Fotos) return;
  Fotos.deGrupo("borrador").then(rs => rs.filter(r => r && r.creado < Date.now() - 3600000).forEach(r => Fotos.borrar(r.id).catch(() => {}))).catch(() => {});
}

// Hoy en este teléfono (AAAA-MM-DD).
function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// Lo que se guarda de una prenda (lo que viene del formulario, ya revisado).
function limpio(d) {
  const o = {
    v: 1, grupo: d.grupo, tipo: String(d.tipo || "").trim().slice(0, 40),
    colores: (d.colores || []).filter(c => c && M.COLOR[c.id]).slice(0, 3).map(c => (typeof c.peso === "number" ? { id: c.id, peso: c.peso } : { id: c.id })),
    estampado: d.estampado || "", tela: String(d.tela || "").trim().slice(0, 40),
    estilo: d.estilo || [], clima: d.clima || [],
    formalidad: d.formalidad ? Number(d.formalidad) : null,
    marca: String(d.marca || "").trim().slice(0, 40), talla: String(d.talla || "").trim().slice(0, 12),
    precio: d.precio === "" || d.precio == null ? null : Math.round(Number(d.precio) * 100) / 100,
    compra: d.compra || "", notas: String(d.notas || "").trim().slice(0, 500)
  };
  if (Array.isArray(d.fotos)) o.fotos = d.fotos.map(f => ({ id: f.id, mini: f.mini || "", ancho: f.ancho || 0, alto: f.alto || 0 }));
  if (d.ia) o.ia = { fecha: d.ia };   // la llenó la IA (D-147)
  return o;
}
// Nueva (id null) o editada. → Promise<id>
function guardar(id, datos) {
  const ref = id ? col("ropa").doc(id) : col("ropa").doc();
  const o = limpio(datos);
  if (id) o.editado = Date.now(); else { o.creado = Date.now(); o.estado = "activa"; }
  const fotos = (datos.fotos || []).map(f => f.id);
  return ref.set(o, { merge: true })
    .then(() => (Fotos && fotos.length ? Fotos.mover(fotos, ref.id).catch(() => {}) : null))
    .then(() => ref.id);
}
// "Para lavar", "Ya está limpia", "Ya no la tengo" y "La volví a tener".
function estado(id, e) {
  const cambio = { estado: e, editado: Date.now() };
  cambio.fueraFecha = e === "fuera" ? hoy() : FV().delete();
  return col("ropa").doc(id).update(cambio);
}
function borrar(id) { return col("ropa").doc(id).delete(); }
// Lo que la IA llenó en una prenda que ya tenías (solo lo que faltaba, D-147).
function completar(id, cambios) {
  return col("ropa").doc(id).update(Object.assign({}, cambios, { ia: { fecha: hoy() }, editado: Date.now() }));
}
function restaurar(id, doc) { return col("ropa").doc(id).set(doc); }
// Me la puse (o no) en una fecha.
function meLaPuse(id, fecha, si) {
  const f = fecha || hoy();
  return col("ropa_usos").doc(f).set({ prendas: si ? FV().arrayUnion(id) : FV().arrayRemove(id), actualizado: Date.now() }, { merge: true });
}
const puestaHoy = id => !!(usosDocs[hoy()] && Array.isArray(usosDocs[hoy()].prendas) && usosDocs[hoy()].prendas.includes(id));

window.RopaDatos = {
  lista: () => prendas, una: id => prendas.find(p => p.id === id) || null, crudo: id => crudos.get(id) || null,
  cargada: () => cargada, error: () => error, usos: () => usosMap, usosDe: id => usosMap.get(id) || { n: 0, ultima: "", fechas: [] },
  usosDocs: () => usosDocs, al: fn => { oyentes.push(fn); }, guardar, estado, borrar, completar, restaurar, meLaPuse, puestaHoy, hoy, Fotos
};
})();
