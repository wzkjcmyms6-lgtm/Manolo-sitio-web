// ---------- Running: pantalla de importación ----------
// Elegir archivos → vista previa → guardar con avance → listo. Después, en
// segundo plano, clima y lugar. La lógica vive en módulos sin pantalla:
// run-formatos (GPX/TCX/FIT), run-zip (ZIP/gzip por partes), run-csv
// (activities.csv), run-metricas (cálculos), run-guardar (duplicados,
// fusión, lotes) y run-enriquecer (clima y lugar). Diseño: docs/RUNNING.md,
// decisiones D-062 a D-067.
(function () {
"use strict";
const F = window.RunFormatos, Z = window.RunZip, C = window.RunCsv, M = window.RunMetricas, G = window.RunGuardar, E = window.RunEnriquecer;
const CLAVE_LUGARES = "manolo.run.lugares";
const MAX_FILAS = 300;

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const usuario = () => db.collection("users").doc(currentUser.uid);
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const fechaCorta = ms => { const d = new Date(ms); return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`; };
const km = m => `${(Math.round((m || 0) / 10) / 100).toFixed(2).replace(".", ",")} km`;
const NOMBRE_DEP = { running: "Carrera", bicicleta: "Bici" };
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const tick = () => new Promise(r => setTimeout(r, 0));

let hoja = null, estado = null, ocupado = false;

// ---- Hoja ----
function crearHoja() {
  hoja = document.createElement("div");
  hoja.id = "ri-hoja";
  hoja.className = "js-sheet budget-sheet ri-hoja";
  hoja.hidden = true;
  hoja.innerHTML = `
    <div class="budget-sheet-overlay"></div>
    <div class="budget-sheet-panel ri-panel" role="dialog" aria-modal="true" aria-labelledby="ri-titulo">
      <div class="budget-sheet-header">
        <button type="button" class="budget-sheet-close" aria-label="Cerrar"><span data-icon="close"></span></button>
        <h3 id="ri-titulo">Importar carreras</h3>
      </div>
      <div class="ri-cuerpo" id="ri-cuerpo" aria-live="polite"></div>
      <div class="txn-sheet-actions ri-acciones" id="ri-acciones"></div>
      <input type="file" id="ri-archivos" multiple hidden>
    </div>`;
  document.body.appendChild(hoja);
  if (typeof renderIcons === "function") renderIcons(hoja);
  hoja.addEventListener("click", e => {
    if (e.target.closest(".budget-sheet-close") || e.target.classList.contains("budget-sheet-overlay")) return cerrar();
    const b = e.target.closest("[data-ri]");
    if (!b) return;
    const a = b.dataset.ri;
    if (a === "elegir") document.getElementById("ri-archivos").click();
    else if (a === "importar") guardar();
    else if (a === "otra") pantallaInicio();
    else if (a === "cerrar") cerrar();
  });
  hoja.addEventListener("change", e => {
    if (e.target.id === "ri-archivos") {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      if (files.length) analizar(files);
      return;
    }
    const sel = e.target.closest("[data-ri-dep]");
    if (sel && estado) {
      const c = estado.candidatos[Number(sel.dataset.riDep)];
      if (sel.value === "no") c.incluir = false;
      else { c.deporte = sel.value; c.incluir = true; }
      clasificarTodo();
      pantallaPrevia();
    }
    const un = e.target.closest("[data-ri-unir]");
    if (un && estado) {
      const c = estado.candidatos[Number(un.dataset.riUnir)];
      c.unir = un.value === "unir";
      clasificarTodo();
      pantallaPrevia();
    }
  });
}
function abrir() {
  if (!hoja) crearHoja();
  hoja.classList.remove("is-closing");
  hoja.hidden = false;
  document.body.classList.add("sheet-open");
  if (!ocupado) pantallaInicio();
}
function cerrar() {
  if (ocupado && !confirm("Se está guardando. ¿Cerrar igual? Lo que ya se guardó queda guardado.")) return;
  hoja.classList.add("is-closing");
  setTimeout(() => {
    hoja.hidden = true;
    hoja.classList.remove("is-closing");
    document.body.classList.toggle("sheet-open", !!document.querySelector(".js-sheet:not([hidden])"));
  }, 200);
}
function pintar(cuerpo, acciones) {
  document.getElementById("ri-cuerpo").innerHTML = cuerpo;
  document.getElementById("ri-acciones").innerHTML = acciones || "";
}

// ---- Pantallas ----
const GUIA = `
  <details class="ri-guia">
    <summary>Cómo traer mis carreras</summary>
    <h4>Todo tu historial de Strava</h4>
    <ol>
      <li>Entra a strava.com desde el navegador (en el iPhone, Safari; la app no lo tiene).</li>
      <li>Tu foto → Ajustes → Mi cuenta → la opción para descargar o eliminar tu cuenta → pide tu archivo.</li>
      <li>Te llega un correo con el enlace (puede tardar unas horas). Descarga el ZIP: en el iPhone queda en Archivos › Descargas.</li>
      <li>Aquí toca <b>Elegir archivos</b> y elige ese ZIP, sin descomprimirlo.</li>
    </ol>
    <p>Una sola actividad: en la web, ábrela y en el menú de los tres puntos expórtala como GPX o en su archivo original.</p>
    <h4>Apple Salud</h4>
    <p>App Salud → tu foto → exportar todos los datos → guarda el ZIP en Archivos y elígelo aquí. Se importan los recorridos con mapa; como no dicen el deporte, revísalo en la vista previa.</p>
    <h4>Reloj u otras apps</h4>
    <p>Exporta la actividad como FIT, GPX o TCX (en la web o la app de tu reloj) y elígela aquí. De adidas Running se importan los GPX que traiga su ZIP.</p>
  </details>`;
function pantallaInicio() {
  estado = null;
  pintar(`
    <p class="ri-texto">Trae tus carreras con su ruta, parciales y mejores marcas. Se aceptan archivos <b>GPX, TCX y FIT</b> (también .gz), varios a la vez, y el <b>ZIP completo</b> de tu cuenta de Strava.</p>
    <p class="ri-nota">Nada se borra: si una carrera ya estaba, se salta; si coincide con una rutina guiada o una carrera anotada a mano, se le suma la ruta.</p>
    ${GUIA}`,
    `<button type="button" class="txn-save" data-ri="elegir">Elegir archivos</button>`);
}
function pantallaAvance(titulo, hechas, total, detalle) {
  const pct = total ? Math.round(100 * hechas / total) : 0;
  pintar(`
    <div class="ri-avance">
      <p><b>${esc(titulo)}</b></p>
      <div class="ri-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${hechas}"><i style="width:${pct}%"></i></div>
      <p class="ri-nota">${total ? `${hechas} de ${total}` : ""}${detalle ? ` · ${esc(detalle)}` : ""}</p>
    </div>`, "");
}
function pantallaError(msj) {
  pintar(`<p class="ri-error">${esc(msj)}</p>${GUIA}`, `<button type="button" class="txn-save" data-ri="otra">Elegir otros archivos</button>`);
}

// ---- Datos del dueño ----
async function cargarContexto() {
  const u = usuario();
  const [run, bici, aj, perfil] = await Promise.all([
    u.collection("running").get(), u.collection("bicicleta").get(),
    u.collection("meta").doc("running_ajustes").get(), u.collection("meta").doc("perfil_ejercicio").get()
  ]);
  const lista = s => s.docs.map(d => Object.assign({ id: d.id }, d.data()));
  const ajustes = aj.exists ? aj.data() : {};
  const pesajes = perfil.exists ? (perfil.data().pesajes || {}) : {};
  const fechas = Object.keys(pesajes).filter(f => pesajes[f] > 0).sort();
  const existentes = { running: lista(run), bicicleta: lista(bici) };
  const fcVista = existentes.running.concat(existentes.bicicleta).reduce((m, d) => Math.max(m, Number(d.fcMax) || 0), 0);
  return {
    existentes,
    opciones: {
      fcMax: Number(ajustes.fcMax) || null, fcMaxVista: fcVista, fcReposo: Number(ajustes.fcReposo) || null,
      ritmoUmbralS: Number(ajustes.ritmoUmbralS) || null,
      pesoKg: fechas.length ? Number(pesajes[fechas[fechas.length - 1]]) : Number(ajustes.pesoKg) || null
    }
  };
}
// FC máx: la de Ajustes; si no hay, la más alta vista hasta ahora (estimada, D-065).
function opcionesPara(act) {
  const o = estado.ctx.opciones;
  if (o.fcMax) return o;
  const fcAct = (act.puntos || []).reduce((m, p) => (p.fc > 30 && p.fc < 230 ? Math.max(m, p.fc) : m), Number(act.resumen && act.resumen.fcMax) || 0);
  o.fcMaxVista = Math.max(o.fcMaxVista || 0, fcAct);
  return Object.assign({}, o, { fcMax: o.fcMaxVista >= 150 ? o.fcMaxVista : null });
}

// ---- Análisis (vista previa) ----
// Candidata: { nombre, inicio, deporte, deporteSabido, subtipo, titulo,
//   descripcion, origen, campos, ruta, cargar? (lectura diferida), incluir, unir, clase }
function candidataDeActividad(act, nombre, extra) {
  const res = M.calcular(act, opcionesPara(act));
  const x = extra || {};
  const dep = x.deporte || act.deporte;
  return {
    nombre, inicio: res.campos.inicio,
    deporte: dep, deporteSabido: !!dep, subtipo: x.subtipo || act.subtipo || null,
    titulo: x.titulo || act.titulo || null, descripcion: x.descripcion || act.descripcion || null,
    origen: Object.assign({ formato: act.formato }, x.origen || {}, act.dispositivo ? { dispositivo: act.dispositivo } : {}),
    campos: res.campos, ruta: res.ruta, incluir: true, unir: true
  };
}
// Sin deporte en el archivo: se adivina por la velocidad (se puede cambiar).
function adivinar(c) {
  const v = c.campos.tiempoMovS > 0 ? c.campos.distanciaM / c.campos.tiempoMovS : 0;
  return v > 6.5 ? "bicicleta" : v >= 1.9 ? "running" : null;
}
async function leerSuelto(file) {
  const bytes = await Z.sinGzip(new Uint8Array(await file.arrayBuffer()));
  return F.leer(bytes, file.name.replace(/\.gz$/i, ""));
}
const base = n => String(n || "").split("/").pop().replace(/\.gz$/i, "").toLowerCase();

async function analizar(files) {
  ocupado = true;
  estado = { candidatos: [], otros: {}, errores: [], faltan: 0 };
  try {
    pantallaAvance("Revisando tus archivos…", 0, files.length);
    estado.ctx = await cargarContexto();
    let csv = null;
    const sueltos = [];
    for (const f of files) {
      const cab = new Uint8Array(await f.slice(0, 4096).arrayBuffer());
      const tipo = F.tipoDe(cab, f.name);
      if (tipo === "zip") await analizarZip(f);
      else if (tipo === "csv") csv = C.leer(await f.text());
      else if (tipo) sueltos.push(f);
      else estado.errores.push(`${f.name}: no es un archivo de actividad (se aceptan GPX, TCX, FIT y ZIP).`);
    }
    const filasCsv = {};
    if (csv) csv.actividades.forEach(a => { if (a.archivo) filasCsv[base(a.archivo)] = a; });
    for (let i = 0; i < sueltos.length; i++) {
      const f = sueltos[i];
      pantallaAvance("Leyendo archivos…", i, sueltos.length, f.name);
      await tick();
      try {
        const act = await leerSuelto(f);
        const fila = filasCsv[base(f.name)];
        if (fila) delete filasCsv[base(f.name)];
        agregar(act, f.name, fila ? extraDeFila(fila) : null);
      } catch (e) {
        estado.errores.push(`${f.name}: ${e.message || "no se pudo leer."}`);
      }
    }
    if (csv) {
      csv.errores.forEach(x => estado.errores.push(`activities.csv: ${x}`));
      csv.actividades.forEach(a => { if (!a.archivo) agregarResumen(a); });
      estado.faltan += Object.keys(filasCsv).length;
    }
    if (!estado.candidatos.length && !Object.keys(estado.otros).length) {
      ocupado = false;
      return pantallaError(estado.errores[0] || "No se encontraron actividades en esos archivos.");
    }
    clasificarTodo();
    ocupado = false;
    pantallaPrevia();
  } catch (e) {
    ocupado = false;
    console.error("Manolo: importar", e);
    pantallaError(e && e.message ? e.message : "No se pudieron leer los archivos.");
  }
}
function extraDeFila(a) {
  return {
    deporte: a.deporte === "running" || a.deporte === "bicicleta" ? a.deporte : null,
    subtipo: a.subtipo, titulo: a.titulo, descripcion: a.descripcion,
    origen: { app: "strava", archivo: a.archivo, idExterno: a.idExterno, equipo: a.equipo }
  };
}
function agregar(act, nombre, extra) {
  if (extra && extra.origen && extra.origen.idExterno == null) delete extra.origen.idExterno;
  const dep = (extra && extra.deporte) || act.deporte;
  if (dep === "otro") { contarOtro(act.deporteOriginal || "otro deporte"); return; }
  const c = candidataDeActividad(act, nombre, extra);
  if (!c.deporte) c.deporte = adivinar(c);
  if (!c.deporte) { c.deporte = "running"; c.incluir = false; c.lenta = true; }
  estado.candidatos.push(c);
}
function contarOtro(tipo) { estado.otros[tipo] = (estado.otros[tipo] || 0) + 1; }
// Actividad del CSV sin archivo (anotada a mano en la app de origen).
function agregarResumen(a, nombre) {
  if (a.deporte !== "running" && a.deporte !== "bicicleta") { contarOtro(a.tipo || "otro deporte"); return; }
  const act = { formato: "csv", deporte: a.deporte, subtipo: a.subtipo, inicio: a.inicio, puntos: [], resumen: { distM: a.distM, tiempoTotalS: a.tiempoTotalS, tiempoMovS: a.tiempoMovS, ascensoM: a.ascensoM, fcMedia: a.fcMedia, fcMax: a.fcMax, kcal: a.kcal } };
  const c = candidataDeActividad(act, nombre || a.titulo || "Actividad", extraDeFila(a));
  c.soloResumen = true;
  estado.candidatos.push(c);
}

// ZIP: el export de Strava (activities.csv) o cualquier ZIP con archivos de actividad.
async function analizarZip(file) {
  const fuente = Z.desdeArchivo(file);
  const entradas = (await Z.listar(fuente)).filter(e => !e.carpeta && !/(^|\/)(__MACOSX|\.)/.test(e.nombre));
  const csvE = entradas.find(e => /(^|\/)activities\.csv$/i.test(e.nombre));
  if (csvE) {
    const csv = C.leer(new TextDecoder("utf-8").decode(await Z.extraer(fuente, csvE)));
    csv.errores.forEach(x => estado.errores.push(`activities.csv: ${x}`));
    const porNombre = {};
    entradas.forEach(e => { porNombre[e.nombre.toLowerCase()] = e; porNombre[base(e.nombre)] = porNombre[base(e.nombre)] || e; });
    const prefijo = csvE.nombre.slice(0, csvE.nombre.length - "activities.csv".length).toLowerCase();
    csv.actividades.forEach(a => {
      if (a.deporte !== "running" && a.deporte !== "bicicleta") { contarOtro(a.tipo || "otro deporte"); return; }
      if (!a.archivo) { agregarResumen(a); return; }
      const ent = porNombre[(prefijo + a.archivo).toLowerCase()] || porNombre[a.archivo.toLowerCase()] || porNombre[base(a.archivo)];
      if (!ent) { estado.faltan++; agregarResumen(a); return; }
      // Vista previa con los datos del CSV; el archivo se lee al guardar.
      const act = { formato: "csv", deporte: a.deporte, inicio: a.inicio, puntos: [], resumen: { distM: a.distM, tiempoTotalS: a.tiempoTotalS, tiempoMovS: a.tiempoMovS } };
      const c = candidataDeActividad(act, a.titulo || ent.nombre, extraDeFila(a));
      c.cargar = async () => {
        const bytes = await Z.sinGzip(await Z.extraer(fuente, ent));
        return F.leer(bytes, ent.nombre.replace(/\.gz$/i, ""));
      };
      c.filaCsv = a;
      estado.candidatos.push(c);
    });
    return;
  }
  const archivos = entradas.filter(e => /\.(gpx|tcx|fit)(\.gz)?$/i.test(e.nombre));
  if (!archivos.length) { estado.errores.push(`${file.name}: el ZIP no tiene archivos GPX, TCX ni FIT.`); return; }
  const apple = entradas.some(e => /workout-routes\//i.test(e.nombre));
  for (let i = 0; i < archivos.length; i++) {
    const e = archivos[i];
    pantallaAvance("Leyendo el ZIP…", i, archivos.length, base(e.nombre));
    if (i % 5 === 0) await tick();
    try {
      const act = F.leer(await Z.sinGzip(await Z.extraer(fuente, e)), e.nombre.replace(/\.gz$/i, ""));
      agregar(act, base(e.nombre), { origen: { app: apple ? "apple" : null, archivo: e.nombre } });
    } catch (err) {
      estado.errores.push(`${base(e.nombre)}: ${err.message || "no se pudo leer."}`);
    }
  }
}

// Duplicadas y fusiones: contra lo guardado y contra lo de esta misma importación.
function clasificarTodo() {
  const aceptadas = { running: [], bicicleta: [] };
  estado.candidatos.slice().sort((a, b) => a.inicio - b.inicio).forEach(c => {
    if (!c.incluir) { c.clase = { accion: "omitida" }; return; }
    const col = G.colDe(c.deporte);
    const existentes = estado.ctx.existentes[col].concat(aceptadas[col]);
    let clase = G.clasificar(c, existentes);
    if (clase.accion === "fusionar" && !c.unir) clase = { accion: "nueva" };
    c.clase = clase;
    if (clase.accion === "fusionar") c.existente = existentes.find(e => e.id === clase.id);
    if (clase.accion !== "duplicada") aceptadas[col].push({ id: G.idPara(c), fuente: "importado", inicio: c.campos.inicio, distanciaM: c.campos.distanciaM, origen: c.origen });
  });
}

function pantallaPrevia() {
  const cs = estado.candidatos.slice().sort((a, b) => b.inicio - a.inicio);
  const por = k => cs.filter(c => c.clase.accion === k);
  const nuevas = por("nueva"), fusiones = por("fusionar"), dups = por("duplicada"), omitidas = por("omitida");
  const aGuardar = nuevas.length + fusiones.length;
  const otros = Object.keys(estado.otros);
  const nOtros = otros.reduce((s, k) => s + estado.otros[k], 0);
  const idx = c => estado.candidatos.indexOf(c);
  const fila = c => {
    const desconocido = !c.deporteSabido;
    const dep = desconocido
      ? `<select class="ri-select" data-ri-dep="${idx(c)}" aria-label="Deporte de ${esc(c.titulo || c.nombre)}">
          <option value="running"${c.incluir && c.deporte === "running" ? " selected" : ""}>Carrera</option>
          <option value="bicicleta"${c.incluir && c.deporte === "bicicleta" ? " selected" : ""}>Bici</option>
          <option value="no"${!c.incluir ? " selected" : ""}>No importar</option></select>`
      : `<span class="ri-dep">${NOMBRE_DEP[c.deporte]}</span>`;
    let estadoTxt = "";
    if (c.clase.accion === "fusionar") {
      const e = c.existente || {};
      const que = c.clase.con === "rutina" ? `tu rutina «${esc((e.rutina && e.rutina.nombre) || "guiada")}»` : `tu carrera anotada a mano (${esc(String(e.distance || 0).replace(".", ","))} km)`;
      estadoTxt = `<span class="ri-fusion">Se une a ${que}</span>
        <select class="ri-select" data-ri-unir="${idx(c)}" aria-label="Unir o guardar aparte"><option value="unir" selected>Unir</option><option value="aparte">Guardar aparte</option></select>`;
    } else if (c.unir === false && c.clase.accion === "nueva") {
      estadoTxt = `<select class="ri-select" data-ri-unir="${idx(c)}" aria-label="Unir o guardar aparte"><option value="unir">Unir</option><option value="aparte" selected>Guardar aparte</option></select>`;
    }
    const notas = [];
    if (desconocido) notas.push(c.lenta ? "Muy lenta para carrera: ¿caminata?" : "El archivo no dice el deporte");
    if (c.soloResumen) notas.push("Sin archivo: solo distancia y tiempo");
    return `<li class="ri-fila${c.incluir ? "" : " is-off"}">
      <div class="ri-fila-cab"><b>${esc(c.titulo || M.tituloAuto(c.deporte, c.inicio))}</b>${dep}</div>
      <div class="ri-fila-dato">${fechaCorta(c.inicio)} · ${km(c.campos.distanciaM)}${notas.length ? ` · <i>${esc(notas.join(" · "))}</i>` : ""}</div>
      ${estadoTxt ? `<div class="ri-fila-estado">${estadoTxt}</div>` : ""}
    </li>`;
  };
  const lista = l => l.slice(0, MAX_FILAS).map(fila).join("") + (l.length > MAX_FILAS ? `<li class="ri-mas">y ${l.length - MAX_FILAS} más</li>` : "");
  const desde = cs.length ? fechaCorta(cs[cs.length - 1].inicio) : "", hasta = cs.length ? fechaCorta(cs[0].inicio) : "";
  const kmTotal = nuevas.concat(fusiones).reduce((s, c) => s + (c.campos.distanciaM || 0), 0);
  pintar(`
    <div class="ri-resumen">
      <p class="ri-grande"><b>${plural(aGuardar, "actividad", "actividades")}</b> para guardar${aGuardar ? ` · ${km(kmTotal)}` : ""}</p>
      ${cs.length ? `<p class="ri-nota">Del ${desde} al ${hasta}</p>` : ""}
      <ul class="ri-chips">
        ${nuevas.length ? `<li>${plural(nuevas.length, "nueva", "nuevas")}</li>` : ""}
        ${fusiones.length ? `<li>${plural(fusiones.length, "se une", "se unen")} a algo tuyo</li>` : ""}
        ${dups.length ? `<li>${plural(dups.length, "ya estaba", "ya estaban")} (se salta${dups.length === 1 ? "" : "n"})</li>` : ""}
        ${nOtros ? `<li>${plural(nOtros, "de otro deporte", "de otros deportes")}</li>` : ""}
        ${estado.errores.length ? `<li class="ri-chip-error">${plural(estado.errores.length, "con error", "con error")}</li>` : ""}
      </ul>
    </div>
    ${nuevas.length || fusiones.length || omitidas.length ? `<ul class="ri-lista">${lista(fusiones.concat(nuevas, omitidas).sort((a, b) => b.inicio - a.inicio))}</ul>` : ""}
    ${dups.length ? `<details class="ri-mas-info"><summary>Ya estaban (${dups.length})</summary><ul class="ri-lista">${lista(dups)}</ul></details>` : ""}
    ${nOtros ? `<details class="ri-mas-info"><summary>Otros deportes, no se importan (${nOtros})</summary><p class="ri-nota">Manolo guarda carreras y rodadas. ${otros.map(k => `${esc(k)}: ${estado.otros[k]}`).join(" · ")}</p></details>` : ""}
    ${estado.faltan ? `<p class="ri-nota">${plural(estado.faltan, "actividad del CSV no tiene", "actividades del CSV no tienen")} su archivo en el ZIP: se guardan con distancia y tiempo.</p>` : ""}
    ${estado.errores.length ? `<details class="ri-mas-info" open><summary>No se pudieron leer (${estado.errores.length})</summary><ul class="ri-errores">${estado.errores.slice(0, 50).map(x => `<li>${esc(x)}</li>`).join("")}</ul></details>` : ""}`,
    `<button type="button" class="txn-save txn-save-otro" data-ri="otra">Cancelar</button>
     <button type="button" class="txn-save" data-ri="importar"${aGuardar ? "" : " disabled"}>Guardar ${aGuardar || ""}</button>`);
}

// ---- Guardar ----
// Con internet se espera a que Firestore confirme cada lote; sin internet
// quedan en el teléfono y se suben solos después (no se espera para siempre).
function confirmar(lote) {
  const p = lote.commit();
  if (navigator.onLine === false) { p.catch(e => console.error("Manolo: lote", e)); return Promise.resolve(); }
  return Promise.race([p, new Promise(r => setTimeout(r, 30000))]);
}
async function aplicar(ops) {
  for (const grupo of G.lotes(ops)) {
    const lote = db.batch();
    grupo.forEach(op => {
      const [colN, id] = op.ruta.split("/");
      const ref = usuario().collection(colN).doc(id);
      if (op.tipo === "update") lote.update(ref, op.datos); else lote.set(ref, op.datos);
    });
    await confirmar(lote);
  }
}
async function prepararNueva(c) {
  if (!c.cargar) return c;
  try {
    const act = await c.cargar();
    const x = candidataDeActividad(act, c.nombre, { deporte: c.deporte, subtipo: c.subtipo, titulo: c.titulo, descripcion: c.descripcion, origen: c.origen });
    return Object.assign({}, c, { campos: x.campos, ruta: x.ruta, origen: Object.assign({}, c.origen, x.origen, { formato: act.formato }) });
  } catch (e) {
    estado.avisos.push(`${c.titulo || c.nombre}: ${e.message || "no se pudo leer el archivo"}; se guardó con distancia y tiempo.`);
    return c;
  }
}
async function guardar() {
  if (ocupado || !estado) return;
  const lista = estado.candidatos.filter(c => c.clase && (c.clase.accion === "nueva" || c.clase.accion === "fusionar"));
  if (!lista.length) return;
  ocupado = true;
  estado.avisos = [];
  const ahora = Date.now();
  const guardadas = [];
  let ops = [], tam = 0;
  try {
    for (let i = 0; i < lista.length; i++) {
      pantallaAvance("Guardando…", i, lista.length, lista[i].titulo || "");
      await tick();
      const nueva = await prepararNueva(lista[i]);
      const o = G.operaciones(nueva, lista[i].clase, lista[i].existente, ahora);
      o.ops.forEach(op => { ops.push(op); tam += JSON.stringify(op.datos).length; });
      guardadas.push({ id: o.id, col: o.col, doc: o.doc });
      if (ops.length >= G.LOTE_OPS || tam >= G.LOTE_BYTES) { await aplicar(ops); ops = []; tam = 0; }
    }
    await aplicar(ops);
  } catch (e) {
    console.error("Manolo: guardar importación", e);
    ocupado = false;
    return pantallaError(`Algo falló al guardar (${e.message || "error desconocido"}). Vuelve a importar los mismos archivos: lo que ya se guardó se salta solo.`);
  }
  ocupado = false;
  pantallaListo(guardadas);
  completarFondo(guardadas.map(g => Object.assign({ id: g.id, col: g.col }, g.doc)));
}
function pantallaListo(guardadas) {
  const n = { running: 0, bicicleta: 0 };
  guardadas.forEach(g => { n[g.col]++; });
  const partes = [];
  if (n.running) partes.push(plural(n.running, "carrera", "carreras"));
  if (n.bicicleta) partes.push(plural(n.bicicleta, "rodada", "rodadas"));
  const reciente = guardadas.some(g => g.col === "running" && Date.now() - g.doc.inicio < 36 * 3600000);
  pintar(`
    <p class="ri-grande"><b>¡Listo!</b> Guardaste ${partes.join(" y ")}.</p>
    <p class="ri-nota">El clima y el lugar se completan solos en un rato (con internet).</p>
    ${estado.avisos.length ? `<ul class="ri-errores">${estado.avisos.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    ${reciente ? `<a class="ri-estirar" href="#movilidad" data-ri="cerrar">Estirar 3 min: rutina <b>Después de correr</b> →</a>` : ""}`,
    `<button type="button" class="txn-save txn-save-otro" data-ri="otra">Importar más</button>
     <button type="button" class="txn-save" data-ri="cerrar">Listo</button>`);
}

// ---- Clima y lugar en segundo plano ----
let enFondo = false;
const intentadas = new Set(); // una vez por sesión: si una no tiene clima (sin datos), no se insiste
const cacheLugares = {
  get(k) { try { return (JSON.parse(localStorage.getItem(CLAVE_LUGARES) || "{}"))[k] || null; } catch (e) { return null; } },
  set(k, v) { try { const o = JSON.parse(localStorage.getItem(CLAVE_LUGARES) || "{}"); o[k] = v; localStorage.setItem(CLAVE_LUGARES, JSON.stringify(o)); } catch (e) { /* sin espacio: no pasa nada */ } }
};
function completarFondo(docs) {
  if (enFondo || navigator.onLine === false || !window.fetch) return;
  const pendientes = docs.filter(d => d.mini && d.inicio > 0 && (!d.clima || !d.lugar) && !intentadas.has(d.id));
  if (!pendientes.length) return;
  enFondo = true;
  pendientes.slice(0, 60).forEach(d => intentadas.add(d.id));
  E.completar(pendientes.slice(0, 60), {
    // Sin cookies; el navegador manda solo el origen de Manolo (Nominatim pide identificar la app).
    fetch: url => fetch(url, { credentials: "omit" }),
    ahora: Date.now(), leerMini: M.leerMini, cache: cacheLugares,
    esperar: ms => new Promise(r => setTimeout(r, ms)),
    guardar: (id, col, campos) => usuario().collection(col).doc(id).update(campos)
  }).catch(e => console.warn("Manolo: clima/lugar", e)).then(() => { enFondo = false; });
}
// Lo que quedó pendiente de otras veces (sin leer nada extra: llega con la lista).
window.addEventListener("manolo:actividades", e => {
  const d = e.detail || {};
  completarFondo((d.docs || []).filter(x => x.fuente === "importado" || x.conImportado).map(x => Object.assign({ col: d.coleccion }, x)));
});

document.addEventListener("click", e => {
  if (e.target.closest("[data-ri-abrir]")) { e.preventDefault(); abrir(); }
});
window.RunImportar = { abrir };
})();
