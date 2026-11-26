// Puente de Manolo: Pinterest sin red (puente/src/pinterest.js, D-148): los
// links (pin, tablero, pin.it del iPhone), el link corto, el RSS de un
// tablero, oEmbed y las imágenes que el puente acepta traer.
const test = require("node:test");
const assert = require("node:assert/strict");

const cargar = () => import("../puente/src/pinterest.js");

test("los links de Pinterest: pin, tablero, perfil y el link corto", async () => {
  const P = await cargar();
  assert.deepEqual(P.leerLink("https://www.pinterest.com/pin/424605071146401455/"), { tipo: "pin", id: "424605071146401455" });
  assert.deepEqual(P.leerLink("https://es.pinterest.com/pin/424605071146401455/sent/?invite_code=abc&sender=1"), { tipo: "pin", id: "424605071146401455" });
  assert.deepEqual(P.leerLink("https://pinterest.com.mx/pin/99/"), { tipo: "pin", id: "99" });
  // D-168: desde 2026-11, en el RSS de los tableros el pin viene con un código de 55 letras.
  assert.deepEqual(P.leerLink("https://www.pinterest.com/pin/e1_AfqPShzsafwMC3zEh8VCdutn84cI39v-eNA_DVedfCihH2C8Tqj_/"), { tipo: "pin", id: "e1_AfqPShzsafwMC3zEh8VCdutn84cI39v-eNA_DVedfCihH2C8Tqj_" });
  assert.strictEqual(P.leerLink(`https://www.pinterest.com/pin/${"a".repeat(101)}/`), null, "más de 100: no es un pin");
  // Lo que pega el iPhone desde la app: texto y el link corto.
  assert.deepEqual(P.leerLink("Mira este pin en Pinterest https://pin.it/2Ab3Cd4Ef"), { tipo: "corto", url: "https://pin.it/2Ab3Cd4Ef" });
  assert.deepEqual(P.leerLink("https://pin.it/2Ab3Cd4Ef/"), { tipo: "corto", url: "https://pin.it/2Ab3Cd4Ef" });
  assert.deepEqual(P.leerLink("https://api.pinterest.com/url_shortener/4ZqXgTHSn/redirect/"), { tipo: "corto", url: "https://api.pinterest.com/url_shortener/4ZqXgTHSn/redirect/" });
  // Tableros (con o sin lo que agrega la app al compartir).
  assert.deepEqual(P.leerLink("https://www.pinterest.com/juanito_99/manolo/"), { tipo: "tablero", usuario: "juanito_99", tablero: "manolo" });
  assert.deepEqual(P.leerLink("https://pinterest.com/juanito_99/ropa-de-invierno/?invite_code=x&sfo=1"), { tipo: "tablero", usuario: "juanito_99", tablero: "ropa-de-invierno" });
  assert.deepEqual(P.leerLink("https://www.pinterest.es/juanito_99/manolo/abrigos/"), { tipo: "tablero", usuario: "juanito_99", tablero: "manolo" });
  assert.deepEqual(P.leerLink("juanito_99/manolo"), { tipo: "tablero", usuario: "juanito_99", tablero: "manolo" });
  assert.deepEqual(P.leerLink("https://www.pinterest.com/juanito_99/"), { tipo: "perfil", usuario: "juanito_99" });
  // Lo que no es de Pinterest o no sirve.
  for (const malo of ["", "hola", "https://example.com/pin/1/", "https://evil-pinterest.com/pin/1/", "https://www.pinterest.com/search/pins/?q=jean",
    "https://www.pinterest.com/juanito_99/_saved/", "https://www.pinterest.com/juanito_99/pins/", "https://pin.it/", "ftp://pinterest.com/pin/1/", "https://www.pinterest.com/pin/"]) {
    assert.equal(P.leerLink(malo), null, malo);
  }
  assert.equal(P.esHostPinterest("www.pinterest.co.uk"), true);
  assert.equal(P.esHostPinterest("pinterest.com.evil.com"), false);
  assert.equal(P.urlRss("juanito_99", "ropa-de-invierno"), "https://www.pinterest.com/juanito_99/ropa-de-invierno.rss");
  assert.equal(P.urlOembed("99"), "https://www.pinterest.com/oembed.json?url=https%3A%2F%2Fwww.pinterest.com%2Fpin%2F99%2F");
});

