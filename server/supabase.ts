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

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

async function insertRows<T extends object>(table: string, rows: T[]) {
  if (!isSupabaseConfigured()) return;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
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
  const res = await fetch(`${SUPABASE_URL}/rest/v1/alerts?${params.toString()}`, {
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
