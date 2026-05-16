import "dotenv/config";

import { getKlines } from "../src/lib/binance";
import { analyzeSignal } from "../src/lib/signal-engine";
import {
  buildTelegramMessage,
  createAlertKey,
  shouldSendTelegramAlert,
} from "./alert-message";
import { sendTelegramMessage } from "./telegram";

const SYMBOL = process.env.SYMBOL || "BTCUSDT";
const LOW_INTERVAL = process.env.LOW_INTERVAL || "5m";
const HIGH_INTERVAL = process.env.HIGH_INTERVAL || "1h";
const LOOP_MS = Number(process.env.WORKER_INTERVAL_MS || "300000");

let lastAlertKey = "";

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
    setupQuality: result.setupQuality,
    price: result.price,
    triggerPrice: result.triggerPrice,
    invalidationPrice: result.invalidationPrice,
    hasTradePlan: !!result.tradePlan,
    structure: result.structure,
    bias: result.higherTimeframe.bias,
    reasons: result.reasons,
  });

  if (!shouldSendTelegramAlert(result)) {
    console.log("אין טריגר מאושר. לא נשלחת התראת טלגרם.");
    return;
  }

  const alertKey = createAlertKey(result);
  if (alertKey === lastAlertKey) {
    console.log("אותה התראת טריגר כבר נשלחה. מדלג.");
    return;
  }

  const message = buildTelegramMessage(result, {
    symbol: SYMBOL,
    lowInterval: LOW_INTERVAL,
    highInterval: HIGH_INTERVAL,
  });

  await sendTelegramMessage(message);
  lastAlertKey = alertKey;
  console.log("התראת טלגרם נשלחה בהצלחה.");
}

async function startWorker() {
  console.log("ה-worker הופעל.");
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
  console.error("שגיאה בהפעלת ה-worker:", error);
  process.exit(1);
});
