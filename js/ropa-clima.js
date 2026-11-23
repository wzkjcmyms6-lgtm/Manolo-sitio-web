// ---------- Ropa: el clima del día para vestirte (sin pantalla, D-149) ----------
// Para cualquier ciudad (la eliges tú; nunca se usa tu ubicación) y cualquier
// clima: el pronóstico de Open-Meteo (gratis, sin clave y con CORS; el mismo
// de Running) → el día de 7 a 21 h, cuando estás fuera (la sensación térmica,
// la lluvia, el viento y el sol) → lo que hace falta: la ropa de qué clima
// (frío, templado o calor), capas si la mañana y el mediodía son muy
// distintos (como en La Paz), abrigo, algo para la lluvia, el viento, la
// nieve o el sol. "Cómo sientes el frío" (friolento, normal o caluroso) corre
// los límites 3 grados. Buscar ciudades: el buscador de Open-Meteo.
// Pruebas: tests/ropa-clima.test.js (con días de verdad de La Paz y Santa Cruz).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RopaClima = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

// La ciudad de siempre al empezar (se cambia en Outfits o en Ajustes de Ropa).
const LA_PAZ = { nombre: "La Paz", region: "La Paz", pais: "Bolivia", codigoPais: "BO", lat: -16.5, lon: -68.15, zona: "America/La_Paz" };
const r2 = v => Math.round(v * 100) / 100;
const r1 = v => Math.round(v * 10) / 10;
const redondo = v => Math.round(v);

// ---- Las direcciones ----
const DIARIO = ["weather_code", "temperature_2m_max", "temperature_2m_min", "apparent_temperature_max", "apparent_temperature_min",
  "precipitation_probability_max", "precipitation_sum", "wind_speed_10m_max", "wind_gusts_10m_max", "uv_index_max"];
const POR_HORA = ["temperature_2m", "apparent_temperature", "precipitation_probability", "weather_code", "wind_speed_10m"];
// Tres días (hoy, mañana y, de noche, pasado), en la hora de la ciudad.
const urlPronostico = (lat, lon) => `https://api.open-meteo.com/v1/forecast?latitude=${r2(lat)}&longitude=${r2(lon)}&daily=${DIARIO.join(",")}&hourly=${POR_HORA.join(",")}&timezone=auto&forecast_days=3`;
const urlBuscar = nombre => `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(String(nombre || "").trim().slice(0, 80))}&count=8&language=es&format=json`;

// Lo que devolvió el buscador → ciudades: las de tu país primero y, dentro de
// cada país, las más pobladas.
function ciudades(json, codigoPais) {
  const rs = json && Array.isArray(json.results) ? json.results : [];
  const txt = (v, n) => String(v == null ? "" : v).slice(0, n);
  return rs.filter(x => x && x.name && typeof x.latitude === "number" && typeof x.longitude === "number")
    .map(x => ({ nombre: txt(x.name, 60), region: txt(x.admin1, 60), pais: txt(x.country, 40), codigoPais: txt(x.country_code, 2).toUpperCase(), lat: r2(x.latitude), lon: r2(x.longitude), zona: txt(x.timezone, 40), poblacion: x.population || 0 }))
    .sort((a, b) => (b.codigoPais === codigoPais) - (a.codigoPais === codigoPais) || b.poblacion - a.poblacion);
}
// Una ciudad guardada (de Ajustes o de las recientes) → completa y segura.
function ciudad(c) {
  const o = c && typeof c === "object" ? c : {};
  if (typeof o.lat !== "number" || typeof o.lon !== "number" || !isFinite(o.lat) || !isFinite(o.lon) || Math.abs(o.lat) > 90 || Math.abs(o.lon) > 180 || !o.nombre) return Object.assign({}, LA_PAZ);
  const txt = (v, n) => String(v == null ? "" : v).slice(0, n);
  return { nombre: txt(o.nombre, 60), region: txt(o.region, 60), pais: txt(o.pais, 40), codigoPais: txt(o.codigoPais, 2), lat: r2(o.lat), lon: r2(o.lon), zona: txt(o.zona, 40) };
}
const mismaCiudad = (a, b) => !!(a && b && Math.abs(a.lat - b.lat) < 0.02 && Math.abs(a.lon - b.lon) < 0.02);
// "Departamento de Santa Cruz, Bolivia" (sin repetir el nombre).
const detalleCiudad = c => [c.region !== c.nombre ? c.region : "", c.pais].filter(Boolean).join(", ");

