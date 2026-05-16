import type {
  DashboardAlert,
  DashboardAnalytics,
  DashboardResponse,
  DashboardSummary,
  DashboardSymbol,
  PerformanceGroup,
} from "../src/lib/dashboard-types";
import type { SignalAnalysis } from "../src/lib/signal-engine";
import {
  isSupabaseConfigured,
  listRecentAlerts,
  listRecentSignalAnalyses,
  type StoredSignalAnalysis,
  type TrackedAlert,
} from "./supabase";

const SMALL_SAMPLE_CLOSED_TRADES = 5;

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

function latestBtcContextBySymbol(rows: StoredSignalAnalysis[]) {
  const contexts = new Map<string, string>();

  for (const row of rows) {
    if (contexts.has(row.symbol)) continue;
    contexts.set(row.symbol, row.btc_context);
  }

  return contexts;
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

function createEmptyGroup(key: string, label: string): PerformanceGroup {
  return {
    key,
    label,
    totalTrades: 0,
    closedTrades: 0,
    openTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalR: 0,
    averageR: 0,
    bestR: null,
    worstR: null,
    sampleSize: "SMALL",
  };
}

function buildPerformanceGroups(
  alerts: TrackedAlert[],
  getKey: (alert: TrackedAlert) => string,
  getLabel: (key: string) => string = (key) => key
) {
  const groups = new Map<string, PerformanceGroup>();

  for (const alert of alerts) {
    if (alert.alert_type !== "TRADE") continue;

    const key = getKey(alert) || "UNKNOWN";
    const group = groups.get(key) ?? createEmptyGroup(key, getLabel(key));

    group.totalTrades += 1;

    if (isOpenTrade(alert)) {
      group.openTrades += 1;
    }

    if (isClosedTrade(alert)) {
      const resultR = alert.result_r ?? 0;
      group.closedTrades += 1;
      group.totalR += resultR;
      group.bestR = group.bestR === null ? resultR : Math.max(group.bestR, resultR);
      group.worstR = group.worstR === null ? resultR : Math.min(group.worstR, resultR);

      if (resultR > 0) group.wins += 1;
      if (resultR < 0) group.losses += 1;
    }

    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      winRate: group.closedTrades ? group.wins / group.closedTrades : 0,
      averageR: group.closedTrades ? group.totalR / group.closedTrades : 0,
      sampleSize: group.closedTrades < SMALL_SAMPLE_CLOSED_TRADES ? "SMALL" : "OK",
    }) satisfies PerformanceGroup)
    .sort((a, b) => b.totalTrades - a.totalTrades || a.label.localeCompare(b.label));
}

function translateDirection(key: string) {
  if (key === "LONG") return "לונג";
  if (key === "SHORT") return "שורט";
  return "לא ידוע";
}

function translateQuality(key: string) {
  if (key === "HIGH") return "גבוהה";
  if (key === "MEDIUM") return "בינונית";
  if (key === "LOW") return "נמוכה";
  return key;
}

function translateBtcContext(key: string) {
  switch (key) {
    case "SELF":
      return "BTC";
    case "SUPPORTS":
      return "BTC תומך";
    case "AGAINST":
      return "BTC נגד";
    case "NEUTRAL":
      return "BTC ניטרלי";
    default:
      return "לא ידוע";
  }
}

function translateOutcome(key: string) {
  switch (key) {
    case "TP1":
      return "TP1";
    case "TP2":
      return "TP2";
    case "TP3":
      return "TP3";
    case "STOP":
      return "סטופ";
    case "STOP_AFTER_TP1":
      return "סטופ אחרי TP1";
    case "STOP_AFTER_TP2":
      return "סטופ אחרי TP2";
    case "OPEN":
      return "פתוח";
    default:
      return key;
  }
}

function meaningfulClosedGroups(groups: PerformanceGroup[]) {
  return groups.filter((group) => group.closedTrades > 0);
}

function sortTopAverage(groups: PerformanceGroup[]) {
  return meaningfulClosedGroups(groups)
    .toSorted((a, b) => b.averageR - a.averageR || b.closedTrades - a.closedTrades)
    .slice(0, 5);
}

function sortBottomAverage(groups: PerformanceGroup[]) {
  return meaningfulClosedGroups(groups)
    .toSorted((a, b) => a.averageR - b.averageR || b.closedTrades - a.closedTrades)
    .slice(0, 5);
}

function sortTopTotal(groups: PerformanceGroup[]) {
  return meaningfulClosedGroups(groups)
    .toSorted((a, b) => b.totalR - a.totalR || b.closedTrades - a.closedTrades)
    .slice(0, 5);
}

function sortBottomTotal(groups: PerformanceGroup[]) {
  return meaningfulClosedGroups(groups)
    .toSorted((a, b) => a.totalR - b.totalR || b.closedTrades - a.closedTrades)
    .slice(0, 5);
}

function buildAnalytics(alerts: TrackedAlert[], analyses: StoredSignalAnalysis[]): DashboardAnalytics {
  const btcContexts = latestBtcContextBySymbol(analyses);
  const bySymbol = buildPerformanceGroups(alerts, (alert) => alert.symbol);
  const byDirection = buildPerformanceGroups(
    alerts,
    (alert) => alert.direction ?? alert.analysis.tradePlan?.direction ?? alert.decision,
    translateDirection
  );
  const bySetupQuality = buildPerformanceGroups(alerts, (alert) => alert.setup_quality, translateQuality);
  const bySetupState = buildPerformanceGroups(alerts, (alert) => alert.setup_state);
  const byBtcContext = buildPerformanceGroups(
    alerts,
    (alert) => btcContexts.get(alert.symbol) ?? "UNKNOWN",
    translateBtcContext
  );
  const byOutcome = buildPerformanceGroups(alerts, (alert) => alert.outcome ?? "OPEN", translateOutcome);
  const decisionGroups = [...bySymbol, ...byDirection, ...bySetupQuality, ...bySetupState, ...byBtcContext];

  return {
    bySymbol,
    byDirection,
    bySetupQuality,
    bySetupState,
    byBtcContext,
    byOutcome,
    topAverageR: sortTopAverage(decisionGroups),
    bottomAverageR: sortBottomAverage(decisionGroups),
    topTotalR: sortTopTotal(decisionGroups),
    bottomTotalR: sortBottomTotal(decisionGroups),
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
    analytics: buildAnalytics(alerts, analyses),
    symbols: latestBySymbol(analyses),
    alerts: alerts.map(mapAlert),
  };
}
