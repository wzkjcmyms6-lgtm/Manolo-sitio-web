"""Guarda los cierres diarios (en US$) de los tickers de data/tickers.json en
data/precios.json, para la sección Inversiones de Manolo. No usa claves:
primero el gráfico público de Yahoo Finance y, si falla, el CSV de Stooq.
Conserva el historial y solo agrega o corrige días (repasa los últimos 10).
El precio es el cierre normal (no ajustado por dividendos), para compararlo
con el precio de compra. Formato y uso: docs/INVERSIONES.md."""
import csv
import datetime as dt
import io
import json
import sys
import time
import urllib.error
import urllib.request

TICKERS = "data/tickers.json"
OUT = "data/precios.json"
REPASO_DIAS = 10
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json,text/csv,text/plain,*/*",
}


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        code, body = resp.status, resp.read()
    except urllib.error.HTTPError as err:
        code, body = err.code, err.read()
    print(f"  GET {url.split('?')[0]} -> {code}, {len(body)} bytes")
    if code != 200:
        raise ValueError(f"HTTP {code}")
    return body.decode("utf-8", "replace")


def epoch(fecha):
    return int(dt.datetime.fromisoformat(fecha).replace(tzinfo=dt.timezone.utc).timestamp())


def leer_yahoo(texto):
    """JSON del gráfico de Yahoo -> {fecha: cierre}. La fecha es la de la bolsa."""
    data = json.loads(texto)
    res = (data.get("chart") or {}).get("result") or []
    if not res:
        raise ValueError(f"sin datos: {(data.get('chart') or {}).get('error')}")
    r = res[0]
    if (r.get("meta") or {}).get("currency", "USD") != "USD":
        raise ValueError(f"moneda {r['meta'].get('currency')}")
    offset = (r.get("meta") or {}).get("gmtoffset", -14400)
    cierres = ((r.get("indicators") or {}).get("quote") or [{}])[0].get("close") or []
    local = lambda t: dt.datetime.fromtimestamp(t + offset, dt.timezone.utc)
    out = {}
    for t, c in zip(r.get("timestamp") or [], cierres):
        if c is None or not c > 0:
            continue
        out[local(t).date().isoformat()] = round(float(c), 4)
    # El cierre del último día a veces no viene como barra todavía: si la
    # sesión ya cerró (último precio a las 16:00 de Nueva York o después),
    # ese precio es el cierre del día.
    meta = r.get("meta") or {}
    precio, hora = meta.get("regularMarketPrice"), meta.get("regularMarketTime")
    if precio and precio > 0 and hora:
        h = local(hora)
        print(f"  último precio {precio} a las {h:%Y-%m-%d %H:%M} (hora de la bolsa)")
        if h.hour >= 16 and h.date().isoformat() not in out:
            out[h.date().isoformat()] = round(float(precio), 4)
    return out


def leer_stooq(texto):
    """CSV de Stooq (Date,Open,High,Low,Close,Volume) -> {fecha: cierre}."""
    filas = list(csv.DictReader(io.StringIO(texto)))
    if not filas or "Close" not in filas[0]:
        raise ValueError(f"respuesta inesperada: {texto[:80]!r}")
    out = {}
    for f in filas:
        try:
            c = float(f["Close"])
        except (TypeError, ValueError):
            continue
        if c > 0 and len(f.get("Date", "")) == 10:
            out[f["Date"]] = round(c, 4)
    return out


def yahoo(ticker, desde, hasta):
    errores = []
    for host in ("query1", "query2"):
        url = (f"https://{host}.finance.yahoo.com/v8/finance/chart/{ticker}"
               f"?period1={epoch(desde)}&period2={epoch(hasta) + 86400}&interval=1d&events=history")
        try:
            return leer_yahoo(fetch(url))
        except (ValueError, KeyError, urllib.error.URLError, TimeoutError) as err:
            errores.append(f"{host}: {err}")
    raise ValueError("; ".join(errores))


def stooq(ticker, desde, hasta):
    d1, d2 = desde.replace("-", ""), hasta.replace("-", "")
    url = f"https://stooq.com/q/d/l/?s={ticker.lower()}.us&d1={d1}&d2={d2}&i=d"
    return leer_stooq(fetch(url))


FUENTES = [("yahoo", "Yahoo Finance (gráfico público)", yahoo), ("stooq", "Stooq (CSV)", stooq)]


def cargar(ruta, defecto):
    try:
        with open(ruta, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return defecto


def main():
    conf = cargar(TICKERS, {})
    lista = [t.strip().upper() for t in conf.get("tickers", []) if t.strip()]
    desde_conf = conf.get("desde", "2026-09-01")
    hoy = dt.datetime.now(dt.timezone.utc).date().isoformat()
    previo = cargar(OUT, {})
    tickers = dict(previo.get("tickers") or {})
    fallidos, usadas = [], set()

    for t in lista:
        actual = tickers.get(t) or {}
        historial = dict(actual.get("historial") or {})
        desde = desde_conf
        if historial:
            ultimo = max(historial)
            repaso = (dt.date.fromisoformat(ultimo) - dt.timedelta(days=REPASO_DIAS)).isoformat()
            desde = max(desde_conf, repaso)
        print(f"{t}: desde {desde}")
        nuevos, fuente = None, None
        for clave, _nombre, leer in FUENTES:
            try:
                nuevos = leer(t, desde, hoy)
                if not nuevos:
                    raise ValueError("sin cierres en el rango")
                fuente = clave
                break
            except Exception as err:  # una fuente caída no debe frenar a la otra
                print(f"  {clave} falló: {err}")
            time.sleep(1)
        if not nuevos:
            fallidos.append(t)
            print(f"::warning::{t}: ninguna fuente respondió; se mantiene lo guardado")
            continue
        nuevos = {f: c for f, c in nuevos.items() if f >= desde_conf}
        for f, c in sorted(nuevos.items()):
            viejo = historial.get(f)
            if viejo and abs(c / viejo - 1) > 0.3:
                print(f"::warning::{t} {f}: cambio grande {viejo} -> {c}")
        historial.update(nuevos)
        historial = dict(sorted(historial.items()))
        u = max(historial)
        tickers[t] = {"fuente": fuente, "ultimo": {"fecha": u, "cierre": historial[u]}, "historial": historial}
        usadas.add(fuente)
        print(f"  {fuente}: {len(nuevos)} cierres, último {u} = {historial[u]}")
        time.sleep(1)

    nombres = {clave: nombre for clave, nombre, _ in FUENTES}
    datos = {"fuente": " + ".join(nombres[c] for c, _n, _f in FUENTES if c in usadas) or previo.get("fuente", ""),
             "tickers": dict(sorted(tickers.items()))}
    cambio = datos["tickers"] != (previo.get("tickers") or {})
    datos["actualizado"] = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if cambio else previo.get("actualizado")
    if cambio:
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump(datos, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.write("\n")
        print(f"Guardado {OUT}")
    else:
        print("Sin cambios en los precios")
    if lista and len(fallidos) == len(lista):
        print("::error::No se pudo leer ningún precio")
        sys.exit(1)


if __name__ == "__main__":
    main()
