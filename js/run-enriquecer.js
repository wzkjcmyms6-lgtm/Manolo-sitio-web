// ---------- Running: clima y lugar de cada actividad (sin pantalla) ----------
// Después de importar, en segundo plano (D-066):
// - Clima a la hora del inicio con Open-Meteo (gratis, sin clave, CC BY 4.0):
//   pronóstico con fecha pasada para los últimos ~85 días y el archivo
//   histórico para lo anterior (verificado 2026-11-04: ambos con CORS).
// - Lugar aproximado (barrio, ciudad) con Nominatim de OpenStreetMap (ODbL,
//   máx. 1 pedido por segundo).
// Solo se envían coordenadas redondeadas (clima a 2 decimales ≈ 1 km; lugar
// a 3 ≈ 100 m, nivel barrio): nunca la ruta ni datos del dueño. Se guarda en
// la actividad (`clima`, `lugar`) y un caché de lugares en el teléfono.
// fetch, guardar y esperar se inyectan (pruebas: tests/run-enriquecer.test.js).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RunEnriquecer = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const DIA = 86400000;
const r = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
const diaUtc = ms => new Date(ms).toISOString().slice(0, 10);

function urlClima(lat, lon, inicio, ahora) {
  const base = ahora - inicio < 85 * DIA ? "https://api.open-meteo.com/v1/forecast" : "https://archive-api.open-meteo.com/v1/archive";
  const dia = diaUtc(inicio);
  return `${base}?latitude=${r(lat, 2)}&longitude=${r(lon, 2)}&start_date=${dia}&end_date=${dia}` +
    "&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&timezone=GMT";
}
// La hora más cercana al inicio (las horas vienen en UTC por timezone=GMT).
function leerClima(json, inicio) {
  const h = json && json.hourly;
  if (!h || !Array.isArray(h.time) || !h.time.length) return null;
  let mejor = -1, dif = Infinity;
  h.time.forEach((t, i) => {
    const ms = Date.parse(t + (/[zZ]$/.test(t) ? "" : "Z"));
    if (Math.abs(ms - inicio) < dif) { dif = Math.abs(ms - inicio); mejor = i; }
  });
  if (mejor < 0 || dif > 2 * 3600000) return null;
  const v = k => (Array.isArray(h[k]) && typeof h[k][mejor] === "number" ? h[k][mejor] : null);
  const out = { tC: v("temperature_2m"), sensC: v("apparent_temperature"), hum: v("relative_humidity_2m"), vientoKmh: v("wind_speed_10m"), cod: v("weather_code") };
  if (out.tC == null) return null;
  Object.keys(out).forEach(k => { if (out[k] == null) delete out[k]; else out[k] = Math.round(out[k] * 10) / 10; });
  return out;
}
// Códigos WMO → texto corto en español.
function textoClima(cod) {
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

function claveLugar(lat, lon) { return `${r(lat, 3)},${r(lon, 3)}`; }
function urlLugar(lat, lon) {
  return `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${r(lat, 3)}&lon=${r(lon, 3)}&zoom=14&accept-language=es`;
}
// "Sopocachi, La Paz": barrio y ciudad, sin "Municipio …".
function leerLugar(json) {
  const a = json && json.address;
  if (!a) return null;
  const barrio = a.quarter || a.neighbourhood || a.suburb || a.village || a.hamlet || a.town || null;
  let ciudad = (a.city || a.town || a.village || a.municipality || a.county || "").replace(/^municipio\s+(de\s+)?/i, "").trim();
  if (a.state && ciudad && ciudad !== a.state && ciudad.endsWith(a.state)) ciudad = a.state;
  if (!ciudad) ciudad = a.state || a.country || "";
  const partes = [barrio, ciudad].filter(Boolean).filter((x, i, l) => l.indexOf(x) === i);
  return partes.length ? partes.join(", ").slice(0, 80) : null;
}

// Primer punto de la ruta (de la mini ruta guardada).
function puntoInicio(doc, leerMini) {
  const pts = doc && doc.mini ? leerMini(doc.mini) : [];
  return pts.length ? pts[0] : null;
}

// Completa clima y lugar de las actividades que no los tienen.
// deps = { fetch, guardar(id, col, campos) → Promise, esperar(ms) → Promise,
//          cache: { get(clave), set(clave, valor) }, leerMini, ahora }
// Devuelve cuántas se completaron. Si falla la red, se detiene (se reintenta otra vez).
async function completar(docs, deps) {
  let hechas = 0, ultimoNominatim = -Infinity;
  for (const d of docs) {
    const p = puntoInicio(d, deps.leerMini);
    if (!p || !(d.inicio > 0)) continue;
    const campos = {};
    try {
      if (!d.clima) {
        const res = await deps.fetch(urlClima(p.lat, p.lon, d.inicio, deps.ahora));
        if (res.ok) {
          const c = leerClima(await res.json(), d.inicio);
          if (c) campos.clima = c;
        }
      }
      if (!d.lugar) {
        const k = claveLugar(p.lat, p.lon);
        let lugar = deps.cache && deps.cache.get(k);
        if (!lugar) {
          const falta = 1100 - (Date.now() - ultimoNominatim);
          if (falta > 0) await deps.esperar(falta);
          ultimoNominatim = Date.now();
          const res = await deps.fetch(urlLugar(p.lat, p.lon));
          if (res.ok) {
            lugar = leerLugar(await res.json());
            if (lugar && deps.cache) deps.cache.set(k, lugar);
          }
        }
        if (lugar) campos.lugar = lugar;
      }
    } catch (e) {
      break; // sin internet: se intenta la próxima vez
    }
    if (Object.keys(campos).length) {
      await deps.guardar(d.id, d.col, campos);
      hechas++;
    }
  }
  return hechas;
}

return { urlClima, leerClima, textoClima, urlLugar, leerLugar, claveLugar, completar };
});
