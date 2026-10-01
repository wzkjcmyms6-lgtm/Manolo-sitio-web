// Firebase FALSO en memoria, solo para pruebas de pantalla locales
// (scripts/e2e/*.js lo inyecta en lugar de vendor/firebase-10.7.1). Nunca se
// carga en la app publicada.
//
// Configuración por localStorage antes de cargar la página:
//   __SEED__     { "ruta/de/coleccion": { id: {...datos} } } (datos iniciales;
//                luego manda __STORE__, que se actualiza con cada escritura)
//   __USERS__    { "usuario@manolo-panel.local": { uid, pass } }  (login)
//   __SESION__   uid con sesión ya iniciada ("" = pantalla de login)
// Simula, de forma mínima, las reglas de accesos/admins de firestore.rules
// para probar cómo reacciona la app; las reglas reales se verifican al
// publicarlas (docs/ADMIN.md).
(function () {
  const store = new Map();
  const listeners = [];
  let autoId = 0;
  const clone = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const colMap = p => { if (!store.has(p)) store.set(p, new Map()); return store.get(p); };
  const split = p => { const i = p.lastIndexOf("/"); return [p.slice(0, i), p.slice(i + 1)]; };
  const negado = () => Promise.reject(Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" }));

  let usuario = null;
  const esAdmin = () => !!usuario && colMap("admins").has(usuario.uid);
  // Reglas mínimas (las mismas ideas que firestore.rules).
  function puedeLeer(path) {
    if (path === "accesos" || path.startsWith("accesos/")) return esAdmin();
    if (path.startsWith("admins/")) return !!usuario && path === "admins/" + usuario.uid;
    return !!usuario;
  }
  function puedeEscribir(path, nuevo, existe) {
    if (path.startsWith("admins/")) return false;
    if (path.startsWith("accesos/")) {
      if (existe) return esAdmin() && nuevo !== "crear";
      return !!usuario && path.startsWith("accesos/" + usuario.uid + "_");
    }
    return !!usuario;
  }

  function snapDoc(p) {
    const [c, id] = split(p);
    const d = colMap(c).get(id);
    return { id, exists: d !== undefined, data: () => clone(d), ref: docRef(p), metadata: { fromCache: false } };
  }
  function filas(q) {
    let docs = [...colMap(q.path).keys()].map(id => snapDoc(q.path + "/" + id));
    if (q.orden) {
      const [campo, dir] = q.orden;
      docs.sort((a, b) => { const x = a.data()[campo], y = b.data()[campo]; return (x > y ? 1 : x < y ? -1 : 0) * (dir === "desc" ? -1 : 1); });
    }
    if (q.tope) docs = docs.slice(0, q.tope);
    return docs;
  }
  function snapCol(q, previos) {
    const docs = filas(q);
    const cambios = docs.filter(d => !previos || !previos.has(d.id)).map(doc => ({ type: "added", doc }));
    return { docs, empty: !docs.length, size: docs.length, forEach: f => docs.forEach(f), docChanges: () => cambios, metadata: { fromCache: false } };
  }
  function emitir(l) {
    if (l.kind === "col") {
      if (!puedeLeer(l.q.path)) { if (l.err) l.err({ code: "permission-denied" }); return; }
      const s = snapCol(l.q, l.vistos);
      l.vistos = new Set(s.docs.map(d => d.id));
      l.cb(s);
    } else {
      if (!puedeLeer(l.path)) { if (l.err) l.err({ code: "permission-denied" }); return; }
      l.cb(snapDoc(l.path));
    }
  }
  // El "servidor" sobrevive a las recargas: se guarda en __STORE__.
  function guardar() {
    const o = {};
    store.forEach((m, p) => { o[p] = {}; m.forEach((d, id) => { o[p][id] = d; }); });
    localStorage.setItem("__STORE__", JSON.stringify(o));
  }
  function notify() { guardar(); setTimeout(() => listeners.slice().forEach(emitir), 0); }
  function listen(l) {
    listeners.push(l);
    setTimeout(() => emitir(l), 0);
    return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); };
  }
  const args = (a, b, c) => (typeof a === "function" ? [a, b] : [b, c]);

  const DEL = { __del: true };
  const HORA = { __hora: true };
  function valor(v, previo) {
    if (v && v.__hora) return Date.now();
    if (v && v.__suma != null) return (typeof previo === "number" ? previo : 0) + v.__suma;
    if (v && v.__union) return (Array.isArray(previo) ? previo : []).concat(v.__union.filter(x => !(previo || []).includes(x)));
    if (v && v.__quitar) return (Array.isArray(previo) ? previo : []).filter(x => !v.__quitar.includes(x));
    return clone(v);
  }
  // update({ "a.b": 1 }) o update(campo, valor, campo, valor…) con FieldPath.
  function pares(a) {
    if (a.length === 1) return Object.keys(a[0]).map(k => [k.split("."), a[0][k]]);
    const out = [];
    for (let i = 0; i < a.length; i += 2) out.push([a[i] && a[i].__ruta ? a[i].__ruta : String(a[i]).split("."), a[i + 1]]);
    return out;
  }
  function applyUpdate(obj, lista) {
    lista.forEach(([parts, v]) => {
      let o = obj;
      for (let i = 0; i < parts.length - 1; i++) { o[parts[i]] = o[parts[i]] || {}; o = o[parts[i]]; }
      const last = parts[parts.length - 1];
      if (v && v.__del) delete o[last]; else o[last] = valor(v, o[last]);
    });
    return obj;
  }
  function merge(a, b) {
    Object.keys(b).forEach(k => {
      const v = b[k];
      if (v && v.__del) delete a[k];
      else if (v && typeof v === "object" && !Array.isArray(v) && !v.__hora && v.__suma == null && !v.__union && !v.__quitar && a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) merge(a[k], v);
      else a[k] = valor(v, a[k]);
    });
    return a;
  }
  function query(q) {
    return {
      where: () => query(q),
      orderBy: (campo, dir) => query(Object.assign({}, q, { orden: [campo, dir || "asc"] })),
      limit: n => query(Object.assign({}, q, { tope: n })),
      onSnapshot: (a, b, c) => { const [cb, err] = args(a, b, c); return listen({ kind: "col", q, cb, err }); },
      get: () => (puedeLeer(q.path) ? Promise.resolve(snapCol(q)) : negado())
    };
  }
  function colRef(path) {
    return Object.assign(query({ path }), {
      path, id: path.split("/").pop(),
      doc: id => docRef(path + "/" + (id || "auto" + (++autoId))),
      add: data => {
        const id = "auto" + (++autoId);
        if (!puedeEscribir(path + "/" + id, "crear", false)) return negado();
        colMap(path).set(id, merge({}, data)); notify(); return Promise.resolve(docRef(path + "/" + id));
      }
    });
  }
  function docRef(path) {
    const [c, id] = split(path);
    const existe = () => colMap(c).has(id);
    return {
      id, path, collection: n => colRef(path + "/" + n),
      set: (data, opts) => {
        if (!puedeEscribir(path, "crear", existe())) return negado();
        const m = colMap(c); m.set(id, opts && opts.merge ? merge(m.get(id) || {}, data) : merge({}, data)); notify(); return Promise.resolve();
      },
      update: (...data) => {
        if (!existe() || !puedeEscribir(path, "cambiar", true)) return negado();
        const m = colMap(c); m.set(id, applyUpdate(m.get(id) || {}, pares(data))); notify(); return Promise.resolve();
      },
      delete: () => {
        if (!puedeEscribir(path, "borrar", existe())) return negado();
        colMap(c).delete(id); notify(); return Promise.resolve();
      },
      get: () => (puedeLeer(path) ? Promise.resolve(snapDoc(path)) : negado()),
      onSnapshot: (a, b, c2) => { const [cb, err] = args(a, b, c2); return listen({ kind: "doc", path, cb, err }); }
    };
  }
  const db = {
    collection: n => colRef(n),
    batch: () => {
      const ops = [];
      return {
        set: (r, d, o) => ops.push(() => r.set(d, o)), update: (r, ...d) => ops.push(() => r.update(...d)), delete: r => ops.push(() => r.delete()),
        commit: () => ops.reduce((p, f) => p.then(f), Promise.resolve())
      };
    },
    enablePersistence: () => Promise.resolve()
  };

  // ---- Auth ----
  const usuarios = JSON.parse(localStorage.getItem("__USERS__") || "{}");
  const oyentesAuth = [];
  function hacerUsuario(email, uid, login) {
    return { uid, email, metadata: { lastSignInTime: new Date(login).toUTCString() } };
  }
  const sesion = localStorage.getItem("__SESION__");
  if (sesion === null || sesion) {
    const uid = sesion || "test";
    const email = Object.keys(usuarios).find(e => usuarios[e].uid === uid) || "test@manolo-panel.local";
    const login = Number(localStorage.getItem("__LOGIN_MS__")) || Date.UTC(2026, 8, 1, 12);
    usuario = hacerUsuario(email, uid, login);
  }
  const auth = {
    get currentUser() { return usuario; },
    setPersistence: () => Promise.resolve(),
    onAuthStateChanged: cb => { oyentesAuth.push(cb); setTimeout(() => cb(usuario), 0); },
    signInWithEmailAndPassword: (email, pass) => {
      const u = usuarios[email];
      if (!u || u.pass !== pass) return Promise.reject({ code: "auth/invalid-credential" });
      const login = Math.floor(Date.now() / 1000) * 1000;
      localStorage.setItem("__SESION__", u.uid);
      localStorage.setItem("__LOGIN_MS__", String(login));
      usuario = hacerUsuario(email, u.uid, login);
      setTimeout(() => oyentesAuth.forEach(cb => cb(usuario)), 0);
      return Promise.resolve({ user: usuario });
    },
    signOut: () => { usuario = null; localStorage.setItem("__SESION__", ""); setTimeout(() => oyentesAuth.forEach(cb => cb(null)), 0); return Promise.resolve(); }
  };

  const fs = () => db;
  fs.FieldValue = { delete: () => DEL, serverTimestamp: () => HORA, increment: n => ({ __suma: n }),
    arrayUnion: (...x) => ({ __union: x }), arrayRemove: (...x) => ({ __quitar: x }) };
  fs.FieldPath = function (...ruta) { this.__ruta = ruta; };
  const au = () => auth; au.Auth = { Persistence: { LOCAL: "local" } };
  window.firebase = { initializeApp: () => ({}), auth: au, firestore: fs };

  const seed = JSON.parse(localStorage.getItem("__STORE__") || localStorage.getItem("__SEED__") || "{}");
  Object.keys(seed).forEach(p => Object.keys(seed[p]).forEach(id => colMap(p).set(id, seed[p][id])));
  window.__fakeStore = { store, notify, colMap };
})();
