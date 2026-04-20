import "dotenv/config";

import { getKlines } from "../src/lib/binance";
import { analyzeSignal, type SignalAnalysis } from "../src/lib/signal-engine";
import { sendTelegramMessage } from "./telegram";

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

function buildTelegramMessage(result: SignalAnalysis) {
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
    "",
    "סיבות:",
    ...result.reasons.map((reason) => `• ${reason}`),
  ];

  return lines.join("\n");
}

async function run() {
  console.log("מתחיל בדיקת סיגנל חד־פעמית...");

  const candles5m = await getKlines("BTCUSDT", "5m", 200);
  const candles1h = await getKlines("BTCUSDT", "1h", 200);

  const result = analyzeSignal(candles5m, candles1h);

  console.log("הבדיקה הושלמה:");
  console.log({
    decision: result.decision,
    setupState: result.setupState,
    price: result.price,
    structure: result.structure,
    bias: result.higherTimeframe.bias,
    reasons: result.reasons,
  });

  if (!shouldAlert(result)) {
    console.log("אין כרגע התראה לשליחה.");
    return;
  }

  const message = buildTelegramMessage(result);
  await sendTelegramMessage(message);
  console.log("התראת טלגרם נשלחה בהצלחה.");
}

run().catch((error) => {
  console.error("שגיאה בהרצה חד־פעמית:", error);
  process.exit(1);
});
