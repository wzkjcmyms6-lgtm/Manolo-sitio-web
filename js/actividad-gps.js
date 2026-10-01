// ---------- GPS y pantalla encendida (APIs del navegador) ----------
// Envoltorio fino de navigator.geolocation y navigator.wakeLock. No calcula
// nada (eso es js/actividad-motor.js). Límites reales en iPhone: el GPS solo
// llega con la pantalla encendida y Manolo al frente (docs/GPS.md).
(function () {

function disponible() {
  return !!(navigator.geolocation && navigator.geolocation.watchPosition);
}

// "granted" · "prompt" · "denied" · "desconocido" (Safari viejo no lo dice).
function permiso() {
  if (!navigator.permissions || !navigator.permissions.query) return Promise.resolve("desconocido");
  return navigator.permissions.query({ name: "geolocation" }).then(r => r.state).catch(() => "desconocido");
}

const ERRORES = {
  1: "Manolo no tiene permiso para usar tu ubicación.",
  2: "El GPS no está disponible. Revisa que la ubicación del teléfono esté activada.",
  3: "El GPS tarda en responder. Sal a cielo abierto y espera unos segundos."
};

// Empieza a recibir posiciones. Devuelve una función para detenerlo.
// alPunto({ lat, lon, t, acc, alt, altAcc }) · alError({ codigo, texto })
function vigilar(alPunto, alError) {
  if (!disponible()) {
    alError({ codigo: 2, texto: ERRORES[2] });
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(pos => {
    const c = pos.coords;
    // Si el teléfono entrega una posición vieja, se usa la hora actual.
    const t = Math.abs(pos.timestamp - Date.now()) < 60000 ? pos.timestamp : Date.now();
    alPunto({ lat: c.latitude, lon: c.longitude, t, acc: c.accuracy, alt: c.altitude, altAcc: c.altitudeAccuracy });
  }, err => {
    alError({ codigo: err.code, texto: ERRORES[err.code] || "No se pudo leer el GPS." });
  }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  return () => navigator.geolocation.clearWatch(id);
}

// ---- Pantalla encendida mientras corres ----
let bloqueo = null;
let quiere = false;
function pedirPantalla() {
  quiere = true;
  if (!("wakeLock" in navigator)) return Promise.resolve(false);
  return navigator.wakeLock.request("screen").then(b => {
    bloqueo = b;
    b.addEventListener("release", () => { if (bloqueo === b) bloqueo = null; });
    return true;
  }).catch(() => false);
}
function soltarPantalla() {
  quiere = false;
  if (bloqueo) bloqueo.release().catch(() => {});
  bloqueo = null;
}
// El sistema suelta el bloqueo al salir de la app: se pide de nuevo al volver.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && quiere && !bloqueo) pedirPantalla();
});

window.ActividadGps = { disponible, permiso, vigilar, pedirPantalla, soltarPantalla, pantallaActiva: () => !!bloqueo };
})();
