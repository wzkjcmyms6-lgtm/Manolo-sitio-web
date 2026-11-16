// ---------- Libros: "Si te gustó…" (sin pantalla) ----------
// Nivel 3, fase 6 (D-134; diseño en docs/LIBROS_NIVEL3.md). A partir de tus
// últimos libros de 4 y 5 estrellas: otros libros del mismo autor y de los
// mismos temas (Open Library), que tengan edición en español y que todavía
// no tengas, cada uno con su razón ("Como «El alquimista»: también de Paulo
// Coelho"). Sin IA: solo reglas. La pantalla está en js/libros-ideas-ui.js.
// Sin DOM ni Firebase: tests/libros-recomendar.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./libros-motor.js"), require("./libros-fuentes.js"));
  else root.LibrosRecomendar = factory(root.LibrosMotor, root.LibrosFuentes);
})(typeof self !== "undefined" ? self : this, function (L, F) {
"use strict";

const POR_GRUPO = 4;   // ideas por autor y por tema de cada libro
const MAXIMO = 12;
const DIAS = 7;        // lo encontrado vale una semana
const limpio = t => L.normalizar(t).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

// Tus últimos libros de 4 y 5 estrellas (los terminados más recientes).
function semillas(libros, max) {
  return (libros || []).filter(l => l && l.titulo && l.estado === "terminado" && Number(l.calificacion) >= 4)
    .sort((a, b) => String(b.fechaFin || "").localeCompare(String(a.fechaFin || "")) || (b.calificacion || 0) - (a.calificacion || 0) || (b.creado || 0) - (a.creado || 0))
    .slice(0, max || 3);
}
// Si cambian tus libros favoritos (o sus temas), se buscan de nuevo.
const firma = ss => (ss || []).map(s => [s.id, s.calificacion, s.autorKey || limpio(s.autor), (s.temas || []).join(",")].join(":")).join("|");
const vigente = (guardado, f, ahora) => !!(guardado && guardado.firma === f && Number(guardado.t) > 0 && ahora - guardado.t < DIAS * 864e5);

// Lo que se guarda de cada idea (lo que necesita "＋ Quiero leer").
const CAMPOS_IDEA = ["titulo", "tituloOriginal", "autor", "autorKey", "anio", "paginas", "url", "urlChica", "genero", "temas", "olKey", "edicionKey", "ediciones"];
const dato = x => { const o = {}; CAMPOS_IDEA.forEach(k => { if (x[k] != null && x[k] !== "") o[k] = x[k]; }); o.titulo = sinBarra(o.titulo); return o; };
// "Como agua para chocolate/Like Water for Chocolate" → "Como agua para
// chocolate" (ediciones bilingües o con la colección pegada al título).
const sinBarra = t => { const m = String(t || "").match(/^(.+?)\s*\/\s*[^/]+$/); const izq = m ? m[1].trim() : ""; return izq && (izq.split(/\s+/).length >= 2 || izq.length >= 6) ? izq : String(t || ""); };
// Un título en inglés aunque Open Library diga que la edición es en español
// (dato mal cargado): no se ofrece.
const pareceIngles = t => /\b(the|of|and|how|to|your|with|for|from|my)\b/i.test(t) && !/\b(el|la|los|las|de|del|y|en|para|que|un|una|con|por|tu|su|mi|lo)\b/i.test(L.normalizar(t));
const ficcion = g => g === "novela" || g === "poesia" || g === "infantil";

// "finanzas personales e inversiones" (y → e antes de "i").
function yLista(xs) {
  if (xs.length < 2) return xs.join("");
  const ult = xs[xs.length - 1];
  return `${xs.slice(0, -1).join(", ")} ${/^h?i(?![aeiouáéó])/i.test(L.normalizar(ult)) ? "e" : "y"} ${ult}`;
}

// "romper hábitos" ya dice "hábitos": no se repite.
const distintos = ts => ts.filter((t, i) => !ts.some((u, j) => j !== i && u !== t && L.normalizar(u).includes(L.normalizar(t))));
// Del mismo autor (respuesta de urlLibrosDeAutor): en español y que no tengas.
function delAutor(json, s, libros) {
  return F.librosDeAutor(json, 30).filter(x => x.enEspanol && x.titulo && !pareceIngles(sinBarra(x.titulo)) && !F.loTienes(x, libros))
    .slice(0, POR_GRUPO)
    .map(x => ({ libro: dato(x), semilla: s.titulo, tipo: "autor", texto: `también de ${x.autor || s.autor}` }));
}
// De los mismos temas (respuesta de urlIdeasTema): en español, de otro
// autor, que no tengas, no infantil (salvo que el tuyo lo sea), novela con
// novela y no novela con no novela, y con al menos 2 temas en común (el que
// se buscó cuenta; si tu libro tiene uno solo, alcanza ese). Primero los que
// más temas comparten y más ediciones tienen (los conocidos); uno por autor.
function deTema(json, s, tema, libros) {
  const suyos = s.temas || [];
  const hace = Math.min(2, suyos.length);
  return F.leerBusqueda(json, "", 30).libros
    .filter(x => x.enEspanol && x.titulo && !pareceIngles(sinBarra(x.titulo)) && !x.derivado && !F.loTienes(x, libros) && x.ediciones >= 2)
    .filter(x => !(s.autor && x.autor && (F.mismoAutor(s.autor, x.autor) || limpio(s.autor) === limpio(x.autor))))
    .filter(x => (x.genero !== "infantil" || s.genero === "infantil") && !(s.genero && x.genero && ficcion(s.genero) !== ficcion(x.genero)))
    .map(x => ({ x, comunes: Array.from(new Set([tema].concat((x.temas || []).filter(t => suyos.includes(t))))) }))
    .filter(o => o.comunes.length >= hace)
    .map(o => Object.assign(o, { puntos: o.comunes.length + Math.log10(o.x.ediciones + 1) * 1.5 }))
    .sort((a, b) => b.puntos - a.puntos)
    .filter((o, i, xs) => !xs.slice(0, i).some(p => p.x.autor && o.x.autor && limpio(p.x.autor) === limpio(o.x.autor)))
    .slice(0, POR_GRUPO)
    .map(o => ({ libro: dato(o.x), semilla: s.titulo, tipo: "tema", texto: `también trata de ${yLista(distintos(o.comunes).slice(0, 2))}` }));
}

// Las ideas de todos, intercaladas (autor y tema de cada uno de tus libros),
// sin repetir, sin lo que ya tienes y sin las que descartaste.
const claveIdea = x => x.olKey || `t:${limpio(x.titulo)}`;
function mezclar(grupos, libros, descartadas, max) {
  const fuera = new Set(descartadas || []), vistas = new Set(), out = [];
  const gs = (grupos || []).map(g => (Array.isArray(g) ? g.slice() : []));
  for (let ronda = 0; out.length < (max || MAXIMO) && gs.some(g => g.length); ronda++) {
    for (const g of gs) {
      const i = g.shift();
      if (!i || !i.libro || !i.libro.titulo) continue;
      const k = claveIdea(i.libro);
      if (vistas.has(k) || fuera.has(k) || F.loTienes(i.libro, libros)) continue;
      vistas.add(k);
      out.push(i);
      if (out.length >= (max || MAXIMO)) break;
    }
  }
  return out;
}
const razon = i => `Como «${i.semilla}»: ${i.texto}`;

return { POR_GRUPO, MAXIMO, DIAS, semillas, firma, vigente, delAutor, deTema, mezclar, claveIdea, razon, yLista, sinBarra, pareceIngles };
});
