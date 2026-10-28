// ---------- Inversiones: pantallas ----------
// Resumen, posiciones (con precios diarios de data/precios.json o a mano),
// movimientos (compra, venta, dividendo, fondeo, depósito/retiro, interés),
// gráficos (js/inversiones-series.js + js/inversiones-graficos.js), ronda
// DCA del mes y ajustes. Las cuentas viven en
// js/inversiones-motor.js; aquí solo se pinta y se guarda en Firestore.
// Los registros viejos se completan AGREGANDO campos: nunca se reescribe
// su date, name, amount ni notes. Ver docs/INVERSIONES.md.
(function () {
const M = window.InversionesMotor;
const S = window.InversionesSeries;
const G = window.InversionesGraficos;
const $ = id => document.getElementById(id);

let docs = {};          // id → datos tal como están en Firestore
let movs = [];          // movimientos normalizados
let guardados = null;   // meta/inversiones_ajustes
let cargado = false;
let vista = "resumen";
let hoja = null;        // hoja que sube desde abajo
let est = null;         // qué muestra la hoja: { modo: "mov"|"ronda", tipo, id, … }
let borrador = null;    // ajustes en edición
let sucio = false;      // hay cambios sin guardar en Ajustes
let guardadoEn = 0;     // cuándo se guardaron los ajustes (para el ✓)
let precios = null;     // data/precios.json (o la última copia guardada)
let tipoCambio = null;  // data/tipo-cambio.json (TCO del BCB)
let preciosLeidos = 0;  // cuándo se pidieron por última vez
const CLAVE_PRECIOS = "manolo-inv-precios";
const CLAVE_TC = "manolo-inv-tc";
let graficos = null;    // series ya calculadas para dibujar
const tablasAbiertas = new Set();

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const aj = () => M.ajustes(guardados);
const coleccion = () => db.collection("users").doc(currentUser.uid).collection("inversiones");
const refAjustes = () => db.collection("users").doc(currentUser.uid).collection("meta").doc("inversiones_ajustes");
// Número → texto para un campo ("0,068"), sin separador de miles.
const enCampo = (n, vacioSiCero) => (typeof n === "number" && isFinite(n) && !(vacioSiCero && n === 0) ? String(n).replace(".", ",") : "");
const decimales = (n, d) => (n || 0).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: d });
const nombreMes = f => M.mesTitulo(M.mesDe(f)).split(" ")[0].toLowerCase();

// ---------- Pestañas ----------
// Si no caben todas, la barra se desliza de lado y un borde difuminado
// avisa que hay más.
const barraTabs = document.querySelector("#panel-inversiones .inv-tabs");
barraTabs.addEventListener("click", e => {
  const b = e.target.closest("[data-inv-tab]");
  if (b) irA(b.dataset.invTab);
});
function marcarDesborde() {
  barraTabs.classList.toggle("hay-izq", barraTabs.scrollLeft > 2);
  barraTabs.classList.toggle("hay-der", barraTabs.scrollLeft + barraTabs.clientWidth < barraTabs.scrollWidth - 2);
}
barraTabs.addEventListener("scroll", marcarDesborde, { passive: true });
if (typeof ResizeObserver === "function") new ResizeObserver(marcarDesborde).observe(barraTabs);
function irA(v) {
  vista = v;
  document.querySelectorAll("#panel-inversiones [data-inv-tab]").forEach(b => {
    const on = b.dataset.invTab === vista;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", String(on));
    if (on && barraTabs.clientWidth) {
      const rb = b.getBoundingClientRect(), rc = barraTabs.getBoundingClientRect();
      barraTabs.scrollLeft += (rb.left - rc.left) - (rc.width - rb.width) / 2;
    }
  });
  marcarDesborde();
  document.querySelectorAll("#panel-inversiones [data-inv-vista]").forEach(el => { el.hidden = el.dataset.invVista !== vista; });
  if (vista === "ajustes") { borrador = null; sucio = false; }
  render();
}

function render() {
  if (vista === "resumen") renderResumen();
  else if (vista === "posiciones") renderPosiciones();
  else if (vista === "movimientos") renderMovimientos();
  else if (vista === "graficos") renderGraficos();
  else if (vista === "ajustes") renderAjustes();
}
const cargando = `<p class="empty-state">Cargando…</p>`;

// ---------- Resumen ----------
const dato = (etiqueta, valor, pie) => `
      <div class="inv-dato"><span>${etiqueta}</span><b>${valor}</b>${pie ? `<small>${pie}</small>` : ""}</div>`;
function renderResumen() {
  const el = $("inv-resumen");
  if (!cargado) { el.innerHTML = cargando; return; }
  const c = M.cartera(movs, precios, guardados), r = c.resumen, a = aj();
  const interes = M.interesMensual(r.efectivo, a.tasaEfectivo);
  const agenda = M.agendaDividendos(precios, movs, hoyLocal());
  let html = M.avisosDividendos(agenda).map(avisoDividendo).join("") + `
    <div class="inv-hero">
      <span class="inv-hero-label">Valor de tu cartera</span>
      <strong class="inv-hero-valor">${M.usd(c.valor)}</strong>
      <span class="inv-hero-sub">${gp(c.gp, c.gpPct)} sobre <b>${M.usd(r.aportado)}</b> aportados</span>
      <span class="inv-hero-sub">Efectivo en el broker: <b>${M.usd(r.efectivo)}</b>${interes > 0 ? ` · al ${M.pct(a.tasaEfectivo)} anual ≈ ${M.usd(interes)} al mes` : ""}</span>
    </div>
    <div class="inv-grid">
      ${dato("Comprado", M.usd(r.comprado), r.vendido ? `Vendido: ${M.usd(r.vendido)}` : "")}
      ${dato("Comisiones", M.usd(r.comisiones), r.comisiones ? `${M.pct(r.comisionesPct)} de lo que pusiste` : "")}
      ${dato("Dividendos", M.usd(r.dividendos))}
      ${dato("Intereses", M.usd(r.intereses))}
    </div>`;
  const notas = [];
  const tp = c.posiciones.total;
  if (c.posiciones.abiertas.length) notas.push(textoPrecios());
  if (tp.sinPrecio) notas.push(`${tp.sinPrecio === 1 ? "1 posición sin precio cuenta" : `${tp.sinPrecio} posiciones sin precio cuentan`} a su costo.`);
  if (r.bsEnviados > 0) notas.push(`Fondeos: ${M.bs(r.bsEnviados)} enviados, a un promedio de ${decimales(r.tasaPromedio, 2)} Bs por US$.`);
  if (r.sinFondeo > 0) notas.push(`Incluye ${M.usd(r.sinFondeo)} de compras sin fondeo anotado.`);
  if (notas.length) html += `<p class="inv-nota">${notas.join(" ")}</p>`;
  if (r.nAportesViejos) html += `
    <div class="inv-aviso">
      <p>📥 Tienes <b>${r.nAportesViejos} ${r.nAportesViejos === 1 ? "aporte anterior" : "aportes anteriores"}</b> (${M.usd(r.aportesViejos)}) sin detalle. Complétalos con ticker, cantidad y precio para que cuenten como compras.</p>
      <button type="button" class="inv-btn-sec" data-inv="ver-aportes">Completar aportes</button>
    </div>`;
  html += botones(true);
  if (!movs.length) html += `<p class="empty-state">Aún no hay movimientos. Empieza con tu fondeo o tu primera compra; puedes poner fechas pasadas.</p>`;
  if (agenda.length) html += tarjetaAgenda(agenda);
  el.innerHTML = html;
}

// ---------- Dividendos: avisos y próximas fechas ----------
// Las fechas las guarda el workflow de precios (data/precios.json). Avisa de
// 3 días antes a 3 días después de la fecha ex o del pago.
const aprox = (f, estimada) => `${M.fechaLarga(f)}${estimada ? " (estimada)" : ""}`;
const montoDiv = x => (x.total != null ? `≈ ${M.usd(x.total)} por tus ${M.cantidadTexto(x.acciones)} acciones (${M.usd(x.monto)} c/u, antes de impuestos)` : "");
function avisoDividendo(x) {
  return `
    <div class="inv-aviso inv-aviso-div" data-div="${esc(x.ticker)}">
      <p><b>💰 Dividendo de ${esc(x.ticker)}</b>${x.estimado ? ` <span class="inv-chip">fecha estimada</span>` : ""}</p>
      ${x.lineas.map(l => `<p>${esc(l)}</p>`).join("")}
      ${x.total != null ? `<p class="inv-nota">${esc(montoDiv(x))}</p>` : ""}
      ${x.anotar ? `<button type="button" class="inv-btn-sec" data-inv-anotar-div="${esc(x.ticker)}" data-fecha="${esc(x.pago)}" data-monto="${x.total != null ? esc(enCampo(x.total)) : ""}">Anotar dividendo</button>` : ""}
    </div>`;
}
function tarjetaAgenda(agenda) {
  const filas = agenda.map(x => `
      <div class="inv-agenda-fila">
        <div class="inv-pos-fila"><b>${esc(x.ticker)}</b><span>${x.estimado ? `<span class="inv-chip">estimada</span>` : `<span class="inv-chip is-ok">anunciada</span>`}</span></div>
        <div class="inv-pos-fila"><span>Fecha ex: ${aprox(x.ex, x.estimado)}</span><span>${x.pago ? `Pago: ${aprox(x.pago, x.estimado || x.pagoEstimado)}` : "Pago: sin anunciar"}</span></div>
        ${x.total != null ? `<div class="inv-pos-fila"><span>${esc(montoDiv(x))}</span></div>` : ""}
      </div>`).join("");
  return tarjetaG("Próximos dividendos", `${filas}
      <p class="inv-ayuda">Para cobrar un dividendo tienes que tener la acción <b>antes</b> de la fecha ex. Los montos son brutos: EE. UU. retiene impuestos, así que llega algo menos. Te aviso aquí desde 3 días antes hasta 3 días después.</p>`,
    "De lo que tienes, según las fechas anunciadas o el ritmo de pagos anteriores.");
}
const botones = rondaPrimero => {
  const ronda = `<button type="button" class="inv-btn${rondaPrimero ? "" : "-sec"}" data-inv="ronda">🗓️ Ronda DCA de ${nombreMes(hoyLocal())}</button>`;
  const nuevo = `<button type="button" class="inv-btn${rondaPrimero ? "-sec" : ""}" data-inv="nuevo">＋ Movimiento</button>`;
  return `<div class="inv-acciones">${rondaPrimero ? ronda + nuevo : nuevo + ronda}</div>`;
};

