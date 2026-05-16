import { useEffect, useState } from "react";
import { getKlines } from "./lib/binance";
import { analyzeSignal, type SignalAnalysis } from "./lib/signal-engine";

export default function App() {
  const [analysis, setAnalysis] = useState<SignalAnalysis | null>(null);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState("");

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

  function translateConfidence(confidence: SignalAnalysis["confidence"]) {
    switch (confidence) {
      case "HIGH":
        return "גבוהה";
      case "MEDIUM":
        return "בינונית";
      default:
        return "נמוכה";
    }
  }

  function translateStructure(structure: SignalAnalysis["structure"]) {
    switch (structure) {
      case "BULLISH":
        return "שורי";
      case "BEARISH":
        return "דובי";
      default:
        return "דשדוש";
    }
  }

  function translateDirection(direction: SignalAnalysis["bos"] | SignalAnalysis["choch"]) {
    switch (direction) {
      case "BULLISH":
        return "שורי";
      case "BEARISH":
        return "דובי";
      default:
        return "ללא";
    }
  }

  function translateBias(bias: SignalAnalysis["higherTimeframe"]["bias"]) {
    switch (bias) {
      case "BULLISH":
        return "שורית";
      case "BEARISH":
        return "דובית";
      default:
        return "ניטרלית";
    }
  }

  function translateSetupState(setupState: SignalAnalysis["setupState"]) {
    switch (setupState) {
      case "CONFLICT":
        return "קונפליקט";
      case "WATCHLIST_LONG":
        return "מעקב ללונג";
      case "WATCHLIST_SHORT":
        return "מעקב לשורט";
      case "READY_LONG":
        return "לונג מאושר";
      case "READY_SHORT":
        return "שורט מאושר";
      default:
        return "ללא";
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

  function translateRangePosition(position: SignalAnalysis["rangePosition"]) {
    switch (position) {
      case "LOWER":
        return "תחתון";
      case "UPPER":
        return "עליון";
      default:
        return "אמצע";
    }
  }

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    async function load() {
      try {
        setError("");
        const candles5m = await getKlines("BTCUSDT", "5m", 200);
        const candles1h = await getKlines("BTCUSDT", "1h", 200);
        const result = analyzeSignal(candles5m, candles1h);

        setAnalysis(result);
        setLastUpdate(new Date().toLocaleTimeString());
      } catch (err) {
        setError(err instanceof Error ? err.message : "שגיאה לא ידועה");
      }
    }

    load();
    interval = setInterval(load, 5000);

    return () => clearInterval(interval);
  }, []);

  const decisionColor =
    analysis?.decision === "LONG"
      ? "#22c55e"
      : analysis?.decision === "SHORT"
        ? "#ef4444"
        : "#f59e0b";

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
      <p>צמד: BTCUSDT</p>
      <p>טיימפריים נמוך: 5 דקות</p>
      <p>טיימפריים גבוה: שעה</p>
      <p>עדכון אחרון: {lastUpdate || "טוען..."}</p>

      {analysis && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 8,
            border: `1px solid ${decisionColor}`,
            background: "#111827",
            maxWidth: 920,
          }}
        >
          <h2 style={{ marginTop: 0 }}>החלטה: {translateDecision(analysis.decision)}</h2>
          <p>רמת ביטחון: {translateConfidence(analysis.confidence)}</p>
          <p>מצב סטאפ: {translateSetupState(analysis.setupState)}</p>
          <p>איכות סטאפ: {translateQuality(analysis.setupQuality)}</p>
          <p>מיקום בטווח: {translateRangePosition(analysis.rangePosition)}</p>
          <p>תנאי כניסה: {analysis.validIf ?? "-"}</p>
          <p>תנאי ביטול: {analysis.invalidIf ?? "-"}</p>

          <h3>Context</h3>
          <p>כיוון קונטקסט: {analysis.context.direction}</p>
          <p>יישור טיימפריימים: {analysis.context.aligned ? "כן" : "לא"}</p>
          <p>קונפליקט: {analysis.context.conflict ? "כן" : "לא"}</p>
          <p>EMA stack: {analysis.context.emaStack}</p>
          <p>מומנטום: {analysis.context.momentum}</p>
          <p>מצב נפח: {analysis.context.volumeState}</p>

          <h3>ניתוח 5 דקות</h3>
          <p>מבנה: {translateStructure(analysis.structure)}</p>
          <p>BOS: {translateDirection(analysis.bos)}</p>
          <p>CHoCH: {translateDirection(analysis.choch)}</p>
          <p>מחיר: {analysis.price.toFixed(2)}</p>
          <p>ATR: {analysis.atr.toFixed(2)}</p>
          <p>שיא קודם: {analysis.previousHigh.toFixed(2)}</p>
          <p>שפל קודם: {analysis.previousLow.toFixed(2)}</p>
          <p>שיא סווינג אחרון: {analysis.lastSwingHigh?.toFixed(2) ?? "-"}</p>
          <p>שפל סווינג אחרון: {analysis.lastSwingLow?.toFixed(2) ?? "-"}</p>
          <p>EMA 9 / 21 / 50 / 200: {analysis.ema9.toFixed(2)} / {analysis.ema21.toFixed(2)} / {analysis.ema50.toFixed(2)} / {analysis.ema200.toFixed(2)}</p>
          <p>RSI: {analysis.rsi.toFixed(2)}</p>
          <p>MACD: {analysis.macd.toFixed(2)}</p>
          <p>יחס נפח: {analysis.volumeRatio.toFixed(2)}</p>
          <p>עוצמת מגמה: {(analysis.trendStrength * 100).toFixed(2)}%</p>
          <p>אזור ללא מסחר: {analysis.noTradeZone ? "כן" : "לא"}</p>
          <p>ציון לונג / שורט: {analysis.longScore} / {analysis.shortScore}</p>

          <h3>אישור שעה</h3>
          <p>הטיה: {translateBias(analysis.higherTimeframe.bias)}</p>
          <p>מבנה: {translateStructure(analysis.higherTimeframe.structure)}</p>
          <p>BOS: {translateDirection(analysis.higherTimeframe.bos)}</p>
          <p>CHoCH: {translateDirection(analysis.higherTimeframe.choch)}</p>
          <p>EMA 50 / 200: {analysis.higherTimeframe.ema50.toFixed(2)} / {analysis.higherTimeframe.ema200.toFixed(2)}</p>
          <p>RSI: {analysis.higherTimeframe.rsi.toFixed(2)}</p>

          {analysis.tradePlan && (
            <>
              <h3>תוכנית עסקה</h3>
              <p>כיוון: {analysis.tradePlan.direction}</p>
              <p>כניסה: {analysis.tradePlan.entry.toFixed(2)}</p>
              <p>סטופ: {analysis.tradePlan.stopLoss.toFixed(2)}</p>
              <p>יעד 1: {analysis.tradePlan.takeProfit1.toFixed(2)}</p>
              <p>יעד 2: {analysis.tradePlan.takeProfit2.toFixed(2)}</p>
              <p>יעד 3: {analysis.tradePlan.takeProfit3.toFixed(2)}</p>
            </>
          )}

          <h3>סיבות</h3>
          <ul>
            {analysis.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p style={{ color: "#ef4444", marginTop: 16 }}>
          Error: {error}
        </p>
      )}
    </div>
  );
}
