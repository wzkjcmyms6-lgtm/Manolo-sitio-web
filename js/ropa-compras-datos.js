// ---------- Ropa: tu lista de deseos (D-150) ----------
// Escucha users/{uid}/ropa_deseos: lo que traes de Pinterest para comprar
// (desde "Qué te falta" o desde un pin). Agregar lo mismo dos veces no lo
// repite: suma los pines al que ya está. "Lo compré" lo deja como comprado,
// con la prenda nueva del ropero; "Ya no lo quiero", como descartado. Manolo
// nunca compra nada. Solo se suman campos y documentos.
// window.RopaComprasDatos: lista(), quiero(), una(id), crudo(id), cargada(),
// al(fn), deClave(clave), agregar(cosa, extra), comprado(id, prendaId),
// descartar(id), borrar(id), restaurar(id, doc).
(function () {
"use strict";
const K = window.RopaComprasMotor, D = window.RopaDatos;
if (!K || !D) return;
const usuario = () => db.collection("users").doc(currentUser.uid);
const col = () => usuario().collection("ropa_deseos");
const FV = () => firebase.firestore.FieldValue;

let todos = [], cargada = false;
const crudos = new Map();
const oyentes = [];
let quitar = null;
function escuchar() {
  if (quitar) quitar();
  quitar = col().onSnapshot(snap => {
    crudos.clear();
    snap.docs.forEach(d => crudos.set(d.id, d.data()));
    todos = [...crudos.entries()].map(([id, d]) => K.normalizarDeseo(id, d)).sort((a, b) => b.creado - a.creado || (a.id < b.id ? -1 : 1));
    cargada = true;
    oyentes.forEach(f => { try { f(); } catch (e) { console.error("Ropa (deseos):", e); } });
  }, err => console.warn("Ropa (deseos):", err));
}
if (typeof onAuthReady === "function") onAuthReady(escuchar);

const quiero = () => todos.filter(d => d.estado === "quiero");
// Lo que ya está en tu lista con esa clave (o nada).
const deClave = k => quiero().find(d => d.clave === k) || null;
// cosa: { grupo, tipo, colores [ids] }; extra: { inspiraciones [ids], origen, nota }.
// → { id, nuevo } (si ya estaba, le suma los pines).
function agregar(cosa, extra) {
  const e = extra || {};
  const pines = [...new Set((e.inspiraciones || []).filter(x => typeof x === "string" && x))].slice(0, 24);
  const ya = deClave(K.clave(cosa));
  if (ya) {
    const cambios = { editado: Date.now() };
    if (pines.length) cambios.inspiraciones = FV().arrayUnion(...pines);
    return col().doc(ya.id).set(cambios, { merge: true }).then(() => ({ id: ya.id, nuevo: false }));
  }
  const ref = col().doc();
  return ref.set({
    v: 1, grupo: cosa.grupo, tipo: String(cosa.tipo || "").slice(0, 40), colores: (cosa.colores || []).slice(0, 3), nota: String(e.nota || "").slice(0, 200),
    inspiraciones: pines, origen: K.ORIGENES.includes(e.origen) ? e.origen : "manual", estado: "quiero", creado: Date.now(), editado: Date.now()
  }).then(() => ({ id: ref.id, nuevo: true }));
}
// "Lo compré": ya está en tu ropero (prendaId).
const comprado = (id, prendaId) => col().doc(id).set({ estado: "comprado", prendaId: prendaId || "", compradoFecha: D.hoy(), editado: Date.now() }, { merge: true });
const descartar = id => col().doc(id).set({ estado: "descartado", editado: Date.now() }, { merge: true });
const borrar = id => col().doc(id).delete();
const restaurar = (id, doc) => col().doc(id).set(doc);

window.RopaComprasDatos = {
  lista: () => todos, quiero, una: id => todos.find(d => d.id === id) || null, crudo: id => crudos.get(id) || null,
  cargada: () => cargada, al: fn => { oyentes.push(fn); }, deClave, agregar, comprado, descartar, borrar, restaurar
};
})();
