import type {
  DashboardAlert,
  DashboardResponse,
  DashboardSummary,
  DashboardSymbol,
} from "../src/lib/dashboard-types";
import type { SignalAnalysis } from "../src/lib/signal-engine";
import {
  isSupabaseConfigured,
  listRecentAlerts,
  listRecentSignalAnalyses,
  type StoredSignalAnalysis,
  type TrackedAlert,
} from "./supabase";

function toNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isClosedTrade(alert: TrackedAlert) {
  return alert.alert_type === "TRADE" && alert.status === "CLOSED";
}

function isOpenTrade(alert: TrackedAlert) {
  return alert.alert_type === "TRADE" && alert.status !== "CLOSED";
}

function mapAlert(alert: TrackedAlert): DashboardAlert {
  return {
    id: alert.id,
    createdAt: alert.created_at,
    symbol: alert.symbol,
    alertType: alert.alert_type,
    decision: alert.decision,
    setupState: alert.setup_state,
    setupQuality: alert.setup_quality,
    status: alert.status,
    outcome: alert.outcome,
    direction: alert.direction,
    entryPrice: toNumber(alert.entry_price),
    stopLoss: toNumber(alert.stop_loss),
    takeProfit1: toNumber(alert.take_profit1),
    takeProfit2: toNumber(alert.take_profit2),
    takeProfit3: toNumber(alert.take_profit3),
    maxR: toNumber(alert.max_r),
    resultR: toNumber(alert.result_r),
    lastCheckedAt: alert.last_checked_at,
    reasons: alert.analysis.reasons ?? [],
  };
}

function mapSymbol(row: StoredSignalAnalysis): DashboardSymbol {
  const analysis: SignalAnalysis = row.analysis;

  return {
    symbol: row.symbol,
    createdAt: row.created_at,
    decision: row.decision,
    setupState: row.setup_state,
    setupQuality: row.setup_quality,
    confidence: row.confidence,
    price: row.price,
    triggerPrice: row.trigger_price,
    invalidationPrice: row.invalidation_price,
    btcContext: row.btc_context,
    contextDirection: analysis.context.direction,
    emaStack: analysis.context.emaStack,
    momentum: analysis.context.momentum,
    volumeState: analysis.context.volumeState,
    validIf: analysis.validIf,
    invalidIf: analysis.invalidIf,
    reasons: analysis.reasons,
  };
}

function latestBySymbol(rows: StoredSignalAnalysis[]) {
  const seen = new Set<string>();
  const latest: DashboardSymbol[] = [];

  for (const row of rows) {
    if (seen.has(row.symbol)) continue;
    seen.add(row.symbol);
    latest.push(mapSymbol(row));
  }

  return latest;
}

function getSymbolScores(alerts: TrackedAlert[]) {
  const scores = new Map<string, number>();

  for (const alert of alerts) {
    if (!isClosedTrade(alert)) continue;
    scores.set(alert.symbol, (scores.get(alert.symbol) ?? 0) + (alert.result_r ?? 0));
  }

  return [...scores.entries()].sort((a, b) => b[1] - a[1]);
}

function buildSummary(alerts: TrackedAlert[]): DashboardSummary {
  const tradeAlerts = alerts.filter((alert) => alert.alert_type === "TRADE");
  const watchlistAlerts = alerts.filter((alert) => alert.alert_type === "WATCHLIST");
  const closedTrades = tradeAlerts.filter(isClosedTrade);
  const wins = closedTrades.filter((alert) => (alert.result_r ?? 0) > 0);
  const losses = closedTrades.filter((alert) => (alert.result_r ?? 0) < 0);
  const totalR = closedTrades.reduce((sum, alert) => sum + (alert.result_r ?? 0), 0);
  const symbolScores = getSymbolScores(alerts);

  return {
    totalAlerts: alerts.length,
    tradeAlerts: tradeAlerts.length,
    watchlistAlerts: watchlistAlerts.length,
    openTrades: tradeAlerts.filter(isOpenTrade).length,
    closedTrades: closedTrades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closedTrades.length ? wins.length / closedTrades.length : 0,
    totalR,
    averageR: closedTrades.length ? totalR / closedTrades.length : 0,
    bestSymbol: symbolScores[0]?.[0],
    worstSymbol: symbolScores.at(-1)?.[0],
  };
}

export async function getDashboardData(): Promise<DashboardResponse> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase לא מוגדר בשרת.");
  }

  const [alerts, analyses] = await Promise.all([
    listRecentAlerts(Number(process.env.DASHBOARD_ALERT_LIMIT || "200")),
    listRecentSignalAnalyses(Number(process.env.DASHBOARD_ANALYSIS_LIMIT || "200")),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    summary: buildSummary(alerts),
    symbols: latestBySymbol(analyses),
    alerts: alerts.map(mapAlert),
  };
}