// Ganancia o pérdida con su color.
const gp = (n, p) => `<span class="inv-gp ${n > 0 ? "is-sube" : n < 0 ? "is-baja" : ""}">${M.usdS(n)} (${M.pctS(p)})</span>`;
function textoPrecios() {
  const f = M.fechaPrecios(precios);
  if (!f) return "Todavía no hay precios diarios guardados.";
  const dias = M.diasEntre(f, hoyLocal());
  return `Precios al cierre del ${M.fechaLarga(f)}${dias > 4 ? ` (hace ${dias} días${navigator.onLine === false ? ", sin conexión" : ""})` : ""}.`;
}

// ---------- Precios ----------
// data/precios.json lo actualiza un workflow de GitHub cada día hábil. Sin
// conexión, el service worker devuelve la última copia; si tampoco hay, se
// usa la guardada en este teléfono.
// El tipo de cambio del BCB (para el rendimiento en Bs) llega igual.
function leerArchivo(ruta, clave) {
  return fetch(`${ruta}?t=${Date.now()}`, { cache: "no-store" })
    .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then(d => {
      try { localStorage.setItem(clave, JSON.stringify(d)); } catch (e) { /* sin espacio: no pasa nada */ }
      return d;
    })
    .catch(() => { try { return JSON.parse(localStorage.getItem(clave) || "null"); } catch (e) { return null; } });
}
function cargarPrecios() {
  preciosLeidos = Date.now();
  Promise.all([leerArchivo("data/precios.json", CLAVE_PRECIOS), leerArchivo("data/tipo-cambio.json", CLAVE_TC)]).then(([p, tc]) => {
    if (p) precios = p;
    if (tc) tipoCambio = tc;
    if (vista !== "ajustes") render();
  });
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && Date.now() - preciosLeidos > 30 * 60 * 1000) cargarPrecios();
});

// ---------- Posiciones ----------
function renderPosiciones() {
  const el = $("inv-posiciones");
  if (!cargado) { el.innerHTML = cargando; return; }
  const c = M.cartera(movs, precios, guardados), pos = c.posiciones, t = pos.total, r = c.resumen;
  if (!pos.abiertas.length && !pos.cerradas.length && !r.nAportesViejos) {
    el.innerHTML = `<p class="empty-state">Aún no tienes posiciones. Anota una compra (o una ronda DCA) y aquí verás cuánto tienes de cada ticker y cuánto vale.</p>`;
    return;
  }
  let html = `
    <div class="inv-hero">
      <span class="inv-hero-label">Posiciones</span>
      <strong class="inv-hero-valor">${M.usd(t.valor)}</strong>
      <span class="inv-hero-sub">Invertido <b>${M.usd(t.invertido)}</b>${t.invertidoConPrecio > 0 ? ` · ${gp(t.gp, t.gpPct)}` : ""}</span>
    </div>
    <p class="inv-nota">${textoPrecios()} Toca un ticker para ver o poner su precio.</p>`;
  html += pos.abiertas.map(tarjeta).join("");
  if (r.nAportesViejos) html += `
    <div class="inv-pos is-sin-asignar">
      <div class="inv-pos-fila"><b>📥 Aportes sin completar</b><span class="inv-pos-valor">${M.usd(r.aportesViejos)}</span></div>
      <div class="inv-pos-fila"><span>${r.nAportesViejos} ${r.nAportesViejos === 1 ? "registro anterior" : "registros anteriores"} sin ticker: cuentan a su monto.</span></div>
      <button type="button" class="inv-btn-sec" data-inv="ver-aportes">Completar</button>
    </div>`;
  if (pos.cerradas.length) html += `
    <h3 class="inv-mes-titulo">Vendidas por completo</h3>
    ${pos.cerradas.map(o => `
    <div class="inv-pos is-cerrada">
      <div class="inv-pos-fila"><b>${esc(o.ticker)}</b><span class="inv-gp ${o.realizado > 0 ? "is-sube" : o.realizado < 0 ? "is-baja" : ""}">${M.usdS(o.realizado)}</span></div>
      <div class="inv-pos-fila"><span>Ganancia realizada${o.dividendos ? ` · dividendos ${M.usd(o.dividendos)}` : ""}</span></div>
    </div>`).join("")}`;
  const extra = [];
  if (t.realizado) extra.push(`Ganancia realizada en ventas: ${M.usdS(t.realizado)}.`);
  if (r.dividendos) extra.push(`Dividendos cobrados: ${M.usd(r.dividendos)}.`);
  if (extra.length) html += `<p class="inv-nota">${extra.join(" ")}</p>`;
  el.innerHTML = html;
}
function tarjeta(o) {
  let precio;
  if (o.fuentePrecio === "manual") precio = `✍️ Precio manual ${M.usd(o.precio)} · ${M.fechaLarga(o.fechaPrecio)}`;
  else if (o.fuentePrecio === "diario") {
    const dias = M.diasEntre(o.fechaPrecio, hoyLocal());
    precio = `${M.usd(o.precio)} · cierre ${M.fechaLarga(o.fechaPrecio)}${dias > 4 ? ` · hace ${dias} días` : ""}`;
  } else precio = "⚠️ Sin precio diario · tócalo";
  return `
    <button type="button" class="inv-pos${o.precio == null ? " is-sin-precio" : ""}" data-inv-precio="${esc(o.ticker)}">
      <span class="inv-pos-fila"><b>${esc(o.ticker)} <span class="inv-chip">${o.grupo === "nucleo" ? "Núcleo" : "Satélite"}</span></b><span class="inv-pos-valor">${o.valor != null ? M.usd(o.valor) : "—"}</span></span>
      <span class="inv-pos-fila"><span>${M.cantidadTexto(o.cantidad)} acc. · prom. ${M.usd(o.costoPromedio)}</span>${o.gp != null ? gp(o.gp, o.gpPct) : `<span>Costo ${M.usd(o.invertido)}</span>`}</span>
      <span class="inv-pos-fila"><span class="inv-pos-precio">${precio}</span><span>Peso ${M.pct(o.peso, 1)}</span></span>
      <span class="inv-peso" aria-hidden="true"><i style="width:${Math.min(100, Math.max(0, o.peso))}%"></i></span>
    </button>`;
}

// ---------- Gráficos ----------
const C = G.COLORES;
const tarjetaG = (titulo, cuerpo, sub) => `
    <section class="inv-card">
      <h3 class="inv-card-t">${titulo}</h3>
      ${sub ? `<p class="inv-card-sub">${sub}</p>` : ""}
      ${cuerpo}
    </section>`;
const clave = (color, linea) => `<i class="inv-key${linea ? " is-linea" : ""}" style="--c:${color}"></i>`;
const kpi = (etiqueta, valor, pie) => `<div class="inv-kpi"><span>${etiqueta}</span><b>${valor}</b>${pie ? `<small>${pie}</small>` : ""}</div>`;
const conColor = (n, texto) => `<span class="inv-gp ${n > 0 ? "is-sube" : n < 0 ? "is-baja" : ""}">${texto}</span>`;
// Tabla con los mismos números (para leerlos sin tocar el gráfico).
const tabla = (id, cab, filas) => `
      <details class="inv-tabla" data-tabla="${id}"${tablasAbiertas.has(id) ? " open" : ""}>
        <summary>Ver tabla</summary>
        <div class="inv-tabla-caja"><table>
          <thead><tr>${cab.map(c => `<th scope="col">${c}</th>`).join("")}</tr></thead>
          <tbody>${filas.map(f => `<tr>${f.map((c, i) => (i ? `<td>${c}</td>` : `<th scope="row">${c}</th>`)).join("")}</tr>`).join("")}</tbody>
        </table></div>
      </details>`;

