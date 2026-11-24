// ---------- Ropa: tus conversaciones con tu estilista (D-158) ----------
// Escucha users/{uid}/ropa_charlas: cada conversación con sus mensajes (los
// tuyos y los de tu estilista, con los outfits que armó). Cada mensaje se
// suma al final (arrayUnion): nada se reescribe. Hasta 40 mensajes por
// conversación; después, lo que escribas empieza una nueva. Lo que recuerda
// de ti va en meta/ropa_ajustes.memoria (por RopaInspDatos.guardarAjustes).
// Borrar una conversación se puede deshacer (restaurar). Solo se suman campos
// y documentos.
// window.RopaEstilistaDatos: lista(), una(id), crudo(id), cargada(), al(fn),
// crear(mensaje) → id, agregar(id, mensaje) → promesa, borrar(id),
// restaurar(id, doc), memoria(), guardarMemoria(lista).
(function () {
"use strict";
const E = window.RopaEstilistaMotor, DI = window.RopaInspDatos;
if (!E || !DI) return;
const usuario = () => db.collection("users").doc(currentUser.uid);
const col = () => usuario().collection("ropa_charlas");
const FV = () => firebase.firestore.FieldValue;

let todas = [], cargada = false;
const crudos = new Map();
const oyentes = [];
let quitar = null;
function escuchar() {
  if (quitar) quitar();
  quitar = col().onSnapshot(snap => {
    crudos.clear();
    snap.docs.forEach(d => crudos.set(d.id, d.data()));
    todas = E.ordenar([...crudos.entries()].map(([id, d]) => E.normalizar(id, d)));
    cargada = true;
    oyentes.forEach(f => { try { f(); } catch (e) { console.error("Ropa (estilista):", e); } });
  }, err => console.warn("Ropa (estilista):", err));
}
if (typeof onAuthReady === "function") onAuthReady(escuchar);

// Un mensaje como se guarda (sin campos vacíos de más).
function limpio(m) {
  const x = E.mensaje(m);
  if (!x) return null;
  const out = { de: x.de, texto: x.texto, fecha: x.fecha || Date.now() };
  if (x.de === "ia") Object.assign(out, { outfits: x.outfits, faltan: x.faltan, recordo: x.recordo }, x.sinMostrar ? { sinMostrar: x.sinMostrar } : {});
  return out;
}
// Una conversación nueva con tu primer mensaje. → su id (al toque; se guarda
// en segundo plano: sin internet, queda en la cola de Firestore).
function crear(m, alFallar) {
  const x = limpio(m);
  const ref = col().doc();
  const ahora = Date.now();
  ref.set({ v: 1, titulo: E.titulo(x ? x.texto : ""), mensajes: x ? [x] : [], creado: ahora, editado: ahora }).catch(e => { if (alFallar) alFallar(e); });
  return ref.id;
}
// Un mensaje más, al final.
function agregar(id, m) {
  const x = limpio(m);
  if (!x) return Promise.resolve();
  return col().doc(id).set({ mensajes: FV().arrayUnion(x), editado: Date.now() }, { merge: true });
}
const borrar = id => col().doc(id).delete();
const restaurar = (id, doc) => col().doc(id).set(doc);

// Lo que recuerda de ti (en los ajustes de Ropa).
const memoria = () => E.memoria((DI.ajustes() || {}).memoria);
const guardarMemoria = lista => DI.guardarAjustes({ memoria: E.memoria(lista) });

window.RopaEstilistaDatos = {
  lista: () => todas, una: id => todas.find(c => c.id === id) || null, crudo: id => crudos.get(id) || null,
  cargada: () => cargada, al: fn => { oyentes.push(fn); }, crear, agregar, borrar, restaurar, memoria, guardarMemoria
};
})();
