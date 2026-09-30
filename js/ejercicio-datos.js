// ---------- Datos de Ejercicio (centro compartido) ----------
// Junta en un solo lugar lo que necesitan el mapa, el radar y el registro:
// la base de ejercicios (data/ejercicios.json), los ejercicios propios, las
// asignaciones de nombres no reconocidos, los ajustes (peso corporal y
// constantes) y los entrenamientos de Gimnasio (Running y Bicicleta se cargan
// solo para el respaldo; no entran en el cálculo del mapa). Cada
// vez que algo cambia en Firestore recalcula y avisa a quien escuche con
// EjercicioDatos.onCambio(cb). Firestore avisa al instante también de lo
// que se guarda sin conexión, así que el mapa reacciona sin recargar.
(function () {

const RUTA_BASE = "data/ejercicios.json?v=202609301";

const estado = {
  base: [], destacados: 0, propios: [], asignaciones: {}, ajustes: {},
  // Rangos: perfil (altura, pesajes), vínculos con el catálogo y el snapshot
  // del aviso "Nuevos rangos". snapshotRangos = undefined hasta que se lea.
  perfil: {}, rangosVinculos: {}, snapshotRangos: undefined,
  registros: { gimnasio: [], running: [], bicicleta: [] },
  // true cuando llegó una lectura confirmada por el servidor (no del caché)
  cargado: { base: false, gimnasio: false, running: false, bicicleta: false, ajustes: false },
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

// Para enterarse también de cuándo los datos pasan de "caché" a "confirmados
// por el servidor" (lo necesita el respaldo automático).
const CON_METADATOS = { includeMetadataChanges: true };
function delServidor(snap) {
  return !snap.metadata || !snap.metadata.fromCache;
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
    // Running y Bicicleta no pintan el mapa ni cuentan en sus estadísticas: se
    // siguen cargando (y respaldando) para usarlos más adelante en otra cosa.
    estado.datos = MuscleEngine.desdeRegistros({ gimnasio: estado.registros.gimnasio }, resolver);
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
  coleccion("entrenamientos").onSnapshot(CON_METADATOS, snap => {
    estado.registros.gimnasio = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (delServidor(snap)) estado.cargado.gimnasio = true;
    avisar();
  });
  coleccion("running").onSnapshot(CON_METADATOS, snap => {
    estado.registros.running = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (delServidor(snap)) estado.cargado.running = true;
    avisar();
  });
  coleccion("bicicleta").onSnapshot(CON_METADATOS, snap => {
    estado.registros.bicicleta = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (delServidor(snap)) estado.cargado.bicicleta = true;
    avisar();
  });
  meta("ajustes_ejercicio").onSnapshot(CON_METADATOS, doc => {
    estado.ajustes = (doc.exists && doc.data()) || {};
    if (delServidor(doc)) estado.cargado.ajustes = true;
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
  meta("perfil_ejercicio").onSnapshot(doc => {
    estado.perfil = (doc.exists && doc.data()) || {};
    avisar();
  });
  meta("rangos_vinculos").onSnapshot(doc => {
    estado.rangosVinculos = (doc.exists && doc.data()) || {};
    avisar();
  });
  meta("rangos_snapshot").onSnapshot(doc => {
    estado.snapshotRangos = (doc.exists && doc.data()) || null;
    avisar();
  });
});

window.EjercicioDatos = { estado, onCambio, config, ficha, resolver, buscar, meta, coleccion };
})();