test("el link corto se sigue sin salir de Pinterest", async () => {
  const P = await cargar();
  const saltos = {
    "https://pin.it/2Ab3Cd4Ef": { status: 308, location: "https://api.pinterest.com/url_shortener/2Ab3Cd4Ef/redirect/" },
    "https://api.pinterest.com/url_shortener/2Ab3Cd4Ef/redirect/": { status: 302, location: "https://www.pinterest.com/pin/123456/sent/?invite_code=z" }
  };
  const pedidos = [];
  const pedir = async url => { pedidos.push(url); return saltos[url] || { status: 404 }; };
  assert.deepEqual(await P.resolverCorto("https://pin.it/2Ab3Cd4Ef", pedir), { tipo: "pin", id: "123456" });
  assert.equal(pedidos.length, 2, "no baja la página del pin");
  // A un tablero.
  const tablero = async url => (url.startsWith("https://pin.it") ? { status: 301, location: "https://www.pinterest.com/juanito_99/manolo/?invite_code=1" } : { status: 404 });
  assert.deepEqual(await P.resolverCorto("https://pin.it/Xyz12", tablero), { tipo: "tablero", usuario: "juanito_99", tablero: "manolo" });
  // Afuera de Pinterest, sin redirección o en círculo: nada.
  assert.equal(await P.resolverCorto("https://pin.it/Xyz12", async () => ({ status: 302, location: "https://example.com/" })), null);
  assert.equal(await P.resolverCorto("https://pin.it/Xyz12", async () => ({ status: 404 })), null);
  assert.equal(await P.resolverCorto("https://pin.it/Xyz12", async () => ({ status: 302, location: "https://pin.it/Xyz12" })), null);
});

test("las imágenes: la de 736 px y solo de i.pinimg.com", async () => {
  const P = await cargar();
  const chica = "https://i.pinimg.com/236x/6c/b3/ab/6cb3ab2b0529475a7e027d8cfc46e688.jpg";
  assert.equal(P.imagenGrande(chica), "https://i.pinimg.com/736x/6c/b3/ab/6cb3ab2b0529475a7e027d8cfc46e688.jpg");
  assert.equal(P.imagenGrande("https://i.pinimg.com/originals/6c/b3/ab/x.png"), "https://i.pinimg.com/736x/6c/b3/ab/x.png");
  assert.deepEqual(P.imagenesPosibles(chica).map(u => u.split("/")[3]), ["736x", "474x", "236x"]);
  assert.equal(P.imagenValida(chica), true);
  for (const malo of ["http://i.pinimg.com/236x/a/b.jpg", "https://i.pinimg.com.evil.com/236x/a.jpg", "https://example.com/236x/a.jpg",
    "https://i.pinimg.com/236x/../../etc/passwd", "https://i.pinimg.com/236x/a/b.svg", "https://i.pinimg.com/236x/a b.jpg", ""]) {
    assert.equal(P.imagenValida(malo), false, malo);
    assert.equal(P.imagenGrande(malo), null, malo);
  }
});

// Como lo manda Pinterest (probado el 2026-11-22): la imagen viene adentro de
// la descripción, escapada.
const RSS = `<?xml version="1.0" encoding="utf-8"?><rss xmlns:atom="http://www.w3.org/2005/Atom" version="2.0"><channel>
  <title>Manolo</title><link>https://www.pinterest.com/juanito_99/manolo/</link>
  <item>
    <title>Abrigo camel &amp; jean recto</title>
    <link>https://www.pinterest.com/pin/424605071146401455/</link>
    <description>&lt;a href=&quot;https://www.pinterest.com/pin/424605071146401455/&quot;&gt;&lt;img src=&quot;https://i.pinimg.com/236x/6c/b3/ab/6cb3ab2b0529475a7e027d8cfc46e688.jpg&quot;&gt;&lt;/a&gt;Abrigo camel</description>
    <pubDate>Sun, 22 Nov 2026 18:21:01 GMT</pubDate>
    <guid>https://www.pinterest.com/pin/424605071146401455/</guid>
  </item>
  <item>
    <title><![CDATA[Look de oficina – azul marino]]></title>
    <link>https://www.pinterest.com/pin/424605071146401454/</link>
    <description><![CDATA[<a href="https://www.pinterest.com/pin/424605071146401454/"><img src="https://i.pinimg.com/236x/42/c1/ae/42c1ae188d3a8b44f105a4bd33b2f5ac.jpg"></a>]]></description>
    <pubDate>Sat, 21 Nov 2026 10:00:00 GMT</pubDate>
  </item>
  <item><title>Repetido</title><link>https://www.pinterest.com/pin/424605071146401455/</link><description>&lt;img src=&quot;https://i.pinimg.com/236x/aa/bb/cc/dd.jpg&quot;&gt;</description></item>
  <item><title>Sin imagen</title><link>https://www.pinterest.com/pin/1/</link><description>nada</description></item>
  <item><title>Imagen de otro lado</title><link>https://www.pinterest.com/pin/2/</link><description>&lt;img src=&quot;https://example.com/x.jpg&quot;&gt;</description></item>
</channel></rss>`;