function renderGraficos() {
  const el = $("inv-graficos");
  if (!cargado) { el.innerHTML = cargando; return; }
  const hoy = hoyLocal();
  const ser = S.serie(movs, precios, guardados, hoy);
  if (!ser.length) { graficos = null; el.innerHTML = `<p class="empty-state">Los gráficos aparecen cuando anotes tu primer movimiento.</p>`; return; }
  const c = M.cartera(movs, precios, guardados);
  const meses = S.aportesPorMes(ser), meta = S.metaMensual(guardados);
  graficos = { ser, meses, meta };
  el.innerHTML = [
    tarjetaValor(ser),
    tarjetaRendimiento(S.rendimiento(movs, precios, guardados, tipoCambio, hoy)),
    tarjetaDistribucion(S.distribucion(c.posiciones, guardados), c.resumen),
    tarjetaAportes(meses, meta),
    tarjetaDividendos(ser, c.resumen),
    tarjetaComisiones(c.resumen)
  ].join("");
  dibujar();
}

function tarjetaValor(ser) {
  const u = ser[ser.length - 1];
  const finDeMes = ser.filter((p, k) => k === ser.length - 1 || ser[k + 1].fecha.slice(0, 7) !== p.fecha.slice(0, 7));
  return tarjetaG("Valor vs aportado", `
      <div class="inv-leyenda">
        <span>${clave(C.principal, true)}Valor <b>${M.usd(u.valor)}</b></span>
        <span>${clave(C.contexto, true)}Aportado <b>${M.usd(u.aportado)}</b></span>
      </div>
      <div class="inv-g" data-g="valor"></div>
      ${tabla("valor", ["Fecha", "Valor", "Aportado", "G/P"], finDeMes.map(p => [esc(M.fechaLarga(p.fecha)), M.usd(p.valor), M.usd(p.aportado), conColor(p.valor - p.aportado, M.usdS(M.red(p.valor - p.aportado)))]))}`,
    `Desde ${M.fechaLarga(ser[0].fecha)}, en US$. Toca y desliza sobre el gráfico para ver cada día.`);
}

function tarjetaRendimiento(r) {
  if (!r) return "";
  const enBs = (x, nombre, pie, falta) => (x
    ? kpi(nombre, conColor(x.gp, `${M.bsS(x.gp)} (${M.pctS(x.pct)})`), pie)
    : kpi(nombre, `<span class="inv-falta">—</span>`, falta));
  const max = Math.max(0.01, ...r.tickers.map(t => Math.abs(t.usd)));
  const filas = r.tickers.map(t => `
        <div class="inv-div-fila">
          <span class="inv-div-t">${esc(t.ticker)}</span>
          <span class="inv-div-pista"><i class="${t.usd >= 0 ? "is-sube" : "is-baja"}" style="--w:${Math.round((Math.abs(t.usd) / max) * 500) / 10}%"></i></span>
          <span class="inv-div-v">${t.sinPrecio ? `<span class="inv-falta">sin precio</span>` : M.usdS(t.usd)}</span>
        </div>`).join("");
  const nada = v => (v == null ? "—" : M.bsS(v));
  return tarjetaG("Rendimiento", `
      <div class="inv-kpis">
        ${kpi("En dólares", conColor(r.usd.gp, `${M.usdS(r.usd.gp)} (${M.pctS(r.usd.pct)})`), `Valor ${M.usd(r.usd.valor)} · aportado ${M.usd(r.usd.aportado)}`)}
        ${enBs(r.bsTco, "En Bs · TCO del BCB", r.bsTco && `Aportado ${M.bs(r.bsTco.aportado)} (al TCO de cada día) · hoy ${decimales(r.bsTco.tasa, 2)} Bs/US$`, "Todavía no hay tipo de cambio del BCB guardado.")}
        ${enBs(r.bsReal, "En Bs · tipo AirTM", r.bsReal && `Aportado ${M.bs(r.bsReal.aportado)} (tus fondeos en Bs; lo demás a tu tipo AirTM) · valor a ${decimales(r.bsReal.tasa, 2)} Bs/US$, tu último fondeo (${M.fechaLarga(r.bsReal.fecha)})`, "Anota un fondeo con Bs y tipo de cambio para verlo.")}
      </div>
      ${r.tickers.length ? `<h4 class="inv-card-h">Por ticker, en US$</h4>${filas}
      <p class="inv-ayuda">Incluye lo ya vendido y los dividendos. Sin precio, un ticker cuenta a su costo.</p>
      ${tabla("rendimiento", ["Ticker", "US$", "Bs BCB", "Bs AirTM"], r.tickers.map(t => [esc(t.ticker), conColor(t.usd, M.usdS(t.usd)), nada(t.bsTco), nada(t.bsReal)]))}` : ""}`,
    "Lo que vale hoy tu cartera menos lo que aportaste.");
}

function tarjetaDistribucion(d, r) {
  if (!d.hayPosiciones) return tarjetaG("Distribución", `<p class="empty-state">Cuando tengas posiciones verás aquí el peso de cada ticker contra tu objetivo.</p>`);
  const tope = Math.min(100, Math.max(10, Math.ceil(Math.max(...d.filas.map(f => Math.max(f.peso, f.objetivo || 0))) / 10) * 10));
  const pos = v => `${Math.min(100, (v / tope) * 100).toFixed(1)}%`;
  const filas = d.filas.map(f => `
        <div class="inv-dist-fila">
          <span class="inv-dist-t">${esc(f.ticker)}</span>
          <span class="inv-dist-pista"><i style="width:${pos(f.peso)};--c:${f.grupo === "nucleo" ? C.principal : C.satelite}"></i>${f.objetivo != null ? `<b class="inv-obj" style="left:${pos(f.objetivo)}"></b>` : ""}</span>
          <span class="inv-dist-v">${M.pct(f.peso, 1)}<small>${f.objetivo != null ? `obj. ${M.pct(f.objetivo, 1)}` : "satélite"}</small></span>
        </div>`).join("");
  const nota = r.nAportesViejos ? ` Sin contar ${M.usd(r.aportesViejos)} de aportes sin completar.` : "";
  return tarjetaG("Distribución", `
      <div class="inv-stack" role="img" aria-label="Núcleo ${M.pct(d.nucleo, 1)}, satélite ${M.pct(d.satelite, 1)}">
        <i style="width:${d.nucleo}%;--c:${C.principal}"></i><i style="width:${d.satelite}%;--c:${C.satelite}"></i>
        <b class="inv-obj" style="left:${Math.min(100, d.objetivoNucleo)}%"></b>
      </div>
      <div class="inv-leyenda">
        <span>${clave(C.principal)}Núcleo <b>${M.pct(d.nucleo, 1)}</b> · obj. ${M.pct(d.objetivoNucleo, 1)}</span>
        <span>${clave(C.satelite)}Satélite <b>${M.pct(d.satelite, 1)}</b> · obj. ${M.pct(d.objetivoSatelite, 1)}</span>
        <span><i class="inv-key is-obj"></i>Objetivo</span>
      </div>
      <h4 class="inv-card-h">Por ticker</h4>
      ${filas}
      <p class="inv-ayuda">La barra llega hasta ${tope} %. Peso sobre el valor de tus posiciones, sin el efectivo.${nota} Los objetivos se cambian en Ajustes.</p>`,
    "Peso de cada parte de tu cartera contra tu objetivo.");
}

function tarjetaAportes(meses, meta) {
  return tarjetaG("Aportes por mes", `
      ${meta > 0 ? `<div class="inv-leyenda"><span>${clave(C.principal)}Aporte del mes</span><span>${clave(G.TINTA.suave, true)}Ronda DCA <b>${M.usd(meta)}</b></span></div>` : ""}
      <div class="inv-g" data-g="aportes"></div>
      ${tabla("aportes", ["Mes", "Aporte"], meses.map(m => [esc(m.titulo), M.usd(m.monto)]))}`,
    "Lo que entró al broker cada mes, en US$.");
}

function tarjetaDividendos(ser, r) {
  if (!(r.dividendos > 0)) return tarjetaG("Dividendos acumulados", `<p class="empty-state">Todavía no anotaste dividendos. Cuando cobres uno, anótalo en Movimientos › Dividendo.</p>${r.intereses > 0 ? `<p class="inv-nota">Intereses del efectivo: ${M.usd(r.intereses)}.</p>` : ""}`);
  const divs = S.dividendosPorTicker(movs);
  return tarjetaG("Dividendos acumulados", `
      <p class="inv-card-big">${M.usd(r.dividendos)}</p>
      <div class="inv-g" data-g="dividendos"></div>
      <div class="inv-lista-simple">${divs.map(d => `<div><span>${esc(d.ticker)}</span><b>${M.usd(d.monto)}</b></div>`).join("")}</div>
      ${r.intereses > 0 ? `<p class="inv-nota">Además, intereses del efectivo: ${M.usd(r.intereses)}.</p>` : ""}`,
    "Lo cobrado en dividendos, sumado en el tiempo.");
}

