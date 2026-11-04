// ---------- Running: datos compartidos entre pantallas ----------
// Las listas de running/ y bicicleta/ ya las escucha js/actividad-registro.js
// (avisa con el evento "manolo:actividades"); aquí se guardan para el
// detalle, el feed y el progreso sin leer nada dos veces. También los ajustes
// de Running (meta/running_ajustes). RunDatos.al(fn) avisa cada cambio.
(function () {
"use strict";
const listas = { running: [], bicicleta: [] };
let ajustes = {};
const oyentes = new Set();
const avisar = () => oyentes.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });

window.addEventListener("manolo:actividades", e => {
  const d = e.detail || {};
  if (!listas[d.coleccion]) return;
  listas[d.coleccion] = d.docs || [];
  avisar();
});
if (typeof onAuthReady === "function") onAuthReady(() => {
  db.collection("users").doc(currentUser.uid).collection("meta").doc("running_ajustes")
    .onSnapshot(s => { ajustes = s.exists ? s.data() || {} : {}; avisar(); }, () => {});
});

window.RunDatos = {
  lista: col => listas[col] || [],
  doc: (col, id) => (listas[col] || []).find(d => d.id === id) || null,
  ajustes: () => ajustes,
  // FC máx: la de Ajustes o la más alta vista (estimada, D-065).
  fcMax: () => Number(ajustes.fcMax) || listas.running.concat(listas.bicicleta).reduce((m, d) => Math.max(m, Number(d.fcMax) || 0), 0) || null,
  al: fn => { oyentes.add(fn); return () => oyentes.delete(fn); }
};
})();
