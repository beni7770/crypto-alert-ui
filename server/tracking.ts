import "dotenv/config";

import { fileURLToPath } from "node:url";

import { getKlines, type KlineCandle } from "../src/lib/binance";
import type { TradeDirection } from "../src/lib/signal-engine";
import {
  listOpenTradeAlerts,
  updateAlertTracking,
  type AlertTrackingPatch,
  type TrackedAlert,
  type TrackedAlertOutcome,
  type TrackedAlertStatus,
} from "./supabase";

const LOW_INTERVAL = process.env.LOW_INTERVAL || "5m";
const TRACKING_CANDLE_LIMIT = Number(process.env.TRACKING_CANDLE_LIMIT || "500");

type EvaluatedTrade = {
  status: TrackedAlertStatus;
  outcome: TrackedAlertOutcome;
  maxR: number;
  resultR: number | null;
  closedAt: string | null;
};

function calculateR(
  direction: TradeDirection,
  entry: number,
  stopLoss: number,
  candle: KlineCandle
) {
  const risk = Math.abs(entry - stopLoss);
  if (risk <= 0) return 0;

  const favorableMove = direction === "LONG" ? candle.high - entry : entry - candle.low;
  return Math.max(0, favorableMove / risk);
}

function hasHitStop(direction: TradeDirection, stopLoss: number, candle: KlineCandle) {
  return direction === "LONG" ? candle.low <= stopLoss : candle.high >= stopLoss;
}

function hasHitTarget(direction: TradeDirection, target: number, candle: KlineCandle) {
  return direction === "LONG" ? candle.high >= target : candle.low <= target;
}

function closeTimeIso(candle: KlineCandle) {
  return new Date(candle.closeTime).toISOString();
}

function normalizeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function evaluateTrackedAlert(alert: TrackedAlert, candles: KlineCandle[]): EvaluatedTrade | null {
  const direction = alert.direction;
  const entry = normalizeNumber(alert.entry_price);
  const stopLoss = normalizeNumber(alert.stop_loss);
  const tp1 = normalizeNumber(alert.take_profit1);
  const tp2 = normalizeNumber(alert.take_profit2);
  const tp3 = normalizeNumber(alert.take_profit3);

  if (!direction || !entry || !stopLoss || !tp1 || !tp2 || !tp3) return null;

  const openedAt = alert.opened_at ? Date.parse(alert.opened_at) : Date.parse(alert.created_at);
  const relevantCandles = candles.filter((candle) => candle.closeTime >= openedAt);
  if (relevantCandles.length === 0) return null;

  let status: TrackedAlertStatus = alert.status === "TP1" || alert.status === "TP2" ? alert.status : "OPEN";
  let outcome: TrackedAlertOutcome =
    alert.outcome === "TP1" || alert.outcome === "TP2" ? alert.outcome : "OPEN";
  let maxR = alert.max_r ?? 0;
  let resultR: number | null = alert.result_r ?? null;
  let closedAt: string | null = alert.closed_at ?? null;

  for (const candle of relevantCandles) {
    maxR = Math.max(maxR, calculateR(direction, entry, stopLoss, candle));

    const stopHit = hasHitStop(direction, stopLoss, candle);
    const tp3Hit = hasHitTarget(direction, tp3, candle);
    const tp2Hit = hasHitTarget(direction, tp2, candle);
    const tp1Hit = hasHitTarget(direction, tp1, candle);

    if (tp3Hit) {
      status = "CLOSED";
      outcome = "TP3";
      resultR = 3;
      closedAt = closeTimeIso(candle);
      break;
    }

    if (tp2Hit) {
      status = "TP2";
      outcome = "TP2";
      resultR = 2;
    } else if (tp1Hit && status === "OPEN") {
      status = "TP1";
      outcome = "TP1";
      resultR = 1;
    }

    if (stopHit) {
      status = "CLOSED";
      if (outcome === "TP2") {
        outcome = "STOP_AFTER_TP2";
        resultR = 2;
      } else if (outcome === "TP1") {
        outcome = "STOP_AFTER_TP1";
        resultR = 1;
      } else {
        outcome = "STOP";
        resultR = -1;
      }
      closedAt = closeTimeIso(candle);
      break;
    }
  }

  return { status, outcome, maxR, resultR, closedAt };
}

function buildTrackingPatch(evaluation: EvaluatedTrade): AlertTrackingPatch {
  return {
    status: evaluation.status,
    outcome: evaluation.outcome,
    max_r: Number(evaluation.maxR.toFixed(2)),
    result_r: evaluation.resultR,
    closed_at: evaluation.closedAt,
    last_checked_at: new Date().toISOString(),
  };
}

export async function trackOpenAlerts() {
  const alerts = await listOpenTradeAlerts();
  if (alerts.length === 0) {
    console.log("אין התראות פתוחות למעקב.");
    return;
  }

  console.log(`בודק מעקב עבור ${alerts.length} התראות פתוחות...`);

  for (const alert of alerts) {
    try {
      const candles = await getKlines(alert.symbol, LOW_INTERVAL, TRACKING_CANDLE_LIMIT);
      const evaluation = evaluateTrackedAlert(alert, candles);

      if (!evaluation) {
        console.log(`אין מספיק נתונים למעקב עבור ${alert.symbol}.`);
        continue;
      }

      await updateAlertTracking(alert.id, buildTrackingPatch(evaluation));
      console.log("מעקב התראה עודכן:", {
        symbol: alert.symbol,
        alertKey: alert.alert_key,
        status: evaluation.status,
        outcome: evaluation.outcome,
        resultR: evaluation.resultR,
        maxR: Number(evaluation.maxR.toFixed(2)),
      });
    } catch (error) {
      console.error(`מעקב התראה נכשל עבור ${alert.symbol}:`, error);
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  trackOpenAlerts().catch((error) => {
    console.error("שגיאה בהרצת מעקב התראות:", error);
    process.exit(1);
  });
}
