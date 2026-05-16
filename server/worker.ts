import "dotenv/config";

import { getKlines } from "../src/lib/binance";
import { getMarketUniverse, getUniverseConfigFromEnv } from "../src/lib/market-universe";
import { analyzeSignal, type SignalAnalysis } from "../src/lib/signal-engine";
import {
  buildTelegramMessage,
  createAlertKey,
  shouldSendTelegramAlert,
} from "./alert-message";
import { alertExists, saveAlert, saveSignalAnalysis } from "./supabase";
import { sendTelegramMessage } from "./telegram";

const LOW_INTERVAL = process.env.LOW_INTERVAL || "5m";
const HIGH_INTERVAL = process.env.HIGH_INTERVAL || "1h";
const LOOP_MS = Number(process.env.WORKER_INTERVAL_MS || "300000");
const WATCHLIST_ALERT_MIN_QUALITY =
  (process.env.WATCHLIST_ALERT_MIN_QUALITY as SignalAnalysis["setupQuality"]) || "HIGH";

type BtcContextStatus = "SELF" | "SUPPORTS" | "AGAINST" | "NEUTRAL" | "UNKNOWN";

const sentAlertKeys = new Set<string>();

function getBtcContext(symbol: string, result: SignalAnalysis, btcResult?: SignalAnalysis): BtcContextStatus {
  if (symbol === "BTCUSDT") return "SELF";
  if (!btcResult) return "UNKNOWN";
  if (btcResult.context.direction === "NEUTRAL") return "NEUTRAL";
  if (!result.setup.direction) return "NEUTRAL";
  return btcResult.context.direction === result.setup.direction ? "SUPPORTS" : "AGAINST";
}

function translateBtcContext(status: BtcContextStatus) {
  switch (status) {
    case "SELF":
      return "BTC הוא הצמד הנבדק";
    case "SUPPORTS":
      return "BTC תומך בכיוון";
    case "AGAINST":
      return "BTC נגד הכיוון";
    case "NEUTRAL":
      return "BTC ניטרלי";
    default:
      return "BTC לא נבדק";
  }
}

async function analyzeSymbol(symbol: string) {
  const [candlesLow, candlesHigh] = await Promise.all([
    getKlines(symbol, LOW_INTERVAL, 200),
    getKlines(symbol, HIGH_INTERVAL, 200),
  ]);

  return analyzeSignal(candlesLow, candlesHigh);
}

async function persistAnalysis(symbol: string, result: SignalAnalysis, btcContext: BtcContextStatus) {
  try {
    await saveSignalAnalysis({
      symbol,
      low_interval: LOW_INTERVAL,
      high_interval: HIGH_INTERVAL,
      decision: result.decision,
      setup_state: result.setupState,
      setup_quality: result.setupQuality,
      confidence: result.confidence,
      price: result.price,
      trigger_price: result.triggerPrice ?? null,
      invalidation_price: result.invalidationPrice ?? null,
      btc_context: btcContext,
      analysis: result,
    });
  } catch (error) {
    console.error(`שמירת ניתוח ל-Supabase נכשלה עבור ${symbol}:`, error);
  }
}

async function maybeSendAlert(symbol: string, result: SignalAnalysis, btcContext: BtcContextStatus) {
  if (!shouldSendTelegramAlert(result, WATCHLIST_ALERT_MIN_QUALITY)) return;

  const alertKey = createAlertKey(symbol, result);
  if (sentAlertKeys.has(alertKey)) {
    console.log(`התראה כפולה עבור ${symbol}. מדלג.`);
    return;
  }

  try {
    if (await alertExists(alertKey)) {
      sentAlertKeys.add(alertKey);
      console.log(`התראה כבר קיימת ב-Supabase עבור ${symbol}. מדלג.`);
      return;
    }
  } catch (error) {
    console.error(`בדיקת כפילות ב-Supabase נכשלה עבור ${symbol}:`, error);
  }

  const message = buildTelegramMessage(result, {
    symbol,
    lowInterval: LOW_INTERVAL,
    highInterval: HIGH_INTERVAL,
    btcContext: translateBtcContext(btcContext),
  });
  const alertType = result.decision === "WAIT" ? "WATCHLIST" : "TRADE";

  try {
    await sendTelegramMessage(message);
    sentAlertKeys.add(alertKey);
    await saveAlert({
      symbol,
      alert_key: alertKey,
      alert_type: alertType,
      decision: result.decision,
      setup_state: result.setupState,
      setup_quality: result.setupQuality,
      message,
      sent: true,
      analysis: result,
    });
    console.log(`התראת ${alertType} נשלחה עבור ${symbol}.`);
  } catch (error) {
    console.error(`שליחת התראה נכשלה עבור ${symbol}:`, error);
  }
}

async function runCycle() {
  const startedAt = new Date().toISOString();
  const universe = await getMarketUniverse(getUniverseConfigFromEnv(process.env));
  const symbols = universe.map((coin) => coin.binanceSymbol);

  console.log(`מתחיל מחזור בדיקה: ${startedAt}`);
  console.log(`צמדים לבדיקה: ${symbols.join(", ")}`);

  let btcResult: SignalAnalysis | undefined;
  if (symbols.includes("BTCUSDT")) {
    btcResult = await analyzeSymbol("BTCUSDT");
  }

  for (const symbol of symbols) {
    try {
      const result = symbol === "BTCUSDT" && btcResult ? btcResult : await analyzeSymbol(symbol);
      const btcContext = getBtcContext(symbol, result, btcResult);

      console.log("תוצאת ניתוח:", {
        symbol,
        decision: result.decision,
        setupState: result.setupState,
        setupQuality: result.setupQuality,
        price: result.price,
        triggerPrice: result.triggerPrice,
        invalidationPrice: result.invalidationPrice,
        btcContext,
        hasTradePlan: !!result.tradePlan,
        reasons: result.reasons,
      });

      await persistAnalysis(symbol, result, btcContext);
      await maybeSendAlert(symbol, result, btcContext);
    } catch (error) {
      console.error(`שגיאה בניתוח ${symbol}:`, error);
    }
  }
}

async function startWorker() {
  console.log("ה-worker הופעל.");
  console.log(`טיימפריים נמוך: ${LOW_INTERVAL}`);
  console.log(`טיימפריים גבוה: ${HIGH_INTERVAL}`);
  console.log(`מרווח בדיקה: ${LOOP_MS}ms`);
  console.log(`איכות מינימלית ל-WATCHLIST: ${WATCHLIST_ALERT_MIN_QUALITY}`);

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
