// ---------- Hábitos: categorías (lógica pura, sin DOM ni Firebase) ----------
// Las "áreas de vida" son las categorías: mismos ids (cuerpo, mente, dinero,
// carrera, bienestar, social) y los nombres que el dueño les puso. Cada una
// tiene nombre, emoji, color (de una paleta cerrada), orden y archivada.
// Viven en meta/habitos_juego.categorias = { id: { nombre, emoji, color,
// orden, archivada, borrada, creada } } y, si no existe, se arman al leer
// desde prefs.areas (migración en lectura: nunca se reescribe nada).
// Cada hábito guarda el id en `area`. Tests: tests/habitos-categorias.test.js
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./habitos-config.js"));
  else root.HabitosCategorias = factory(root.HabitosConfig);
})(typeof self !== "undefined" ? self : this, function (CFG) {

const MAX = 16;          // categorías activas a la vez (10 vienen de fábrica)
const NOMBRE_MAX = 20;

// Paleta cerrada: colores claros que se leen sobre el fondo oscuro y no
// chocan con el naranja y dorado de Manolo.
const PALETA = [
  { id: "coral", nombre: "Coral", color: "#f2716b" },
  { id: "rosa", nombre: "Rosa", color: "#f472b6" },
  { id: "violeta", nombre: "Violeta", color: "#a78bfa" },
  { id: "indigo", nombre: "Índigo", color: "#818cf8" },
  { id: "azul", nombre: "Azul", color: "#60a5fa" },
  { id: "celeste", nombre: "Celeste", color: "#22d3ee" },
  { id: "turquesa", nombre: "Turquesa", color: "#2dd4bf" },
  { id: "verde", nombre: "Verde", color: "#4ade80" },
  { id: "lima", nombre: "Lima", color: "#a3e635" },
  { id: "piedra", nombre: "Piedra", color: "#a8a29e" }
];
// De fábrica: las 6 áreas de siempre y, desde 2026-11-05, las 4 que eligió
// el dueño (D-088). Se arman al leer; solo se guarda lo que cambies.
const EXTRAS = [
  { id: "fe", nombre: "Fe" },
  { id: "lectura", nombre: "Lectura" },
  { id: "cuidado", nombre: "Cuidado personal" },
  { id: "hogar", nombre: "Hogar" }
];
const BASE = CFG.AREAS.concat(EXTRAS);
const DEFECTO = {
  cuerpo: { emoji: "💪", color: "coral" },
  mente: { emoji: "🧠", color: "violeta" },
  dinero: { emoji: "💰", color: "verde" },
  carrera: { emoji: "💼", color: "azul" },
  bienestar: { emoji: "🌿", color: "turquesa" },
  social: { emoji: "🤝", color: "rosa" },
  fe: { emoji: "🙏", color: "indigo" },
  lectura: { emoji: "📚", color: "celeste" },
  cuidado: { emoji: "💆", color: "lima" },
  hogar: { emoji: "🏠", color: "piedra" }
};
// Propuestas para crear con un toque (las de la fase 0 ya vienen de fábrica).
const SUGERIDAS = [];
// Categorías más específicas: ganan a las generales al sugerir (Lectura > Mente).
const ESPECIFICAS = new Set(EXTRAS.map(e => e.id));

const esObjeto = v => !!v && typeof v === "object" && !Array.isArray(v);
const texto = v => (typeof v === "string" ? v.trim() : "");
const idValido = id => typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,39}$/.test(id);
const sinTildes = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function colorDe(c) {
  const id = c && typeof c === "object" ? c.color : c;
  return (PALETA.find(p => p.id === id) || PALETA[0]).color;
}

function normalizar(d, id, orden) {
  return {
    id,
    nombre: texto(d.nombre).slice(0, NOMBRE_MAX) || "Categoría",
    emoji: texto(d.emoji) || "🏷️",
    color: PALETA.some(p => p.id === d.color) ? d.color : PALETA[0].id,
    orden: Number.isFinite(Number(d.orden)) && d.orden !== null && d.orden !== "" ? Number(d.orden) : orden,
    archivada: !!d.archivada,
    borrada: !!d.borrada,
    defecto: !!DEFECTO[id],
    creada: Number(d.creada) || null
  };
}

// Todas las categorías (también las archivadas; nunca las borradas), en orden.
function leer(juego) {
  const j = esObjeto(juego) ? juego : {};
  const guardadas = esObjeto(j.categorias) ? j.categorias : {};
  const viejos = esObjeto(j.prefs) && esObjeto(j.prefs.areas) ? j.prefs.areas : {};
  const out = [];
  // Una propia con el mismo nombre que una de fábrica nueva (p. ej. "Fe"
  // creada a mano con otro id) evita que aparezca repetida.
  const propias = new Set(Object.keys(guardadas).filter(id => !DEFECTO[id] && esObjeto(guardadas[id]) && !guardadas[id].borrada).map(id => sinTildes(texto(guardadas[id].nombre))));
  BASE.forEach((a, i) => {
    if (!guardadas[a.id] && EXTRAS.some(e => e.id === a.id) && propias.has(sinTildes(a.nombre))) return;
    const base = { nombre: texto(viejos[a.id]) || a.nombre, emoji: DEFECTO[a.id].emoji, color: DEFECTO[a.id].color, orden: i + 1 };
    const g = esObjeto(guardadas[a.id]) ? guardadas[a.id] : {};
    // Lo guardado manda campo por campo (un nombre vacío no borra el de antes).
    const d = Object.assign({}, base);
    Object.keys(g).forEach(k => { if (g[k] != null && g[k] !== "") d[k] = g[k]; });
    out.push(normalizar(d, a.id, i + 1));
  });
  Object.keys(guardadas).forEach((id, i) => {
    if (DEFECTO[id] || !idValido(id) || !esObjeto(guardadas[id])) return;
    out.push(normalizar(guardadas[id], id, 100 + i));
  });
  return out.filter(c => !c.borrada).sort((a, b) => a.orden - b.orden || (a.creada || 0) - (b.creada || 0) || a.id.localeCompare(b.id));
}
const activas = lista => lista.filter(c => !c.archivada);
const porId = lista => { const m = {}; lista.forEach(c => { m[c.id] = c; }); return m; };

// Categoría de un hábito (null si no tiene o ya no existe).
function deHabito(h, lista) {
  const id = h && h.area;
  return (id && lista.find(c => c.id === id)) || null;
}

// Cuántos hábitos la usan (activos y en total, archivados incluidos).
function usos(id, habitos) {
  let activos = 0, total = 0;
  (habitos || []).forEach(h => { if (h && h.area === id) { total++; if (!h.archivado) activos++; } });
  return { activos, total };
}

function slug(nombre) {
  return sinTildes(nombre).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "cat";
}

// Valida y prepara una categoría nueva. Devuelve { ok, id, doc } o { ok:false, error }.
// juego: para no repetir ids, ni siquiera de categorías borradas.
function crear(lista, datos, juego, ahora) {
  const nombre = texto(datos && datos.nombre).slice(0, NOMBRE_MAX);
  if (!nombre) return { ok: false, error: "Ponle un nombre a la categoría." };
  if (activas(lista).length >= MAX) return { ok: false, error: `Puedes tener hasta ${MAX} categorías activas. Archiva una para crear otra.` };
  const igual = lista.find(c => sinTildes(c.nombre) === sinTildes(nombre));
  if (igual) return { ok: false, error: igual.archivada ? `Ya tienes «${igual.nombre}» archivada: restáurala desde Categorías.` : `Ya tienes una categoría «${igual.nombre}».` };
  const usados = new Set(lista.map(c => c.id).concat(Object.keys((juego && juego.categorias) || {}), Object.keys(DEFECTO)));
  let id = (datos.id && idValido(datos.id) && !usados.has(datos.id)) ? datos.id : slug(nombre);
  for (let n = 2; usados.has(id); n++) id = `${slug(nombre)}-${n}`;
  const orden = lista.reduce((m, c) => Math.max(m, c.orden), 0) + 1;
  const doc = { nombre, emoji: texto(datos.emoji) || "🏷️", color: PALETA.some(p => p.id === datos.color) ? datos.color : siguienteColor(lista), orden, archivada: false, creada: ahora || Date.now() };
  return { ok: true, id, doc };
}
// El primer color de la paleta que todavía no usa ninguna activa.
function siguienteColor(lista) {
  const usados = new Set(activas(lista).map(c => c.color));
  return (PALETA.find(p => !usados.has(p.id)) || PALETA[activas(lista).length % PALETA.length]).id;
}

// Cambios de nombre, emoji o color: devuelve solo los campos válidos.
function editar(lista, id, cambios) {
  const c = lista.find(x => x.id === id);
  if (!c) return { ok: false, error: "Esa categoría ya no existe." };
  const out = {};
  if (cambios.nombre != null) {
    const nombre = texto(cambios.nombre).slice(0, NOMBRE_MAX);
    if (!nombre) return { ok: false, error: "Ponle un nombre a la categoría." };
    const igual = lista.find(x => x.id !== id && sinTildes(x.nombre) === sinTildes(nombre));
    if (igual) return { ok: false, error: `Ya tienes una categoría «${igual.nombre}».` };
    out.nombre = nombre;
  }
  if (cambios.emoji != null && texto(cambios.emoji)) out.emoji = texto(cambios.emoji);
  if (cambios.color != null && PALETA.some(p => p.id === cambios.color)) out.color = cambios.color;
  return { ok: true, cambios: out };
}

// Nuevo orden (ids de arriba abajo): { id: { orden } } solo de lo que cambia.
function reordenar(lista, ids) {
  const out = {};
  const vistos = new Set();
  let n = 0;
  ids.concat(lista.map(c => c.id)).forEach(id => {
    if (vistos.has(id) || !lista.some(c => c.id === id)) return;
    vistos.add(id);
    n++;
    if (lista.find(c => c.id === id).orden !== n) out[id] = { orden: n };
  });
  return out;
}

// Archivar siempre se puede (el historial sigue en las estadísticas).
// Borrar, solo si ningún hábito (ni archivado) la usa nunca.
function puedeBorrar(id, habitos) {
  return usos(id, habitos).total === 0;
}

// Asignar en lote: solo cambia `area` de los que de verdad cambian.
function asignar(habitos, ids, area) {
  const set = new Set(ids);
  return (habitos || []).filter(h => set.has(h.id) && (h.area || null) !== (area || null)).map(h => ({ id: h.id, area: area || null }));
}

// Sugeridas que todavía no existen (ni por id ni por nombre).
function sugeridas(lista, juego) {
  const guardadas = (juego && juego.categorias) || {};
  return SUGERIDAS.filter(s => !lista.some(c => c.id === s.id || sinTildes(c.nombre) === sinTildes(s.nombre)) && !guardadas[s.id]);
}

// ---------- Sugerir categoría al crear un hábito (reglas simples) ----------
const PALABRAS = {
  cuerpo: ["agua", "correr", "trotar", "caminar", "pasos", "gimnasio", "gym", "entrenar", "entreno", "ejercicio", "pesas", "flexiones", "abdominales", "sentadillas", "bici", "bicicleta", "nadar", "natacion", "estirar", "estiramiento", "movilidad", "yoga", "dormir", "sueno", "fruta", "verdura", "proteina", "comer", "cenar", "desayunar", "azucar", "alcohol", "vitamina", "deporte", "cardio", "peso", "dieta", "cuerpo"],
  mente: ["estudiar", "aprender", "idioma", "ingles", "frances", "curso", "escribir", "diario", "journal", "ajedrez", "podcast", "practicar", "memorizar", "mente", "pensar", "leer"],
  dinero: ["gasto", "gastos", "ahorrar", "ahorro", "invertir", "inversion", "presupuesto", "finanzas", "deuda", "dinero", "cuentas", "comprar", "antojo", "antojos", "tarjeta"],
  carrera: ["trabajo", "trabajar", "proyecto", "correo", "correos", "email", "reunion", "codigo", "programar", "clientes", "ventas", "oficina", "carrera", "negocio", "tareas", "planificar", "planear"],
  bienestar: ["meditar", "meditacion", "respirar", "respiracion", "gratitud", "agradecer", "descansar", "desconectar", "pantalla", "redes", "celular", "sol", "naturaleza", "relajar", "terapia", "paz", "calma", "musica", "orar", "rezar", "oracion"],
  social: ["llamar", "mama", "papa", "familia", "amigo", "amigos", "amiga", "pareja", "esposa", "esposo", "hijos", "hijo", "hija", "visitar", "mensaje", "abuela", "abuelo", "social"],
  fe: ["orar", "rezar", "oracion", "biblia", "misa", "iglesia", "devocional", "dios", "fe", "salmo", "rosario", "versiculo"],
  lectura: ["leer", "lectura", "libro", "libros", "paginas", "capitulo", "novela", "kindle"],
  cuidado: ["scalping", "masaje", "piel", "crema", "dientes", "hilo", "dental", "cabello", "pelo", "skincare", "protector", "afeitar", "unas", "cuidado"],
  hogar: ["limpiar", "ordenar", "cocinar", "lavar", "ropa", "plantas", "regar", "cama", "basura", "barrer", "platos", "hogar", "casa", "mascota", "perro", "gato"]
};
const EMOJIS = {
  cuerpo: "💪🏃🚶🏋🚴🏊🤸🧗🥾💧🥗🍎🥦🥑🛌😴⚖🍬🍺🍷🍔🍟🍩🥤",
  mente: "🧠✍📝🎯💡🧩♟🎓🗣🌍🎧🔤📓🤔",
  dinero: "💰💵🪙🏦📈🐷💳🧾💹🤑📉🧮💸",
  carrera: "💼💻⏰📅📊📧📌🗂🚀⌛🖊📋🎙🏢",
  bienestar: "🧘🌿🌅🌙☀🌳🛀😊🎵🌊✨🧖☮🌸📵",
  social: "👨📞💬🤝💌🎁🫂🥰👋🎉👫🙌",
  fe: "🙏🕯📿✝⛪",
  lectura: "📖📚",
  cuidado: "💆🧴🦷🪥🧼💅",
  hogar: "🧹🧺🧽🛏🪴🌱🐶🐱🗑🛒🔧🏠🍽"
};
// Devuelve el id de la categoría activa que mejor encaja, o null.
function sugerir(nombre, emoji, lista) {
  const act = activas(lista || []);
  if (!act.length) return null;
  const palabras = sinTildes(nombre).split(/[^a-z0-9ñ]+/).filter(Boolean);
  const e = texto(emoji);
  let mejor = null;
  act.forEach((c, i) => {
    const claves = new Set(PALABRAS[c.id] || []);
    // Las categorías propias también encajan por su nombre ("Guitarra" → "guitarra").
    sinTildes(c.nombre).split(/[^a-z0-9ñ]+/).filter(w => w.length >= 3).forEach(w => claves.add(w));
    let puntos = 0;
    palabras.forEach(w => {
      if (claves.has(w)) puntos += 2;
      else if (w.length >= 4 && [...claves].some(k => k.length >= 4 && (w.startsWith(k) || k.startsWith(w)))) puntos += 1;
    });
    if (e && EMOJIS[c.id] && Array.from(e).some(ch => ch.length && EMOJIS[c.id].includes(ch) && /\p{Extended_Pictographic}/u.test(ch))) puntos += 1.5;
    // Lo específico (Fe, Lectura… o una propia) gana a lo general (Mente) en un empate.
    const extra = DEFECTO[c.id] && !ESPECIFICAS.has(c.id) ? 0 : 0.5;
    if (puntos > 0 && (!mejor || puntos + extra > mejor.p)) mejor = { id: c.id, p: puntos + extra, i };
  });
  return mejor ? mejor.id : null;
}

// Equilibrio entre categorías: qué ejes mostrar (las que tuvieron algo que
// hacer en el periodo, activas o archivadas) y cómo: radar con 3 a 8 ejes;
// con menos o con más, barras horizontales. filas: areasPeriodo del motor.
const RADAR_MIN = 3, RADAR_MAX = 8;
function equilibrio(filas) {
  const ejes = (filas || []).filter(a => a.esperados > 0);
  return { forma: ejes.length >= RADAR_MIN && ejes.length <= RADAR_MAX ? "radar" : "barras", ejes };
}

return { MAX, NOMBRE_MAX, PALETA, DEFECTO, SUGERIDAS, colorDe, leer, activas, porId, deHabito, usos, crear, editar,
  reordenar, puedeBorrar, asignar, sugeridas, sugerir, siguienteColor, slug, equilibrio, RADAR_MIN, RADAR_MAX };
});
