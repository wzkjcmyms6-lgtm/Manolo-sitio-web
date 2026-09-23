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

const googleProvider = new firebase.auth.GoogleAuthProvider();

function translateAuthError(code) {
  const map = {
    "auth/invalid-email": "Ese correo no es válido.",
    "auth/user-not-found": "No existe una cuenta con ese correo.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/too-many-requests": "Demasiados intentos. Probá de nuevo en unos minutos.",
    "auth/network-request-failed": "Sin conexión. Revisá tu internet.",
    "auth/unauthorized-domain": "Este sitio todavía no está autorizado para iniciar sesión con Google (falta agregarlo en Firebase).",
    "auth/account-exists-with-different-credential": "Ese correo ya está registrado con otro método de acceso."
  };
  return map[code] || "No se pudo iniciar sesión. Intentá de nuevo.";
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const errorEl = document.getElementById("login-error");

  form.addEventListener("submit", e => {
    e.preventDefault();
    errorEl.hidden = true;
    const email = document.getElementById("login-email").value.trim();
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

  // Resultado de volver de Google (signInWithRedirect manda a otra página y
  // vuelve); si falló, mostramos el error acá.
  auth.getRedirectResult().catch(err => {
    errorEl.textContent = translateAuthError(err.code);
    errorEl.hidden = false;
  });

  // Delegados: estos botones los arma modules.js (logout) o viven en el
  // login, así que pueden no existir todavía cuando este listener se registra.
  document.addEventListener("click", e => {
    if (e.target.closest("#logout-btn")) auth.signOut();
    if (e.target.closest("#google-login-btn")) auth.signInWithRedirect(googleProvider);
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