// ---- El pronóstico ----
// json de Open-Meteo → [{ fecha, min, max, sensMin, sensMax, horaFria,
// horaCalida, lluvia (%), lluviaMm, viento, rafagas (km/h), uv, codigo }].
// La sensación y la lluvia son de 7 a 21 h (si vienen las horas).
function leer(json) {
  const d = json && json.daily, h = json && json.hourly;
  if (!d || !Array.isArray(d.time)) return [];
  return d.time.map((fecha, i) => {
    const v = k => (Array.isArray(d[k]) && typeof d[k][i] === "number" ? d[k][i] : null);
    const horas = [];
    if (h && Array.isArray(h.time)) {
      h.time.forEach((t, j) => {
        if (String(t).slice(0, 10) !== fecha) return;
        const hora = Number(String(t).slice(11, 13));
        if (!(hora >= 7 && hora <= 21)) return;
        const x = k => (Array.isArray(h[k]) && typeof h[k][j] === "number" ? h[k][j] : null);
        horas.push({ hora, sens: x("apparent_temperature"), lluvia: x("precipitation_probability") });
      });
    }
    const conSens = horas.filter(x => x.sens != null);
    const fria = conSens.reduce((a, x) => (!a || x.sens < a.sens ? x : a), null);
    const calida = conSens.reduce((a, x) => (!a || x.sens > a.sens ? x : a), null);
    const lluvias = horas.map(x => x.lluvia).filter(x => x != null);
    const sensMin = fria ? fria.sens : v("apparent_temperature_min");
    const sensMax = calida ? calida.sens : v("apparent_temperature_max");
    return {
      fecha, min: v("temperature_2m_min"), max: v("temperature_2m_max"),
      sensMin: sensMin == null ? null : r1(sensMin), sensMax: sensMax == null ? null : r1(sensMax),
      horaFria: fria ? fria.hora : null, horaCalida: calida ? calida.hora : null,
      lluvia: lluvias.length ? Math.max(...lluvias) : v("precipitation_probability_max"),
      lluviaMm: v("precipitation_sum"), viento: v("wind_speed_10m_max"), rafagas: v("wind_gusts_10m_max"), uv: v("uv_index_max"), codigo: v("weather_code")
    };
  }).filter(x => x.sensMin != null && x.sensMax != null);
}
const diaDe = (dias, fecha) => (dias || []).find(x => x.fecha === fecha) || null;
// La fecha y la hora en la ciudad (el pronóstico trae su diferencia con UTC).
function enLaCiudad(offsetSeg, ms) {
  const d = new Date((ms == null ? Date.now() : ms) + (Number(offsetSeg) || 0) * 1000);
  return { fecha: d.toISOString().slice(0, 10), hora: d.getUTCHours() };
}
const manana = fecha => new Date(Date.parse(`${fecha}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);

// Códigos WMO → "Despejado", "Lluvia"…
function descripcion(cod) {
  if (cod == null) return "";
  if (cod === 0) return "Despejado";
  if (cod <= 2) return "Parcialmente nublado";
  if (cod === 3) return "Nublado";
  if (cod === 45 || cod === 48) return "Niebla";
  if (cod >= 51 && cod <= 57) return "Llovizna";
  if ((cod >= 61 && cod <= 67) || (cod >= 80 && cod <= 82)) return "Lluvia";
  if ((cod >= 71 && cod <= 77) || cod === 85 || cod === 86) return "Nieve";
  if (cod >= 95) return "Tormenta";
  return "";
}
const esLluvia = cod => cod != null && ((cod >= 51 && cod <= 67) || (cod >= 80 && cod <= 82) || cod >= 95);
const esNieve = cod => cod != null && ((cod >= 71 && cod <= 77) || cod === 85 || cod === 86);

// ---- Lo que hace falta ----
const SENSACIONES = [["friolento", "Friolento", "Siento más frío que los demás"], ["normal", "Normal", ""], ["caluroso", "Caluroso", "Siento más calor que los demás"]];
const AJUSTE = { friolento: -3, normal: 0, caluroso: 3 };
const climaDe = t => (t < 12 ? "frio" : t < 22 ? "templado" : "calor");
// d: un día de leer(); sensacion: "friolento" | "normal" | "caluroso".
// → { bajo, alto (la sensación ya corrida), base (el clima de la ropa de abajo
// del abrigo), abrigo ("abrigo" | "liviano" | ""), capas, lluvia ("si" |
// "quizas" | ""), tormenta, nieve, viento, sol }
function necesidades(d, sensacion) {
  const aj = AJUSTE[sensacion] || 0;
  const bajo = r1(d.sensMin + aj), alto = r1(d.sensMax + aj);
  // Capas: la mañana fresca y el mediodía bastante más cálido.
  const capas = alto - bajo >= 9 && bajo < 18;
  // La temperatura que manda (con capas, la de casi mediodía: el abrigo te lo sacas).
  const t = capas ? alto - 2 : (bajo + alto) / 2;
  const base = climaDe(t);
  const abrigo = bajo < 10 ? "abrigo" : bajo < 16 ? "liviano" : "";
  const p = d.lluvia || 0;
  const lluvia = p >= 60 || (esLluvia(d.codigo) && p >= 40) ? "si" : p >= 30 ? "quizas" : "";
  return {
    bajo, alto, temp: r1(t), base, abrigo, capas, lluvia,
    tormenta: d.codigo != null && d.codigo >= 95,
    nieve: esNieve(d.codigo),
    // Ráfagas de 50 en La Paz son de todos los días: el aviso es para más que eso.
    viento: (d.rafagas || 0) >= 60 || (d.viento || 0) >= 30,
    sol: (d.uv || 0) >= 8
  };
}
// Los consejos del día, en palabras simples.
function consejos(n, d) {
  const c = [];
  const g = t => `${redondo(t)} °C`;
  if (n.capas) c.push(`Capas: a la mañana se siente ${g(d.sensMin)} y al mediodía ${g(d.sensMax)}. Sal con ${n.abrigo === "abrigo" ? "abrigo" : "algo liviano encima"} y te lo sacas.`);
  else if (n.abrigo === "abrigo") c.push(`Frío todo el día (se siente de ${g(d.sensMin)} a ${g(d.sensMax)}): abrígate.`);
  else if (n.abrigo === "liviano") c.push(`Fresco (se siente de ${g(d.sensMin)} a ${g(d.sensMax)}): lleva algo liviano encima.`);
  else if (n.base === "calor") c.push(`Calor (se siente hasta ${g(d.sensMax)}): ropa liviana y fresca.`);
  else c.push(`Templado (se siente de ${g(d.sensMin)} a ${g(d.sensMax)}).`);
  if (n.tormenta) c.push(`Tormenta (${d.lluvia || 0} % de lluvia): algo que no se moje y zapatos cerrados.`);
  else if (n.lluvia === "si") c.push(`Lluvia (${d.lluvia} %): paraguas o algo que no se moje, y mejor zapatos cerrados.`);
  else if (n.lluvia === "quizas") c.push(`Puede llover (${d.lluvia} %): lleva paraguas por si acaso.`);
  if (n.nieve) c.push("Nieve: botas y abrigo.");
  if (n.viento) c.push(`Viento fuerte (ráfagas de ${redondo(d.rafagas || d.viento || 0)} km/h): algo que corte el viento.`);
  if (n.sol) c.push(`Sol muy fuerte (UV ${redondo(d.uv)}): gorra o sombrero y lentes.`);
  return c;
}
// Un renglón: "6 a 20 °C de sensación · Llovizna, 24 % de lluvia · UV 11".
function resumen(d) {
  const desc = descripcion(d.codigo);
  return [`${redondo(d.sensMin)} a ${redondo(d.sensMax)} °C de sensación`,
    [desc, d.lluvia ? `${d.lluvia} % de lluvia` : ""].filter(Boolean).join(", "),
    d.uv != null ? `UV ${redondo(d.uv)}` : ""].filter(Boolean).join(" · ");
}
// Para la IA (y para guardar con el outfit): lo justo, en texto.
function paraIA(c, d, n) {
  return `En ${c.nombre}${c.pais ? ` (${c.pais})` : ""}: sensación de ${redondo(n.bajo)} a ${redondo(n.alto)} °C (de 7 a 21 h; ya ajustada a cómo siente el frío), ${descripcion(d.codigo).toLowerCase() || "sin datos del cielo"}, ${d.lluvia || 0} % de lluvia, viento de ${redondo(d.viento || 0)} km/h (ráfagas de ${redondo(d.rafagas || 0)}), UV ${redondo(d.uv || 0)}.`;
}

return { LA_PAZ, DIARIO, POR_HORA, urlPronostico, urlBuscar, ciudades, ciudad, mismaCiudad, detalleCiudad, leer, diaDe, enLaCiudad, manana, descripcion, SENSACIONES, AJUSTE, climaDe, necesidades, consejos, resumen, paraIA };
});
