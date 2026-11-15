// ---------- Libros: estadísticas nuevas y "Tu año en libros" (pantalla, fase 5e) ----------
// En Estadísticas (libros.js deja los huecos data-lest="…"): calendario de
// días leídos (‹ mes ›, tocar un día dice qué leíste), tiempo leyendo,
// velocidad y su tendencia, tus autores y el botón de "Tu año en libros".
// Arriba de Libros, del 15 de diciembre al 31 de enero, la tarjeta del año
// que se cierra. La hoja del año se puede compartir como imagen.
// Lógica en js/libros-estadisticas.js. D-112.
(function () {
"use strict";
const E = window.LibrosEstadisticas, L = window.LibrosMotor;
if (!E || !L || !window.Lectura) return;
const { esc, hoyLocal } = window.Lectura;
const D = () => window.LibrosDatos || null;
const hoja = window.Lectura.hoja("lanio-hoja");
const nf = n => Number(n).toLocaleString("es-ES");
const coma = n => String(n).replace(".", ",");
let mesCal = null;      // mes que muestra el calendario ("2026-11")
let anioHoja = null;    // año abierto en la hoja
const DIAS_SEM = ["L", "M", "M", "J", "V", "S", "D"];
const DIAS_LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
function fechaLarga(f) {
  const dia = (new Date(f + "T12:00:00Z").getUTCDay() + 6) % 7;
  return `${DIAS_LARGOS[dia]} ${Number(f.slice(8, 10))} de ${E.MESES[Number(f.slice(5, 7)) - 1]}`;
}
const leidoTxt = x => [x.paginas ? `${nf(x.paginas)} ${x.paginas === 1 ? "página" : "páginas"}` : "", x.pct ? `${coma(x.pct)} % del audiolibro` : "", x.min ? E.duracion(x.min) : ""].filter(Boolean).join(", ");

// ---------- Estadísticas ----------
function pintar(raiz) {
  const d = D();
  if (!raiz || !d) return;
  const libros = d.lista(), hoy = hoyLocal(), dias = E.porDia(libros);
  const poner = (que, html) => { const el = raiz.querySelector(`[data-lest="${que}"]`); if (el) el.innerHTML = html; };
  poner("anio", botonAnio(libros, hoy));
  poner("calendario", calendario(libros, hoy, dias));
  poner("tiempo", tiempo(libros, hoy, dias));
  poner("velocidad", velocidad(libros, hoy));
  poner("autores", autores(libros));
}
function botonAnio(libros, hoy) {
  const anio = Number(hoy.slice(0, 4)), r = E.anio(libros, [], anio);
  const anios = E.aniosConLibros(libros);
  const cual = r.terminados ? anio : anios[anios.length - 1];
  if (!cual) return "";
  return `<button type="button" class="lanio-boton" data-lanio-abrir="${cual}"><span aria-hidden="true">🎉</span><b>Tu año en libros ${cual}</b><span class="lanio-ir" aria-hidden="true">›</span></button>`;
}

// Calendario del mes, con ‹ › para ir y volver.
function calendario(libros, hoy, dias) {
  const mesHoy = hoy.slice(0, 7);
  if (!mesCal || mesCal > mesHoy) mesCal = mesHoy;
  const c = E.calendario(libros, mesCal, hoy, D().metaDia(), dias);
  const celda = x => {
    if (!x) return `<span class="lest-dia is-vacio" aria-hidden="true"></span>`;
    const que = x.futuro ? "todavía no" : E.leido(x) ? leidoTxt(x) : "sin lectura";
    return `<button type="button" class="lest-dia n${x.nivel}${x.hoy ? " is-hoy" : ""}" data-lest-dia="${x.fecha}"${x.futuro ? " disabled" : ""} aria-label="${x.dia} de ${E.MESES[Number(x.fecha.slice(5, 7)) - 1]}: ${esc(que)}">${x.dia}</button>`;
  };
  const resumen = c.leidos
    ? `Leíste ${c.leidos} de ${c.dias} ${c.dias === 1 ? "día" : "días"}${c.paginas ? ` · ${nf(c.paginas)} páginas` : ""}${c.min ? ` · ${E.duracion(c.min)}` : ""}`
    : c.dias ? "Este mes todavía no anotaste lectura." : "";
  return `
    <section class="lib-graf lest-cal">
      <div class="lest-cal-cab">
        <button type="button" class="lest-nav" data-lest-mes="${c.anterior}" aria-label="Mes anterior">‹</button>
        <h3>${esc(c.titulo.charAt(0).toUpperCase() + c.titulo.slice(1))}</h3>
        <button type="button" class="lest-nav" data-lest-mes="${c.siguiente || ""}" aria-label="Mes siguiente"${c.siguiente ? "" : " disabled"}>›</button>
      </div>
      <p class="lib-nota">${esc(resumen)}</p>
      <div class="lest-semana" aria-hidden="true">${DIAS_SEM.map(x => `<span>${x}</span>`).join("")}</div>
      <div class="lest-grilla">${c.semanas.map(s => s.map(celda).join("")).join("")}</div>
      <div class="lest-leyenda" aria-hidden="true"><span>Menos</span>${[0, 1, 2, 3, 4].map(n => `<i class="n${n}"></i>`).join("")}<span>Más (tu meta de ${D().metaDia()} págs.)</span></div>
      <p class="lib-g-lectura" data-lest-dia-txt aria-live="polite">Toca un día para ver qué leíste.</p>
    </section>`;
}
function leerDia(fecha) {
  const d = D(), el = document.querySelector("[data-lest-dia-txt]");
  if (!d || !el) return;
  const xs = E.delDia(d.lista(), fecha);
  el.textContent = xs.length
    ? `${fechaLarga(fecha).replace(/^./, m => m.toUpperCase())}: ${xs.map(x => `${x.titulo} (${leidoTxt(x)})`).join("; ")}.`
    : `${fechaLarga(fecha).replace(/^./, m => m.toUpperCase())}: no anotaste lectura.`;
  document.querySelectorAll(".lest-dia.is-elegido").forEach(b => b.classList.remove("is-elegido"));
  const b = document.querySelector(`[data-lest-dia="${fecha}"]`);
  if (b) b.classList.add("is-elegido");
}

function tiempo(libros, hoy, dias) {
  const t = E.tiempo(libros, hoy, dias), d = D();
  if (!t.sesiones) {
    return `<section class="lib-graf"><h3>Tiempo leyendo</h3>
      <p class="lib-nota">Toca «Leer ahora» en un libro para medir cuánto lees: aquí verás tu tiempo y tu velocidad.</p></section>`;
  }
  const semanas = t.semanas.map(s => ({ etiqueta: `${Number(s.desde.slice(8, 10))} ${E.MESES[Number(s.desde.slice(5, 7)) - 1].slice(0, 3)}`, nombre: `Semana del ${Number(s.desde.slice(8, 10))} de ${E.MESES[Number(s.desde.slice(5, 7)) - 1]}`, valor: s.min }));
  const cifra = (n, v, sub) => `<div><span>${n}</span><b>${v}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
  return `
    <section class="lib-graf">
      <h3>Tiempo leyendo</h3>
      <p class="lib-nota">Con «Leer ahora».</p>
      <div class="lib-stats-cifras lest-cifras">
        ${cifra(`En ${hoy.slice(0, 4)}`, E.duracion(t.anio))}
        ${cifra("Este mes", E.duracion(t.mes))}
        ${cifra("Por sesión", E.duracion(t.promedioSesion || 0), "promedio")}
      </div>
      <h4 class="lest-sub">Minutos por semana</h4>
      ${d.grafico("lest-semanas", semanas, { titulo: "Minutos leyendo por semana, últimas 12 semanas", etiquetas: i => i === 0 || i === 6 || i === 11, columna: "Semana", unidad: ["minuto", "minutos"] })}
      ${t.larga ? `<p class="lib-nota">Tu sesión más larga: <b>${E.duracion(t.larga.min)}</b> con «${esc(t.larga.titulo)}».</p>` : ""}
      ${t.estimadoAnio >= 30 ? `<p class="lib-nota">Además, unas ${E.duracion(t.estimadoAnio)} más este año en días que anotaste páginas sin cronómetro (calculado con tu velocidad).</p>` : ""}
    </section>`;
}

function velocidad(libros, hoy) {
  const v = E.velocidad(libros, hoy), d = D();
  if (!v.porHora) return "";
  const t = v.tendencia;
  const tend = !t ? `<p class="lib-nota">Con unos meses más de «Leer ahora» te digo si vas más rápido.</p>`
    : t.sentido === "sube" ? `<p class="lest-tend is-sube">↑ Lees ${t.cambio} % más rápido que hace unos meses (${coma(t.antes)} → ${coma(t.ahora)} págs./hora).</p>`
    : t.sentido === "baja" ? `<p class="lest-tend is-baja">↓ ${Math.abs(t.cambio)} % más lento que hace unos meses (${coma(t.antes)} → ${coma(t.ahora)} págs./hora). Es normal con libros más densos.</p>`
    : `<p class="lest-tend">→ Tu ritmo se mantiene (${coma(t.ahora)} págs./hora).</p>`;
  const meses = v.meses.map(m => ({ etiqueta: m.nombre.slice(0, 3), nombre: m.nombre, valor: m.porHora ? Math.round(m.porHora) : 0 }));
  return `
    <section class="lib-graf">
      <h3>Velocidad</h3>
      <p class="lest-vel"><b>${coma(Math.round(v.porHora))}</b> páginas por hora</p>
      ${tend}
      <h4 class="lest-sub">Páginas por hora, cada mes</h4>
      ${d.grafico("lest-velocidad", meses, { titulo: "Páginas por hora en cada mes, últimos 6 meses", etiquetas: () => true, todosLosValores: true, columna: "Mes", unidad: ["pág./hora", "págs./hora"] })}
    </section>`;
}

function autores(libros) {
  const xs = E.autores(libros).slice(0, 5);
  if (!xs.length) return "";
  const max = xs[0].libros;
  return `
    <section class="lib-graf">
      <h3>Tus autores</h3>
      <p class="lib-nota">Los que más leíste (libros terminados).</p>
      <div class="lib-generos">${xs.map(a => `
        <div class="lib-genero-fila"><span>${esc(a.nombre)}</span><span class="lib-barra" aria-hidden="true"><i style="width:${Math.round((a.libros / max) * 100)}%"></i></span><b>${a.libros}</b></div>`).join("")}
      </div>
    </section>`;
}

// ---------- Tarjeta arriba de Libros (15 de diciembre a 31 de enero) ----------
function tarjeta() {
  const el = document.getElementById("lib-anio"), d = D();
  if (!el || !d || !d.listo()) return;
  const anio = E.anioParaMostrar(hoyLocal());
  const r = anio ? E.anio(d.lista(), [], anio) : null;
  if (!r || !r.terminados) { el.innerHTML = ""; return; }
  el.innerHTML = `
    <button type="button" class="lanio-tarjeta" data-lanio-abrir="${anio}">
      <span class="lanio-emoji" aria-hidden="true">🎉</span>
      <span class="lanio-txt"><b>Tu año en libros ${anio}</b><small>${r.terminados} ${r.terminados === 1 ? "libro" : "libros"} · ${nf(r.paginas)} páginas. Míralo y compártelo.</small></span>
      <span class="lanio-ir" aria-hidden="true">›</span>
    </button>`;
}

// ---------- La hoja del año ----------
function abrirAnio(anio) {
  const d = D();
  if (!d) return;
  anioHoja = Number(anio);
  const libros = d.lista(), r = E.anio(libros, d.frases(), anioHoja);
  const anios = E.aniosConLibros(libros);
  const i = anios.indexOf(anioHoja);
  const ant = i > 0 ? anios[i - 1] : null, sig = i >= 0 && i < anios.length - 1 ? anios[i + 1] : null;
  const titulo = t => `«${esc(t)}»`;
  const lista = [
    r.mejores.length ? `<li><span aria-hidden="true">⭐</span> Tus 5 estrellas: ${r.mejores.slice(0, 4).map(x => titulo(x.titulo)).join(", ")}${r.mejores.length > 4 ? ` y ${r.mejores.length - 4} más` : ""}.</li>` : "",
    r.masLargo ? `<li><span aria-hidden="true">📏</span> El más largo: ${titulo(r.masLargo.titulo)} (${nf(r.masLargo.paginas)} págs.).</li>` : "",
    r.masRapido ? `<li><span aria-hidden="true">⚡</span> El que leíste más rápido: ${titulo(r.masRapido.titulo)}, en ${r.masRapido.dias} ${r.masRapido.dias === 1 ? "día" : "días"}.</li>` : "",
    r.mesTop ? `<li><span aria-hidden="true">📅</span> Tu mejor mes: ${r.mesTop.nombre} (${r.mesTop.libros} libros).</li>` : "",
    r.generoTop && L.GENERO[r.generoTop.nombre] ? `<li><span aria-hidden="true">🏷️</span> Lo que más leíste: ${esc(L.GENERO[r.generoTop.nombre].nombre)}.</li>` : "",
    r.autorTop ? `<li><span aria-hidden="true">✍️</span> Tu autor del año: ${esc(r.autorTop.nombre)} (${r.autorTop.libros} libros).</li>` : "",
    r.audiolibros || r.relecturas ? `<li><span aria-hidden="true">🎧</span> ${[r.audiolibros ? `${r.audiolibros} ${r.audiolibros === 1 ? "audiolibro" : "audiolibros"}` : "", r.relecturas ? `${r.relecturas} ${r.relecturas === 1 ? "relectura" : "relecturas"}` : ""].filter(Boolean).join(" y ")}.</li>` : "",
    r.frases ? `<li><span aria-hidden="true">💬</span> Guardaste ${r.frases} ${r.frases === 1 ? "frase" : "frases"}.</li>` : ""
  ].join("");
  const comp = r.anterior ? (r.terminados > r.anterior.terminados ? `📈 ${r.terminados - r.anterior.terminados} ${r.terminados - r.anterior.terminados === 1 ? "libro" : "libros"} más que en ${r.anterior.anio}.`
    : r.terminados < r.anterior.terminados ? `En ${r.anterior.anio} fueron ${r.anterior.terminados}: el año que viene, por más.` : `Igual que en ${r.anterior.anio}: constante.`) : "";
  const fav = r.fraseFav ? d.uno(r.fraseFav.libroId) : null;
  hoja.abrir(`Tu año en libros`, `
    <div class="lanio">
      ${anios.length > 1 ? `<div class="lanio-nav">
        <button type="button" class="lest-nav" data-lanio-abrir="${ant || ""}" aria-label="Año anterior"${ant ? "" : " disabled"}>‹</button>
        <b>${anioHoja}</b>
        <button type="button" class="lest-nav" data-lanio-abrir="${sig || ""}" aria-label="Año siguiente"${sig ? "" : " disabled"}>›</button>
      </div>` : `<p class="lanio-anio">${anioHoja}</p>`}
      ${r.hayDatos ? `
      <p class="lanio-hero"><b>${r.terminados}</b> ${r.terminados === 1 ? "libro terminado" : "libros terminados"}</p>
      <div class="lanio-cifras">
        <div><b>${nf(r.paginas)}</b><span>páginas</span></div>
        <div><b>${r.minutos ? E.duracion(r.minutos) : "—"}</b><span>leyendo${r.minutos ? "" : " (usa «Leer ahora»)"}</span></div>
        <div><b>${r.diasLeidos}</b><span>${r.diasLeidos === 1 ? "día con lectura" : "días con lectura"}</span></div>
        <div><b>${r.mejorRacha}</b><span>${r.mejorRacha === 1 ? "día seguido (tu mejor racha)" : "días seguidos (tu mejor racha)"}</span></div>
      </div>
      ${comp ? `<p class="lanio-comp">${esc(comp)}</p>` : ""}
      ${r.libros.length ? `<h4 class="lanio-h">Tus libros del año</h4>
      <div class="lanio-tapas">${r.libros.map(x => { const l = d.uno(x.id); return l ? `<button type="button" class="lanio-tapa" data-lanio-ver="${esc(l.id)}" aria-label="Ver ${esc(l.titulo)}"><span class="lib-portada">${d.tapa(l)}</span></button>` : ""; }).join("")}</div>` : ""}
      ${lista ? `<h4 class="lanio-h">Lo mejor</h4><ul class="lanio-lista">${lista}</ul>` : ""}
      ${r.fraseFav ? `<blockquote class="lanio-frase">«${esc(r.fraseFav.texto)}»${fav ? `<cite>— ${esc(fav.titulo)}</cite>` : ""}</blockquote>` : ""}
      <button type="button" class="lib-btn lib-btn-ancho" data-lanio-compartir>Compartir como imagen</button>
      <p class="lib-error" role="alert" hidden></p>` : `<p class="lib-nota">En ${anioHoja} no anotaste libros terminados.</p>`}
    </div>`);
}

// ---- Imagen para compartir (1080 × 1350, JPEG) ----
const SERIF = '"Fraunces", "DM Sans", Georgia, serif', SANS = '"DM Sans", system-ui, sans-serif';
function recortar(g, t, ancho) {
  if (g.measureText(t).width <= ancho) return t;
  let s = t;
  while (s.length > 1 && g.measureText(`${s}…`).width > ancho) s = s.slice(0, -1);
  return `${s.trim()}…`;
}
function dibujarAnio(g, r) {
  const W = 1080, H = 1350, M = 80;
  g.fillStyle = "#111111";
  g.fillRect(0, 0, W, H);
  const grad = g.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, "#ff7a3d");
  grad.addColorStop(1, "#ffb347");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, 16);
  g.textBaseline = "alphabetic";
  g.fillStyle = "#ff9a4d";
  g.font = `700 40px ${SANS}`;
  g.fillText("MI AÑO EN LIBROS", M, 150);
  g.fillStyle = "#ffffff";
  g.font = `600 150px ${SERIF}`;
  g.fillText(String(r.anio), M - 6, 310);
  g.fillStyle = grad;
  g.font = `800 230px ${SANS}`;
  g.fillText(String(r.terminados), M - 8, 570);
  const ancho = g.measureText(String(r.terminados)).width;
  g.fillStyle = "#ffffff";
  g.font = `600 52px ${SANS}`;
  g.fillText(r.terminados === 1 ? "libro" : "libros", M + ancho + 24, 500);
  g.fillStyle = "#b9b9b9";
  g.font = `500 40px ${SANS}`;
  g.fillText(r.terminados === 1 ? "terminado" : "terminados", M + ancho + 24, 556);
  // Tres cifras
  const horas = r.minutos >= 60 ? `${nf(Math.round(r.minutos / 60))} h` : r.minutos ? `${r.minutos} min` : "—";
  const cifras = [[nf(r.paginas), "páginas"], [horas, "leyendo"], [String(r.diasLeidos), r.diasLeidos === 1 ? "día leído" : "días leídos"]];
  const col = (W - 2 * M - 40) / 3;
  cifras.forEach(([v, n], k) => {
    const x = M + k * (col + 20);
    g.fillStyle = "#1d1d1d";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, 640, col, 190, 28); else g.rect(x, 640, col, 190);
    g.fill();
    g.fillStyle = "#ffffff";
    g.font = `700 64px ${SANS}`;
    g.fillText(recortar(g, v, col - 48), x + 28, 740);
    g.fillStyle = "#b9b9b9";
    g.font = `500 34px ${SANS}`;
    g.fillText(n, x + 28, 795);
  });
  // Lo mejor (hasta 4 líneas)
  const lineas = [
    r.mejores.length ? `★ ${r.mejores.map(x => x.titulo).join(", ")}` : "",
    r.masLargo ? `El más largo: ${r.masLargo.titulo}` : "",
    r.masRapido ? `El más rápido: ${r.masRapido.titulo} (${r.masRapido.dias} ${r.masRapido.dias === 1 ? "día" : "días"})` : "",
    r.autorTop ? `Autor del año: ${r.autorTop.nombre}` : r.mesTop ? `Mejor mes: ${r.mesTop.nombre}` : ""
  ].filter(Boolean).slice(0, 4);
  g.font = `500 40px ${SANS}`;
  lineas.forEach((t, k) => {
    g.fillStyle = k === 0 && r.mejores.length ? "#ffb347" : "#e8e8e8";
    g.fillText(recortar(g, t, W - 2 * M), M, 920 + k * 70);
  });
  g.fillStyle = "#8a8a8a";
  g.font = `600 36px ${SANS}`;
  g.fillText("Manolo", M, H - 70);
}
async function compartir() {
  const d = D();
  if (!d || !anioHoja) return;
  const r = E.anio(d.lista(), d.frases(), anioHoja);
  const err = hoja.el.querySelector(".lib-error");
  try {
    if (document.fonts && document.fonts.load) {
      try { await Promise.all([document.fonts.load(`600 150px ${SERIF}`), document.fonts.load(`700 64px ${SANS}`)]); } catch (e) { /* letra del sistema */ }
    }
    const c = document.createElement("canvas");
    c.width = 1080;
    c.height = 1350;
    dibujarAnio(c.getContext("2d"), r);
    const blob = await new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error("imagen"))), "image/jpeg", 0.92));
    const nombre = `mi-anio-en-libros-${r.anio}.jpg`;
    const archivo = typeof File === "function" ? new File([blob], nombre, { type: "image/jpeg" }) : null;
    if (archivo && navigator.canShare && navigator.canShare({ files: [archivo] }) && navigator.share) {
      try { await navigator.share({ files: [archivo] }); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  } catch (e) {
    if (err) { err.textContent = "No se pudo armar la imagen."; err.hidden = false; }
  }
}

// ---------- Toques ----------
document.addEventListener("click", e => {
  const m = e.target.closest("[data-lest-mes]");
  if (m && m.dataset.lestMes) {
    mesCal = m.dataset.lestMes;
    const d = D(), el = document.querySelector('[data-lest="calendario"]');
    if (d && el) el.innerHTML = calendario(d.lista(), hoyLocal(), E.porDia(d.lista()));
    return;
  }
  const dia = e.target.closest("[data-lest-dia]");
  if (dia) { leerDia(dia.dataset.lestDia); return; }
  const a = e.target.closest("[data-lanio-abrir]");
  if (a && a.dataset.lanioAbrir) { abrirAnio(a.dataset.lanioAbrir); return; }
  if (e.target.closest("[data-lanio-compartir]")) compartir();
});
// Tocar una tapa abre el libro (en la hoja de libros.js).
hoja.el.addEventListener("click", e => {
  const t = e.target.closest("[data-lanio-ver]");
  if (!t || !D()) return;
  hoja.cerrar();
  D().ver(t.dataset.lanioVer);
});
window.addEventListener("libros:datos", () => {
  tarjeta();
  if (hoja.abierta() && anioHoja) abrirAnio(anioHoja);
});

window.LibrosEstadisticasUI = { pintar, tarjeta, abrirAnio, dibujarAnio };
})();
