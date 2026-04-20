import { useEffect, useRef, useState } from "react";
import { getKlines } from "./lib/binance";
import { analyzeSignal, type SignalAnalysis } from "./lib/signal-engine";
import { sendTelegramMessage } from "./lib/telegram";

export default function App() {
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
        return "רשימת מעקב ללונג";
      case "WATCHLIST_SHORT":
        return "רשימת מעקב לשורט";
      case "READY_LONG":
        return "מוכן ללונג";
      case "READY_SHORT":
        return "מוכן לשורט";
      default:
        return "ללא";
    }
  }
  const [analysis, setAnalysis] = useState<SignalAnalysis | null>(null);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState("");
  const [telegramStatus, setTelegramStatus] = useState("");

  const lastAlertKeyRef = useRef<string>("");

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

        await maybeSendTelegramAlert(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "שגיאה לא ידועה");
      }
    }

    async function maybeSendTelegramAlert(result: SignalAnalysis) {
      const shouldAlert =
        result.decision === "LONG" ||
        result.decision === "SHORT" ||
        result.setupState === "WATCHLIST_LONG" ||
        result.setupState === "WATCHLIST_SHORT";

      if (!shouldAlert) return;

      const alertKey = [
        result.decision,
        result.setupState,
        result.structure,
        result.bos,
        result.choch,
        result.higherTimeframe.bias,
      ].join("|");

      if (lastAlertKeyRef.current === alertKey) return;

      lastAlertKeyRef.current = alertKey;

      const lines = [
        "🚨 סוכן התראות קריפטו",
        `צמד: BTCUSDT`,
        `החלטה: ${translateDecision(result.decision)}`,
        `מצב סטאפ: ${translateSetupState(result.setupState)}`,
        `מבנה 5ד: ${translateStructure(result.structure)}`,
        `BOS ב־5ד: ${translateDirection(result.bos)}`,
        `CHoCH ב־5ד: ${translateDirection(result.choch)}`,
        `הטיה ב־1ש: ${translateBias(result.higherTimeframe.bias)}`,
        `מחיר: ${result.price.toFixed(2)}`,
        `EMA 21: ${result.ema21.toFixed(2)}`,
        `RSI: ${result.rsi.toFixed(2)}`,
        `MACD: ${result.macd.toFixed(2)}`,
        `יחס נפח: ${result.volumeRatio.toFixed(2)}`,
        `עוצמת מגמה: ${(result.trendStrength * 100).toFixed(2)}%`,
        `סיבה: ${result.reasons.join(" | ")}`,
      ];

      if (result.trade) {
        lines.push(
          `כניסה: ${result.trade.entry.toFixed(2)}`,
          `סטופ לוס: ${result.trade.stopLoss.toFixed(2)}`,
          `יעד 1: ${result.trade.takeProfit1.toFixed(2)}`,
          `יעד 2: ${result.trade.takeProfit2.toFixed(2)}`,
          `יעד 3: ${result.trade.takeProfit3.toFixed(2)}`
        );
      }

      try {
        await sendTelegramMessage(lines.join("\n"));
        setTelegramStatus(`התראת טלגרם נשלחה ב־${new Date().toLocaleTimeString()}`);
      } catch (err) {
        setTelegramStatus(
          err instanceof Error ? `שליחת טלגרם נכשלה: ${err.message}` : "שליחת טלגרם נכשלה"
        );
      }
    }

    async function sendTestMessage() {
      try {
        setTelegramStatus("שולח...");
        await sendTelegramMessage("✅ הודעת בדיקה מסוכן התראות הקריפטו");
        setTelegramStatus("הודעת בדיקה לטלגרם נשלחה בהצלחה");
      } catch (err) {
        setTelegramStatus(
          err instanceof Error ? `שליחת טלגרם נכשלה: ${err.message}` : "שליחת טלגרם נכשלה"
        );
      }
    }

    load();
    interval = setInterval(load, 5000);

    (window as any).sendTelegramTest = sendTestMessage;

    return () => clearInterval(interval);
  }, []);

  async function handleTelegramTest() {
    try {
      setTelegramStatus("שולח...");
      await sendTelegramMessage("✅ הודעת בדיקה מסוכן התראות הקריפטו");
      setTelegramStatus("הודעת בדיקה לטלגרם נשלחה בהצלחה");
    } catch (err) {
      setTelegramStatus(
        err instanceof Error ? `שליחת טלגרם נכשלה: ${err.message}` : "שליחת טלגרם נכשלה"
      );
    }
  }

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

      <button
        onClick={handleTelegramTest}
        style={{
          marginTop: 12,
          marginBottom: 12,
          padding: "10px 16px",
          borderRadius: 8,
          border: "1px solid #22c55e",
          background: "#111827",
          color: "white",
          cursor: "pointer",
        }}
      >
        שלח בדיקת טלגרם
      </button>

      {telegramStatus && <p>{telegramStatus}</p>}

      {analysis && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 10,
            border: `1px solid ${decisionColor}`,
            background: "#111827",
            maxWidth: 820,
          }}
        >
          <h2 style={{ marginTop: 0 }}>החלטה: {translateDecision(analysis.decision)}</h2>
          <p>רמת ביטחון: {translateConfidence(analysis.confidence)}</p>
          <p>מצב סטאפ: {translateSetupState(analysis.setupState)}</p>

          <h3>ניתוח 5 דקות</h3>
          <p>מבנה: {translateStructure(analysis.structure)}</p>
          <p>BOS: {translateDirection(analysis.bos)}</p>
          <p>CHoCH: {translateDirection(analysis.choch)}</p>

          <p>מחיר: {analysis.price.toFixed(2)}</p>
          <p>רמה עגולה: {analysis.roundLevel.toFixed(2)}</p>
          <p>שיא קודם: {analysis.previousHigh.toFixed(2)}</p>
          <p>שפל קודם: {analysis.previousLow.toFixed(2)}</p>

          <p>שיא סווינג אחרון: {analysis.lastSwingHigh?.toFixed(2) ?? "-"}</p>
          <p>שפל סווינג אחרון: {analysis.lastSwingLow?.toFixed(2) ?? "-"}</p>
          <p>שיא סווינג קודם: {analysis.priorSwingHigh?.toFixed(2) ?? "-"}</p>
          <p>שפל סווינג קודם: {analysis.priorSwingLow?.toFixed(2) ?? "-"}</p>

          <p>EMA 9: {analysis.ema9.toFixed(2)}</p>
          <p>EMA 21: {analysis.ema21.toFixed(2)}</p>
          <p>EMA 50: {analysis.ema50.toFixed(2)}</p>
          <p>EMA 200: {analysis.ema200.toFixed(2)}</p>

          <p>RSI: {analysis.rsi.toFixed(2)}</p>
          <p>MACD: {analysis.macd.toFixed(2)}</p>
          <p>אות MACD: {analysis.macdSignal.toFixed(2)}</p>
          <p>היסטוגרמת MACD: {analysis.macdHistogram.toFixed(2)}</p>

          <p>נפח נוכחי: {analysis.currentVolume.toFixed(2)}</p>
          <p>נפח ממוצע: {analysis.averageVolume.toFixed(2)}</p>
          <p>יחס נפח: {analysis.volumeRatio.toFixed(2)}</p>
          <p>עוצמת מגמה: {(analysis.trendStrength * 100).toFixed(2)}%</p>

          <p>פריצת שווא: {analysis.fakeBreakout ? "כן" : "לא"}</p>
          <p>גריפת נזילות: {analysis.liquiditySweep ? "כן" : "לא"}</p>
          <p>דחייה שורית: {analysis.bullishRejection ? "כן" : "לא"}</p>
          <p>דחייה דובית: {analysis.bearishRejection ? "כן" : "לא"}</p>
          <p>פולבק ללונג: {analysis.isPullbackLong ? "כן" : "לא"}</p>
          <p>פולבק לשורט: {analysis.isPullbackShort ? "כן" : "לא"}</p>
          <p>אזור ללא מסחר: {analysis.noTradeZone ? "כן" : "לא"}</p>

          <p>ציון לונג: {analysis.longScore}</p>
          <p>ציון שורט: {analysis.shortScore}</p>

          <h3>אישור שעה</h3>
          <p>הטיה: {translateBias(analysis.higherTimeframe.bias)}</p>
          <p>מבנה: {translateStructure(analysis.higherTimeframe.structure)}</p>
          <p>BOS: {translateDirection(analysis.higherTimeframe.bos)}</p>
          <p>CHoCH: {translateDirection(analysis.higherTimeframe.choch)}</p>
          <p>מחיר: {analysis.higherTimeframe.price.toFixed(2)}</p>
          <p>EMA 21: {analysis.higherTimeframe.ema21.toFixed(2)}</p>
          <p>EMA 50: {analysis.higherTimeframe.ema50.toFixed(2)}</p>
          <p>EMA 200: {analysis.higherTimeframe.ema200.toFixed(2)}</p>
          <p>RSI: {analysis.higherTimeframe.rsi.toFixed(2)}</p>
          <p>MACD: {analysis.higherTimeframe.macd.toFixed(2)}</p>
          <p>אות MACD: {analysis.higherTimeframe.macdSignal.toFixed(2)}</p>
          <p>
            עוצמת מגמה: {(analysis.higherTimeframe.trendStrength * 100).toFixed(2)}%
          </p>

          <p>סיבה: {analysis.reasons.join(" | ")}</p>

          {analysis.trade && (
            <>
              <h3>סטאפ למסחר</h3>
              <p>כניסה: {analysis.trade.entry.toFixed(2)}</p>
              <p>סטופ לוס: {analysis.trade.stopLoss.toFixed(2)}</p>
              <p>יעד 1: {analysis.trade.takeProfit1.toFixed(2)}</p>
              <p>יעד 2: {analysis.trade.takeProfit2.toFixed(2)}</p>
              <p>יעד 3: {analysis.trade.takeProfit3.toFixed(2)}</p>
              <p>RR1: {analysis.trade.riskReward1.toFixed(2)}</p>
              <p>RR2: {analysis.trade.riskReward2.toFixed(2)}</p>
              <p>RR3: {analysis.trade.riskReward3.toFixed(2)}</p>
            </>
          )}
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