function tarjetaComisiones(r) {
  return tarjetaG("Comisiones", `
      <p class="inv-card-big">${M.usd(r.comisiones)} <small>${M.pct(r.comisionesPct)} de lo que pusiste</small></p>
      <div class="inv-kpis is-3">
        ${kpi("Broker", M.usd(r.comisionesCompra), "compras y ventas")}
        ${kpi("AirTM", M.usd(r.comisionesAirtm), "Bs → US$")}
        ${kpi("Transferencia", M.usd(r.comisionesTransferencia), "AirTM → broker")}
      </div>
      <p class="inv-ayuda">«Lo que pusiste» = lo aportado más las comisiones de los fondeos (salen antes de llegar al broker).</p>`);
}

// Dibuja cada gráfico al ancho real de su caja (y lo vuelve a dibujar si cambia).
function dibujar() {
  const el = $("inv-graficos");
  if (!graficos || el.hidden) return;
  const { ser, meses, meta } = graficos;
  el.querySelectorAll(".inv-g[data-g]").forEach(viejo => {
    const ancho = viejo.clientWidth;
    if (!ancho) return;
    const caja = viejo.cloneNode(false); // sin oyentes viejos
    viejo.replaceWith(caja);
    caja.dataset.ancho = String(ancho);
    const tipo = caja.dataset.g;
    if (tipo === "valor") {
      const g = G.lineas({ ancho, alto: 200, titulo: "Valor vs aportado", fechas: ser.map(p => p.fecha), series: [
        { id: "valor", nombre: "Valor", color: C.principal, valores: ser.map(p => p.valor) },
        { id: "aportado", nombre: "Aportado", color: C.contexto, valores: ser.map(p => p.aportado), escalon: true }
      ] });
      caja.innerHTML = g.svg;
      G.conectar(caja, {
        xs: g.xs,
        fila: i => ({ titulo: M.fechaLarga(ser[i].fecha), items: [
          { color: C.principal, valor: M.usd(ser[i].valor), nombre: "Valor" },
          { color: C.contexto, valor: M.usd(ser[i].aportado), nombre: "Aportado" },
          { color: "transparent", valor: M.usdS(M.red(ser[i].valor - ser[i].aportado)), nombre: "Ganancia" }
        ] }),
        puntos: i => [{ serie: "valor", y: g.ys.valor[i] }, { serie: "aportado", y: g.ys.aportado[i] }]
      });
    } else if (tipo === "aportes") {
      const g = G.columnas({ ancho, alto: 180, titulo: "Aportes por mes", color: C.principal, barras: meses.map(m => ({ etiqueta: m.corto, valor: m.monto })), meta: meta > 0 ? { valor: meta, texto: `Ronda DCA ${M.usd(meta)}` } : null });
      caja.innerHTML = g.svg;
      G.conectar(caja, { xs: g.xs, fila: i => ({ titulo: meses[i].titulo, items: [{ color: C.principal, valor: M.usd(meses[i].monto), nombre: "Aporte" }] }) });
    } else if (tipo === "dividendos") {
      const g = G.lineas({ ancho, alto: 150, titulo: "Dividendos acumulados", fechas: ser.map(p => p.fecha), series: [
        { id: "div", nombre: "Dividendos", color: C.principal, valores: ser.map(p => p.dividendos), area: true, escalon: true }
      ] });
      caja.innerHTML = g.svg;
      G.conectar(caja, { xs: g.xs, fila: i => ({ titulo: M.fechaLarga(ser[i].fecha), items: [{ color: C.principal, valor: M.usd(ser[i].dividendos), nombre: "Acumulado" }] }), puntos: i => [{ serie: "div", y: g.ys.div[i] }] });
    }
  });
}
$("inv-graficos").addEventListener("toggle", e => {
  const d = e.target.closest && e.target.closest("[data-tabla]");
  if (d) { if (d.open) tablasAbiertas.add(d.dataset.tabla); else tablasAbiertas.delete(d.dataset.tabla); }
}, true);
if (typeof ResizeObserver === "function") {
  let anchoVisto = 0, pedido = 0;
  new ResizeObserver(() => {
    const a = $("inv-graficos").clientWidth;
    if (!a || a === anchoVisto) return;
    anchoVisto = a;
    cancelAnimationFrame(pedido);
    pedido = requestAnimationFrame(dibujar);
  }).observe($("inv-graficos"));
}

// ---------- Hoja de precio (ver el diario o poner uno a mano) ----------
function abrirPrecio(ticker) {
  const a = aj();
  const diario = M.precioDiario(precios, ticker);
  const manual = a.preciosManuales[ticker];
  est = { modo: "precio", ticker };
  const info = diario
    ? `<p class="inv-nota">Precio diario: <b>${M.usd(diario.precio)}</b> (cierre del ${M.fechaLarga(diario.fecha)}). Se actualiza solo de lunes a viernes.</p>`
    : `<div class="inv-aviso"><p>⚠️ <b>${esc(ticker)}</b> no está en la lista de precios diarios: el precio que pongas aquí <b>no se actualiza solo</b>. Para que se actualice cada día hay que agregarlo a la lista (data/tickers.json).</p></div>`;
  const guardado = manual && Number(manual.precio) > 0
    ? `<p class="inv-nota">Precio manual guardado: <b>${M.usd(Number(manual.precio))}</b> del ${M.fechaLarga(manual.fecha)}.</p>` : "";
  abrirHoja(`Precio de ${ticker}`, `${info}${guardado}
      <form class="inv-form inv-precio-form" novalidate>
        ${par(campo("precio", "Precio a mano (US$)", manual ? enCampo(Number(manual.precio)) : ""), campo("fecha", "Fecha del precio", hoyLocal(), "fecha"))}
        <p class="inv-ayuda">Manda el precio más reciente: cuando llegue un precio diario más nuevo, se usa ese.</p>
        <p class="inv-error" role="alert" hidden></p>
        <div class="inv-hoja-acciones">
          ${manual ? `<button type="button" class="inv-btn-peligro" data-inv-quitar-precio>Quitar precio manual</button>` : ""}
          <button type="submit" class="inv-btn">Guardar precio</button>
        </div>
      </form>`);
}
function guardarPrecio(f) {
  const precio = M.numero(f.elements.precio.value), fecha = f.elements.fecha.value;
  const errores = [];
  if (!(precio > 0)) errores.push({ campo: "precio", texto: "Revisa el precio." });
  if (!M.fechaOk(fecha)) errores.push({ campo: "fecha", texto: "Pon la fecha." });
  else if (fecha > hoyLocal()) errores.push({ campo: "fecha", texto: "La fecha no puede ser futura." });
  if (errores.length) { mostrarErrores(f, errores); return; }
  refAjustes().set({ preciosManuales: { [est.ticker]: { precio: M.red(precio, 6), fecha } } }, { merge: true }).catch(avisarFallo);
  cerrarHoja();
}
function quitarPrecio() {
  const t = est.ticker;
  refAjustes().update(new firebase.firestore.FieldPath("preciosManuales", t), firebase.firestore.FieldValue.delete()).catch(avisarFallo);
  cerrarHoja();
}

// ---------- Movimientos ----------
function renderMovimientos() {
  const el = $("inv-movimientos");
  if (!cargado) { el.innerHTML = cargando; return; }
  const grupos = M.porMes(movs);
  let html = botones(false);
  if (!grupos.length) html += `<p class="empty-state">Aún no hay movimientos. Toca «＋ Movimiento» para anotar uno (también con fecha pasada).</p>`;
  grupos.forEach(g => {
    html += `
    <section class="inv-mes">
      <h3 class="inv-mes-titulo">${esc(g.titulo)}<span>${g.items.length} ${g.items.length === 1 ? "movimiento" : "movimientos"}</span></h3>
      ${g.items.map(fila).join("")}
    </section>`;
  });
  el.innerHTML = html;
}
function fila(m) {
  const t = textoFila(m);
  return `
      <button type="button" class="inv-fila" data-inv-editar="${esc(m.id)}">
        <span class="inv-fila-emoji is-${esc(m.tipo)}" aria-hidden="true">${M.EMOJI[m.tipo] || "•"}</span>
        <span class="inv-fila-texto"><b>${esc(t.titulo)}</b><small>${esc(t.detalle)}</small></span>
        <span class="inv-fila-lado">${t.chip ? `<span class="inv-chip${t.chip === "Completar" ? " is-completar" : ""}">${t.chip}</span>` : ""}<span class="inv-fila-monto${t.entra ? " is-entra" : ""}">${t.monto}</span></span>
      </button>`;
}
function textoFila(m) {
  const extra = [M.fechaLarga(m.fecha), m.broker].filter(Boolean);
  const junto = partes => partes.filter(Boolean).join(" · ");
  switch (m.tipo) {
    case "compra":
    case "venta":
      return { titulo: `${M.NOMBRE[m.tipo]} · ${m.ticker}`, detalle: junto([`${M.cantidadTexto(m.cantidad)} a ${M.usd(m.precio)}`, ...extra]), monto: M.usd(m.total), entra: m.tipo === "venta", chip: m.ronda ? "DCA" : "" };
    case "dividendo":
      return { titulo: `Dividendo · ${m.ticker}`, detalle: junto(extra), monto: `+${M.usd(m.monto)}`, entra: true };
    case "interes":
      return { titulo: "Interés", detalle: junto(extra), monto: `+${M.usd(m.monto)}`, entra: true };
    case "efectivo":
      return m.sentido === "retiro"
        ? { titulo: "Retiro", detalle: junto(extra), monto: M.usd(-m.monto) }
        : { titulo: "Depósito", detalle: junto(extra), monto: `+${M.usd(m.monto)}` };
    case "fondeo":
      return { titulo: "Fondeo", detalle: junto([m.bs ? `${M.bs(m.bs)} a ${decimales(m.tasa, 4)}` : "", m.comision ? `comisiones ${M.usd(m.comision)}` : "", ...extra]), monto: M.usd(m.usd) };
    case "aporte":
      return { titulo: `Aporte · ${m.nombre || "sin nombre"}`, detalle: junto(["Registro anterior", M.fechaLarga(m.fecha)]), monto: M.usd(m.monto), chip: "Completar" };
    default:
      return { titulo: "Movimiento", detalle: junto(extra), monto: "" };
  }
}

