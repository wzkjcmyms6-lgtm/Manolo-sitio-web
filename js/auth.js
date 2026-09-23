// Pantalla de login que protege todo el sitio. Cada página avisa cuándo
// puede empezar a leer sus datos de Firestore usando onAuthReady(), en vez
// de arrancar apenas carga el archivo (todavía no habría usuario).
let currentUser = null;
const authReadyCallbacks = [];

function onAuthReady(callback) {
  if (currentUser) callback(currentUser);
  else authReadyCallbacks.push(callback);
}

function showApp() {
  document.getElementById("login-screen").hidden = true;
  document.getElementById("app-content").hidden = false;
}
function showLogin() {
  document.getElementById("login-screen").hidden = false;
  document.getElementById("app-content").hidden = true;
}

// Firebase Auth solo entiende "correo + contraseña" por dentro; para que
// vos veas un login simple de usuario + contraseña, convertimos el nombre
// de usuario a una dirección interna que nunca se muestra ni se usa para
// enviar nada (ej: "Manolo" -> "manolo@manolo-panel.local").
function usernameToEmail(username) {
  const clean = username.trim().toLowerCase().replace(/\s+/g, "");
  return clean + "@manolo-panel.local";
}

function translateAuthError(code) {
  const map = {
    "auth/invalid-email": "Ese usuario no es válido.",
    "auth/user-not-found": "No existe una cuenta con ese usuario.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Usuario o contraseña incorrectos.",
    "auth/too-many-requests": "Demasiados intentos. Probá de nuevo en unos minutos.",
    "auth/network-request-failed": "Sin conexión. Revisá tu internet."
  };
  return map[code] || "No se pudo iniciar sesión. Intentá de nuevo.";
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const errorEl = document.getElementById("login-error");

  form.addEventListener("submit", e => {
    e.preventDefault();
    errorEl.hidden = true;
    const email = usernameToEmail(document.getElementById("login-username").value);
    const password = document.getElementById("login-password").value;
    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;

    auth.signInWithEmailAndPassword(email, password)
      .catch(err => {
        errorEl.textContent = translateAuthError(err.code);
        errorEl.hidden = false;
      })
      .finally(() => { submitBtn.disabled = false; });
  });

  // Delegado: el botón de "Cerrar sesión" lo arma modules.js dentro del
  // menú, así que puede no existir todavía cuando este listener se registra.
  document.addEventListener("click", e => {
    if (e.target.closest("#logout-btn")) auth.signOut();
  });

  auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      showApp();
      authReadyCallbacks.forEach(cb => cb(user));
      authReadyCallbacks.length = 0;
    } else if (currentUser) {
      // Se cerró la sesión con la página abierta: recargar limpia todo
      // (listeners de Firestore, datos en memoria, formularios).
      window.location.reload();
    } else {
      showLogin();
    }
  });
});
