"""Guarda los cierres diarios (en US$) de los tickers de data/tickers.json en
data/precios.json, para la sección Inversiones de Manolo. No usa claves:
primero el gráfico público de Yahoo Finance y, si falla, el CSV de Stooq.
Conserva el historial y solo agrega o corrige días (repasa los últimos 10).
El precio es el cierre normal (no ajustado por dividendos), para compararlo
con el precio de compra.
También guarda las fechas de dividendos de cada ticker ("dividendos"): el
historial de Yahoo (fecha ex y monto) y, si Nasdaq ya las anunció, la próxima
fecha ex y la de pago. Si no hay anuncio, la próxima se estima con el ritmo
de las anteriores. Formato y uso: docs/INVERSIONES.md."""
import statistics
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


def fetch(url, extra=None):
    req = urllib.request.Request(url, headers=dict(HEADERS, **(extra or {})))
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


# ---- Dividendos ----
NASDAQ = {"Origin": "https://www.nasdaq.com", "Referer": "https://www.nasdaq.com/", "Accept-Language": "en-US,en;q=0.9"}


def leer_div_yahoo(texto):
    """Eventos de dividendo del gráfico de Yahoo -> [{ex, monto}] (fecha ex de la bolsa)."""
    r = json.loads(texto)["chart"]["result"][0]
    offset = (r.get("meta") or {}).get("gmtoffset", -14400)
    divs = ((r.get("events") or {}).get("dividends") or {}).values()
    out = [{"ex": dt.datetime.fromtimestamp(v["date"] + offset, dt.timezone.utc).date().isoformat(), "monto": round(float(v["amount"]), 6)}
           for v in divs if v.get("amount")]
    return sorted(out, key=lambda e: e["ex"])


def fecha_us(s):
    """'10/27/2026' -> '2026-10-27'; 'N/A' o vacío -> None."""
    try:
        return dt.datetime.strptime(str(s).strip(), "%m/%d/%Y").date().isoformat()
    except ValueError:
        return None


def leer_div_nasdaq(texto):
    """Tabla de dividendos de Nasdaq -> [{ex, pago, registro, anuncio, monto}]."""
    data = (json.loads(texto) or {}).get("data") or {}
    filas = ((data.get("dividends") or {}).get("rows")) or []
    out = []
    for f in filas:
        ex = fecha_us(f.get("exOrEffDate"))
        if not ex:
            continue
        try:
            monto = round(float(str(f.get("amount", "")).replace("$", "").replace(",", "")), 6)
        except ValueError:
            monto = None
        e = {"ex": ex, "pago": fecha_us(f.get("paymentDate")), "registro": fecha_us(f.get("recordDate")),
             "anuncio": fecha_us(f.get("declarationDate")), "monto": monto}
        out.append({k: v for k, v in e.items() if v is not None})
    return sorted(out, key=lambda e: e["ex"])


def div_yahoo(ticker):
    return leer_div_yahoo(fetch(f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=3y&interval=1mo&events=div"))


def div_nasdaq(ticker):
    errores = []
    for clase in ("etf", "stocks"):
        try:
            filas = leer_div_nasdaq(fetch(f"https://api.nasdaq.com/api/quote/{ticker}/dividends?assetclass={clase}", NASDAQ))
            if filas:
                return filas
            errores.append(f"{clase}: sin filas")
        except Exception as err:
            errores.append(f"{clase}: {err}")
    raise ValueError("; ".join(errores))


FRECUENCIAS = [(45, "mensual"), (120, "trimestral"), (240, "semestral"), (10000, "anual")]


def armar_dividendos(eventos_yahoo, eventos_nasdaq, hoy):
    """Junta las dos fuentes (Nasdaq trae la fecha de pago) y arma la próxima
    fecha: la anunciada (fecha ex desde hoy) o, si no hay, la estimada."""
    por_ex = {}
    for e in eventos_yahoo or []:
        por_ex[e["ex"]] = dict(e)
    for e in eventos_nasdaq or []:
        por_ex.setdefault(e["ex"], {}).update(e)
    eventos = sorted(por_ex.values(), key=lambda e: e["ex"])
    if not eventos:
        return None
    pasados = [e for e in eventos if e["ex"] < hoy]
    futuros = [e for e in eventos if e["ex"] >= hoy]
    exs = [dt.date.fromisoformat(e["ex"]) for e in pasados[-9:]]
    intervalos = [(b - a).days for a, b in zip(exs, exs[1:]) if (b - a).days > 5]
    paso = int(statistics.median(intervalos)) if intervalos else None
    demoras = [(dt.date.fromisoformat(e["pago"]) - dt.date.fromisoformat(e["ex"])).days for e in eventos if e.get("pago")]
    demora = int(statistics.median(demoras)) if demoras else None
    out = {"historial": pasados[-8:]}
    if paso:
        out["frecuencia"] = next(n for tope, n in FRECUENCIAS if paso <= tope)
    if futuros:
        out["proximo"] = dict(futuros[0], estimado=False)
    elif paso and pasados:
        ex = dt.date.fromisoformat(pasados[-1]["ex"]) + dt.timedelta(days=paso)
        while ex.isoformat() < hoy:
            ex += dt.timedelta(days=paso)
        prox = {"ex": ex.isoformat(), "estimado": True}
        if demora is not None:
            prox["pago"] = (ex + dt.timedelta(days=demora)).isoformat()
        if pasados[-1].get("monto"):
            prox["monto"] = pasados[-1]["monto"]
        out["proximo"] = prox
    return out


def dividendos(lista, previo, hoy):
    """Fechas de dividendos por ticker; si una fuente falla, se usa la otra,
    y si fallan las dos, queda lo guardado."""
    out = dict(previo or {})
    for t in lista:
        print(f"{t}: dividendos")
        y, n = None, None
        try:
            y = div_yahoo(t)
            print(f"  yahoo: {len(y)} pagos")
        except Exception as err:
            print(f"  yahoo falló: {err}")
        time.sleep(1)
        try:
            n = div_nasdaq(t)
            print(f"  nasdaq: {len(n)} filas, última ex {n[-1]['ex']}")
        except Exception as err:
            print(f"  nasdaq falló: {err}")
        time.sleep(1)
        d = armar_dividendos(y, n, hoy)
        if not d:
            print(f"::warning::{t}: sin fechas de dividendos; se mantiene lo guardado")
            continue
        d["fuentes"] = [nombre for nombre, ok in (("yahoo", y), ("nasdaq", n)) if ok]
        out[t] = d
        p = d.get("proximo")
        print(f"  próximo: {p and p.get('ex')} ({'estimado' if p and p.get('estimado') else 'anunciado'}), pago {p and p.get('pago')}")
    return out


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

    divs = dividendos(lista, previo.get("dividendos"), hoy)
    nombres = {clave: nombre for clave, nombre, _ in FUENTES}
    datos = {"fuente": " + ".join(nombres[c] for c, _n, _f in FUENTES if c in usadas) or previo.get("fuente", ""),
             "tickers": dict(sorted(tickers.items())), "dividendos": dict(sorted(divs.items()))}
    cambio = datos["tickers"] != (previo.get("tickers") or {}) or datos["dividendos"] != (previo.get("dividendos") or {})
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