// ---------- Acciones de la sección ----------
$("panel-inversiones").addEventListener("click", e => {
  const ed = e.target.closest("[data-inv-editar]");
  if (ed) { abrirMov({ id: ed.dataset.invEditar }); return; }
  const pr = e.target.closest("[data-inv-precio]");
  if (pr) { abrirPrecio(pr.dataset.invPrecio); return; }
  const dv = e.target.closest("[data-inv-anotar-div]");
  if (dv) {
    const hoy = hoyLocal();
    abrirMov({ tipo: "dividendo", valores: { ticker: dv.dataset.invAnotarDiv, fecha: dv.dataset.fecha && dv.dataset.fecha <= hoy ? dv.dataset.fecha : hoy, monto: dv.dataset.monto || "" } });
    return;
  }
  const q = e.target.closest("[data-inv-quitar]");
  if (q) { quitarTicker(q.dataset.invQuitar); return; }
  const b = e.target.closest("[data-inv]");
  if (!b) return;
  const accion = b.dataset.inv;
  if (accion === "nuevo") abrirMov({ tipo: "compra" });
  else if (accion === "ronda") abrirRonda();
  else if (accion === "agregar-ticker") agregarTicker();
  else if (accion === "ver-aportes") {
    irA("movimientos");
    const primero = document.querySelector("#inv-movimientos .inv-chip.is-completar");
    if (primero) primero.closest(".inv-fila").scrollIntoView({ block: "center" });
  }
});

// ---------- Hoja ----------
function abrirHoja(titulo, cuerpo) {
  if (!hoja) {
    hoja = document.createElement("div");
    hoja.className = "js-sheet budget-sheet inv-hoja";
    hoja.hidden = true;
    document.body.appendChild(hoja);
    hoja.addEventListener("click", alTocarHoja);
    hoja.addEventListener("input", alEscribir);
    hoja.addEventListener("submit", alEnviar);
    hoja.addEventListener("change", e => { if (est && e.target.form && e.target.type === "date") vistaPrevia(e.target.form); });
  }
  hoja.innerHTML = `<div class="budget-sheet-overlay" data-inv-cerrar></div>
    <div class="budget-sheet-panel inv-hoja-panel" role="dialog" aria-modal="true" aria-labelledby="inv-hoja-t">
      <div class="budget-sheet-header">
        <button type="button" class="budget-sheet-close" data-inv-cerrar aria-label="Cerrar"><span data-icon="close"></span></button>
        <h3 id="inv-hoja-t">${esc(titulo)}</h3>
      </div>
      <div class="inv-hoja-cuerpo">${cuerpo}</div>
    </div>`;
  hoja.hidden = false;
  hoja.classList.remove("is-closing");
  document.body.classList.add("sheet-open");
  if (typeof renderIcons === "function") renderIcons(hoja);
}
function cerrarHoja() {
  if (!hoja || hoja.hidden) return;
  hoja.classList.add("is-closing");
  setTimeout(() => {
    hoja.hidden = true;
    hoja.classList.remove("is-closing");
    document.body.classList.toggle("sheet-open", !!document.querySelector(".js-sheet:not([hidden])"));
  }, 200);
  est = null;
}

// Campo con su etiqueta. tipo: decimal | fecha | ticker | broker | texto.
function campo(nombre, etiqueta, valor, tipo, o) {
  o = o || {};
  const attrs = {
    decimal: `type="text" inputmode="decimal" autocomplete="off" placeholder="${o.placeholder || "0,00"}"`,
    fecha: `type="date" max="${hoyLocal()}"`,
    ticker: `type="text" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="10" list="inv-tickers" placeholder="${o.placeholder || "VOO"}"`,
    broker: `type="text" autocomplete="off" maxlength="40" list="inv-brokers" placeholder="Hapi"`,
    texto: `type="text" autocomplete="off" maxlength="300" placeholder="Opcional"`
  }[tipo || "decimal"];
  return `<label class="inv-campo${tipo === "ticker" ? " is-ticker" : ""}"><span>${etiqueta}</span><input name="${nombre}" ${attrs} value="${esc(valor == null ? "" : valor)}"></label>`;
}
const par = (a, b) => `<div class="inv-par">${a}${b}</div>`;
function listas() {
  const brokers = ["Hapi", "IBKR"];
  movs.forEach(m => { if (m.broker && !brokers.includes(m.broker)) brokers.push(m.broker); });
  return `<datalist id="inv-tickers">${M.tickersConocidos(movs, guardados).map(t => `<option value="${esc(t)}">`).join("")}</datalist>
    <datalist id="inv-brokers">${brokers.map(b => `<option value="${esc(b)}">`).join("")}</datalist>`;
}

// ---------- Hoja de movimiento ----------
const TITULO_TIPO = { compra: "compra", venta: "venta", dividendo: "dividendo", fondeo: "fondeo", efectivo: "depósito o retiro", interes: "interés" };
const NOMBRE_BOTON = { efectivo: "Depósito / retiro" };

function abrirMov(o) {
  const a = aj();
  if (o.id) {
    const d = docs[o.id];
    if (!d) return;
    const m = M.normalizar(o.id, d);
    const completar = m.tipo === "aporte";
    const tipo = completar ? "compra" : m.tipo;
    if (!M.TIPOS.includes(tipo)) return;
    est = { modo: "mov", tipo, id: o.id, viejo: m.viejo, completar, original: m.original || null, ultimo: completar ? "monto" : "cantidad", monto: m.monto };
    pintarMov(valoresDe(m, a));
  } else {
    est = { modo: "mov", tipo: o.tipo || "compra", id: null, ultimo: "monto" };
    pintarMov(Object.assign({ fecha: hoyLocal(), broker: a.broker, comision: enCampo(a.comisionTicker), sentido: "deposito" }, o.valores || {}));
  }
}
function valoresDe(m, a) {
  const v = { fecha: m.fecha, broker: m.broker || a.broker, nota: m.nota };
  if (m.tipo === "aporte") {
    const com = a.comisionTicker;
    return Object.assign(v, { ticker: M.tickerSugerido(m.nombre), comision: enCampo(com), monto: enCampo(Math.max(0, M.red(m.monto - com)), true) });
  }
  if (m.tipo === "compra" || m.tipo === "venta") return Object.assign(v, { ticker: m.ticker, precio: enCampo(m.precio), cantidad: enCampo(m.cantidad), comision: enCampo(m.comision), monto: enCampo(m.bruto) });
  if (m.tipo === "dividendo") return Object.assign(v, { ticker: m.ticker, monto: enCampo(m.monto) });
  if (m.tipo === "interes") return Object.assign(v, { monto: enCampo(m.monto) });
  if (m.tipo === "efectivo") return Object.assign(v, { monto: enCampo(m.monto), sentido: m.sentido });
  if (m.tipo === "fondeo") return Object.assign(v, { bs: enCampo(m.bs, true), tasa: enCampo(m.tasa, true), usdEnviado: enCampo(m.usdEnviado, true), comisionAirtm: enCampo(m.comisionAirtm), comisionTransferencia: enCampo(m.comisionTransferencia), usd: enCampo(m.usd) });
  return v;
}

