import "dotenv/config";

import { getKlines } from "../src/lib/binance";
import { analyzeSignal, type SignalAnalysis } from "../src/lib/signal-engine";
import { sendTelegramMessage } from "./telegram";

const SYMBOL = process.env.SYMBOL || "BTCUSDT";
const LOW_INTERVAL = process.env.LOW_INTERVAL || "5m";
const HIGH_INTERVAL = process.env.HIGH_INTERVAL || "1h";
const LOOP_MS = Number(process.env.WORKER_INTERVAL_MS || "300000");

let lastAlertKey = "";

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

function translateDirection(
  direction: SignalAnalysis["bos"] | SignalAnalysis["choch"]
) {
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

function shouldAlert(result: SignalAnalysis) {
  return (
    result.decision === "LONG" ||
    result.decision === "SHORT" ||
    result.setupState === "WATCHLIST_LONG" ||
    result.setupState === "WATCHLIST_SHORT"
  );
}

function createAlertKey(result: SignalAnalysis) {
  return [
    result.decision,
    result.setupState,
    result.structure,
    result.bos,
    result.choch,
    result.higherTimeframe.bias,
  ].join("|");
}

function buildTelegramMessage(result: SignalAnalysis) {
  const lines = [
    "🚨 סוכן התראות קריפטו",
    `צמד: ${SYMBOL}`,
    `החלטה: ${translateDecision(result.decision)}`,
    `מצב סטאפ: ${translateSetupState(result.setupState)}`,
    `מבנה ${LOW_INTERVAL}: ${translateStructure(result.structure)}`,
    `BOS ב־${LOW_INTERVAL}: ${translateDirection(result.bos)}`,
    `CHoCH ב־${LOW_INTERVAL}: ${translateDirection(result.choch)}`,
    `הטיה ב־${HIGH_INTERVAL}: ${translateBias(result.higherTimeframe.bias)}`,
    `מחיר: ${result.price.toFixed(2)}`,
    `EMA 21: ${result.ema21.toFixed(2)}`,
    `RSI: ${result.rsi.toFixed(2)}`,
    `MACD: ${result.macd.toFixed(2)}`,
    `יחס נפח: ${result.volumeRatio.toFixed(2)}`,
    "",
    "סיבות:",
    ...result.reasons.map((reason) => `• ${reason}`),
  ];

  return lines.join("\n");
}

async function runCycle() {
  const startedAt = new Date().toISOString();
  console.log(`מתחיל מחזור בדיקה: ${startedAt}`);

  const candlesLow = await getKlines(SYMBOL, LOW_INTERVAL, 200);
  const candlesHigh = await getKlines(SYMBOL, HIGH_INTERVAL, 200);

  const result = analyzeSignal(candlesLow, candlesHigh);

  console.log("תוצאת ניתוח:", {
    symbol: SYMBOL,
    decision: result.decision,
    setupState: result.setupState,
    price: result.price,
    structure: result.structure,
    bias: result.higherTimeframe.bias,
  });

  if (!shouldAlert(result)) {
    console.log("אין כרגע התראה איכותית. ממתין למחזור הבא.");
    return;
  }

  const alertKey = createAlertKey(result);

  if (alertKey === lastAlertKey) {
    console.log("אותה התראה כבר נשלחה. מדלג.");
    return;
  }

  const message = buildTelegramMessage(result);
  await sendTelegramMessage(message);

  lastAlertKey = alertKey;
  console.log("התראת טלגרם נשלחה בהצלחה.");
}

async function startWorker() {
  console.log("ה־worker הופעל.");
  console.log(`צמד: ${SYMBOL}`);
  console.log(`טיימפריים נמוך: ${LOW_INTERVAL}`);
  console.log(`טיימפריים גבוה: ${HIGH_INTERVAL}`);
  console.log(`מרווח בדיקה: ${LOOP_MS}ms`);

  await runCycle();

  setInterval(() => {
    runCycle().catch((error) => {
      console.error("שגיאה במחזור בדיקה:", error);
    });
  }, LOOP_MS);
}

startWorker().catch((error) => {
  console.error("שגיאה בהפעלת ה־worker:", error);
  process.exit(1);
});
