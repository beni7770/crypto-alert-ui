import type { SignalAnalysis } from "../src/lib/signal-engine";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type BtcContextStatus = "SELF" | "SUPPORTS" | "AGAINST" | "NEUTRAL" | "UNKNOWN";

type AnalysisInsert = {
  symbol: string;
  low_interval: string;
  high_interval: string;
  decision: SignalAnalysis["decision"];
  setup_state: SignalAnalysis["setupState"];
  setup_quality: SignalAnalysis["setupQuality"];
  confidence: SignalAnalysis["confidence"];
  price: number;
  trigger_price?: number | null;
  invalidation_price?: number | null;
  btc_context: BtcContextStatus;
  analysis: SignalAnalysis;
};

type AlertInsert = {
  symbol: string;
  alert_key: string;
  alert_type: "TRADE" | "WATCHLIST";
  decision: SignalAnalysis["decision"];
  setup_state: SignalAnalysis["setupState"];
  setup_quality: SignalAnalysis["setupQuality"];
  message: string;
  sent: boolean;
  analysis: SignalAnalysis;
};

export type TrackedAlertStatus = "OPEN" | "TP1" | "TP2" | "CLOSED" | "WATCHLIST";
export type TrackedAlertOutcome =
  | "OPEN"
  | "TP1"
  | "TP2"
  | "TP3"
  | "STOP"
  | "STOP_AFTER_TP1"
  | "STOP_AFTER_TP2"
  | "WATCHLIST";

export type TrackedAlert = {
  id: number;
  created_at: string;
  symbol: string;
  alert_key: string;
  alert_type: "TRADE" | "WATCHLIST";
  decision: SignalAnalysis["decision"];
  setup_state: SignalAnalysis["setupState"];
  setup_quality: SignalAnalysis["setupQuality"];
  analysis: SignalAnalysis;
  status: TrackedAlertStatus;
  outcome: TrackedAlertOutcome | null;
  direction: SignalAnalysis["tradePlan"]["direction"] | null;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit1: number | null;
  take_profit2: number | null;
  take_profit3: number | null;
  max_r: number | null;
  result_r: number | null;
  opened_at: string | null;
  closed_at: string | null;
  last_checked_at: string | null;
};

export type AlertTrackingPatch = Partial<{
  status: TrackedAlertStatus;
  outcome: TrackedAlertOutcome;
  max_r: number;
  result_r: number;
  closed_at: string | null;
  last_checked_at: string;
}>;

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseRestUrl(table: string) {
  if (!SUPABASE_URL) return "";

  const baseUrl = SUPABASE_URL.trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/, "");

  return `${baseUrl}/rest/v1/${table}`;
}

async function insertRows<T extends object>(table: string, rows: T[]) {
  if (!isSupabaseConfigured()) return;

  const res = await fetch(getSupabaseRestUrl(table), {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase insert ${table} failed ${res.status}: ${text}`);
  }
}

async function selectRows<T>(table: string, params: URLSearchParams): Promise<T[]> {
  if (!isSupabaseConfigured()) return [];

  const res = await fetch(`${getSupabaseRestUrl(table)}?${params.toString()}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase select ${table} failed ${res.status}: ${text}`);
  }

  return (await res.json()) as T[];
}

async function updateRows<T extends object>(
  table: string,
  filters: URLSearchParams,
  patch: T
) {
  if (!isSupabaseConfigured()) return;

  const res = await fetch(`${getSupabaseRestUrl(table)}?${filters.toString()}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase update ${table} failed ${res.status}: ${text}`);
  }
}

export async function saveSignalAnalysis(record: AnalysisInsert) {
  await insertRows("signal_analyses", [
    {
      symbol: record.symbol,
      low_interval: record.low_interval,
      high_interval: record.high_interval,
      decision: record.decision,
      setup_state: record.setup_state,
      setup_quality: record.setup_quality,
      confidence: record.confidence,
      price: record.price,
      trigger_price: record.trigger_price ?? null,
      invalidation_price: record.invalidation_price ?? null,
      btc_context: record.btc_context,
      analysis: record.analysis,
    },
  ]);
}

export async function saveAlert(record: AlertInsert) {
  const tradePlan = record.analysis.tradePlan;
  const isTrade = record.alert_type === "TRADE" && !!tradePlan;

  await insertRows("alerts", [
    {
      symbol: record.symbol,
      alert_key: record.alert_key,
      alert_type: record.alert_type,
      decision: record.decision,
      setup_state: record.setup_state,
      setup_quality: record.setup_quality,
      message: record.message,
      sent: record.sent,
      analysis: record.analysis,
      status: isTrade ? "OPEN" : "WATCHLIST",
      outcome: isTrade ? "OPEN" : "WATCHLIST",
      direction: tradePlan?.direction ?? record.analysis.setup.direction ?? null,
      entry_price: tradePlan?.entry ?? null,
      stop_loss: tradePlan?.stopLoss ?? null,
      take_profit1: tradePlan?.takeProfit1 ?? null,
      take_profit2: tradePlan?.takeProfit2 ?? null,
      take_profit3: tradePlan?.takeProfit3 ?? null,
      opened_at: isTrade ? new Date().toISOString() : null,
      max_r: isTrade ? 0 : null,
      result_r: null,
    },
  ]);
}

export async function alertExists(alertKey: string) {
  if (!isSupabaseConfigured()) return false;

  const params = new URLSearchParams({
    alert_key: `eq.${alertKey}`,
    select: "id",
    limit: "1",
  });
  const res = await fetch(`${getSupabaseRestUrl("alerts")}?${params.toString()}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase alert lookup failed ${res.status}: ${text}`);
  }

  const rows = (await res.json()) as unknown[];
  return rows.length > 0;
}

export async function listOpenTradeAlerts(limit = 100) {
  const params = new URLSearchParams({
    select:
      "id,created_at,symbol,alert_key,alert_type,decision,setup_state,setup_quality,analysis,status,outcome,direction,entry_price,stop_loss,take_profit1,take_profit2,take_profit3,max_r,result_r,opened_at,closed_at,last_checked_at",
    alert_type: "eq.TRADE",
    status: "in.(OPEN,TP1,TP2)",
    order: "created_at.asc",
    limit: String(limit),
  });

  return selectRows<TrackedAlert>("alerts", params);
}

export async function listTrackedAlerts(limit = 1000) {
  const params = new URLSearchParams({
    select:
      "id,created_at,symbol,alert_key,alert_type,decision,setup_state,setup_quality,analysis,status,outcome,direction,entry_price,stop_loss,take_profit1,take_profit2,take_profit3,max_r,result_r,opened_at,closed_at,last_checked_at",
    alert_type: "eq.TRADE",
    order: "created_at.desc",
    limit: String(limit),
  });

  return selectRows<TrackedAlert>("alerts", params);
}

export async function updateAlertTracking(id: number, patch: AlertTrackingPatch) {
  const filters = new URLSearchParams({
    id: `eq.${id}`,
  });

  await updateRows("alerts", filters, patch);
}