function camposDe(tipo, v) {
  const a = aj();
  const fechaBroker = par(campo("fecha", "Fecha", v.fecha, "fecha"), campo("broker", "Broker", v.broker, "broker"));
  const nota = campo("nota", "Nota", v.nota, "texto");
  if (tipo === "compra" || tipo === "venta") return fechaBroker
    + campo("ticker", "Ticker", v.ticker, "ticker")
    + par(campo("precio", "Precio por acción (US$)", v.precio), campo("monto", `Monto ${tipo === "compra" ? "invertido" : "vendido"} (US$)`, v.monto))
    + par(campo("cantidad", "Cantidad (acciones)", v.cantidad, "decimal", { placeholder: "0,000000" }), campo("comision", "Comisión (US$)", v.comision))
    + `<p class="inv-ayuda">Escribe el precio y el monto, y la cantidad se calcula (o al revés). Corrígela si tu broker dice otra.</p>`
    + nota;
  if (tipo === "dividendo") return fechaBroker + campo("ticker", "Ticker", v.ticker, "ticker", { placeholder: "SCHD" }) + campo("monto", "Monto recibido (US$)", v.monto) + nota;
  if (tipo === "interes") return fechaBroker + campo("monto", "Interés recibido (US$)", v.monto) + `<p class="inv-ayuda">Lo que te paga el broker por el efectivo (hoy ${M.pct(a.tasaEfectivo)} anual).</p>` + nota;
  if (tipo === "efectivo") {
    const s = v.sentido === "retiro" ? "retiro" : "deposito";
    return `<div class="inv-segmento" role="radiogroup" aria-label="Depósito o retiro">
        <button type="button" class="${s === "deposito" ? "active" : ""}" data-inv-sentido="deposito" role="radio" aria-checked="${s === "deposito"}">Depósito</button>
        <button type="button" class="${s === "retiro" ? "active" : ""}" data-inv-sentido="retiro" role="radio" aria-checked="${s === "retiro"}">Retiro</button>
      </div><input type="hidden" name="sentido" value="${s}">`
      + fechaBroker + campo("monto", "Monto (US$)", v.monto)
      + `<p class="inv-ayuda">Para dinero que entra o sale del broker sin pasar por AirTM. Para lo que mandas desde Bs, usa «Fondeo».</p>` + nota;
  }
  if (tipo === "fondeo") return fechaBroker
    + par(campo("bs", "Bs enviados", v.bs), campo("tasa", "Tipo de cambio (Bs por US$)", v.tasa))
    + campo("usdEnviado", "US$ comprados en AirTM", v.usdEnviado)
    + par(campo("comisionAirtm", `Comisión AirTM (US$, ${M.pct(a.comisionAirtm)})`, v.comisionAirtm), campo("comisionTransferencia", `Comisión AirTM → broker (US$, ${M.pct(a.comisionTransferencia)})`, v.comisionTransferencia))
    + campo("usd", "US$ que llegaron al broker", v.usd)
    + `<p class="inv-ayuda">Con Bs y tipo de cambio se calcula todo. Si tu broker muestra otro monto, escríbelo: manda lo que tú pongas.</p>`
    + nota;
  return "";
}

function pintarMov(v) {
  const tipo = est.tipo;
  const titulo = est.completar ? "Completar aporte" : est.id ? `Editar ${TITULO_TIPO[tipo]}` : "Nuevo movimiento";
  const n = M.nucleo(guardados).length;
  const tipos = est.id ? "" : `
      <div class="inv-tipos" role="radiogroup" aria-label="Tipo de movimiento">
        ${M.TIPOS.map(t => `<button type="button" class="inv-tipo${t === tipo ? " active" : ""}" data-inv-tipo="${t}" role="radio" aria-checked="${t === tipo}"><span aria-hidden="true">${M.EMOJI[t]}</span>${NOMBRE_BOTON[t] || M.NOMBRE[t]}</button>`).join("")}
      </div>
      ${n ? `<button type="button" class="inv-atajo" data-inv-ronda>🗓️ Ronda DCA: los ${n} del núcleo de una vez</button>` : ""}`;
  const o = est.original;
  const original = o ? `
      <div class="inv-original">
        <b>Registro original</b>
        <span>${esc(M.fechaLarga(o.fecha))} · ${esc(o.nombre || "sin nombre")} · ${M.usd(o.monto)}</span>
        ${o.nota ? `<span>${esc(o.nota)}</span>` : ""}
        <small>${est.completar ? "No se cambia: solo se le agregan los datos de la compra." : "No se cambia: tus correcciones se guardan aparte."}</small>
      </div>` : "";
  abrirHoja(titulo, `${tipos}${original}
      <form class="inv-form" novalidate>
        ${camposDe(tipo, v)}
        <p class="inv-total" data-inv-total></p>
        <p class="inv-error" role="alert" hidden></p>
        <div class="inv-hoja-acciones">
          ${est.id ? `<button type="button" class="inv-btn-peligro" data-inv-borrar>Eliminar</button>` : ""}
          <button type="submit" class="inv-btn">${est.completar ? "Guardar como compra" : "Guardar"}</button>
        </div>
      </form>
      ${listas()}`);
  const f = hoja.querySelector(".inv-form");
  // Al editar un fondeo se respetan los montos guardados (borra uno para recalcularlo).
  if (tipo === "fondeo" && est.id) ["usdEnviado", "comisionAirtm", "comisionTransferencia", "usd"].forEach(k => { if (f.elements[k].value) f.elements[k].dataset.tocado = "1"; });
  vistaPrevia(f);
}

function alTocarHoja(e) {
  if (e.target.closest("[data-inv-cerrar]")) { cerrarHoja(); return; }
  if (!est) return;
  const t = e.target.closest("[data-inv-tipo]");
  if (t && t.dataset.invTipo !== est.tipo) {
    // Cambiar de tipo conserva lo común (fecha, broker, ticker y nota); entre
    // compra y venta, todo.
    const todo = leer(hoja.querySelector(".inv-form"));
    const deCompra = est.tipo === "compra" || est.tipo === "venta";
    est.tipo = t.dataset.invTipo;
    const aCompra = est.tipo === "compra" || est.tipo === "venta";
    const previos = deCompra && aCompra ? todo : { fecha: todo.fecha, broker: todo.broker, ticker: todo.ticker, nota: todo.nota };
    if (aCompra && !previos.comision) previos.comision = enCampo(aj().comisionTicker);
    pintarMov(Object.assign({ sentido: "deposito" }, previos));
    return;
  }
  if (e.target.closest("[data-inv-ronda]")) { abrirRonda(); return; }
  const s = e.target.closest("[data-inv-sentido]");
  if (s) {
    hoja.querySelectorAll("[data-inv-sentido]").forEach(b => { const on = b === s; b.classList.toggle("active", on); b.setAttribute("aria-checked", String(on)); });
    hoja.querySelector('[name="sentido"]').value = s.dataset.invSentido;
    return;
  }
  if (e.target.closest("[data-inv-borrar]")) borrarMov();
  if (e.target.closest("[data-inv-quitar-precio]")) quitarPrecio();
}

const leer = f => {
  const out = {};
  if (f) Array.from(f.elements).forEach(el => { if (el.name) out[el.name] = el.value; });
  return out;
};

function alEscribir(e) {
  const i = e.target, f = i.form;
  if (!f || !est) return;
  if (i.classList.contains("is-error")) { i.classList.remove("is-error"); i.removeAttribute("aria-invalid"); }
  if (est.modo === "mov" && (est.tipo === "compra" || est.tipo === "venta")) enlazarCompra(f, i.name);
  else if (est.modo === "mov" && est.tipo === "fondeo") enlazarFondeo(f, i);
  else if (est.modo === "ronda") enlazarRonda(i);
  vistaPrevia(f);
}

// Precio, monto y cantidad se calculan entre sí: manda lo último que tocaste.
function enlazarCompra(f, nombre) {
  const val = k => f.elements[k].value;
  const desdeMonto = () => { const c = M.cantidadDesdeMonto(val("monto"), val("precio")); if (c != null) f.elements.cantidad.value = enCampo(c); };
  const desdeCantidad = () => { const c = M.numero(val("cantidad")), p = M.numero(val("precio")); if (c > 0 && p > 0) f.elements.monto.value = enCampo(M.red(c * p)); };
  if (nombre === "monto") { est.ultimo = "monto"; desdeMonto(); }
  else if (nombre === "cantidad") { est.ultimo = "cantidad"; desdeCantidad(); }
  else if (nombre === "precio") { if (est.ultimo === "monto") desdeMonto(); else desdeCantidad(); }
}

// Fondeo: lo que no escribiste a mano se recalcula con Bs y tipo de cambio.
const AUTO_FONDEO = ["usdEnviado", "comisionAirtm", "comisionTransferencia", "usd"];
function enlazarFondeo(f, i) {
  if (AUTO_FONDEO.includes(i.name)) {
    if (i.value.trim()) i.dataset.tocado = "1"; else delete i.dataset.tocado;
  }
  const el = f.elements, tocado = k => !!el[k].dataset.tocado;
  const datos = { bs: el.bs.value, tasa: el.tasa.value, usdEnviado: el.usdEnviado.value };
  if (tocado("usdEnviado")) { datos.bs = ""; datos.tasa = ""; }
  if (tocado("comisionAirtm")) datos.comisionAirtm = el.comisionAirtm.value;
  if (tocado("comisionTransferencia")) datos.comisionTransferencia = el.comisionTransferencia.value;
  const c = M.calcularFondeo(datos, guardados);
  if (!c) return;
  AUTO_FONDEO.forEach(k => {
    if (k === i.name || tocado(k)) return;
    if (k === "usd") { el.usd.value = enCampo(M.red(M.numero(el.usdEnviado.value) - (M.numero(el.comisionAirtm.value) || 0) - (M.numero(el.comisionTransferencia.value) || 0))); return; }
    el[k].value = enCampo(c[k]);
  });
}

