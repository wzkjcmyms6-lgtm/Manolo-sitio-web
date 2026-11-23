// ---------- Ropa: tus inspiraciones (D-148) ----------
// Escucha users/{uid}/ropa_inspiracion (los pines de tu tablero, los links que
// pegaste y las imágenes que subiste) y users/{uid}/meta/ropa_ajustes (tu
// tablero de Pinterest y "Mi estilo"). La imagen de cada una vive en este
// teléfono (IndexedDB "manolo-ropa", la misma de las prendas, con clase
// "inspiracion"); en la nube queda la miniatura. Solo se suman campos y
// documentos. Los pines del tablero que quitas quedan ocultos (así no vuelven
// al actualizar); las imágenes subidas se borran (con Deshacer).
// window.RopaInspDatos: lista(), todas(), una(id), crudo(id), cargada(),
// error(), ajustes(), ajustesListos(), al(fn), agregarImagen(archivo, extra), agregarPin(pin,
// via, blob), guardarAnalisis(id, a), fallaAnalisis(id, mensaje),
// guardarLook(id, look), guardarImagen(id, blob, fotoId), ocultar(id, si),
// borrar(id), restaurar(id, doc), guardarAjustes(cambios), Fotos.
(function () {
"use strict";
const I = window.RopaInspMotor, D = window.RopaDatos;
if (!I || !D) return;
const Fotos = D.Fotos;
const usuario = () => db.collection("users").doc(currentUser.uid);
const col = () => usuario().collection("ropa_inspiracion");
const refAjustes = () => usuario().collection("meta").doc("ropa_ajustes");
const FV = () => firebase.firestore.FieldValue;

let todas = [], cargada = false, error = null, ajustes = {}, ajustesListos = false;
const crudos = new Map();
const oyentes = [];
function avisar() {
  oyentes.forEach(f => { try { f(); } catch (e) { console.error("Ropa (inspiración):", e); } });
}
let quitar = [];
function escuchar() {
  quitar.forEach(f => f());
  quitar = [
    col().onSnapshot(snap => {
      crudos.clear();
      snap.docs.forEach(d => crudos.set(d.id, d.data()));
      todas = I.ordenar([...crudos.entries()].map(([id, d]) => I.normalizar(id, d)));
      cargada = true;
      error = null;
      avisar();
    }, err => { console.warn("Ropa (inspiración):", err); error = err; avisar(); }),
    refAjustes().onSnapshot(s => { ajustes = (s.exists && s.data()) || {}; ajustesListos = true; avisar(); }, err => console.warn("Ropa (ajustes):", err))
  ];
}
if (typeof onAuthReady === "function") onAuthReady(escuchar);

const fotoDe = reg => ({ id: reg.id, mini: reg.mini, ancho: reg.ancho, alto: reg.alto });
// Una imagen que subiste (una captura de Pinterest, de Instagram o una foto).
function agregarImagen(archivo) {
  const ref = col().doc();
  if (!Fotos) return Promise.reject(new Error("Este teléfono no puede guardar imágenes."));
  return Fotos.preparar(archivo, ref.id, { clase: "inspiracion" })
    .then(reg => Fotos.guardar(reg).then(() => reg))
    .then(reg => ref.set({ v: 1, via: "foto", fotos: [fotoDe(reg)], creado: Date.now() }).then(() => ref.id));
}
// Un pin (de tu tablero o de un link): su imagen ya traída por el puente.
// Si lo habías quitado y lo vuelves a pegar, vuelve.
function agregarPin(pin, via, blob) {
  const id = I.docDePin(pin.id);
  const ref = col().doc(id);
  const datos = { v: 1, via, pin: { id: pin.id, url: pin.url, titulo: pin.titulo || "", img: pin.img, fecha: pin.fecha || 0 } };
  const yaEsta = crudos.get(id);
  if (yaEsta) return ref.set(via === "link" ? Object.assign(datos, { oculta: false, editado: Date.now() }) : { pin: datos.pin }, { merge: true }).then(() => id);
  const conFoto = blob && Fotos
    ? Fotos.preparar(blob, id, { clase: "inspiracion" }).then(reg => Fotos.guardar(reg).then(() => [fotoDe(reg)], () => [fotoDe(reg)]))
    : Promise.resolve([]);
  return conFoto.then(fotos => ref.set(Object.assign(datos, { fotos, creado: Date.now() })).then(() => id));
}
// Lo que vio la IA (o la falla, para no insistir más de dos veces).
function guardarAnalisis(id, a) {
  return col().doc(id).update({ analisis: a, ia: { fecha: D.hoy() }, iaError: FV().delete(), editado: Date.now() });
}
function fallaAnalisis(id, mensaje) {
  return col().doc(id).set({ iaError: { veces: FV().increment(1), mensaje: String(mensaje || "").slice(0, 140) } }, { merge: true });
}
// La imagen que trajo el puente cuando no estaba en este teléfono: con el
// mismo id de foto (si el doc ya tenía una) o como foto nueva del doc.
function guardarImagen(id, blob, fotoId) {
  if (!Fotos || !blob) return Promise.resolve();
  return Fotos.preparar(blob, id, { clase: "inspiracion" }).then(reg => {
    if (fotoId) reg.id = fotoId;
    return Fotos.guardar(reg).then(() => (fotoId ? null : col().doc(id).update({ fotos: [fotoDe(reg)], editado: Date.now() })));
  });
}
function guardarLook(id, look) {
  return col().doc(id).update({ look: Object.assign({}, look, { fecha: D.hoy() }), editado: Date.now() });
}
function ocultar(id, si) { return col().doc(id).update({ oculta: si !== false, editado: Date.now() }); }
function borrar(id) { return col().doc(id).delete(); }
function restaurar(id, doc) { return col().doc(id).set(doc); }
function guardarAjustes(cambios) { return refAjustes().set(Object.assign({}, cambios, { editado: Date.now() }), { merge: true }); }

window.RopaInspDatos = {
  lista: () => todas.filter(p => !p.oculta), todas: () => todas, una: id => todas.find(p => p.id === id) || null, crudo: id => crudos.get(id) || null,
  cargada: () => cargada, error: () => error, ajustes: () => ajustes, ajustesListos: () => ajustesListos, al: fn => { oyentes.push(fn); },
  agregarImagen, agregarPin, guardarAnalisis, fallaAnalisis, guardarLook, guardarImagen, ocultar, borrar, restaurar, guardarAjustes, Fotos
};
})();
