// Puente de Manolo (puente/src/logica.js, D-147): el token de Firebase (firma
// y datos), quién puede usar la IA, CORS, el costo y el tope, y lo que se le
// pide y se acepta de la IA al describir una prenda (con las mismas listas que
// js/ropa-motor.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../js/ropa-motor.js");

const cargar = () => import("../puente/src/logica.js");
const b64url = buf => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const subtle = globalThis.crypto.subtle;

// Un par de llaves como las de Google y un token firmado con la privada.
async function llaves() {
  const par = await subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const pub = await subtle.exportKey("jwk", par.publicKey);
  return { privada: par.privateKey, jwks: { keys: [Object.assign({ kid: "k1", alg: "RS256", use: "sig" }, { kty: pub.kty, n: pub.n, e: pub.e })] } };
}
async function token(privada, payload, header) {
  const h = b64url(JSON.stringify(Object.assign({ alg: "RS256", kid: "k1", typ: "JWT" }, header || {})));
  const p = b64url(JSON.stringify(payload));
  const firma = await subtle.sign("RSASSA-PKCS1-v1_5", privada, new TextEncoder().encode(`${h}.${p}`));
  return `${h}.${p}.${b64url(firma)}`;
}
const AHORA = 1795000000;
const bueno = (extra) => Object.assign({ aud: "manolo-4c57b", iss: "https://securetoken.google.com/manolo-4c57b", sub: "dueno123", iat: AHORA - 60, auth_time: AHORA - 3600, exp: AHORA + 3000 }, extra || {});

test("token de Firebase: el bueno pasa, los demás no", async () => {
  const L = await cargar();
  const { privada, jwks } = await llaves();
  const ok = await L.verificarToken(await token(privada, bueno()), jwks, "manolo-4c57b", AHORA, subtle);
  assert.deepEqual(ok, { ok: true, uid: "dueno123" });
  const motivo = async (t, proyecto) => (await L.verificarToken(t, jwks, proyecto || "manolo-4c57b", AHORA, subtle)).motivo;
  assert.equal(await motivo(await token(privada, bueno({ exp: AHORA - 1 }))), "vencido");
  assert.equal(await motivo(await token(privada, bueno({ aud: "otro-proyecto", iss: "https://securetoken.google.com/otro-proyecto" }))), "proyecto");
  assert.equal(await motivo(await token(privada, bueno()), "otro"), "proyecto");
  assert.equal(await motivo(await token(privada, bueno({ iat: AHORA + 3600 }))), "fecha");
  assert.equal(await motivo(await token(privada, bueno({ sub: "" }))), "usuario");
  assert.equal(await motivo(await token(privada, bueno(), { kid: "otra" })), "llave");
  assert.equal(await motivo(await token(privada, bueno(), { alg: "none" })), "algoritmo");
  assert.equal(await motivo("no.es.token"), "formato");
  assert.equal(await motivo(""), "formato");
  // Firmado por otra llave (alguien que no es Google).
  const otra = await llaves();
  assert.equal(await motivo(await token(otra.privada, bueno())), "firma");
  // Cambiar el usuario sin volver a firmar.
  const t = (await token(privada, bueno())).split(".");
  t[1] = b64url(JSON.stringify(bueno({ sub: "intruso" })));
  assert.equal(await motivo(t.join(".")), "firma");
});

test("solo los usuarios de la lista usan la IA; CORS solo para Manolo", async () => {
  const L = await cargar();
  assert.equal(L.permitido("dueno123", "dueno123"), true);
  assert.equal(L.permitido("dueno123", " otro , dueno123 "), true);
  assert.equal(L.permitido("otro", "dueno123"), false);
  assert.equal(L.permitido("", ""), false);
  assert.equal(L.permitido("x", undefined), false);
  const h = L.cors("https://wzkjcmyms6-lgtm.github.io", "https://wzkjcmyms6-lgtm.github.io");
  assert.equal(h["Access-Control-Allow-Origin"], "https://wzkjcmyms6-lgtm.github.io");
  assert.equal(L.cors("https://malo.example", "https://wzkjcmyms6-lgtm.github.io")["Access-Control-Allow-Origin"], undefined);
  assert.equal(L.cors("http://localhost:8080", "")["Access-Control-Allow-Origin"], "http://localhost:8080");
  assert.match(h["Access-Control-Allow-Headers"], /Authorization/);
});

