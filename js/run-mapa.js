// ---------- Running: mapa de una ruta ----------
// Leaflet 1.9.4 vendorizado (D-068) se carga solo al abrir un mapa, con las
// teselas de OpenStreetMap oscurecidas por CSS y su atribución (D-009).
// Primero se ve el trazo SVG local (sirve sin internet); si Leaflet y las
// teselas cargan, lo reemplaza. Inicio en verde, fin en rojo y un cursor que
// mueve el gráfico. Al salir se libera (Leaflet deja oyentes si no).
(function () {
"use strict";
let carga = null;
function cargarLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (carga) return carga;
  carga = new Promise((res, rej) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "vendor/leaflet-1.9.4/leaflet.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "vendor/leaflet-1.9.4/leaflet.js";
    s.onload = () => (window.L ? res(window.L) : rej(new Error("Leaflet")));
    s.onerror = () => { carga = null; rej(new Error("Leaflet")); };
    document.head.appendChild(s);
  });
  return carga;
}

// Dibuja la ruta en el elemento. Devuelve un control:
// { mover(lat, lon), ocultarCursor(), destruir(), ampliar(bool) }.
function crear(el, tramos, opciones) {
  const o = Object.assign({ alto: 240 }, opciones || {});
  const conGps = (tramos || []).map(t => t.filter(p => p.lat != null)).filter(t => t.length);
  const ctl = { mapa: null, cursor: null, destruido: false };
  el.innerHTML = conGps.length ? RunVista.svgRuta(conGps, { ancho: 340, alto: o.alto, clase: "run-ruta run-ruta-mapa" }) : "";
  ctl.mover = () => {};
  ctl.ocultarCursor = () => {};
  ctl.destruir = () => { ctl.destruido = true; if (ctl.mapa) { ctl.mapa.remove(); ctl.mapa = null; } };
  ctl.ampliar = () => {};
  ctl.resaltar = () => {};
  if (!conGps.length || navigator.onLine === false) return ctl;
  cargarLeaflet().then(L => {
    if (ctl.destruido || !el.isConnected) return;
    const div = document.createElement("div");
    div.className = "run-leaflet";
    el.innerHTML = "";
    el.appendChild(div);
    const movil = L.Browser.mobile;
    const mapa = L.map(div, { zoomControl: !movil, dragging: !movil, scrollWheelZoom: false, tap: false, attributionControl: true });
    ctl.mapa = mapa;
    const capa = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
    }).addTo(mapa);
    const lineas = conGps.map(t => L.polyline(t.map(p => [p.lat, p.lon]), { color: "#ff7a30", weight: 4, opacity: 0.95 }).addTo(mapa));
    const ini = conGps[0][0], ul = conGps[conGps.length - 1], fin = ul[ul.length - 1];
    L.circleMarker([fin.lat, fin.lon], { radius: 7, color: "#0a0a0a", weight: 2, fillColor: "#e2593f", fillOpacity: 1 }).addTo(mapa);
    L.circleMarker([ini.lat, ini.lon], { radius: 7, color: "#0a0a0a", weight: 2, fillColor: "#4cc38a", fillOpacity: 1 }).addTo(mapa);
    const limites = L.featureGroup(lineas).getBounds();
    mapa.fitBounds(limites, { padding: [22, 22], maxZoom: 17 });
    ctl.mover = (lat, lon) => {
      if (lat == null || !ctl.mapa) return;
      if (!ctl.cursor) ctl.cursor = L.circleMarker([lat, lon], { radius: 7, color: "#fff", weight: 3, fillColor: "#ff7a30", fillOpacity: 1, interactive: false }).addTo(mapa);
      else ctl.cursor.setLatLng([lat, lon]);
    };
    ctl.ocultarCursor = () => { if (ctl.cursor) { ctl.cursor.remove(); ctl.cursor = null; } };
    // Un tramo resaltado encima de la ruta (vista previa de un segmento).
    ctl.resaltar = pts => {
      if (!ctl.mapa) return;
      if (ctl.resalte) { ctl.resalte.remove(); ctl.resalte = null; }
      if (pts && pts.length > 1) ctl.resalte = L.polyline(pts.map(p => [p.lat, p.lon]), { color: "#4cc38a", weight: 7, opacity: 0.95, interactive: false }).addTo(mapa);
    };
    ctl.ampliar = grande => {
      setTimeout(() => {
        if (!ctl.mapa) return;
        mapa.invalidateSize();
        if (movil) { grande ? mapa.dragging.enable() : mapa.dragging.disable(); }
        if (grande && movil && !mapa.zoomControl) L.control.zoom({ position: "bottomright" }).addTo(mapa);
        mapa.fitBounds(limites, { padding: [22, 22], maxZoom: 17 });
      }, 60);
    };
    // Sin teselas (se cortó la red): vuelve el trazo propio.
    let fallos = 0;
    capa.on("tileerror", () => {
      if (++fallos === 6 && el.isConnected && ctl.mapa) {
        ctl.destruir();
        el.innerHTML = RunVista.svgRuta(conGps, { ancho: 340, alto: o.alto, clase: "run-ruta run-ruta-mapa" });
      }
    });
  }).catch(() => { /* queda el trazo SVG */ });
  return ctl;
}

window.RunMapa = { crear, cargarLeaflet };
})();
