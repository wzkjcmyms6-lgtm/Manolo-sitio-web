const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../js/habitos-categorias.js");
const E = require("../js/habitos-engine.js");

test("migración en lectura: sin categorías guardadas salen las 6 áreas con los nombres del dueño", () => {
  const lista = C.leer({ prefs: { areas: { dinero: "Finanzas", bienestar: "Paz", mente: "  " } } });
  assert.deepEqual(lista.map(c => c.id), ["cuerpo", "mente", "dinero", "carrera", "bienestar", "social"]);
  assert.equal(lista.find(c => c.id === "dinero").nombre, "Finanzas");
  assert.equal(lista.find(c => c.id === "bienestar").nombre, "Paz");
  assert.equal(lista.find(c => c.id === "mente").nombre, "Mente"); // vacío = el de siempre
  assert.ok(lista.every(c => c.emoji && C.PALETA.some(p => p.id === c.color) && !c.archivada && c.defecto));
  // Sin juego también funciona.
  assert.equal(C.leer(null).length, 6);
  assert.equal(C.leer(undefined)[0].nombre, "Cuerpo");
});

test("lo guardado manda campo por campo y las propias se suman en su orden", () => {
  const juego = {
    prefs: { areas: { dinero: "Finanzas" } },
    categorias: {
      dinero: { emoji: "🪙" },                          // conserva el nombre de prefs
      social: { nombre: "Gente", orden: 0.5 },
      fe: { nombre: "Fe", emoji: "🙏", color: "indigo", orden: 3.5 },
      vieja: { nombre: "Vieja", borrada: true },
      "MAL/ID": { nombre: "x" },
      rara: { nombre: "Rara", color: "fucsia" }       // color fuera de la paleta → el primero
    }
  };
  const lista = C.leer(juego);
  assert.equal(lista[0].id, "social");
  assert.equal(lista[0].nombre, "Gente");
  const dinero = lista.find(c => c.id === "dinero");
  assert.equal(dinero.nombre, "Finanzas");
  assert.equal(dinero.emoji, "🪙");
  assert.ok(lista.findIndex(c => c.id === "fe") === lista.findIndex(c => c.id === "dinero") + 1);
  assert.ok(!lista.some(c => c.id === "vieja" || c.id === "MAL/ID"));
  assert.equal(lista.find(c => c.id === "rara").color, "coral");
  assert.equal(C.colorDe(lista.find(c => c.id === "fe")), "#818cf8");
});

test("crear: valida nombre, repetidos y el límite; id sin tildes y sin chocar", () => {
  const lista = C.leer({});
  assert.equal(C.crear(lista, { nombre: "  " }).ok, false);
  assert.match(C.crear(lista, { nombre: "mente" }).error, /Ya tienes/);
  const r = C.crear(lista, { nombre: "Música y Guitarra", emoji: "🎸" }, {}, 1000);
  assert.ok(r.ok);
  assert.equal(r.id, "musica-y-guitarra");
  assert.equal(r.doc.orden, 7);
  assert.equal(r.doc.creada, 1000);
  assert.ok(C.PALETA.some(p => p.id === r.doc.color));
  // No reutiliza un id de una categoría borrada.
  const juego = { categorias: { fe: { nombre: "Fe vieja", borrada: true } } };
  assert.equal(C.crear(C.leer(juego), { nombre: "Fe" }, juego).id, "fe-2");
  // Límite de activas (las archivadas no cuentan).
  const llenas = {};
  for (let i = 0; i < 6; i++) llenas["c" + i] = { nombre: "Cat " + i };
  assert.match(C.crear(C.leer({ categorias: llenas }), { nombre: "Otra" }).error, /hasta 12/);
  llenas.c0.archivada = true;
  assert.ok(C.crear(C.leer({ categorias: llenas }), { nombre: "Otra" }).ok);
});

test("editar, reordenar, archivar y borrar", () => {
  const lista = C.leer({});
  assert.deepEqual(C.editar(lista, "mente", { nombre: " Cabeza ", color: "azul", emoji: "" }).cambios, { nombre: "Cabeza", color: "azul" });
  assert.equal(C.editar(lista, "mente", { nombre: "Cuerpo" }).ok, false);
  assert.equal(C.editar(lista, "nada", { nombre: "x" }).ok, false);
  // Mover Social arriba: solo cambian los que se movieron.
  assert.deepEqual(C.reordenar(lista, ["social", "cuerpo", "mente", "dinero", "carrera", "bienestar"]),
    { social: { orden: 1 }, cuerpo: { orden: 2 }, mente: { orden: 3 }, dinero: { orden: 4 }, carrera: { orden: 5 }, bienestar: { orden: 6 } });
  assert.deepEqual(C.reordenar(lista, ["cuerpo", "mente"]), {});
  const habitos = [{ id: "a", area: "mente", archivado: true }, { id: "b", area: "cuerpo" }];
  assert.deepEqual(C.usos("mente", habitos), { activos: 0, total: 1 });
  assert.equal(C.puedeBorrar("mente", habitos), false); // tiene historia: se archiva
  assert.equal(C.puedeBorrar("social", habitos), true);
  const arch = C.leer({ categorias: { mente: { archivada: true } } });
  assert.equal(C.activas(arch).length, 5);
  assert.equal(arch.find(c => c.id === "mente").archivada, true);
});

