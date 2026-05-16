import "dotenv/config";

import { getKlines } from "../src/lib/binance";
import { analyzeSignal } from "../src/lib/signal-engine";
import {
  buildTelegramMessage,
  shouldSendTelegramAlert,
} from "./alert-message";
import { sendTelegramMessage } from "./telegram";

const SYMBOL = process.env.SYMBOL || "BTCUSDT";
const LOW_INTERVAL = process.env.LOW_INTERVAL || "5m";
const HIGH_INTERVAL = process.env.HIGH_INTERVAL || "1h";

async function run() {
  console.log("מתחיל בדיקת סיגנל חד-פעמית...");

  const candlesLow = await getKlines(SYMBOL, LOW_INTERVAL, 200);
  const candlesHigh = await getKlines(SYMBOL, HIGH_INTERVAL, 200);
  const result = analyzeSignal(candlesLow, candlesHigh);

  console.log("הבדיקה הושלמה:");
  console.log({
    symbol: SYMBOL,
    decision: result.decision,
    setupState: result.setupState,
    setupQuality: result.setupQuality,
    price: result.price,
    triggerPrice: result.triggerPrice,
    invalidationPrice: result.invalidationPrice,
    tradePlan: result.tradePlan,
    structure: result.structure,
    bias: result.higherTimeframe.bias,
    reasons: result.reasons,
  });

  if (!shouldSendTelegramAlert(result)) {
    console.log("אין טריגר מאושר. לא נשלחת התראת טלגרם.");
    return;
  }

  const message = buildTelegramMessage(result, {
    symbol: SYMBOL,
    lowInterval: LOW_INTERVAL,
    highInterval: HIGH_INTERVAL,
  });

  await sendTelegramMessage(message);
  console.log("התראת טלגרם נשלחה בהצלחה.");
}

run().catch((error) => {
  console.error("שגיאה בהרצה חד-פעמית:", error);
  process.exit(1);
});
