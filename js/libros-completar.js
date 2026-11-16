// ---------- Libros: completar tu biblioteca (sin pantalla) ----------
// Nivel 3, fase 5 (D-133; diseño en docs/LIBROS_NIVEL3.md). Para los
// libros que ya tienes (escritos a mano, importados o buscados antes de
// D-129): qué les falta, con qué libro de Open Library se emparejan y qué se
// les puede sumar (también las páginas de la edición en español más común,
// a los que no tienen páginas). Solo se suma lo que falta: nunca se cambia lo que
// escribiste, salvo el título que la búsqueda vieja guardó en otro idioma
// ("Atomic Habits" → "Hábitos atómicos", y el de antes queda como título
// original), y siempre con tu OK (la pantalla está en
// js/libros-completar-ui.js).
// Sin DOM ni Firebase: tests/libros-completar.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./libros-motor.js"), require("./libros-fuentes.js"));
  else root.LibrosCompletar = factory(root.LibrosMotor, root.LibrosFuentes);
})(typeof self !== "undefined" ? self : this, function (L, F) {
"use strict";

const limpio = t => L.normalizar(t).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
// ¿Qué le falta? (lo que la búsqueda puede traer)
function falta(l) {
  const f = [];
  if (!l.autor) f.push("autor");
  if (!l.genero) f.push("genero");
  if (!l.temas || !l.temas.length) f.push("temas");
  if (!l.portada) f.push("portada");
  if (!l.anio) f.push("anio");
  if (!l.olKey) f.push("olKey");
  if (necesitaPaginas(l)) f.push("paginas");
  return f;
}
// Sin páginas (y no es audiolibro: esos van por tiempo o %).
const necesitaPaginas = l => !l.paginas && l.formato !== "audio";
// Los que vale la pena revisar: sin obra de Open Library o con algo
// importante por completar (autor, género, temas, portada o páginas). Los que ya
// revisaste ("Dejar como está") no vuelven, salvo que cambien.
const firma = l => `${limpio(l.titulo)}|${limpio(l.autor)}`;
function pendientes(libros, revisados) {
  const r = revisados || {};
  return (libros || []).filter(l => l && l.titulo && r[l.id] !== firma(l) && (!l.olKey || falta(l).some(c => ["autor", "genero", "temas", "portada", "paginas"].includes(c))));
}
// Qué se busca: el título y el apellido del autor (si hay).
function consulta(l) {
  const ap = l.autor && F.esLatino(l.autor) ? limpio(l.autor).split(" ").slice(-1)[0] : "";
  return `${String(l.titulo || "").trim()}${ap ? ` ${ap}` : ""}`.trim();
}
// ¿Es el mismo libro? "alta": título casi igual (el tuyo o el original) y,
// si tiene autor, el mismo; "media": parecido; null: no se propone.
function confianza(l, x) {
  if (!x || x.derivado) return null;
  const sim = Math.max(F.parecido(l.titulo, x.titulo), F.parecido(l.titulo, x.tituloOriginal || ""), F.parecido(x.titulo, l.titulo));
  const autorOk = !l.autor || !x.autor || F.mismoAutor(l.autor, x.autor) || limpio(x.autor).includes(limpio(l.autor).split(" ").slice(-1)[0] || "@");
  if (!autorOk) return null;
  if (sim >= 0.9) return "alta";
  if (sim >= 0.7) return "media";
  return null;
}
// De los resultados, el mejor que sea el mismo libro.
function emparejar(l, resultados) {
  for (const x of resultados || []) {
    const c = confianza(l, x);
    if (c) return { resultado: x, confianza: c };
  }
  return null;
}
// Las páginas que se proponen (de la recomendación de ediciones, D-130):
// solo de ediciones en español (la más común o la única); la mediana de
// todos los idiomas no (puede ser otro largo). Nunca menos que la página en
// la que vas.
function paginasDe(l, r) {
  if (!necesitaPaginas(l) || !r || !Number.isInteger(r.paginas) || r.paginas < 1) return null;
  if (r.razon !== "comun" && r.razon !== "unica") return null;
  if (Number.isInteger(l.paginaActual) && l.paginaActual > r.paginas) return null;
  return { paginas: r.paginas, texto: `Páginas: ${r.paginas} (${r.razon === "comun" ? "la edición en español más común" : "la edición en español que encontré"})` };
}
// Lo que se suma (y cómo decirlo). Solo lo que falta; el título, solo si
// el tuyo es el original de una edición en español. pag: de paginasDe().
function propuesta(l, x, pag) {
  const cambios = {}, lista = [];
  if (!l.tituloOriginal && x.tituloOriginal && limpio(l.titulo) === limpio(x.tituloOriginal) && limpio(x.titulo) !== limpio(l.titulo)) {
    cambios.titulo = x.titulo;
    cambios.tituloOriginal = l.titulo;
    lista.push({ campo: "titulo", texto: `Título en español: «${x.titulo}» (el tuyo queda como original)` });
  }
  if (!l.autor && x.autor && !x.autorRaro) { cambios.autor = x.autor; lista.push({ campo: "autor", texto: `Autor: ${x.autor}` }); }
  if (!l.autorKey && x.autorKey && (cambios.autor || (l.autor && x.autor && F.mismoAutor(l.autor, x.autor)))) cambios.autorKey = x.autorKey;
  if (!l.genero && x.genero && L.GENERO[x.genero]) { cambios.genero = x.genero; lista.push({ campo: "genero", texto: `Género: ${L.GENERO[x.genero].nombre}` }); }
  if ((!l.temas || !l.temas.length) && x.temas && x.temas.length) { cambios.temas = x.temas.slice(0, 5); lista.push({ campo: "temas", texto: `Temas: ${x.temas.slice(0, 5).join(", ")}` }); }
  if (!l.portada && x.url && L.portadaUrlOk(x.url)) { cambios.portada = { tipo: "url", url: x.url, fuente: "openlibrary" }; lista.push({ campo: "portada", texto: "Portada" }); }
  if (pag && necesitaPaginas(l)) { cambios.paginas = pag.paginas; lista.push({ campo: "paginas", texto: pag.texto }); }
  if (!l.anio && x.anio) { cambios.anio = x.anio; lista.push({ campo: "anio", texto: `Publicado: ${x.anio}` }); }
  if (!l.olKey && x.olKey) cambios.olKey = x.olKey;
  return { cambios, lista };
}
// Para "Deshacer": cómo estaba cada campo que se cambió.
function antes(l, cambios) {
  const o = {};
  Object.keys(cambios || {}).forEach(k => { o[k] = l[k] === undefined || l[k] === "" ? null : l[k]; });
  // Los temas vacíos y la portada sin elegir eran "nada".
  if ("temas" in o && Array.isArray(o.temas) && !o.temas.length) o.temas = null;
  return o;
}

return { falta, necesitaPaginas, firma, pendientes, consulta, confianza, emparejar, paginasDe, propuesta, antes };
});