test("asignar en lote: solo cambia `area` de los que cambian", () => {
  const habitos = [{ id: "a", area: null }, { id: "b", area: "mente" }, { id: "c" }, { id: "d", area: "cuerpo" }];
  assert.deepEqual(C.asignar(habitos, ["a", "b", "c"], "mente"), [{ id: "a", area: "mente" }, { id: "c", area: "mente" }]);
  assert.deepEqual(C.asignar(habitos, ["b", "d"], null), [{ id: "b", area: null }, { id: "d", area: null }]);
  assert.deepEqual(C.asignar(habitos, [], "mente"), []);
});

test("sugeridas: solo las que faltan", () => {
  assert.deepEqual(C.sugeridas(C.leer({})).map(s => s.id), ["fe", "lectura", "cuidado", "hogar"]);
  const juego = { categorias: { fe: { nombre: "Fe" }, otra: { nombre: "Lectura" } } };
  assert.deepEqual(C.sugeridas(C.leer(juego), juego).map(s => s.id), ["cuidado", "hogar"]);
});

test("sugerir categoría por nombre o emoji (reglas simples)", () => {
  const base = C.leer({});
  assert.equal(C.sugerir("Correr 5 km", "🏃", base), "cuerpo");
  assert.equal(C.sugerir("Tomar agua", "", base), "cuerpo");
  assert.equal(C.sugerir("Anotar mis gastos", "", base), "dinero");
  assert.equal(C.sugerir("Meditar", "", base), "bienestar");
  assert.equal(C.sugerir("Llamar a mamá", "", base), "social");
  assert.equal(C.sugerir("Estudiar inglés", "", base), "mente");
  assert.equal(C.sugerir("Algo raro", "🎈", base), null);
  assert.equal(C.sugerir("", "💰", base), "dinero");
  // Lo específico gana a lo general si existe.
  const con = C.leer({ categorias: { lectura: { nombre: "Lectura", emoji: "📚" }, fe: { nombre: "Fe" }, guitarra: { nombre: "Guitarra" } } });
  assert.equal(C.sugerir("Leer 20 páginas", "📖", con), "lectura");
  assert.equal(C.sugerir("Leer 20 páginas", "📖", base), "mente");
  assert.equal(C.sugerir("Orar", "🙏", con), "fe");
  assert.equal(C.sugerir("Practicar guitarra", "🎸", con), "guitarra");
  // Nunca sugiere una archivada.
  assert.equal(C.sugerir("Correr", "", C.leer({ categorias: { cuerpo: { archivada: true } } })), null);
});

test("el motor usa las categorías: XP, nivel y % por categoría, con las archivadas", () => {
  const cats = C.leer({ categorias: { fe: { nombre: "Fe", emoji: "🙏", color: "indigo" }, social: { archivada: true } } });
  const regs = n => { const r = {}; for (let i = 0; i < n; i++) r[E.addDias("2026-09-01", i)] = { e: "hecho" }; return r; };
  const docs = [
    { id: "a", name: "Orar", area: "fe", inicio: "2026-09-01", registros: regs(10) },
    { id: "b", name: "Llamar", area: "social", inicio: "2026-09-01", registros: regs(4) },
    { id: "c", name: "Sin", area: "borrada", inicio: "2026-09-01", registros: regs(2) }
  ];
  const r = E.evaluar(docs, { hoy: "2026-09-11", areas: cats });
  const fe = r.areas.find(a => a.id === "fe");
  assert.equal(fe.xp, r.habitos.a.xp);
  assert.equal(fe.emoji, "🙏");
  assert.equal(fe.color, "indigo");
  assert.equal(r.areas.find(a => a.id === "social").archivada, true);
  assert.equal(r.areas.find(a => a.id === "social").xp, r.habitos.b.xp);
  const per = E.areasPeriodo(r, "2026-09-01", "2026-09-10", cats);
  assert.equal(per.find(a => a.id === "fe").pct, 1);
  assert.equal(per.find(a => a.id === "social").pct, 0.4);
  assert.equal(per.length, 7);
});

test("copia de seguridad: importar agrega solo las categorías que faltan", () => {
  const datos = { app: "manolo-habitos", habitos: [], juego: { categorias: { fe: { nombre: "Fe" }, mente: { nombre: "Otra" } } } };
  const plan = E.planImportacion(datos, { docs: {}, juego: { categorias: { mente: { nombre: "Mente" } } } });
  assert.deepEqual(plan.juego.categorias, { fe: { nombre: "Fe" } });
  assert.equal(plan.vacio, false);
});
