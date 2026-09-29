// ---------- Datos de Ejercicio (centro compartido) ----------
// Junta en un solo lugar lo que necesitan el mapa, el radar y el registro:
// la base de ejercicios (data/ejercicios.json), los ejercicios propios, las
// asignaciones de nombres no reconocidos, los ajustes (peso corporal y
// constantes) y los entrenamientos de Gimnasio, Running y Bicicleta. Cada
// vez que algo cambia en Firestore recalcula y avisa a quien escuche con
// EjercicioDatos.onCambio(cb). Firestore avisa al instante también de lo
// que se guarda sin conexión, así que el mapa reacciona sin recargar.
(function () {

const RUTA_BASE = "data/ejercicios.json?v=202609291";

const estado = {
  base: [], destacados: 0, propios: [], asignaciones: {}, ajustes: {},
  registros: { gimnasio: [], running: [], bicicleta: [] },
  cargado: { base: false, gimnasio: false },
  indice: null, datos: null, version: 0
};
const oyentes = [];
let cacheResolver = new Map();
let pendiente = null;

function meta(doc) {
  return db.collection("users").doc(currentUser.uid).collection("meta").doc(doc);
}
function coleccion(nombre) {
  return db.collection("users").doc(currentUser.uid).collection(nombre);
}

function reconstruirIndice() {
  const todos = estado.base.concat(estado.propios);
  estado.indice = ExerciseSearch.crearIndice(todos, { destacados: estado.destacados });
  cacheResolver = new Map();
}

function ficha(id) {
  return (estado.indice && id && estado.indice.porId.get(id)) || null;
}

function resolver(nombre, id) {
  const porId = ficha(id);
  if (porId) return porId;
  if (!estado.indice || !nombre) return null;
  const k = ExerciseSearch.clave(nombre);
  if (!cacheResolver.has(k)) cacheResolver.set(k, ExerciseSearch.resolver(estado.indice, nombre, { asignaciones: estado.asignaciones }));
  return cacheResolver.get(k);
}

function config() {
  return MuscleEngine.config(estado.ajustes);
}

// Agrupa varios avisos seguidos de Firestore en un solo recálculo.
function avisar() {
  if (pendiente) return;
  pendiente = Promise.resolve().then(() => {
    pendiente = null;
    if (!estado.indice) return;
    estado.datos = MuscleEngine.desdeRegistros(estado.registros, resolver);
    estado.version++;
    oyentes.forEach(cb => { try { cb(estado); } catch (e) { console.error(e); } });
  });
}

function onCambio(cb) {
  oyentes.push(cb);
  if (estado.datos) cb(estado);
}

function buscar(consulta, limite) {
  if (!estado.indice) return [];
  return ExerciseSearch.buscar(estado.indice, consulta, limite);
}

fetch(RUTA_BASE)
  .then(r => r.json())
  .then(json => {
    estado.base = json.ejercicios || [];
    estado.destacados = json.destacados || 0;
    estado.cargado.base = true;
    reconstruirIndice();
    avisar();
  })
  .catch(err => console.error("No se pudo cargar la base de ejercicios", err));

onAuthReady(() => {
  coleccion("entrenamientos").onSnapshot(snap => {
    estado.registros.gimnasio = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    estado.cargado.gimnasio = true;
    avisar();
  });
  coleccion("running").onSnapshot(snap => {
    estado.registros.running = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    avisar();
  });
  coleccion("bicicleta").onSnapshot(snap => {
    estado.registros.bicicleta = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    avisar();
  });
  meta("ajustes_ejercicio").onSnapshot(doc => {
    estado.ajustes = (doc.exists && doc.data()) || {};
    avisar();
  });
  meta("ejercicios_propios").onSnapshot(doc => {
    const d = (doc.exists && doc.data()) || {};
    estado.propios = Object.keys(d).map(id => Object.assign({}, d[id], { id }));
    reconstruirIndice();
    avisar();
  });
  meta("asignaciones_ejercicios").onSnapshot(doc => {
    estado.asignaciones = (doc.exists && doc.data()) || {};
    cacheResolver = new Map();
    avisar();
  });
});

window.EjercicioDatos = { estado, onCambio, config, ficha, resolver, buscar, meta, coleccion };
})();