function vistaPrevia(f) {
  const p = f.querySelector("[data-inv-total]");
  if (!p || !est) return;
  const v = leer(f), n = k => M.numero(v[k]);
  let t = "";
  if (est.modo === "ronda") t = previaRonda(f);
  else if (est.tipo === "compra" || est.tipo === "venta") {
    const c = n("cantidad"), pr = n("precio"), com = n("comision") || 0;
    if (c > 0 && pr > 0) {
      const bruto = c * pr;
      t = est.tipo === "compra"
        ? `Total: <b>${M.usd(bruto + com)}</b>${com ? ` (con ${M.usd(com)} de comisión)` : ""}.`
        : `Recibes: <b>${M.usd(bruto - com)}</b>${com ? ` (después de ${M.usd(com)} de comisión)` : ""}.`;
      if (est.completar) t += ` Tu registro decía ${M.usd(est.monto)}.`;
      if (est.tipo === "venta") {
        const tk = String(v.ticker || "").trim().toUpperCase();
        const tengo = M.cantidades(movs, est.id)[tk] || 0;
        if (tk && c > tengo + 1e-9) t += `<br>⚠️ Según tus registros tienes ${M.cantidadTexto(Math.max(0, tengo))} ${esc(tk)}. Puedes guardarla igual si te falta anotar compras.`;
      }
    }
  } else if (est.tipo === "fondeo") {
    const env = n("usdEnviado"), rec = n("usd"), b = n("bs");
    const com = (n("comisionAirtm") || 0) + (n("comisionTransferencia") || 0);
    if (rec > 0) {
      t = `Comisiones: <b>${M.usd(com)}</b>${env > 0 ? ` (${M.pct((com / env) * 100)} de lo enviado)` : ""}.`;
      if (b > 0) t += ` Cada US$ que llegó al broker te costó <b>${decimales(b / rec, 2)} Bs</b>.`;
    }
  }
  p.innerHTML = t;
  p.hidden = !t;
}

function mostrarErrores(f, errores, buscar) {
  f.querySelectorAll(".is-error").forEach(el => { el.classList.remove("is-error"); el.removeAttribute("aria-invalid"); });
  errores.forEach(e => {
    const el = buscar ? buscar(e) : f.querySelector(`[name="${e.campo}"]`);
    if (el) { el.classList.add("is-error"); el.setAttribute("aria-invalid", "true"); }
  });
  const p = f.querySelector(".inv-error");
  p.innerHTML = errores.map(e => esc(e.texto)).join("<br>");
  p.hidden = false;
  if (p.scrollIntoView) p.scrollIntoView({ block: "nearest" });
}
const avisarFallo = err => alert(`No se pudo guardar: ${err && err.message ? err.message : err}`);

function alEnviar(e) {
  e.preventDefault();
  if (!est) return;
  if (est.modo === "ronda") guardarRonda(e.target);
  else if (est.modo === "precio") guardarPrecio(e.target);
  else guardarMov(e.target);
}

function guardarMov(f) {
  const r = M.validar(est.tipo, leer(f), { hoy: hoyLocal(), viejo: est.viejo });
  if (!r.ok) { mostrarErrores(f, r.errores); return; }
  let p;
  if (!est.id) p = coleccion().add(Object.assign(r.doc, { creado: Date.now() }));
  // Registro viejo: solo se agregan campos nuevos (date, name, amount y notes quedan igual).
  else if (est.viejo) p = coleccion().doc(est.id).update(M.camposCompletar(r.doc));
  else p = coleccion().doc(est.id).update(r.doc);
  p.catch(avisarFallo);
  cerrarHoja();
}

function borrarMov() {
  const id = est && est.id;
  if (!id) return;
  const texto = est.viejo
    ? "Es un registro anterior a esta versión. ¿Eliminarlo de todos modos? No se puede deshacer."
    : "¿Eliminar este movimiento? No se puede deshacer.";
  if (!confirm(texto)) return;
  coleccion().doc(id).delete().catch(err => alert(`No se pudo eliminar: ${err && err.message ? err.message : err}`));
  cerrarHoja();
}

// ---------- Ronda DCA ----------
function abrirRonda() {
  const a = aj(), hoy = hoyLocal();
  const tickers = M.nucleo(a);
  est = { modo: "ronda" };
  const filas = tickers.map(t => `
        <div class="inv-ronda-fila" data-ticker="${esc(t)}">
          <b class="inv-ronda-ticker">${esc(t)}</b>
          <div class="inv-ronda-campos">
            ${campo("monto", "Monto US$", enCampo(a.tickers[t].dca, true))}
            ${campo("precio", "Precio", "")}
            ${campo("cantidad", "Cantidad", "", "decimal", { placeholder: "0,000000" })}
          </div>
        </div>`).join("");
  abrirHoja("Ronda DCA", `
      <form class="inv-form inv-ronda" novalidate>
        <p class="inv-aviso-ronda" data-inv-ya hidden></p>
        ${par(campo("fecha", "Fecha", hoy, "fecha"), campo("broker", "Broker", a.broker, "broker"))}
        ${tickers.length ? filas : `<p class="empty-state">No hay tickers en tu núcleo. Agrégalos en Ajustes.</p>`}
        <p class="inv-ayuda">Escribe el precio al que compraste cada uno; la cantidad se calcula con el monto (corrígela si tu broker dice otra). Deja vacío lo que no compraste. Comisión: ${M.usd(a.comisionTicker)} por ticker.</p>
        <p class="inv-total" data-inv-total></p>
        <p class="inv-error" role="alert" hidden></p>
        <div class="inv-hoja-acciones"><button type="submit" class="inv-btn">Guardar ronda</button></div>
      </form>
      ${listas()}`);
  vistaPrevia(hoja.querySelector(".inv-form"));
}
function filasRonda(f) {
  return Array.from(f.querySelectorAll(".inv-ronda-fila")).map(r => {
    const c = r.querySelector('[name="cantidad"]');
    return { ticker: r.dataset.ticker, monto: r.querySelector('[name="monto"]').value, precio: r.querySelector('[name="precio"]').value, cantidad: c.dataset.tocado ? c.value : "" };
  });
}
function enlazarRonda(i) {
  const r = i.closest(".inv-ronda-fila");
  if (!r) return;
  const c = r.querySelector('[name="cantidad"]');
  if (i === c) { if (c.value.trim()) c.dataset.tocado = "1"; else delete c.dataset.tocado; return; }
  if (c.dataset.tocado) return;
  const q = M.cantidadDesdeMonto(r.querySelector('[name="monto"]').value, r.querySelector('[name="precio"]').value);
  c.value = q == null ? "" : enCampo(q);
}
function previaRonda(f) {
  const fecha = f.elements.fecha.value, mes = M.mesDe(fecha);
  const ya = M.comprasDeRonda(movs, mes);
  const aviso = f.querySelector("[data-inv-ya]");
  aviso.hidden = !ya.length;
  if (ya.length) aviso.textContent = `Ya anotaste ${ya.length} ${ya.length === 1 ? "compra" : "compras"} de la ronda de ${nombreMes(fecha)}. Si guardas, se suman.`;
  const com = aj().comisionTicker;
  let n = 0, total = 0;
  f.querySelectorAll(".inv-ronda-fila").forEach(r => {
    const c = M.numero(r.querySelector('[name="cantidad"]').value), p = M.numero(r.querySelector('[name="precio"]').value);
    if (c > 0 && p > 0) { n++; total += c * p; }
  });
  if (!n) return "";
  return `${n} ${n === 1 ? "compra" : "compras"} · ${M.usd(total)} + ${M.usd(n * com)} de comisiones = <b>${M.usd(total + n * com)}</b>`;
}
function guardarRonda(f) {
  const r = M.ronda({ fecha: f.elements.fecha.value, broker: f.elements.broker.value, filas: filasRonda(f) }, guardados, { hoy: hoyLocal() });
  if (!r.ok) {
    mostrarErrores(f, r.errores, e => {
      if (e.campo === "fecha") return f.elements.fecha;
      const fila = e.ticker && f.querySelector(`.inv-ronda-fila[data-ticker="${CSS.escape(e.ticker)}"]`);
      return fila ? fila.querySelector(`[name="${e.campo.split(".").pop()}"]`) : null;
    });
    return;
  }
  const lote = db.batch(), ahora = Date.now();
  r.docs.forEach((d, i) => lote.set(coleccion().doc(), Object.assign(d, { creado: ahora + i })));
  lote.commit().catch(avisarFallo);
  cerrarHoja();
}