test("el costo de cada respuesta, el mes en Bolivia y el tope", async () => {
  const L = await cargar();
  // 2.600 de entrada y 700 de salida: 2600 × 4 + 700 × 20 = 24.400 por millón.
  assert.equal(L.redondo(L.costo({ input_tokens: 2600, output_tokens: 700 })), 0.0244);
  assert.equal(L.redondo(L.costo({ input_tokens: 1000, cache_read_input_tokens: 10000, output_tokens: 0 })), 0.006);
  assert.equal(L.redondo(L.costo({ input_tokens: 0, output_tokens: 0, server_tool_use: { web_search_requests: 3 } })), 0.03);
  assert.equal(L.costo(null), 0);
  assert.equal(L.costo({ input_tokens: -5, output_tokens: "x" }), 0);
  assert.equal(L.mesDe(Date.UTC(2026, 11, 1, 2)), "2026-11", "a las 22:00 del 30 de noviembre en La Paz todavía es noviembre");
  assert.equal(L.mesDe(Date.UTC(2026, 11, 1, 5)), "2026-12");
  assert.equal(L.topeValido("8"), 8);
  assert.equal(L.topeValido(12.345), 12.35);
  assert.equal(L.topeValido(0), null);
  assert.equal(L.topeValido(500), null);
  assert.equal(L.topeValido("nada"), null);
});

test("las listas del puente son las mismas que las de la app", async () => {
  const L = await cargar();
  assert.deepEqual(Object.keys(L.GRUPOS), R.GRUPOS.map(g => g.id));
  R.GRUPOS.forEach(g => assert.deepEqual(L.GRUPOS[g.id], g.tipos.map(t => t[0]), g.id));
  assert.deepEqual(L.COLORES, R.COLORES.map(c => c.id));
  assert.deepEqual(L.ESTAMPADOS, R.ESTAMPADOS.map(e => e[0]));
  assert.deepEqual(L.ESTILOS, R.ESTILOS.map(e => e[0]));
  assert.deepEqual(L.CLIMAS, R.CLIMAS.map(c => c[0]));
  assert.deepEqual(L.CORTES, R.CORTES.map(c => c[0]));
  assert.deepEqual(L.CORTES_DE, R.CORTES_DE);
  assert.deepEqual(L.MANGAS, R.MANGAS.map(m => m[0]));
  assert.deepEqual(L.CON_MANGA, R.CON_MANGA);
});

test("el esquema y las instrucciones para describir una prenda", async () => {
  const L = await cargar();
  const s = L.ESQUEMA_PRENDA;
  assert.equal(s.additionalProperties, false);
  assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort(), "todo es obligatorio (salidas con esquema)");
  const sinLimites = JSON.stringify(s);
  assert.ok(!/minimum|maximum|minItems|maxItems|minLength|maxLength/.test(sinLimites), "sin límites que el esquema no acepta");
  const i = L.instruccionesPrenda();
  assert.match(i, /Chompa con capucha/);
  assert.match(i, /No inventes la marca/);
  // El corte y las mangas (D-154): con vacío para "no se nota" o "no va".
  assert.deepEqual(s.properties.corte.enum, ["", ...L.CORTES]);
  assert.deepEqual(s.properties.manga.enum, ["", "sin", "corta", "larga"]);
  assert.match(i, /pitillo \(ajustado hasta el tobillo\)/);
  assert.match(i, /manga: solo arriba y cuerpo entero/);
});

