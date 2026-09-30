// Saludo de Inicio: "Bienvenido, Manolo" / "Bienvenida, Lentina".
// El nombre sale del usuario con el que entraste (primera letra en
// mayúscula). Si te saluda en masculino o femenino se guarda en tu propia
// carpeta de datos (users/{uid}/meta/perfil → saludo), nunca en el código:
// el repositorio es público. La primera vez la app pregunta con un toque; a
// partir de ahí queda guardado (y en el teléfono, para que abra al instante
// y sin conexión).
(function () {
const titulo = document.getElementById("saludo-inicio");
const eleccion = document.getElementById("saludo-eleccion");
if (!titulo || !eleccion) return;

function nombreDe(user) {
  const u = (user && user.email ? user.email.split("@")[0] : "").trim();
  return u ? u.charAt(0).toUpperCase() + u.slice(1) : "";
}
function clave(user) {
  return "manolo.saludo." + user.uid;
}
function leerLocal(user) {
  try { return localStorage.getItem(clave(user)); } catch (e) { return null; }
}
function guardarLocal(user, v) {
  try { localStorage.setItem(clave(user), v); } catch (e) { /* sin almacenamiento */ }
}

function pintar(user, saludo) {
  const nombre = nombreDe(user);
  const valido = saludo === "bienvenido" || saludo === "bienvenida";
  const palabra = saludo === "bienvenida" ? "Bienvenida" : saludo === "bienvenido" ? "Bienvenido" : "Te damos la bienvenida";
  titulo.textContent = nombre ? `${palabra}, ${nombre}` : palabra;
  eleccion.hidden = valido;
}

onAuthReady(user => {
  pintar(user, leerLocal(user));
  const ref = db.collection("users").doc(user.uid).collection("meta").doc("perfil");
  ref.onSnapshot(doc => {
    const saludo = doc.exists ? doc.data().saludo : null;
    if (saludo === "bienvenido" || saludo === "bienvenida") guardarLocal(user, saludo);
    // Sin dato en la nube todavía (o sin conexión): se usa lo del teléfono.
    pintar(user, saludo || leerLocal(user));
  }, () => pintar(user, leerLocal(user)));

  eleccion.addEventListener("click", e => {
    const b = e.target.closest("[data-saludo]");
    if (!b) return;
    const saludo = b.dataset.saludo;
    guardarLocal(user, saludo);
    pintar(user, saludo);
    ref.set({ saludo }, { merge: true }).catch(err => console.error("Manolo: no se pudo guardar el saludo", err));
  });
});
})();