test("el RSS de un tablero: título, link e imagen grande de cada pin", async () => {
  const P = await cargar();
  const pines = P.leerRss(RSS);
  assert.equal(pines.length, 2);
  assert.deepEqual(pines[0], {
    id: "424605071146401455", url: "https://www.pinterest.com/pin/424605071146401455/", titulo: "Abrigo camel & jean recto",
    img: "https://i.pinimg.com/736x/6c/b3/ab/6cb3ab2b0529475a7e027d8cfc46e688.jpg", fecha: Date.parse("Sun, 22 Nov 2026 18:21:01 GMT")
  });
  assert.equal(pines[1].titulo, "Look de oficina – azul marino");
  assert.equal(pines[1].img, "https://i.pinimg.com/736x/42/c1/ae/42c1ae188d3a8b44f105a4bd33b2f5ac.jpg");
  assert.equal(P.leerRss(RSS, 1).length, 1);
  assert.deepEqual(P.leerRss("<html>no es rss</html>"), []);
  assert.deepEqual(P.leerRss(""), []);
  assert.equal(P.decodificar("&lt;b&gt; &#233; &#xe9; &amp;amp; &raro;"), "<b> é é &amp; &raro;");
});

test("un pin por oEmbed", async () => {
  const P = await cargar();
  const j = { title: "The Starter Kit", author_name: "Pinterest", thumbnail_url: "https://i.pinimg.com/236x/6c/b3/ab/6cb3ab2b0529475a7e027d8cfc46e688.jpg" };
  assert.deepEqual(P.pinDeOembed("424605071146401455", j), {
    id: "424605071146401455", url: "https://www.pinterest.com/pin/424605071146401455/", titulo: "The Starter Kit",
    img: "https://i.pinimg.com/736x/6c/b3/ab/6cb3ab2b0529475a7e027d8cfc46e688.jpg"
  });
  assert.equal(P.pinDeOembed("1", { title: "x" }), null);
  assert.equal(P.pinDeOembed("1", null), null);
});

test("RSS de un tablero con los códigos nuevos de los pines (2026-11, D-168)", async () => {
  const P = await cargar();
  // Un pin tal como viene hoy en el RSS de un tablero público de Pinterest.
  const xml = `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><title>Official news</title>
    <item>
      <title>Introducing the Workshop: A creative studio for bringing Pinterest ideas to life</title>
      <link>https://www.pinterest.com/pin/e1_AfqPShzsafwMC3zEh8VCdutn84cI39v-eNA_DVedfCihH2C8Tqj_/</link>
      <description>&lt;a href=&quot;https://www.pinterest.com/pin/e1_AfqPShzsafwMC3zEh8VCdutn84cI39v-eNA_DVedfCihH2C8Tqj_/&quot;&gt;&lt;img src=&quot;https://i.pinimg.com/236x/32/68/65/3268658fe7973644e6e6e5be15266517.jpg&quot;&gt;&lt;/a&gt;Introducing the Workshop</description>
      <pubDate>Thu, 09 Nov 2017 23:13:20 GMT</pubDate>
      <guid>https://www.pinterest.com/pin/e1_AfqPShzsafwMC3zEh8VCdutn84cI39v-eNA_DVedfCihH2C8Tqj_/</guid>
    </item></channel></rss>`;
  const pines = P.leerRss(xml, 50);
  assert.equal(pines.length, 1);
  assert.equal(pines[0].id, "e1_AfqPShzsafwMC3zEh8VCdutn84cI39v-eNA_DVedfCihH2C8Tqj_");
  assert.equal(pines[0].url, "https://www.pinterest.com/pin/e1_AfqPShzsafwMC3zEh8VCdutn84cI39v-eNA_DVedfCihH2C8Tqj_/");
  assert.match(pines[0].img, /^https:\/\/i\.pinimg\.com\/736x\/32\/68\/65\/3268658fe7973644e6e6e5be15266517\.jpg$/);
  assert.equal(P.tituloRss(xml), "Official news");
});