test("lo que contesta la IA se limpia antes de llegar al formulario", async () => {
  const L = await cargar();
  const p = L.limpiarPrenda({ esPrenda: true, varias: false, grupo: "abajo", tipo: "  Jean  ", colores: ["azul-jean", "azul-jean", "violeta", "blanco", "negro", "rojo"], estampado: "lunares", tela: "Jean", estilo: ["casual", "nada"], clima: ["frio", "templado"], formalidad: 2.4, marca: "Levi's" });
  assert.deepEqual(p, { esPrenda: true, varias: false, grupo: "abajo", tipo: "Jean", colores: ["azul-jean", "blanco", "negro"], estampado: "liso", tela: "Jean", corte: "", manga: "", estilo: ["casual"], clima: ["frio", "templado"], formalidad: 2, marca: "Levi's" });
  // El corte y las mangas, solo si van con el grupo (D-154).
  const recto = L.limpiarPrenda({ grupo: "abajo", tipo: "Jean", corte: "recto", manga: "larga" });
  assert.equal(recto.corte, "recto");
  assert.equal(recto.manga, "", "un jean no tiene mangas");
  const polera = L.limpiarPrenda({ grupo: "arriba", tipo: "Polera", corte: "pitillo", manga: "corta" });
  assert.equal(polera.corte, "", "una polera no es pitillo");
  assert.equal(polera.manga, "corta");
  assert.equal(L.limpiarPrenda({ grupo: "zapatos", tipo: "Botas", corte: "pegado", manga: "sin" }).corte, "", "zapatos sin corte");
  assert.equal(R.nombreCorte(R.normalizar("y", L.limpiarPrenda({ grupo: "arriba", tipo: "Polera", corte: "pegado" })).corte, "Polera"), "Pegada");
  const raro = L.limpiarPrenda({ grupo: "luna", formalidad: 9, varias: "si", esPrenda: false });
  assert.equal(raro.grupo, "arriba");
  assert.equal(raro.tipo, "Polera");
  assert.equal(raro.formalidad, null);
  assert.equal(raro.varias, false);
  assert.equal(raro.esPrenda, false);
  assert.deepEqual(L.limpiarPrenda(null).colores, []);
  // Y la app lo entiende tal cual.
  const n = R.normalizar("x", p);
  assert.equal(R.titulo(n), "Jean azul");
});

test("la foto que manda Manolo", async () => {
  const L = await cargar();
  const img = "A".repeat(5000);
  assert.deepEqual(L.fotoValida({ tipo: "image/jpeg", imagen: img }), { tipo: "image/jpeg", imagen: img });
  assert.equal(L.fotoValida({ tipo: "image/gif", imagen: img }), null);
  assert.equal(L.fotoValida({ tipo: "image/jpeg", imagen: "corta" }), null);
  assert.equal(L.fotoValida({ tipo: "image/jpeg", imagen: "A".repeat(4.3e6) }), null);
  assert.equal(L.fotoValida({ tipo: "image/jpeg", imagen: img + "<script>" }), null);
  assert.equal(L.fotoValida(null), null);
});

// Cada objeto del esquema: additionalProperties false y todo obligatorio; sin límites.
function revisarEsquema(s, donde) {
  if (s.type === "object") {
    assert.equal(s.additionalProperties, false, `${donde}: additionalProperties`);
    assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort(), `${donde}: todo obligatorio`);
    Object.entries(s.properties).forEach(([k, v]) => revisarEsquema(v, `${donde}.${k}`));
  }
  if (s.type === "array") revisarEsquema(s.items, `${donde}[]`);
  assert.ok(!/minimum|maximum|minItems|maxItems|minLength|maxLength|multipleOf/.test(JSON.stringify(s)), `${donde}: sin límites`);
}

test("inspiración (D-148): esquemas e instrucciones, sin el nombre de la app", async () => {
  const L = await cargar();
  revisarEsquema(L.ESQUEMA_INSPIRACION, "inspiracion");
  revisarEsquema(L.ESQUEMA_LOOK, "look");
  revisarEsquema(L.ESQUEMA_ESTILO, "estilo");
  assert.deepEqual(L.ESQUEMA_INSPIRACION.properties.prendas.items.properties.colores.items.enum, R.COLORES.map(c => c.id));
  const todas = [L.instruccionesPrenda(), L.instruccionesInspiracion(), L.instruccionesLook(), L.instruccionesEstilo()];
  todas.forEach(t => assert.ok(!/Manolo/.test(t), "las instrucciones no dicen el nombre de la app"));
  assert.match(L.instruccionesInspiracion(), /No describas a la persona/);
  assert.match(L.instruccionesInspiracion(), /Chompa con capucha/);
  assert.match(L.instruccionesLook(), /SOLO su ropa/);
  assert.match(L.instruccionesLook(), /Nunca inventes una referencia/);
  assert.match(L.instruccionesEstilo(), /nunca de la persona/);
});

