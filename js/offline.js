// Registra el service worker (sw.js) y le pasa la lista de archivos que
// cargó esta página (scripts, estilos, datos, fuentes, Firebase) para que
// los guarde: así Manolo abre y funciona sin conexión en el iPhone.
(function () {
if (!("serviceWorker" in navigator) || location.protocol === "file:") return;

window.addEventListener("load", () => {
  navigator.serviceWorker.register("sw.js")
    .then(() => navigator.serviceWorker.ready)
    .then(reg => {
      // Espera un poco para incluir lo que se carga después (base de ejercicios).
      setTimeout(() => {
        const urls = performance.getEntriesByType("resource").map(r => r.name)
          .concat([location.href.split("#")[0]]);
        if (reg.active) reg.active.postMessage({ tipo: "guardar", urls });
      }, 4000);
    })
    .catch(err => console.warn("Sin modo offline:", err));
});
})();
