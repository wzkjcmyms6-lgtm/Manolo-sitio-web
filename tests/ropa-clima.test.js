// Ropa, el clima para vestirte (js/ropa-clima.js, D-149): el pronóstico de
// Open-Meteo de cualquier ciudad → el día de 7 a 21 h → lo que hace falta
// (capas, abrigo, lluvia, viento, sol), con cómo sientes el frío. Con días de
// verdad (2026-11-23) de dos climas muy distintos: La Paz (fresco, capas, sol
// muy fuerte) y Santa Cruz (calor, lluvia y tormenta, viento).
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../js/ropa-clima.js");
const LA_PAZ = require("./fixtures/clima/la-paz-2026-11-23.json");
const SANTA_CRUZ = require("./fixtures/clima/santa-cruz-2026-11-23.json");
const BUSCAR = require("./fixtures/clima/buscar-santa-cruz.json");

test("las direcciones: el pronóstico de 3 días en la hora de la ciudad y el buscador", () => {
  const u = new URL(C.urlPronostico(-16.4955, -68.1336));
  assert.equal(u.origin + u.pathname, "https://api.open-meteo.com/v1/forecast");
  assert.equal(u.searchParams.get("latitude"), "-16.5");
  assert.equal(u.searchParams.get("longitude"), "-68.13");
  assert.equal(u.searchParams.get("timezone"), "auto");
  assert.equal(u.searchParams.get("forecast_days"), "3");
  assert.match(u.searchParams.get("daily"), /apparent_temperature_min/);
  assert.match(u.searchParams.get("hourly"), /apparent_temperature/);
  assert.equal(C.urlBuscar("  Santa Cruz "), "https://geocoding-api.open-meteo.com/v1/search?name=Santa%20Cruz&count=8&language=es&format=json");
});

test("buscar una ciudad: las de tu país primero", () => {
  const cs = C.ciudades(BUSCAR, "BO");
  assert.deepEqual(cs[0], { nombre: "Santa Cruz de la Sierra", region: "Departamento de Santa Cruz", pais: "Bolivia", codigoPais: "BO", lat: -17.79, lon: -63.18, zona: "America/La_Paz", poblacion: 1831434 });
  assert.equal(cs[1].nombre, "Santa Cruz de Tenerife", "después, las más pobladas");
  assert.equal(C.ciudades(BUSCAR, "ES")[0].nombre, "Santa Cruz de Tenerife");
  assert.deepEqual(C.ciudades({}, "BO"), []);
  assert.equal(C.detalleCiudad(cs[0]), "Departamento de Santa Cruz, Bolivia");
  assert.equal(C.detalleCiudad(C.LA_PAZ), "Bolivia", "sin repetir el nombre");
  // Una ciudad guardada que no sirve → La Paz.
  assert.equal(C.ciudad(null).nombre, "La Paz");
  assert.equal(C.ciudad({ nombre: "X", lat: 200, lon: 0 }).nombre, "La Paz");
  assert.equal(C.ciudad(cs[0]).nombre, "Santa Cruz de la Sierra");
  assert.equal(C.mismaCiudad(C.LA_PAZ, { lat: -16.49, lon: -68.15 }), true);
  assert.equal(C.mismaCiudad(C.LA_PAZ, cs[0]), false);
});

test("el día de 7 a 21 h: la sensación de cuando estás fuera", () => {
  const [hoy, manana] = C.leer(LA_PAZ);
  assert.equal(hoy.fecha, "2026-11-23");
  assert.equal(hoy.sensMin, 9.3, "a las 7 (no los 5,5 de la madrugada)");
  assert.equal(hoy.horaFria, 7);
  assert.equal(hoy.sensMax, 19.5);
  assert.equal(hoy.horaCalida, 14);
  assert.equal(hoy.uv, 10.9);
  assert.equal(manana.lluvia, 97);
  assert.equal(C.diaDe(C.leer(LA_PAZ), "2026-11-24").lluvia, 97);
  assert.equal(C.diaDe(C.leer(LA_PAZ), "2030-01-01"), null);
  // Sin las horas: lo del día.
  const solo = C.leer({ daily: LA_PAZ.daily })[0];
  assert.equal(solo.sensMin, 5.5);
  assert.equal(solo.lluvia, 24);
  assert.deepEqual(C.leer(null), []);
  assert.equal(C.descripcion(0), "Despejado");
  assert.equal(C.descripcion(95), "Tormenta");
  assert.equal(C.descripcion(73), "Nieve");
});

