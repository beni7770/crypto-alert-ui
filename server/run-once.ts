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
const WATCHLIST_ALERT_MIN_QUALITY =
  (process.env.WATCHLIST_ALERT_MIN_QUALITY as SignalAnalysis["setupQuality"]) || "HIGH";

type BtcContextStatus = "SELF" | "SUPPORTS" | "AGAINST" | "NEUTRAL" | "UNKNOWN";

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

async function run() {
  const universe = await getMarketUniverse(getUniverseConfigFromEnv(process.env));
  const symbols = universe.map((coin) => coin.binanceSymbol);

  console.log("מתחיל בדיקת סיגנל חד-פעמית...");
  console.log(`צמדים לבדיקה: ${symbols.join(", ")}`);

  let btcResult: SignalAnalysis | undefined;
  if (symbols.includes("BTCUSDT")) {
    btcResult = await analyzeSymbol("BTCUSDT");
  }

  for (const symbol of symbols) {
    try {
      const result = symbol === "BTCUSDT" && btcResult ? btcResult : await analyzeSymbol(symbol);
      const btcContext = getBtcContext(symbol, result, btcResult);

      console.log("הבדיקה הושלמה:", {
        symbol,
        decision: result.decision,
        setupState: result.setupState,
        setupQuality: result.setupQuality,
        price: result.price,
        triggerPrice: result.triggerPrice,
        invalidationPrice: result.invalidationPrice,
        btcContext,
        tradePlan: result.tradePlan,
        reasons: result.reasons,
      });

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

      if (!shouldSendTelegramAlert(result, WATCHLIST_ALERT_MIN_QUALITY)) {
        console.log(`אין התראה לשליחה עבור ${symbol}.`);
        continue;
      }

      const message = buildTelegramMessage(result, {
        symbol,
        lowInterval: LOW_INTERVAL,
        highInterval: HIGH_INTERVAL,
        btcContext: translateBtcContext(btcContext),
      });
      const alertKey = createAlertKey(symbol, result);
      const alertType = result.decision === "WAIT" ? "WATCHLIST" : "TRADE";

      if (await alertExists(alertKey)) {
        console.log(`התראה כבר קיימת ב-Supabase עבור ${symbol}. מדלג.`);
        continue;
      }

      await sendTelegramMessage(message);
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
      console.error(`שגיאה בניתוח ${symbol}:`, error);
    }
  }
}

run().catch((error) => {
  console.error("שגיאה בהרצה חד-פעמית:", error);
  process.exit(1);
});
