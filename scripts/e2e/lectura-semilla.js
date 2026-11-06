// Datos de prueba realistas para Biblia, Libros y Medir tiempos
// (auditoría y scripts/e2e/lectura.js, tiempos.js). Todo determinista.
//
// estado(hoy, opciones) → { __SEED__ } para comun.abrir(); hoy = "AAAA-MM-DD".
// opciones: { sinBiblia, sinLibros, sinTiempos, diasTiempos (40) }.

function addDias(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const ms = (f, h) => Date.parse(`${f}T${h || "07:00"}:00-04:00`);

// Versículos anotados (los 50 últimos días, con huecos).
const VERSICULOS = [
  ["John", 3, "16", "Porque de tal manera amó Dios al mundo, que ha dado á su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna."],
  ["Ps", 23, "1", "Jehová es mi pastor; nada me faltará."],
  ["Phil", 4, "13", "Todo lo puedo en Cristo que me fortalece."],
  ["Prov", 3, "5-6", "Fíate de Jehová de todo tu corazón, Y no estribes en tu prudencia. Reconócelo en todos tus caminos, Y él enderezará tus veredas."],
  ["Rom", 8, "28", "Y sabemos que á los que á Dios aman, todas las cosas les ayudan á bien, es á saber, á los que conforme al propósito son llamados."],
  ["Isa", 41, "10", "No temas, que yo soy contigo; no desmayes, que yo soy tu Dios que te esfuerzo: siempre te ayudaré, siempre te sustentaré con la diestra de mi justicia."],
  ["Matt", 6, "33", "Mas buscad primeramente el reino de Dios y su justicia, y todas estas cosas os serán añadidas."],
  ["Josh", 1, "9", "Mira que te mando que te esfuerces y seas valiente: no temas ni desmayes, porque Jehová tu Dios será contigo en donde quiera que fueres."],
  ["Ps", 46, "1", "Dios es nuestro amparo y fortaleza, Nuestro pronto auxilio en las tribulaciones."],
  ["Jer", 29, "11", "Porque yo sé los pensamientos que tengo acerca de vosotros, dice Jehová, pensamientos de paz, y no de mal, para daros el fin que esperáis."]
];

const LIBROS = [
  // [id, título, autor, páginas, estado, género, calificación, inicio (días atrás), fin (días atrás), página actual]
  ["l1", "Hábitos atómicos", "James Clear", 328, "leyendo", "desarrollo", null, 12, null, 142],
  ["l2", "El hombre en busca de sentido", "Viktor Frankl", 168, "leyendo", "psicologia", null, 5, null, 60],
  ["l3", "Cien años de soledad", "Gabriel García Márquez", 471, "terminado", "novela", 5, 120, 80, null],
  ["l4", "Padre rico, padre pobre", "Robert Kiyosaki", 207, "terminado", "negocios", 4, 75, 60, null],
  ["l5", "Mero cristianismo", "C. S. Lewis", 256, "terminado", "fe", 5, 58, 40, null],
  ["l6", "El poder del ahora", "Eckhart Tolle", 236, "terminado", "desarrollo", 3, 38, 28, null],
  ["l7", "Sapiens", "Yuval Noah Harari", 496, "terminado", "historia", 4, 27, 14, null],
  ["l8", "La sombra del viento", "Carlos Ruiz Zafón", 565, "por_leer", "novela", null, null, null, null],
  ["l9", "Piense y hágase rico", "Napoleon Hill", 320, "por_leer", "negocios", null, null, null, null],
  ["l10", "El Principito", "Antoine de Saint-Exupéry", 96, "por_leer", "infantil", null, null, null, null]
];

const FRASES = [
  ["l1", "No te elevas al nivel de tus metas. Caes al nivel de tus sistemas.", 27],
  ["l1", "Cada acción que realizas es un voto por el tipo de persona que deseas ser.", 38],
  ["l2", "Al hombre se le puede arrebatar todo salvo una cosa: la última de las libertades humanas.", 69],
  ["l3", "La vida no es la que uno vivió, sino la que uno recuerda y cómo la recuerda para contarla.", null],
  ["l5", "Apunta al cielo y tendrás la tierra por añadidura; apunta a la tierra y no tendrás ninguna de las dos.", 134],
  ["l7", "La revolución agrícola fue el mayor fraude de la historia.", 91]
];

function biblia(hoy) {
  const out = {};
  let k = 0;
  for (let d = 50; d >= 1; d--) {
    if (d % 7 === 3 || d % 11 === 0) continue;  // algunos días sin anotar
    const v = VERSICULOS[k % VERSICULOS.length];
    const f = addDias(hoy, -d);
    out[`b${String(++k).padStart(3, "0")}`] = { v: 1, fecha: f, libro: v[0], capitulo: v[1], versiculo: v[2], texto: v[3], nota: k % 4 === 0 ? "Me recordó confiar más." : "", creado: ms(f, "06:30") };
  }
  return out;
}

function libros(hoy) {
  const out = {}, frases = {};
  LIBROS.forEach(([id, titulo, autor, paginas, estado, genero, calificacion, ini, fin, pag]) => {
    const l = { v: 1, titulo, autor, paginas, estado, genero, calificacion, opinion: calificacion >= 5 ? "De mis favoritos." : "",
      fechaRegistro: addDias(hoy, -(ini || 30) - 3), fechaInicio: ini == null ? null : addDias(hoy, -ini), fechaFin: fin == null ? null : addDias(hoy, -fin),
      creado: ms(addDias(hoy, -(ini || 30) - 3)), portada: null };
    if (estado === "leyendo") {
      // Una página por día de lectura (algunos días sin leer).
      const progreso = {};
      for (let d = ini; d >= 1; d--) {
        if (d % 4 === 0) continue;
        progreso[addDias(hoy, -d)] = Math.round(pag * (ini - d + 1) / ini);
      }
      l.paginaActual = pag;
      l.progreso = progreso;
    }
    out[id] = l;
  });
  FRASES.forEach(([libroId, texto, pagina], i) => {
    const f = addDias(hoy, -(20 - i * 3));
    frases[`f${i + 1}`] = { v: 1, libroId, texto, pagina, fecha: f, creado: ms(f, "21:00") };
  });
  return { libros: out, frases };
}

// Tiempos de la mañana (segundos): manana, ejercicio, correr, desayunar, banarse, leer.
function tiempos(hoy, dias) {
  const out = {};
  for (let d = dias; d >= 1; d--) {
    const f = addDias(hoy, -d);
    const dow = new Date(f + "T12:00:00Z").getUTCDay();
    const r = (base, amp) => Math.round(base + amp * Math.sin(d * 1.7 + base));
    const seg = { manana: r(1500, 240), desayunar: r(900, 180), banarse: r(1080, 200) };
    if (dow !== 0) seg.leer = r(2100, 400);
    if (dow === 1 || dow === 2 || dow === 4) seg.ejercicio = r(3300, 300);
    if (dow === 3 || dow === 6) seg.correr = r(2700, 420);
    if (d % 9 === 0) delete seg.desayunar;
    out[f] = { fecha: f, seg, actualizado: ms(f, "09:30") };
  }
  return out;
}

function estado(hoy, opciones) {
  const o = Object.assign({ diasTiempos: 40 }, opciones || {});
  const seed = {};
  if (!o.sinBiblia) seed["users/test/biblia"] = biblia(hoy);
  if (!o.sinLibros) {
    const l = libros(hoy);
    seed["users/test/libros"] = l.libros;
    seed["users/test/libros_frases"] = l.frases;
    seed["users/test/meta"] = { libros_ajustes: { metaPaginasDia: 30, retos: { [hoy.slice(0, 4)]: 12 } } };
  }
  if (!o.sinTiempos) seed["users/test/tiempos"] = tiempos(hoy, o.diasTiempos);
  return { __SEED__: seed };
}

module.exports = { estado, addDias, LIBROS, VERSICULOS };
