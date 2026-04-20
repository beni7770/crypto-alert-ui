const REST_BASE = "https://data-api.binance.vision";

function normalizeSymbol(symbol: string): string {
  return symbol.replace("/", "").toUpperCase();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Binance error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export type KlineCandle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
};

export async function getPrice(symbol: string): Promise<number> {
  const s = normalizeSymbol(symbol);
  const data = await fetchJson<{ symbol: string; price: string }>(
    `${REST_BASE}/api/v3/ticker/price?symbol=${s}`
  );
  return Number(data.price);
}

export async function getKlines(
  symbol: string,
  interval: string = "5m",
  limit: number = 200
): Promise<KlineCandle[]> {
  const s = normalizeSymbol(symbol);
  const data = await fetchJson<any[]>(
    `${REST_BASE}/api/v3/klines?symbol=${s}&interval=${interval}&limit=${limit}`
  );

  return data.map((k) => ({
    openTime: Number(k[0]),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
    closeTime: Number(k[6]),
  }));
}