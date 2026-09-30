// Modo sin conexión de Manolo (para toda la app):
// - Registra el service worker (sw.js), que guarda la app en el teléfono.
// - Si hay una versión nueva descargada, muestra "Nueva versión disponible ·
//   Actualizar" y la activa solo cuando la persona toca el botón.
// - Muestra un aviso discreto "Sin conexión" en la barra de arriba.
// - Pide almacenamiento persistente para que el sistema no borre los datos
//   guardados en el teléfono (caché de la app y de Firestore).
(function () {
// ---------- Indicador "Sin conexión" ----------
function pintarRed() {
  const sin = navigator.onLine === false;
  document.querySelectorAll("[data-net-status]").forEach(el => { el.hidden = !sin; });
  document.documentElement.classList.toggle("sin-conexion", sin);
}
window.addEventListener("online", pintarRed);
window.addEventListener("offline", pintarRed);
document.addEventListener("DOMContentLoaded", pintarRed);
pintarRed();

// ---------- Almacenamiento persistente ----------
// El resultado queda en window.ManoloOffline para mostrarlo en Ajustes.
const estado = { persistente: null, version: null };
window.ManoloOffline = estado;
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persisted()
    .then(ya => (ya ? true : navigator.storage.persist()))
    .then(ok => { estado.persistente = !!ok; })
    .catch(() => { estado.persistente = false; });
}

if (!("serviceWorker" in navigator) || location.protocol === "file:") return;

// ---------- Aviso de versión nueva ----------
let aviso = null;
let actualizando = false;
function mostrarAviso(worker) {
  if (aviso) return;
  aviso = document.createElement("div");
  aviso.className = "app-aviso";
  aviso.setAttribute("role", "status");
  aviso.innerHTML = `<span>Nueva versión disponible</span><button type="button" class="app-aviso-btn">Actualizar</button>`;
  aviso.querySelector("button").addEventListener("click", () => {
    actualizando = true;
    aviso.querySelector("button").disabled = true;
    worker.postMessage({ tipo: "activar" });
  });
  document.body.appendChild(aviso);
}
// Solo se recarga cuando la persona pidió actualizar (la primera instalación
// también cambia de "controlador" y no debe recargar la página).
navigator.serviceWorker.addEventListener("controllerchange", () => {
  if (actualizando) location.reload();
});

window.addEventListener("load", () => {
  navigator.serviceWorker.register("sw.js")
    .then(reg => {
      if (!reg) return navigator.serviceWorker.ready;
      const vigilar = w => {
        if (!w) return;
        const listo = () => { if (w.state === "installed" && navigator.serviceWorker.controller) mostrarAviso(w); };
        listo();
        w.addEventListener("statechange", listo);
      };
      vigilar(reg.waiting || reg.installing);
      reg.addEventListener("updatefound", () => vigilar(reg.installing));
      // Al volver a la app (queda abierta en segundo plano), revisa si hay algo nuevo.
      document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
      return navigator.serviceWorker.ready;
    })
    .then(reg => {
      // Por si algo se cargó después (base de ejercicios, etc.), la página le
      // pasa al service worker la lista de lo que usó para que lo guarde.
      setTimeout(() => {
        const urls = performance.getEntriesByType("resource").map(r => r.name)
          .concat([location.href.split("#")[0]]);
        if (reg.active) reg.active.postMessage({ tipo: "guardar", urls });
      }, 4000);
      navigator.serviceWorker.addEventListener("message", e => {
        if (e.data && e.data.tipo === "version") estado.version = e.data.version;
      });
      if (reg.active) reg.active.postMessage({ tipo: "version" });
    })
    .catch(err => console.warn("Sin modo offline:", err));
});
})();
