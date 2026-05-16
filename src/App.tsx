import { useEffect, useState } from "react";
import { getKlines } from "./lib/binance";
import { getMarketUniverse, type MarketUniverseCoin } from "./lib/market-universe";
import { analyzeSignal, type SignalAnalysis } from "./lib/signal-engine";

type SymbolCard = {
  coin: MarketUniverseCoin;
  analysis?: SignalAnalysis;
  btcContext: "SELF" | "SUPPORTS" | "AGAINST" | "NEUTRAL" | "UNKNOWN";
  error?: string;
};

function translateDecision(decision: SignalAnalysis["decision"]) {
  switch (decision) {
    case "LONG":
      return "לונג";
    case "SHORT":
      return "שורט";
    default:
      return "המתנה";
  }
}

function translateQuality(quality: SignalAnalysis["setupQuality"]) {
  switch (quality) {
    case "HIGH":
      return "גבוהה";
    case "MEDIUM":
      return "בינונית";
    default:
      return "נמוכה";
  }
}

function translateBtcContext(status: SymbolCard["btcContext"]) {
  switch (status) {
    case "SELF":
      return "BTC";
    case "SUPPORTS":
      return "BTC תומך";
    case "AGAINST":
      return "BTC נגד";
    case "NEUTRAL":
      return "BTC ניטרלי";
    default:
      return "לא נבדק";
  }
}

function getBtcContext(symbol: string, result?: SignalAnalysis, btcResult?: SignalAnalysis): SymbolCard["btcContext"] {
  if (symbol === "BTCUSDT") return "SELF";
  if (!result || !btcResult) return "UNKNOWN";
  if (btcResult.context.direction === "NEUTRAL") return "NEUTRAL";
  if (!result.setup.direction) return "NEUTRAL";
  return btcResult.context.direction === result.setup.direction ? "SUPPORTS" : "AGAINST";
}

async function analyzeSymbol(symbol: string) {
  const [candles5m, candles1h] = await Promise.all([
    getKlines(symbol, "5m", 200),
    getKlines(symbol, "1h", 200),
  ]);

  return analyzeSignal(candles5m, candles1h);
}

export default function App() {
  const [cards, setCards] = useState<SymbolCard[]>([]);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setError("");
        setLoading(true);

        const universe = await getMarketUniverse({
          mode: "TOP_MARKET_CAP",
          limit: 10,
          fallbackSymbol: "BTCUSDT",
        });
        const btcCoin = universe.find((coin) => coin.binanceSymbol === "BTCUSDT");
        const btcAnalysis = btcCoin ? await analyzeSymbol("BTCUSDT") : undefined;

        const results = await Promise.allSettled(
          universe.map(async (coin) => {
            const analysis =
              coin.binanceSymbol === "BTCUSDT" && btcAnalysis
                ? btcAnalysis
                : await analyzeSymbol(coin.binanceSymbol);

            return {
              coin,
              analysis,
              btcContext: getBtcContext(coin.binanceSymbol, analysis, btcAnalysis),
            } satisfies SymbolCard;
          })
        );

        setCards(
          results.map((result, index) => {
            if (result.status === "fulfilled") return result.value;

            return {
              coin: universe[index],
              btcContext: "UNKNOWN",
              error: result.reason instanceof Error ? result.reason.message : "שגיאה לא ידועה",
            };
          })
        );
        setLastUpdate(new Date().toLocaleTimeString());
      } catch (err) {
        setError(err instanceof Error ? err.message : "שגיאה לא ידועה");
      } finally {
        setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "Arial",
        minHeight: "100vh",
        background: "#0b1020",
        color: "white",
        direction: "rtl",
        textAlign: "right",
      }}
    >
      <h1>סוכן התראות קריפטו</h1>
      <p>מצב: Top 10 לפי שווי שוק, צמדי USDT ב-Binance</p>
      <p>טיימפריים: 5 דקות / שעה</p>
      <p>עדכון אחרון: {lastUpdate || "טוען..."}</p>
      <p>Telegram ו-Supabase רצים בצד השרת בלבד.</p>

      {loading && <p>מרענן נתונים...</p>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
          maxWidth: 1280,
          marginTop: 20,
        }}
      >
        {cards.map(({ coin, analysis, btcContext, error: cardError }) => {
          const color =
            analysis?.decision === "LONG"
              ? "#22c55e"
              : analysis?.decision === "SHORT"
                ? "#ef4444"
                : analysis?.setupState.startsWith("WATCHLIST")
                  ? "#38bdf8"
                  : "#f59e0b";

          return (
            <div
              key={coin.binanceSymbol}
              style={{
                border: `1px solid ${color}`,
                borderRadius: 8,
                background: "#111827",
                padding: 14,
                minHeight: 260,
              }}
            >
              <h2 style={{ marginTop: 0, marginBottom: 4 }}>{coin.binanceSymbol}</h2>
              <p style={{ marginTop: 0 }}>{coin.name} {coin.marketCapRank ? `#${coin.marketCapRank}` : ""}</p>

              {cardError && <p style={{ color: "#ef4444" }}>שגיאה: {cardError}</p>}

              {analysis && (
                <>
                  <p>החלטה: {translateDecision(analysis.decision)}</p>
                  <p>סטאפ: {analysis.setupState}</p>
                  <p>איכות: {translateQuality(analysis.setupQuality)}</p>
                  <p>מחיר: {analysis.price.toFixed(2)}</p>
                  <p>BTC: {translateBtcContext(btcContext)}</p>
                  <p>Context: {analysis.context.direction}</p>
                  <p>EMA: {analysis.context.emaStack}</p>
                  <p>מומנטום: {analysis.context.momentum}</p>
                  <p>נפח: {analysis.context.volumeState}</p>
                  <p>כניסה: {analysis.validIf ?? "-"}</p>
                  <p>ביטול: {analysis.invalidIf ?? "-"}</p>

                  {analysis.tradePlan && (
                    <>
                      <p>סטופ: {analysis.tradePlan.stopLoss.toFixed(2)}</p>
                      <p>TP1 / TP2 / TP3: {analysis.tradePlan.takeProfit1.toFixed(2)} / {analysis.tradePlan.takeProfit2.toFixed(2)} / {analysis.tradePlan.takeProfit3.toFixed(2)}</p>
                    </>
                  )}

                  <p>סיבה: {analysis.reasons[0]}</p>
                </>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p style={{ color: "#ef4444", marginTop: 16 }}>
          Error: {error}
        </p>
      )}
    </div>
  );
}
