// ---------- Hábitos: plantillas para crear más rápido (datos y lógica pura) ----------
// Hábitos comunes en español con tipo, meta, frecuencia, momento y versión
// mínima sugeridos, por categoría. Si la categoría sugerida (Fe, Lectura,
// Cuidado personal, Hogar) no existe, se usa la alternativa (alt). Al tocar
// una, el formulario se llena y se puede editar antes de guardar.
// Tests: tests/habitos-plantillas.test.js
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HabitosPlantillas = factory();
})(typeof self !== "undefined" ? self : this, function () {

// P(id, nombre, emoji, tipo, opciones)
const P = (id, nombre, emoji, tipo, o) => Object.assign({ id, nombre, emoji, tipo, freqType: "diario", timeOfDay: "cualquiera", dificultad: "media", minima: "" }, o);
const LISTA = [
  // Cuerpo
  P("agua", "Tomar agua", "💧", "medible", { meta: 8, unidad: "vasos", cat: "cuerpo", minima: "1 vaso", dificultad: "facil" }),
  P("caminar", "Caminar", "🚶", "medible", { meta: 8000, unidad: "pasos", cat: "cuerpo", minima: "10 minutos" }),
  P("correr", "Correr", "🏃", "sino", { freqType: "semana", timesPerWeek: 3, timeOfDay: "tarde", cat: "cuerpo", minima: "Trotar 10 minutos", dificultad: "dificil", vinculo: "running" }),
  P("fuerza", "Entrenar fuerza", "🏋️", "sino", { freqType: "semana", timesPerWeek: 3, timeOfDay: "tarde", cat: "cuerpo", minima: "10 flexiones", dificultad: "dificil", vinculo: "gimnasio" }),
  P("bici", "Andar en bici", "🚴", "sino", { freqType: "semana", timesPerWeek: 2, cat: "cuerpo", vinculo: "bicicleta" }),
  P("estirar", "Estirar", "🤸", "tiempo", { meta: 10, timeOfDay: "manana", cat: "cuerpo", minima: "1 minuto", dificultad: "facil", vinculo: "movilidad" }),
  P("dormir", "Dormir 7 horas", "😴", "sino", { timeOfDay: "noche", cat: "cuerpo", minima: "Acostarme antes de las 23:30" }),
  P("verduras", "Comer fruta o verdura", "🥗", "sino", { cat: "cuerpo", minima: "Una fruta", dificultad: "facil" }),
  P("azucar", "Sin azúcar", "🍬", "evitar", { cat: "cuerpo" }),
  P("alcohol", "Sin alcohol", "🍺", "evitar", { cat: "cuerpo" }),
  // Mente / Lectura
  P("leer", "Leer", "📖", "medible", { meta: 20, unidad: "páginas", timeOfDay: "noche", cat: "lectura", alt: "mente", minima: "1 página", vinculo: "libros", medida: "paginas" }),
  P("idioma", "Practicar un idioma", "🗣️", "tiempo", { meta: 15, cat: "mente", minima: "5 minutos" }),
  P("diario", "Escribir un diario", "✍️", "sino", { timeOfDay: "noche", cat: "mente", minima: "Una frase", dificultad: "facil" }),
  P("estudiar", "Estudiar", "🎓", "tiempo", { meta: 30, cat: "mente", minima: "10 minutos", dificultad: "dificil" }),
  P("aprender", "Aprender algo nuevo", "🧩", "sino", { freqType: "semana", timesPerWeek: 3, cat: "mente" }),
  // Dinero
  P("gastos", "Anotar mis gastos", "🧾", "sino", { timeOfDay: "noche", cat: "dinero", minima: "Anotar el más grande", dificultad: "facil", vinculo: "finanzas" }),
  P("ahorrar", "Separar mi ahorro", "🐷", "sino", { freqType: "semana", timesPerWeek: 1, cat: "dinero" }),
  P("impulso", "Sin compras por impulso", "🛒", "evitar", { cat: "dinero", vinculo: "gasto" }),
  P("inversiones", "Revisar mis inversiones", "📈", "sino", { freqType: "semana", timesPerWeek: 1, cat: "dinero", dificultad: "facil" }),
  // Carrera
  P("planificar", "Planificar el día", "📋", "sino", { timeOfDay: "manana", cat: "carrera", minima: "Anotar 3 prioridades", dificultad: "facil" }),
  P("profundo", "Trabajo profundo", "⏰", "tiempo", { meta: 60, timeOfDay: "manana", cat: "carrera", minima: "15 minutos", dificultad: "dificil" }),
  P("correo", "Bandeja de entrada en cero", "📧", "sino", { freqType: "dias", days: [true, true, true, true, true, false, false], timeOfDay: "tarde", cat: "carrera" }),
  P("redes", "Sin redes en horas de trabajo", "📵", "evitar", { cat: "carrera" }),
  // Bienestar
  P("meditar", "Meditar", "🧘", "tiempo", { meta: 10, timeOfDay: "manana", cat: "bienestar", minima: "3 respiraciones" }),
  P("agradecer", "Agradecer 3 cosas", "🌅", "sino", { timeOfDay: "noche", cat: "bienestar", minima: "Una cosa", dificultad: "facil" }),
  P("sol", "Tomar sol", "☀️", "sino", { timeOfDay: "manana", cat: "bienestar", dificultad: "facil" }),
  P("pantalla", "Sin pantalla antes de dormir", "📱", "evitar", { cat: "bienestar" }),
  P("desconectar", "Desconectar 30 minutos", "🌿", "tiempo", { meta: 30, timeOfDay: "noche", cat: "bienestar", minima: "5 minutos" }),
  // Social
  P("familia", "Llamar a la familia", "📞", "sino", { freqType: "semana", timesPerWeek: 2, cat: "social" }),
  P("amigo", "Escribirle a un amigo", "💬", "sino", { freqType: "semana", timesPerWeek: 3, cat: "social", dificultad: "facil" }),
  P("calidad", "Tiempo de calidad en familia", "🫂", "sino", { freqType: "semana", timesPerWeek: 3, timeOfDay: "noche", cat: "social" }),
  // Fe
  P("orar", "Orar", "🙏", "sino", { timeOfDay: "manana", cat: "fe", alt: "bienestar", minima: "Un minuto en silencio" }),
  P("biblia", "Leer la Biblia", "📖", "sino", { timeOfDay: "manana", cat: "fe", alt: "bienestar", minima: "Un versículo", vinculo: "biblia" }),
  // Cuidado personal
  P("hilo", "Usar hilo dental", "🦷", "sino", { timeOfDay: "noche", cat: "cuidado", alt: "cuerpo", dificultad: "facil" }),
  P("piel", "Rutina de piel", "🧴", "sino", { timeOfDay: "noche", cat: "cuidado", alt: "cuerpo", dificultad: "facil" }),
  // Hogar
  P("cama", "Tender la cama", "🛏️", "sino", { timeOfDay: "manana", cat: "hogar", dificultad: "facil" }),
  P("ordenar", "Ordenar 10 minutos", "🧹", "tiempo", { meta: 10, timeOfDay: "noche", cat: "hogar", minima: "Una superficie", dificultad: "facil" }),
  P("plantas", "Regar las plantas", "🪴", "sino", { freqType: "cadaN", cadaN: 3, timeOfDay: "manana", cat: "hogar", dificultad: "facil" }),
  P("platos", "Lavar los platos el mismo día", "🍽️", "sino", { timeOfDay: "noche", cat: "hogar", dificultad: "facil" })
];

const sinTildes = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// La categoría que le toca con las que tienes (activas): la sugerida o su alternativa.
function categoriaDe(p, categorias) {
  const act = (categorias || []).filter(c => !c.archivada);
  if (act.some(c => c.id === p.cat)) return p.cat;
  if (p.alt && act.some(c => c.id === p.alt)) return p.alt;
  return null;
}

// Buscar por nombre o por categoría (sin tildes). Vacío = todas.
function buscar(q, categorias) {
  const t = sinTildes(q).trim();
  const nombreCat = id => { const c = (categorias || []).find(x => x.id === id); return c ? sinTildes(c.nombre) : ""; };
  if (!t) return LISTA.slice();
  return LISTA.filter(p => sinTildes(p.nombre).includes(t) || nombreCat(categoriaDe(p, categorias)).includes(t) || sinTildes(p.unidad || "").includes(t));
}

// Agrupadas por la categoría que les toca, en el orden de tus categorías.
function grupos(lista, categorias) {
  const cats = (categorias || []).filter(c => !c.archivada);
  const out = cats.map(c => ({ id: c.id, nombre: c.nombre, emoji: c.emoji, color: c.color, items: [] }));
  const otras = { id: null, nombre: "Otras", items: [] };
  lista.forEach(p => { const id = categoriaDe(p, categorias); const g = out.find(x => x.id === id); (g || otras).items.push(p); });
  return out.concat([otras]).filter(g => g.items.length);
}

// Campos del formulario (js/habitos.js formDesde) a partir de una plantilla.
function aForm(p, categorias) {
  return {
    name: p.nombre, emoji: p.emoji, tipo: p.tipo,
    meta: p.meta != null ? p.meta : "", unidad: p.unidad || "",
    freqType: p.tipo === "evitar" ? "diario" : p.freqType,
    days: Array.isArray(p.days) ? p.days.slice() : [true, true, true, true, true, true, true],
    timesPerWeek: p.timesPerWeek || 3, cadaN: p.cadaN || 2,
    timeOfDay: p.timeOfDay, dificultad: p.dificultad,
    area: categoriaDe(p, categorias), minima: p.minima || "",
    vinculo: p.vinculo || "", vinculoMedida: p.medida || "",
    plantilla: p.id
  };
}

return { LISTA, categoriaDe, buscar, grupos, aForm };
});
