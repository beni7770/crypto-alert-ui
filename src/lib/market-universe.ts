import { getTradableUsdtSymbols } from "./binance";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const DEFAULT_FALLBACK_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];
const EXCLUDED_COINGECKO_IDS = new Set([
  "tether",
  "usd-coin",
  "usds",
  "dai",
  "staked-ether",
  "wrapped-bitcoin",
  "wrapped-steth",
  "ethena-usde",
  "first-digital-usd",
]);
const EXCLUDED_BASE_ASSETS = new Set([
  "USDT",
  "USDC",
  "USDS",
  "DAI",
  "FDUSD",
  "TUSD",
  "USDE",
  "BUSD",
  "WBTC",
  "WETH",
  "STETH",
]);

type CoinGeckoMarket = {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank: number | null;
};

export type MarketUniverseCoin = {
  id: string;
  symbol: string;
  baseAsset: string;
  binanceSymbol: string;
  name: string;
  marketCapRank: number | null;
};

export type MarketUniverseOptions = {
  mode?: string;
  limit?: number;
  fallbackSymbol?: string;
  fallbackSymbols?: string[];
};

function parseSymbolList(value?: string): string[] {
  return (value ?? "")
    .split(",")
    .map((symbol) => symbol.trim().replace("/", "").toUpperCase())
    .filter(Boolean);
}

export function getUniverseConfigFromEnv(env: Record<string, string | undefined>): MarketUniverseOptions {
  return {
    mode: env.MARKET_UNIVERSE_MODE,
    limit: Number(env.MARKET_UNIVERSE_LIMIT || "10"),
    fallbackSymbol: env.SYMBOL || "BTCUSDT",
    fallbackSymbols: parseSymbolList(env.SYMBOLS),
  };
}

async function fetchCoinGeckoMarkets(limit: number): Promise<CoinGeckoMarket[]> {
  const params = new URLSearchParams({
    vs_currency: "usd",
    order: "market_cap_desc",
    per_page: String(Math.max(limit * 4, 20)),
    page: "1",
    sparkline: "false",
  });
  const res = await fetch(`${COINGECKO_BASE}/coins/markets?${params.toString()}`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CoinGecko error ${res.status}: ${text}`);
  }

  return res.json() as Promise<CoinGeckoMarket[]>;
}

export async function getMarketUniverse(options: MarketUniverseOptions = {}): Promise<MarketUniverseCoin[]> {
  const limit = Number.isFinite(options.limit) && options.limit ? Number(options.limit) : 10;
  const fallbackSymbols = options.fallbackSymbols?.length
    ? options.fallbackSymbols
    : [options.fallbackSymbol || "BTCUSDT", ...DEFAULT_FALLBACK_SYMBOLS];

  if (options.mode && options.mode !== "TOP_MARKET_CAP") {
    return [...new Set(fallbackSymbols)].slice(0, limit).map((symbol) => ({
      id: symbol.toLowerCase(),
      symbol: symbol.replace(/USDT$/, ""),
      baseAsset: symbol.replace(/USDT$/, ""),
      binanceSymbol: symbol,
      name: symbol,
      marketCapRank: null,
    }));
  }

  try {
    const [markets, tradableSymbols] = await Promise.all([
      fetchCoinGeckoMarkets(limit),
      getTradableUsdtSymbols(),
    ]);

    const universe: MarketUniverseCoin[] = [];
    const seen = new Set<string>();

    for (const coin of markets) {
      if (EXCLUDED_COINGECKO_IDS.has(coin.id)) continue;

      const baseAsset = coin.symbol.toUpperCase();
      if (EXCLUDED_BASE_ASSETS.has(baseAsset)) continue;

      const binanceSymbol = `${baseAsset}USDT`;
      if (seen.has(binanceSymbol) || !tradableSymbols.has(binanceSymbol)) continue;

      universe.push({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        baseAsset,
        binanceSymbol,
        name: coin.name,
        marketCapRank: coin.market_cap_rank,
      });
      seen.add(binanceSymbol);

      if (universe.length >= limit) break;
    }

    if (universe.length > 0) return universe;
  } catch (error) {
    console.warn("נכשל איתור Top Market Cap. משתמש ב-fallback:", error);
  }

  return [...new Set(fallbackSymbols)].slice(0, limit).map((symbol) => ({
    id: symbol.toLowerCase(),
    symbol: symbol.replace(/USDT$/, ""),
    baseAsset: symbol.replace(/USDT$/, ""),
    binanceSymbol: symbol,
    name: symbol,
    marketCapRank: null,
  }));
}
