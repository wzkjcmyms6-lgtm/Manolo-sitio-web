"""Lee el Tipo de Cambio Oficial (TCO) Bs/USD publicado por el BCB y lo guarda
en data/tipo-cambio.json (último valor + historial por día, hora de La Paz).
El viernes el BCB publica el valor que rige sábado, domingo y lunes: como esto
corre todos los días, cada día queda con el valor vigente ese día."""
import datetime as dt
import html
import json
import re
import sys
import urllib.request

URL = "https://www.bcb.gob.bo/?q=cotizaciones"
OUT = "data/tipo-cambio.json"
MESES = {"ENERO": 1, "FEBRERO": 2, "MARZO": 3, "ABRIL": 4, "MAYO": 5, "JUNIO": 6, "JULIO": 7,
         "AGOSTO": 8, "SEPTIEMBRE": 9, "SETIEMBRE": 9, "OCTUBRE": 10, "NOVIEMBRE": 11, "DICIEMBRE": 12}


def page_text():
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (Manolo; tipo de cambio diario)"})
    raw = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")
    raw = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", raw)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", raw)))


def parse(text):
    i = text.upper().find("TIPO DE CAMBIO OFICIAL")
    if i < 0:
        raise ValueError("no aparece 'Tipo de Cambio Oficial'")
    m = re.search(r"USD\s+(\d{1,3}[.,]\d{1,4})", text[i:i + 600])
    if not m:
        raise ValueError("no encontré el valor USD junto al TCO")
    tco = float(m.group(1).replace(",", "."))
    if not 1 < tco < 100:
        raise ValueError(f"valor fuera de rango: {tco}")
    f = re.search(r"(\d{1,2}) DE ([A-ZÁÉÍÓÚ]+) DE (\d{4})", text[max(0, i - 800):i].upper())
    publicado = None
    if f and f.group(2) in MESES:
        publicado = dt.date(int(f.group(3)), MESES[f.group(2)], int(f.group(1))).isoformat()
    return tco, publicado


def main():
    text = page_text()
    try:
        tco, publicado = parse(text)
    except ValueError as err:
        k = text.upper().find("CAMBIO")
        print("No se pudo leer el TCO:", err)
        print("Fragmento de la página:", text[max(0, k - 500):k + 1500])
        sys.exit(1)

    hoy = (dt.datetime.utcnow() - dt.timedelta(hours=4)).date().isoformat()  # La Paz (UTC-4)
    try:
        data = json.load(open(OUT, encoding="utf-8"))
    except (OSError, ValueError):
        data = {}
    historial = data.get("historial", {})
    historial[hoy] = tco
    data = {
        "fuente": URL,
        "ultimo": {"fecha": hoy, "tco": tco, "publicado": publicado},
        "historial": dict(sorted(historial.items())),
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print(f"TCO {tco} para {hoy} (publicado {publicado})")


if __name__ == "__main__":
    main()
