// ---------- Avisos de las rutinas: pitidos y voz (del propio teléfono) ----------
// - Pitidos con Web Audio (sin archivos ni internet).
// - Voz con speechSynthesis: la voz en español que trae el sistema. Ninguna
//   API de nube.
// - El iPhone solo deja sonar después de un toque: desbloquear() se llama en
//   el toque de "Iniciar". Con la pantalla bloqueada no suena (la app está
//   congelada); los pitidos respetan el modo silencio. Ver docs/GPS.md.
// - Sonido y voz se pueden apagar; la elección queda en el teléfono.
(function () {
const CLAVE = "manolo.avisos";
let prefs = { sonido: true, voz: true };
try { prefs = Object.assign(prefs, JSON.parse(localStorage.getItem(CLAVE) || "{}")); } catch (e) { /* sin almacenamiento */ }
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(prefs)); } catch (e) { /* sin almacenamiento */ }
}

let ctx = null;
function contexto() {
  if (ctx) return ctx;
  const A = window.AudioContext || window.webkitAudioContext;
  if (!A) return null;
  ctx = new A();
  return ctx;
}

// Voz en español del sistema (la lista llega tarde en algunos navegadores).
let voz = null;
function elegirVoz() {
  if (!window.speechSynthesis) return;
  const voces = speechSynthesis.getVoices();
  voz = voces.find(v => /^es[-_]ES/i.test(v.lang)) || voces.find(v => /^es/i.test(v.lang)) || null;
}
if (window.speechSynthesis) {
  elegirVoz();
  if (speechSynthesis.addEventListener) speechSynthesis.addEventListener("voiceschanged", elegirVoz);
}

// En el toque de Iniciar: activa el audio y la voz para el resto de la rutina.
function desbloquear() {
  // Los pitidos se mezclan con la música en vez de cortarla (iOS 17+).
  try { if (navigator.audioSession) navigator.audioSession.type = "transient"; } catch (e) { /* no soportado */ }
  const c = contexto();
  if (c && c.state !== "running") c.resume().catch(() => {});
  if (c) { const o = c.createOscillator(), g = c.createGain(); g.gain.value = 0; o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.01); }
  if (window.speechSynthesis && prefs.voz) {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    speechSynthesis.speak(u);
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && ctx && ctx.state !== "running") ctx.resume().catch(() => {});
});

// cuenta: un pitido corto · cambio: dos tonos · fin: tres tonos subiendo.
const TONOS = { cuenta: [[880, 0.12]], cambio: [[660, 0.16], [990, 0.24]], fin: [[523, 0.18], [659, 0.18], [784, 0.36]] };
function pitido(tipo) {
  if (!prefs.sonido) return;
  const c = contexto();
  if (!c) return;
  if (c.state !== "running") c.resume().catch(() => {});
  let t = c.currentTime + 0.02;
  (TONOS[tipo] || TONOS.cuenta).forEach(([f, d]) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.45, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + d + 0.02);
    t += d + 0.06;
  });
  if (navigator.vibrate) navigator.vibrate(tipo === "cuenta" ? 60 : [120, 60, 120]);
}

function hablar(texto) {
  if (!prefs.voz || !texto || !window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = voz ? voz.lang : "es-ES";
  if (voz) u.voice = voz;
  u.rate = 1;
  speechSynthesis.speak(u);
}

window.Avisos = {
  desbloquear, pitido, hablar,
  vozDisponible: () => !!window.speechSynthesis,
  sonidoDisponible: () => !!(window.AudioContext || window.webkitAudioContext),
  prefs: () => Object.assign({}, prefs),
  cambiar(clave, valor) { prefs[clave] = !!valor; guardar(); if (clave === "voz" && !valor && window.speechSynthesis) speechSynthesis.cancel(); }
};
})();