test("La Paz: capas (mañana fresca, mediodía templado), abrigo y sol muy fuerte", () => {
  const [hoy, manana] = C.leer(LA_PAZ);
  const n = C.necesidades(hoy, "normal");
  assert.deepEqual(n, { bajo: 9.3, alto: 19.5, temp: 17.5, base: "templado", abrigo: "abrigo", capas: true, lluvia: "", tormenta: false, nieve: false, viento: false, sol: true });
  assert.deepEqual(C.consejos(n, hoy), [
    "Capas: a la mañana se siente 9 °C y al mediodía 20 °C. Sal con abrigo y te lo sacas.",
    "Sol muy fuerte (UV 11): gorra o sombrero y lentes."
  ]);
  assert.equal(C.resumen(hoy), "9 a 20 °C de sensación · Llovizna, 22 % de lluvia · UV 11");
  assert.equal(C.necesidades(manana, "normal").lluvia, "si", "mañana: 97 % de lluvia");
  // Cómo sientes el frío corre los límites 3 grados.
  const friolento = C.necesidades(hoy, "friolento"), caluroso = C.necesidades(hoy, "caluroso");
  assert.deepEqual([friolento.bajo, friolento.alto, friolento.abrigo], [6.3, 16.5, "abrigo"]);
  assert.deepEqual([caluroso.bajo, caluroso.alto, caluroso.abrigo], [12.3, 22.5, "liviano"]);
});

test("Santa Cruz: calor, lluvia, tormenta y viento", () => {
  const [hoy, manana] = C.leer(SANTA_CRUZ);
  const n = C.necesidades(hoy, "normal");
  assert.deepEqual(n, { bajo: 24.7, alto: 30.4, temp: 27.6, base: "calor", abrigo: "", capas: false, lluvia: "si", tormenta: false, nieve: false, viento: true, sol: true });
  assert.deepEqual(C.consejos(n, hoy), [
    "Calor (se siente hasta 30 °C): ropa liviana y fresca.",
    "Lluvia (55 %): paraguas o algo que no se moje, y mejor zapatos cerrados.",
    "Viento fuerte (ráfagas de 86 km/h): algo que corte el viento.",
    "Sol muy fuerte (UV 8): gorra o sombrero y lentes."
  ]);
  const m = C.necesidades(manana, "normal");
  assert.equal(m.tormenta, true);
  assert.match(C.consejos(m, manana)[1], /^Tormenta \(100 % de lluvia\)/);
  assert.equal(C.necesidades(hoy, "friolento").base, "calor", "aunque seas friolento, es calor");
});

test("otros climas: frío todo el día, fresco y nieve", () => {
  const dia = (sensMin, sensMax, extra) => Object.assign({ sensMin, sensMax, lluvia: 0, viento: 5, rafagas: 10, uv: 3, codigo: 1 }, extra || {});
  const frio = C.necesidades(dia(-4, 2), "normal");
  assert.deepEqual([frio.base, frio.abrigo, frio.capas], ["frio", "abrigo", false]);
  assert.equal(C.consejos(frio, dia(-4, 2))[0], "Frío todo el día (se siente de -4 °C a 2 °C): abrígate.");
  const fresco = C.necesidades(dia(13, 18), "normal");
  assert.deepEqual([fresco.base, fresco.abrigo, fresco.capas], ["templado", "liviano", false]);
  const nieve = C.necesidades(dia(-2, 1, { codigo: 73, lluvia: 80 }), "normal");
  assert.equal(nieve.nieve, true);
  assert.ok(C.consejos(nieve, dia(-2, 1, { codigo: 73, lluvia: 80 })).includes("Nieve: botas y abrigo."));
  assert.equal(C.necesidades(dia(20, 26), "normal").base, "calor");
  assert.equal(C.necesidades(dia(20, 26), "friolento").base, "templado");
  assert.equal(C.climaDe(11.9), "frio");
  assert.equal(C.climaDe(22), "calor");
  assert.match(C.paraIA(C.LA_PAZ, C.leer(LA_PAZ)[0], C.necesidades(C.leer(LA_PAZ)[0], "normal")), /^En La Paz \(Bolivia\): sensación de 9 a 20 °C/);
});

test("la fecha y la hora en la ciudad (aunque viajes)", () => {
  const ms = Date.parse("2026-11-24T02:30:00Z");
  assert.deepEqual(C.enLaCiudad(-14400, ms), { fecha: "2026-11-23", hora: 22 }, "en La Paz todavía es el 23");
  assert.deepEqual(C.enLaCiudad(3600, ms), { fecha: "2026-11-24", hora: 3 });
  assert.equal(C.manana("2026-11-30"), "2026-12-01");
});
