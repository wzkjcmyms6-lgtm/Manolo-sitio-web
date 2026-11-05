// Datos de prueba realistas para Hábitos (auditoría y scripts/e2e/habitos.js):
// 9 hábitos de tipos distintos, ~3 meses de historia con ~80 % de
// constancia (pseudoaleatoria, siempre igual), dos sin área, una cadena y
// los nombres de áreas que eligió el dueño.
const E = require("../../js/habitos-engine.js");

function azar(semilla) {
  let s = semilla >>> 0;
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}
const T = (fecha, hora) => new Date(`${fecha}T${hora || "08:30"}:00-04:00`).getTime();

// hoy: "AAAA-MM-DD" (fecha de la prueba). dias: cuántos días de historia.
function semilla(hoy, opciones) {
  const o = Object.assign({ dias: 95, constancia: 0.8 }, opciones);
  const inicio = E.addDias(hoy, -o.dias);
  const rnd = azar(42);
  const base = (orden, extra) => Object.assign({ v: 2, days: [true, true, true, true, true, true, true], done: [], registros: {}, createdAt: T(inicio, "07:00"), inicio, orden, dificultad: "media", freqType: "diario" }, extra);
  const H = {
    agua: base(1, { name: "Tomar agua", emoji: "💧", tipo: "medible", meta: 8, unidad: "vasos", timeOfDay: "manana", area: "cuerpo" }),
    meditar: base(2, { name: "Meditar", emoji: "🧘", tipo: "sino", timeOfDay: "manana", area: "bienestar", minima: "3 respiraciones" }),
    orar: base(3, { name: "Orar", emoji: "🙏", tipo: "sino", timeOfDay: "manana", area: null, despuesDe: "meditar" }),
    estirar: base(4, { name: "Estirar", emoji: "🤸", tipo: "sino", timeOfDay: "tarde", area: null, dificultad: "facil" }),
    correr: base(5, { name: "Correr", emoji: "🏃", tipo: "sino", freqType: "semana", timesPerWeek: 3, timeOfDay: "tarde", area: "cuerpo", dificultad: "dificil" }),
    leer: base(6, { name: "Leer", emoji: "📖", tipo: "tiempo", meta: 20, unidad: "min", timeOfDay: "noche", area: "mente" }),
    gastos: base(7, { name: "Anotar mis gastos", emoji: "🧾", tipo: "sino", timeOfDay: "noche", area: "dinero", dificultad: "facil" }),
    mama: base(8, { name: "Llamar a mamá", emoji: "📞", tipo: "sino", freqType: "dias", days: [false, false, true, false, false, false, true], timeOfDay: "cualquiera", area: "social" }),
    azucar: base(9, { name: "Sin azúcar", emoji: "🍬", tipo: "evitar", timeOfDay: "cualquiera", area: "cuerpo" })
  };
  for (let k = 0; k < o.dias; k++) {
    const f = E.addDias(inicio, k);
    const wd = E.diaSemana(f);
    const t = T(f, "08:30");
    if (rnd() < o.constancia) H.agua.registros[f] = { v: rnd() < 0.8 ? 8 : 5, t };
    if (rnd() < o.constancia) { H.meditar.registros[f] = { e: rnd() < 0.15 ? "minima" : "hecho", t }; H.meditar.done.push(f); }
    if (rnd() < o.constancia - 0.1) { H.orar.registros[f] = { e: "hecho", t }; H.orar.done.push(f); }
    if (rnd() < 0.6) { H.estirar.registros[f] = { e: "hecho", t }; H.estirar.done.push(f); }
    if ([1, 3, 5].includes(wd) && rnd() < o.constancia) { H.correr.registros[f] = { e: "hecho", t: T(f, "18:10") }; H.correr.done.push(f); }
    if (rnd() < o.constancia) H.leer.registros[f] = { v: rnd() < 0.85 ? 20 : 10, t: T(f, "22:00") };
    if (rnd() < o.constancia) { H.gastos.registros[f] = { e: "hecho", t: T(f, "21:00") }; H.gastos.done.push(f); }
    if (H.mama.days[wd] && rnd() < 0.85) { H.mama.registros[f] = { e: "hecho", t }; H.mama.done.push(f); }
    if (rnd() < 0.05) H.azucar.registros[f] = { e: "recaida", t };
  }
  // Hoy: algo hecho y algo pendiente.
  [hoy].forEach(f => {
    ["agua", "meditar", "orar", "estirar", "leer", "gastos", "mama", "azucar"].forEach(id => { delete H[id].registros[f]; });
    H.agua.registros[f] = { v: 3, t: T(f, "08:00") };
    H.meditar.registros[f] = { e: "hecho", t: T(f, "07:30") };
  });
  const juego = { prefs: { areas: { dinero: "Finanzas", bienestar: "Paz" } } };
  return { habitos: H, juego };
}

// Estado para abrir() de comun.js (users/test/…).
function estado(hoy, opciones) {
  const s = semilla(hoy, opciones);
  return { __SEED__: { "users/test/habitos": s.habitos, "users/test/meta": { habitos_juego: s.juego } } };
}

module.exports = { semilla, estado, azar };
