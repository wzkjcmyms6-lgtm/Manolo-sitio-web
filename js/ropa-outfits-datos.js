// ---------- Ropa: tus outfits (D-149) ----------
// Escucha users/{uid}/ropa_outfits: los que te pusiste, los que guardaste (o
// dejaste para mañana) y los que no te gustaron (para que no vuelvan). Un
// outfit es un conjunto de prendas: si armas el mismo otra vez, se usa el
// mismo documento. "Me lo pongo" también anota las prendas en ropa_usos del
// día (con outfitId). Solo se suman campos y documentos.
// window.RopaOutfitsDatos: lista(), una(id), crudo(id), cargada(), al(fn),
// deCombo(ids), ponerme(ids, datos, fecha), quitarme(id, ids, fecha, eraNuevo),
// guardar(ids, datos, para), guardarMio(ids, datos, para), noMeGusta(ids,
// datos), quitarGuardado(id), borrar(id), restaurar(id, doc).
(function () {
"use strict";
const O = window.RopaOutfitMotor, D = window.RopaDatos;
if (!O || !D) return;
const usuario = () => db.collection("users").doc(currentUser.uid);
const col = () => usuario().collection("ropa_outfits");
const FV = () => firebase.firestore.FieldValue;
const fechaOk = f => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f);
const txt = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);

// Lo guardado → { id, prendas, ocasion, origen, nombre, porque, capas, ciudad,
// clima, inspiracionId, guardado, gusto, puesto [fechas], para, creado }.
function normalizar(id, d) {
  const x = d && typeof d === "object" ? d : {};
  return {
    id,
    prendas: [...new Set((Array.isArray(x.prendas) ? x.prendas : []).filter(p => typeof p === "string"))],
    ocasion: txt(x.ocasion, 20), origen: ["ia", "reglas", "inspiracion", "manual"].includes(x.origen) ? x.origen : "reglas",
    nombre: txt(x.nombre, 40), porque: txt(x.porque, 200), capas: txt(x.capas, 160), ciudad: txt(x.ciudad, 60), clima: txt(x.clima, 160),
    inspiracionId: typeof x.inspiracionId === "string" ? x.inspiracionId : "",
    guardado: x.guardado === true, gusto: x.gusto === "si" || x.gusto === "no" ? x.gusto : null,
    puesto: (Array.isArray(x.puesto) ? x.puesto : []).filter(fechaOk).sort(), para: fechaOk(x.para) ? x.para : "",
    creado: typeof x.creado === "number" ? x.creado : 0
  };
}
let todos = [], cargada = false;
const crudos = new Map();
const oyentes = [];
let quitar = null;
function escuchar() {
  if (quitar) quitar();
  quitar = col().onSnapshot(snap => {
    crudos.clear();
    snap.docs.forEach(d => crudos.set(d.id, d.data()));
    todos = [...crudos.entries()].map(([id, d]) => normalizar(id, d)).sort((a, b) => b.creado - a.creado || (a.id < b.id ? -1 : 1));
    cargada = true;
    oyentes.forEach(f => { try { f(); } catch (e) { console.error("Ropa (outfits):", e); } });
  }, err => console.warn("Ropa (outfits):", err));
}
if (typeof onAuthReady === "function") onAuthReady(escuchar);

const deCombo = ids => { const k = O.clave(ids); return todos.find(o => O.clave(o.prendas) === k) || null; };
// Lo que se guarda de una opción: { ocasion, origen, nombre, porque, capas, ciudad, clima, inspiracionId }.
function datosDe(ids, datos) {
  const d = datos || {};
  return {
    v: 1, prendas: [...new Set(ids)], ocasion: txt(d.ocasion, 20), origen: ["ia", "reglas", "inspiracion", "manual"].includes(d.origen) ? d.origen : "reglas",
    nombre: txt(d.nombre, 40), porque: txt(d.porque, 200), capas: txt(d.capas, 160), ciudad: txt(d.ciudad, 60), clima: txt(d.clima, 160),
    inspiracionId: typeof d.inspiracionId === "string" ? d.inspiracionId : ""
  };
}
// El outfit de esas prendas (el que ya existe, o uno nuevo). → { ref, nuevo }
function refDe(ids, datos, extra) {
  const ya = deCombo(ids);
  const ref = ya ? col().doc(ya.id) : col().doc();
  const base = ya ? {} : Object.assign(datosDe(ids, datos), { creado: Date.now() });
  return ref.set(Object.assign(base, extra, { editado: Date.now() }), { merge: true }).then(() => ({ ref, nuevo: !ya }));
}
// "Me lo pongo": el outfit (gusto "si", con la fecha) y las prendas en lo que te pusiste ese día.
function ponerme(ids, datos, fecha) {
  const f = fecha || D.hoy();
  return refDe(ids, datos, { gusto: "si", puesto: FV().arrayUnion(f) }).then(({ ref, nuevo }) =>
    usuario().collection("ropa_usos").doc(f).set({ prendas: FV().arrayUnion(...ids), outfitId: ref.id, actualizado: Date.now() }, { merge: true })
      .then(() => ({ id: ref.id, nuevo })));
}
// Deshacer "Me lo pongo" (solo las prendas que se anotaron recién).
function quitarme(id, ids, fecha, eraNuevo) {
  const f = fecha || D.hoy();
  const usos = usuario().collection("ropa_usos").doc(f);
  const pasos = [ids.length ? usos.set({ prendas: FV().arrayRemove(...ids), outfitId: FV().delete(), actualizado: Date.now() }, { merge: true }) : Promise.resolve()];
  pasos.push(eraNuevo ? col().doc(id).delete() : col().doc(id).set({ puesto: FV().arrayRemove(f), editado: Date.now() }, { merge: true }));
  return Promise.all(pasos);
}
// Guardar (y "para" un día: lo eliges hoy para mañana).
const guardar = (ids, datos, para) => refDe(ids, datos, Object.assign({ guardado: true, gusto: "si" }, para ? { para } : {})).then(r => ({ id: r.ref.id, nuevo: r.nuevo }));
// Lo que armaste tú (D-156): como guardar y, si ese outfit ya existía, con el
// nombre y la ocasión que le pusiste.
function guardarMio(ids, datos, para) {
  const d = datos || {};
  const extra = Object.assign({ guardado: true, gusto: "si" }, para ? { para } : {},
    txt(d.nombre, 40) ? { nombre: txt(d.nombre, 40) } : {}, txt(d.ocasion, 20) ? { ocasion: txt(d.ocasion, 20) } : {});
  return refDe(ids, datos, extra).then(r => ({ id: r.ref.id, nuevo: r.nuevo }));
}
const noMeGusta = (ids, datos) => refDe(ids, datos, { gusto: "no", guardado: false }).then(r => ({ id: r.ref.id, nuevo: r.nuevo }));
const quitarGuardado = id => col().doc(id).set({ guardado: false, para: FV().delete(), editado: Date.now() }, { merge: true });
const borrar = id => col().doc(id).delete();
const restaurar = (id, doc) => col().doc(id).set(doc);

window.RopaOutfitsDatos = {
  lista: () => todos, una: id => todos.find(o => o.id === id) || null, crudo: id => crudos.get(id) || null,
  cargada: () => cargada, al: fn => { oyentes.push(fn); }, normalizar, deCombo, ponerme, quitarme, guardar, guardarMio, noMeGusta, quitarGuardado, borrar, restaurar
};
})();
