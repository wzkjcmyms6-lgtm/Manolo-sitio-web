(function () {
// Bicicleta: resumen semanal, historial y registro a mano
// (js/actividad-registro.js). Todo en users/{uid}/bicicleta.
// Lo que anotas a mano lleva tu bici predeterminada (Bici › Tus bicis, D-143).
ActividadRegistro.registro({ deporte: "bicicleta", coleccion: "bicicleta", prefijo: "cycling", item: "rodada",
  extra: () => {
    const lista = window.RunDatos && RunDatos.ajustesBici ? RunDatos.ajustesBici().bicis || [] : [];
    const b = lista.find(x => x.predeterminada && !x.retirada);
    return b ? { biciId: b.id } : {};
  } });
})();
