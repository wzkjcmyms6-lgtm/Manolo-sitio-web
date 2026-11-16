// ---------- Libros: "¿Qué leo después?" (sin pantalla) ----------
// Fase 5 (D-108). Ordena tus "Por leer" con reglas simples y dice por qué:
// - la prioridad que marcaste (Alta suma mucho; Baja resta);
// - el siguiente de una saga que vienes leyendo (y, si te falta uno
//   anterior, lo avisa y lo baja);
// - un género que hace rato no lees (para equilibrar) y, al revés, baja un
//   poco si vienes de dos seguidos del mismo;
// - el largo contra tu ritmo real (páginas por día de los últimos 30 días;
//   si casi no hay, tu meta): los cortos suben un poco, los muy largos
//   bajan; si vas atrasado con el reto, los cortos suben más;
// - cuánto hace que lo tienes en la lista;
// - (nivel 3, fase 6, D-134) del mismo autor o de los mismos temas que un
//   libro que te gustó (4 o 5 estrellas).
// Sin IA: solo cuentas. Sin DOM ni Firebase: tests/libros-siguiente.test.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./libros-progreso.js"), require("./libros-motor.js"));
  else root.LibrosSiguiente = factory(root.LibrosProgreso, root.LibrosMotor);
})(typeof self !== "undefined" ? self : this, function (P, L) {
"use strict";

const PUNTOS = { alta: 30, baja: -15, sigueSaga: 25, faltaAnterior: -20, empiezaSaga: 3, generoNuevo: 12, mismoGenero: -8, corto: 8, largo: -5, reto: 6, autorGusta: 10, temaGusta: 6 };

// Páginas por día a tu ritmo (últimos 30 días) o, si casi no anotaste, tu meta.
function ritmoDiario(libros, hoy, metaDia) {
  const dias = P.ultimosDias(P.paginasPorDia(libros), hoy, 30);
  const conLectura = dias.filter(d => d.paginas > 0).length;
  const total = dias.reduce((s, d) => s + d.paginas, 0);
  return conLectura >= 3 && total > 0 ? total / 30 : (metaDia > 0 ? metaDia : 30);
}
const nombreGenero = id => (L.GENERO[id] ? L.GENERO[id].nombre.toLowerCase() : id);
const clave = s => L.normalizar(s).replace(/\s+/g, " ");
const numero = n => String(n).replace(".", ",");

// → [{ id, libro, puntos, razones: [texto], avisos: [texto] }] del mejor al último.
// o: { metaDia, retoMeta }.
function siguientes(libros, hoy, o) {
  const opc = Object.assign({ metaDia: 30, retoMeta: 0 }, o);
  const lista = libros || [];
  const cand = lista.filter(l => l.estado === "por_leer");
  if (!cand.length) return [];
  const ritmo = ritmoDiario(lista, hoy, opc.metaDia);
  const veces = P.terminaciones(lista).filter(t => t.fechaFin).sort((a, b) => b.fechaFin.localeCompare(a.fechaFin) || (b.libro.creado || 0) - (a.libro.creado || 0));
  const terminado = new Set(veces.map(t => t.id));
  const recientes = veces.slice(0, 6).map(t => t.libro.genero).filter(Boolean);
  const dosUltimos = veces.slice(0, 2).map(t => t.libro.genero);
  const reto = opc.retoMeta ? P.reto(lista, opc.retoMeta, hoy) : null;
  // Sagas: los libros de cada una que tienes en la lista.
  const sagas = {};
  lista.forEach(l => { if (l.saga && l.sagaN) (sagas[clave(l.saga)] = sagas[clave(l.saga)] || []).push(l); });
  // Lo que te gustó (4 o 5 estrellas), lo último primero.
  const gustos = lista.filter(l => l.estado === "terminado" && Number(l.calificacion) >= 4)
    .sort((a, b) => String(b.fechaFin || "").localeCompare(String(a.fechaFin || "")) || (b.calificacion || 0) - (a.calificacion || 0));

  return cand.map(l => {
    let puntos = 0;
    const razones = [], avisos = [];
    const sumar = (p, texto) => { puntos += p; if (texto) (p > 0 ? razones : avisos).push({ p, texto }); };
    if (l.prioridad === "alta") sumar(PUNTOS.alta, "La marcaste con prioridad alta.");
    if (l.prioridad === "baja") sumar(PUNTOS.baja, null);
    if (l.saga && l.sagaN) {
      const antes = (sagas[clave(l.saga)] || []).filter(x => x.id !== l.id && x.sagaN < l.sagaN);
      const faltan = antes.filter(x => !terminado.has(x.id)).sort((a, b) => a.sagaN - b.sagaN);
      if (faltan.length) sumar(PUNTOS.faltaAnterior, `Antes va el ${numero(faltan[0].sagaN)} de «${l.saga}».`);
      else if (antes.length) sumar(PUNTOS.sigueSaga, `Sigue la saga «${l.saga}»: es el ${numero(l.sagaN)}.`);
      else if (l.sagaN === 1) sumar(PUNTOS.empiezaSaga, `Empieza la saga «${l.saga}».`);
    }
    // Del mismo autor que uno que te gustó; si no, de los mismos temas.
    const gAutor = l.autor ? gustos.find(g => g.autor && clave(g.autor) === clave(l.autor)) : null;
    if (gAutor) sumar(PUNTOS.autorGusta, `Es de ${l.autor}, como «${gAutor.titulo}», que te gustó.`);
    else if (l.temas && l.temas.length) {
      const g = gustos.find(x => x.temas && x.temas.some(t => l.temas.includes(t)));
      if (g) sumar(PUNTOS.temaGusta, `Trata de ${g.temas.find(t => l.temas.includes(t))}, como «${g.titulo}», que te gustó.`);
    }
    if (l.genero) {
      if (recientes.length >= 2 && !recientes.includes(l.genero)) sumar(PUNTOS.generoNuevo, `Hace rato no lees ${nombreGenero(l.genero)}: equilibra.`);
      else if (dosUltimos.length === 2 && dosUltimos.every(g => g === l.genero)) sumar(PUNTOS.mismoGenero, null);
    }
    let dias = null;
    if (l.paginas && ritmo > 0) {
      dias = Math.max(1, Math.ceil(l.paginas / ritmo));
      if (dias <= 14) sumar(PUNTOS.corto, `Lo terminas en ${dias <= 7 ? "una semana" : "unas 2 semanas"} a tu ritmo.`);
      else if (dias > 60) sumar(PUNTOS.largo, `Es largo: unos ${Math.round(dias / 30)} meses a tu ritmo.`);
      if (reto && reto.estado === "atrasado" && dias <= 21) sumar(PUNTOS.reto, "Te ayuda a ponerte al día con tu reto.");
    }
    if (L.fechaOk(l.fechaRegistro) && hoy) {
      const meses = Math.floor(P.diasEntre(l.fechaRegistro, hoy) / 30);
      if (meses >= 6) sumar(Math.min(5, Math.floor(meses / 3)), `Lo tienes en la lista desde hace ${meses} meses.`);
    }
    return { id: l.id, libro: l, puntos, dias,
      razones: razones.sort((a, b) => b.p - a.p).map(x => x.texto).slice(0, 2),
      avisos: avisos.map(x => x.texto) };
  }).sort((a, b) => b.puntos - a.puntos || (a.libro.fechaRegistro || "").localeCompare(b.libro.fechaRegistro || "") || a.libro.titulo.localeCompare(b.libro.titulo, "es"));
}

return { PUNTOS, ritmoDiario, siguientes };
});
