// ---------- Medir tiempos: se llena solo (fase 6) ----------
// Escucha a Running ("manolo:actividades"), Ejercicio, Libros y Movilidad
// ("manolo:fuente") y, con las reglas de js/tiempos-auto.js, escribe o
// corrige los tiempos automáticos de cada actividad que tiene "Se llena
// sola con…". Lo que anotas a mano siempre manda. D-113.
(function () {
"use strict";
const U = window.TiemposAuto;
if (!U || !window.Lectura) return;
const { hoyLocal } = window.Lectura;
const D = () => window.TiemposDatos || null;
const fuentes = {};      // id → { datos, servidor }
let reloj = null, enCurso = false;

function recibir(id, datos, servidor) {
  fuentes[id] = { datos, servidor: servidor !== false };
  programar();
}
function programar() { clearTimeout(reloj); reloj = setTimeout(sincronizar, 300); }

function sincronizar() {
  const d = D();
  if (!d || !d.listo() || enCurso) return;
  const hoy = hoyLocal(), docs = d.docs();
  const escrituras = [];
  d.actividades().filter(a => a.fuente && a.desde && !a.archivada).forEach(a => {
    const src = fuentes[a.fuente];
    if (!src) return;
    const p = U.plan(a, U.porDia(a.fuente, src.datos), docs, { hoy, servidor: src.servidor });
    Object.keys(p.poner).forEach(f => escrituras.push({ tipo: "poner", fecha: f, id: a.id, fuente: a.fuente, seg: p.poner[f] }));
    p.quitar.forEach(f => escrituras.push({ tipo: "quitar", fecha: f, id: a.id }));
  });
  if (!escrituras.length) return;
  enCurso = true;
  d.escribirAuto(escrituras).catch(err => console.warn("Medir tiempos (se llena solo):", err)).finally(() => { enCurso = false; });
}

window.addEventListener("manolo:actividades", e => { const x = e.detail || {}; if (x.coleccion === "running") recibir("running", x.docs || [], x.servidor); });
window.addEventListener("manolo:fuente", e => {
  const x = e.detail || {};
  if (x.fuente === "libros" || x.fuente === "movilidad" || x.fuente === "gimnasio") recibir(x.fuente, x.datos, x.servidor);
});
// Cuando cambian tus tiempos o tus actividades, se revisa de nuevo.
window.addEventListener("tiempos:datos", programar);

window.TiemposLlenar = { sincronizar };
})();
