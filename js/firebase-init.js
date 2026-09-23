// Configuración del proyecto de Firebase de Manolo.
// Estas claves no son secretas (es normal que estén visibles en el código);
// la seguridad real la dan las reglas de Firestore, que solo dejan leer o
// escribir a un usuario autenticado dentro de su propia carpeta de datos.
const firebaseConfig = {
  apiKey: "AIzaSyA1_QACgxjbotfNajIx2jSk6pUOSTmwZ5c",
  authDomain: "manolo-4c57b.firebaseapp.com",
  projectId: "manolo-4c57b",
  storageBucket: "manolo-4c57b.firebasestorage.app",
  messagingSenderId: "852272071245",
  appId: "1:852272071245:web:7aa04222d69d3f2d291204",
  measurementId: "G-XF741H42NZ"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