// ---------- Ajustes ----------
function renderAjustes() {
  const el = $("inv-ajustes");
  if (!borrador) borrador = JSON.parse(JSON.stringify(aj()));
  const b = borrador, tickers = M.nucleo(b);
  el.innerHTML = `
    <form class="inv-form inv-ajustes" novalidate>
      <section class="inv-bloque">
        <h3>Broker y comisiones</h3>
        ${campo("broker", "Broker por defecto", b.broker, "broker")}
        <p class="inv-ayuda">Cuando pases a IBKR, cámbialo aquí: los movimientos nuevos usarán ese broker.</p>
        ${par(campo("comisionTicker", "Comisión por ticker (US$)", enCampo(b.comisionTicker)), campo("tasaEfectivo", "Interés del efectivo (% anual)", enCampo(b.tasaEfectivo)))}
        ${par(campo("comisionAirtm", "AirTM: Bs → US$ (%)", enCampo(b.comisionAirtm)), campo("comisionTransferencia", "AirTM → broker (%)", enCampo(b.comisionTransferencia)))}
      </section>
      <section class="inv-bloque">
        <h3>Núcleo: ronda DCA y objetivo</h3>
        <p class="inv-ayuda">Los tickers del núcleo, cuánto pones en cada uno al mes y qué % de tu cartera quieres en cada uno. Cualquier otro ticker cuenta como satélite.</p>
        <div class="inv-dca-lista">
          ${tickers.length ? `<div class="inv-dca-fila is-cabecera" aria-hidden="true"><span>Ticker</span><span>US$ al mes</span><span>Objetivo %</span><span></span></div>` : ""}
          ${tickers.map(t => `
          <div class="inv-dca-fila" data-ticker="${esc(t)}">
            <b>${esc(t)}</b>
            <input name="dca" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" aria-label="Monto mensual de ${esc(t)} (US$)" value="${esc(enCampo(b.tickers[t].dca, true))}">
            <input name="objetivo" type="text" inputmode="decimal" autocomplete="off" placeholder="0" aria-label="Objetivo de ${esc(t)} (%)" value="${esc(enCampo(typeof b.tickers[t].objetivo === "number" ? b.tickers[t].objetivo : 0))}">
            <button type="button" class="inv-quitar" data-inv-quitar="${esc(t)}" aria-label="Quitar ${esc(t)} del núcleo">✕</button>
          </div>`).join("") || `<p class="empty-state">Sin tickers en el núcleo.</p>`}
        </div>
        ${campo("objetivoSatelite", "Satélite: objetivo para todo el grupo (%)", enCampo(b.objetivoSatelite))}
        <div class="inv-dca-nuevo">
          <input name="nuevoTicker" type="text" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="10" placeholder="Ticker (ej: VXUS)" aria-label="Ticker para agregar al núcleo">
          <button type="button" class="inv-btn-sec" data-inv="agregar-ticker">Agregar</button>
        </div>
        <p class="inv-total" data-inv-total-dca></p>
        <p class="inv-total" data-inv-total-obj></p>
      </section>
      <p class="inv-error" role="alert" hidden></p>
      <div class="inv-hoja-acciones">
        <span class="inv-guardado" role="status"${Date.now() - guardadoEn < 4000 ? "" : " hidden"}>Guardado ✓</span>
        <button type="submit" class="inv-btn">Guardar ajustes</button>
      </div>
    </form>`;
  totalDca();
}
const formAjustes = () => $("inv-ajustes").querySelector(".inv-ajustes");
// Pasa lo escrito al borrador (sin validar) antes de volver a pintar.
function tomarBorrador() {
  const f = formAjustes();
  if (!f || !borrador) return;
  ["broker", "comisionTicker", "tasaEfectivo", "comisionAirtm", "comisionTransferencia", "objetivoSatelite"].forEach(k => {
    const v = f.elements[k].value;
    borrador[k] = k === "broker" ? v : (isFinite(M.numero(v)) ? M.numero(v) : borrador[k]);
  });
  f.querySelectorAll(".inv-dca-fila[data-ticker]").forEach(r => {
    const n = M.numero(r.querySelector('[name="dca"]').value), o = M.numero(r.querySelector('[name="objetivo"]').value);
    borrador.tickers[r.dataset.ticker].dca = isFinite(n) ? n : 0;
    borrador.tickers[r.dataset.ticker].objetivo = isFinite(o) ? o : 0;
  });
}
function totalDca() {
  const f = formAjustes();
  if (!f) return;
  let n = 0, total = 0;
  f.querySelectorAll('.inv-dca-fila [name="dca"]').forEach(i => { const v = M.numero(i.value); if (v > 0) { n++; total += v; } });
  const com = M.numero(f.elements.comisionTicker.value);
  const c = isFinite(com) ? com * n : 0;
  f.querySelector("[data-inv-total-dca]").innerHTML = n ? `Al mes: ${M.usd(total)} + ${M.usd(c)} de comisiones = <b>${M.usd(total + c)}</b>` : "";
  let obj = 0;
  f.querySelectorAll('.inv-dca-fila [name="objetivo"]').forEach(i => { const v = M.numero(i.value); if (v > 0) obj += v; });
  const sat = M.numero(f.elements.objetivoSatelite.value);
  obj = M.red(obj + (sat > 0 ? sat : 0), 2);
  f.querySelector("[data-inv-total-obj]").innerHTML = Math.abs(obj - 100) < 0.05
    ? `Objetivos: suman <b>100 %</b> ✓`
    : `⚠️ Los objetivos suman <b>${M.pct(obj)}</b>: deberían sumar 100 %.`;
}
function agregarTicker() {
  const f = formAjustes();
  const t = String(f.elements.nuevoTicker.value || "").trim().toUpperCase();
  if (!M.tickerOk(t)) { mostrarErrores(f, [{ campo: "nuevoTicker", texto: "Escribe un ticker válido (ej: VXUS)." }]); return; }
  tomarBorrador();
  if (!borrador.tickers[t] || borrador.tickers[t].grupo !== "nucleo") {
    const orden = Math.max(-1, ...Object.values(borrador.tickers).map(x => (typeof x.orden === "number" ? x.orden : -1))) + 1;
    borrador.tickers[t] = { grupo: "nucleo", dca: 0, objetivo: 0, orden };
  }
  sucio = true;
  renderAjustes();
}
function quitarTicker(t) {
  if (!borrador || !borrador.tickers[t]) return;
  tomarBorrador();
  delete borrador.tickers[t];
  sucio = true;
  renderAjustes();
}
$("inv-ajustes").addEventListener("input", e => {
  sucio = true;
  if (e.target.classList.contains("is-error")) { e.target.classList.remove("is-error"); e.target.removeAttribute("aria-invalid"); }
  const ok = $("inv-ajustes").querySelector(".inv-guardado");
  if (ok) ok.hidden = true;
  guardadoEn = 0;
  totalDca();
});
$("inv-ajustes").addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target, errores = [];
  const valor = (k, nombre) => {
    const n = M.numero(f.elements[k].value);
    if (!isFinite(n) || n < 0) { errores.push({ campo: k, texto: `Revisa ${nombre}.` }); return 0; }
    return M.red(n, 4);
  };
  const doc = {
    v: 1,
    broker: f.elements.broker.value.trim().slice(0, 40),
    comisionTicker: valor("comisionTicker", "la comisión por ticker"),
    tasaEfectivo: valor("tasaEfectivo", "el interés del efectivo"),
    comisionAirtm: valor("comisionAirtm", "la comisión de AirTM"),
    comisionTransferencia: valor("comisionTransferencia", "la comisión de transferencia"),
    objetivoSatelite: valor("objetivoSatelite", "el objetivo del satélite"),
    tickers: {},
    preciosManuales: (guardados && guardados.preciosManuales) || {}
  };
  if (!doc.broker) errores.push({ campo: "broker", texto: "Escribe el broker." });
  Object.keys(borrador.tickers).forEach(t => { doc.tickers[t] = Object.assign({}, borrador.tickers[t]); });
  const malos = [];
  f.querySelectorAll(".inv-dca-fila[data-ticker]").forEach(r => {
    const i = r.querySelector('[name="dca"]'), io = r.querySelector('[name="objetivo"]');
    const n = i.value.trim() === "" ? 0 : M.numero(i.value);
    const o = io.value.trim() === "" ? 0 : M.numero(io.value);
    if (!isFinite(n) || n < 0) malos.push(i); else doc.tickers[r.dataset.ticker].dca = M.red(n);
    if (!isFinite(o) || o < 0 || o > 100) malos.push(io); else doc.tickers[r.dataset.ticker].objetivo = M.red(o, 2);
  });
  if (doc.objetivoSatelite > 100) errores.push({ campo: "objetivoSatelite", texto: "El objetivo del satélite va de 0 a 100 %." });
  if (malos.length) errores.push({ campo: "dca", texto: "Revisa los montos y objetivos del núcleo (objetivos de 0 a 100 %)." });
  if (errores.length) { mostrarErrores(f, errores, e2 => (e2.campo === "dca" ? null : f.elements[e2.campo])); malos.forEach(i => i.classList.add("is-error")); return; }
  refAjustes().set(JSON.parse(JSON.stringify(doc))).catch(avisarFallo); // sin campos vacíos (Firestore no acepta undefined)
  guardados = doc;
  borrador = null;
  sucio = false;
  guardadoEn = Date.now();
  renderAjustes();
});

// ---------- Datos ----------
onAuthReady(() => {
  coleccion().onSnapshot(snap => {
    docs = {};
    snap.docs.forEach(d => { docs[d.id] = d.data(); });
    movs = Object.keys(docs).map(id => M.normalizar(id, docs[id])).filter(m => m.tipo !== "desconocido");
    cargado = true;
    if (vista !== "ajustes") render();
  }, err => console.warn("Inversiones:", err));
  refAjustes().onSnapshot(s => {
    guardados = s.exists ? s.data() : null;
    if (vista !== "ajustes") render();
    else if (!sucio) { borrador = null; renderAjustes(); }
  }, err => console.warn("Inversiones (ajustes):", err));
});
render();
cargarPrecios();
})();