const PIN = {
  esRopa: true, resumen: "Casual de invierno: abrigo camel largo con jean recto", estilo: ["casual", "clasico"], clima: ["frio"], formalidad: 2, ocasion: "fin de semana",
  prendas: [
    { grupo: "abrigos", tipo: "Abrigo", colores: ["camel"], estampado: "liso", tela: "Lana", detalle: "largo" },
    { grupo: "arriba", tipo: "Chompa", colores: ["crema"], estampado: "liso", tela: "Punto", detalle: "cuello alto" },
    { grupo: "abajo", tipo: "Jean", colores: ["azul-jean"], estampado: "liso", tela: "Jean", detalle: "recto" },
    { grupo: "zapatos", tipo: "Botines", colores: ["cafe"], estampado: "liso", tela: "Cuero", detalle: "" }
  ]
};

test("lo que la IA vio en un pin se limpia", async () => {
  const L = await cargar();
  const x = L.limpiarInspiracion(Object.assign({}, PIN, {
    prendas: PIN.prendas.concat([{ grupo: "luna", tipo: "X" }, { grupo: "accesorios", tipo: "", colores: ["violeta", "negro"], estampado: "raro", tela: 5, detalle: "  muy   largo  " }]),
    estilo: ["casual", "casual", "hippie"], formalidad: 7, ocasion: "x".repeat(200)
  }));
  assert.equal(x.prendas.length, 5, "sin la de un grupo que no existe");
  assert.deepEqual(x.prendas[4], { grupo: "accesorios", tipo: "Cinturón", colores: ["negro"], estampado: "liso", tela: "5", detalle: "muy largo" });
  assert.deepEqual(x.estilo, ["casual"]);
  assert.equal(x.formalidad, null);
  assert.equal(x.ocasion.length, 60);
  const muchas = L.limpiarInspiracion({ prendas: Array.from({ length: 12 }, () => PIN.prendas[0]) });
  assert.equal(muchas.prendas.length, 8);
  assert.deepEqual(L.limpiarInspiracion({ esRopa: false, prendas: PIN.prendas }).prendas, [], "sin ropa: sin prendas");
  assert.equal(L.limpiarInspiracion(null).esRopa, true);
});

test("armar el look: el ropero va con referencias cortas y vuelve con tus ids", async () => {
  const L = await cargar();
  const ropero = [
    { id: "abc123", grupo: "abrigos", tipo: "Abrigo", colores: ["beige"], estampado: "liso", tela: "Lana", estilo: ["clasico"], clima: ["frio"], formalidad: 3, marca: "Zara", notas: "regalo de mi mamá", precio: 500, talla: "M" },
    { id: "jean_1", grupo: "abajo", tipo: "Jean", colores: ["azul-jean"], estampado: "liso", tela: "Jean", estilo: ["casual"], clima: ["frio", "templado"], formalidad: 2, lavar: true },
    { id: "jean_1", grupo: "abajo", tipo: "Repetido" },
    { id: "mal id!", grupo: "abajo", tipo: "Jean" },
    { id: "zz", grupo: "luna", tipo: "Jean" },
    { id: "polera-9", grupo: "arriba", tipo: "Polera", colores: ["blanco"] }
  ];
  const e = L.entradaLook({ pin: PIN, ropero });
  assert.deepEqual(e.ropero.map(p => p.id), ["abc123", "jean_1", "polera-9"], "solo ids válidos, sin repetir");
  assert.ok(!("notas" in e.ropero[0]) && !("precio" in e.ropero[0]) && !("talla" in e.ropero[0]), "sin notas, precio ni talla");
  assert.equal(L.entradaLook({ pin: { prendas: [] }, ropero }), null, "sin prendas en el pin, nada");
  assert.equal(L.entradaLook({ pin: PIN, ropero: [] }), null, "sin ropero, nada");
  const { texto, refs } = L.textoRopero(e.ropero);
  assert.equal(texto.split("\n")[1], "p1 · abrigos · Abrigo · beige · Lana · clasico · frio · formal 3 · Zara");
  assert.equal(texto.split("\n")[2], "p2 · abajo · Jean · azul jean · Jean · casual · frio, templado · formal 2 · para lavar");
  // Con el corte y las mangas (D-154); lo que no va con el grupo no llega.
  const conCorte = L.entradaLook({ pin: PIN, ropero: [
    { id: "pol", grupo: "arriba", tipo: "Polera", colores: ["negro"], corte: "pegado", manga: "corta" },
    { id: "jn", grupo: "abajo", tipo: "Jean", colores: ["azul-jean"], corte: "oversize", manga: "larga" }
  ] });
  const lineas = L.textoRopero(conCorte.ropero).texto.split("\n");
  assert.equal(lineas[1], "p1 · arriba · Polera · corte pegado · manga corta · negro");
  assert.equal(lineas[2], "p2 · abajo · Jean · azul jean", "oversize no es un corte de pantalón y un jean no tiene mangas");
  assert.ok(!/abc123|jean_1|polera-9|regalo/.test(texto), "la IA no ve tus ids ni tus notas");
  assert.deepEqual([...refs.entries()], [["p1", "abc123"], ["p2", "jean_1"], ["p3", "polera-9"]]);
  const t = L.textoLook(e.pin);
  assert.match(t, /^El look de inspiración: Casual de invierno/);
  assert.match(t, /1\. abrigos · Abrigo · camel · Lana · largo/);
  assert.match(t, /4\. zapatos · Botines · cafe · Cuero/);
  // Lo que contesta la IA.
  const look = L.limpiarLook({
    prendas: [
      { pin: 1, ref: "p1", parecido: "parecida", porque: "Mismo largo, en beige." },
      { pin: 3, ref: "P2", parecido: "igual", porque: "Tu jean." },
      { pin: 2, ref: "p9", parecido: "igual", porque: "no existe" },
      { pin: 3, ref: "p3", parecido: "igual", porque: "esa ya está" },
      { pin: 2, ref: "p1", parecido: "igual", porque: "repetida" },
      { pin: 9, ref: "p3", parecido: "igual", porque: "fuera de rango" }
    ],
    faltan: [{ pin: 4, grupo: "zapatos", tipo: "Botines", colores: ["cafe"], porque: "No tienes botines." }, { pin: 1, grupo: "abrigos", tipo: "Abrigo", colores: [], porque: "ya cubierta" }, { pin: 2, grupo: "luna", tipo: "x", colores: [], porque: "" }],
    consejo: "Dobla el jean una vez."
  }, refs, 4);
  assert.deepEqual(look.prendas, [
    { pin: 1, id: "abc123", parecido: "parecida", porque: "Mismo largo, en beige." },
    { pin: 3, id: "jean_1", parecido: "igual", porque: "Tu jean." }
  ]);
  assert.deepEqual(look.faltan, [{ pin: 4, grupo: "zapatos", tipo: "Botines", colores: ["cafe"], porque: "No tienes botines." }]);
  assert.equal(look.consejo, "Dobla el jean una vez.");
  assert.deepEqual(L.limpiarLook(null, refs, 4), { prendas: [], faltan: [], consejo: "" });
});

test("mi estilo: desde 3 pines, y lo que contesta la IA se limpia", async () => {
  const L = await cargar();
  assert.equal(L.entradaEstilo({ pines: [PIN, PIN] }), null);
  assert.equal(L.entradaEstilo({ pines: [PIN, PIN, { esRopa: false }] }), null, "los que no tienen ropa no cuentan");
  const e = L.entradaEstilo({ pines: [PIN, PIN, PIN] });
  assert.equal(e.pines.length, 3);
  const t = L.textoEstilo(e.pines);
  assert.match(t, /^Mis pines de inspiración/);
  assert.match(t, /1\. Casual de invierno: abrigo camel largo con jean recto \(casual, clasico\): Abrigo camel largo; Chompa crema cuello alto; Jean azul jean recto; Botines cafe\./);
  const s = L.limpiarEstilo({ resumen: " Te gusta lo   neutro. ", claves: ["neutros", "neutros", "", "capas", "a", "b", "c", "d", "e"], colores: ["camel", "nada", "negro"], prendas: ["Abrigo largo"] });
  assert.deepEqual(s, { resumen: "Te gusta lo neutro.", claves: ["neutros", "capas", "a", "b", "c", "d"], colores: ["camel", "negro"], prendas: ["Abrigo largo"] });
});

test("outfits (D-149): esquema, lo que llega, el pedido y lo que contesta la IA", async () => {
  const L = await cargar();
  revisarEsquema(L.ESQUEMA_OUTFITS, "outfits");
  assert.ok(!/Manolo/.test(L.instruccionesOutfits()));
  assert.match(L.instruccionesOutfits(), /Usa SOLO su ropa/);
  const ropero = [
    { id: "idPol1", grupo: "arriba", tipo: "Polera", colores: ["blanco"], clima: ["templado"], notas: "secreta" },
    { id: "idJean2", grupo: "abajo", tipo: "Jean", colores: ["azul-jean"] },
    { id: "idZap3", grupo: "zapatos", tipo: "Zapatillas", colores: ["blanco"] },
    { id: "idCha4", grupo: "abrigos", tipo: "Chamarra", colores: ["verde-oliva"], clima: ["frio"] },
    { id: "idSucia5", grupo: "arriba", tipo: "Camisa", colores: ["celeste"], lavar: true },
    { id: "mal id", grupo: "arriba", tipo: "X" }
  ];
  const e = L.entradaOutfits({
    ropero, clima: "En La Paz (Bolivia): sensación de 9 a 20 °C.", necesidades: { base: "templado", abrigo: "abrigo", capas: true, lluvia: "nada", sol: true },
    ocasion: "Trabajo", estilo: "Neutros y cortes rectos.", recientes: ["idJean2", "otro"], gustan: [["idPol1", "idJean2"], ["solo"]], noGustan: [["idPol1", "idJean2", "idZap3"]], evitar: [["idCha4", "idPol1", "idJean2", "idZap3"]], base: "idCha4"
  });
  assert.deepEqual(e.ropero.map(p => p.id), ["idPol1", "idJean2", "idZap3", "idCha4"], "sin lo que está para lavar ni ids raros");
  assert.deepEqual(e.necesidades, { base: "templado", abrigo: "abrigo", capas: true, lluvia: "", tormenta: false, nieve: false, viento: false, sol: true });
  assert.deepEqual(e.recientes, ["idJean2"]);
  assert.deepEqual(e.gustan, [["idPol1", "idJean2"]]);
  assert.equal(e.base, "idCha4");
  assert.equal(L.entradaOutfits({ ropero: ropero.slice(0, 1) }), null, "con una prenda no se arma nada");
  const { texto, refs } = L.textoRopero(e.ropero);
  const t = L.textoOutfits(e, refs);
  assert.match(t, /^El día: En La Paz \(Bolivia\)/);
  assert.match(t, /Lo que pide: ropa de templado; abrigo para el frío; capas \(mañana fresca/);
  assert.match(t, /Ocasión: Trabajo\./);
  assert.match(t, /Me puse hace poco \(mejor no repetir\): p2\./);
  assert.match(t, /Combinaciones que me gustaron: \(p1, p2\)\./);
  assert.match(t, /No me gustaron \(no las repitas\): \(p1, p2, p3\)\./);
  assert.match(t, /Ya vi estas \(dame otras\): \(p4, p1, p2, p3\)\./);
  assert.match(t, /Tiene que ir sí o sí: p4\./);
  assert.match(t, /Arma 5 outfits, del mejor al menos bueno\.$/, "3 para ver y 2 por si pide otra opción");
  assert.match(L.instruccionesOutfits(), /los tres primeros son los que va a ver/);
  assert.ok(!/idPol1|idJean2|idZap3|idCha4|secreta/.test(texto + t), "la IA no ve tus ids ni tus notas");
  const r = L.limpiarOutfits({ outfits: [
    { nombre: "Capas neutras", prendas: ["p4", "P1", "p2", "p3", "p1"], porque: "Neutros.", capas: "Chamarra a la mañana." },
    { nombre: "Inventado", prendas: ["p9", "p1"], porque: "", capas: "" },
    { nombre: "Otro", prendas: ["p1", "p2"], porque: "x".repeat(300), capas: "" }
  ], nota: "Te falta algo para la lluvia." }, refs);
  assert.deepEqual(r.outfits[0], { nombre: "Capas neutras", prendas: ["idCha4", "idPol1", "idJean2", "idZap3"], porque: "Neutros.", capas: "Chamarra a la mañana." });
  assert.equal(r.outfits.length, 2, "la que tenía una prenda inventada queda con una sola: se va");
  assert.equal(r.outfits[1].porque.length, 200);
  assert.equal(r.nota, "Te falta algo para la lluvia.");
  assert.deepEqual(L.limpiarOutfits(null, refs), { outfits: [], nota: "" });
  const muchos = L.limpiarOutfits({ outfits: Array.from({ length: 9 }, () => ({ nombre: "x", prendas: ["p1", "p2"], porque: "", capas: "" })), nota: "" }, refs);
  assert.equal(muchos.outfits.length, 6, "hasta 6 (la app muestra 3 y guarda el resto)");
});
