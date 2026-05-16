import "dotenv/config";

import { isSupabaseConfigured, listTrackedAlerts, type TrackedAlert } from "./supabase";

type SymbolStats = {
  symbol: string;
  total: number;
  closed: number;
  open: number;
  wins: number;
  losses: number;
  resultR: number;
  bestR: number;
};

function isWin(alert: TrackedAlert) {
  return (alert.result_r ?? 0) > 0;
}

function isLoss(alert: TrackedAlert) {
  return (alert.result_r ?? 0) < 0;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatR(value: number) {
  return `${value.toFixed(2)}R`;
}

function buildStats(alerts: TrackedAlert[]) {
  const totals = new Map<string, SymbolStats>();

  for (const alert of alerts) {
    const existing =
      totals.get(alert.symbol) ??
      {
        symbol: alert.symbol,
        total: 0,
        closed: 0,
        open: 0,
        wins: 0,
        losses: 0,
        resultR: 0,
        bestR: 0,
      };

    existing.total += 1;
    existing.bestR = Math.max(existing.bestR, alert.max_r ?? 0);

    if (alert.status === "CLOSED") {
      existing.closed += 1;
      existing.resultR += alert.result_r ?? 0;
      if (isWin(alert)) existing.wins += 1;
      if (isLoss(alert)) existing.losses += 1;
    } else {
      existing.open += 1;
    }

    totals.set(alert.symbol, existing);
  }

  return [...totals.values()].sort((a, b) => b.total - a.total || a.symbol.localeCompare(b.symbol));
}

function printSummary(alerts: TrackedAlert[]) {
  const closedAlerts = alerts.filter((alert) => alert.status === "CLOSED");
  const openAlerts = alerts.filter((alert) => alert.status !== "CLOSED");
  const wins = closedAlerts.filter(isWin).length;
  const losses = closedAlerts.filter(isLoss).length;
  const totalR = closedAlerts.reduce((sum, alert) => sum + (alert.result_r ?? 0), 0);
  const winRate = closedAlerts.length ? (wins / closedAlerts.length) * 100 : 0;
  const avgR = closedAlerts.length ? totalR / closedAlerts.length : 0;

  console.log("דוח Backtest / Tracking על התראות קיימות");
  console.log("-------------------------------------------");
  console.log(`סה"כ התראות Trade: ${alerts.length}`);
  console.log(`פתוחות: ${openAlerts.length}`);
  console.log(`סגורות: ${closedAlerts.length}`);
  console.log(`ניצחונות: ${wins}`);
  console.log(`הפסדים: ${losses}`);
  console.log(`Win rate: ${formatPercent(winRate)}`);
  console.log(`Total R: ${formatR(totalR)}`);
  console.log(`Average R: ${formatR(avgR)}`);
  console.log("");
  console.log("לפי צמד:");

  for (const stats of buildStats(alerts)) {
    const symbolWinRate = stats.closed ? (stats.wins / stats.closed) * 100 : 0;
    const symbolAvgR = stats.closed ? stats.resultR / stats.closed : 0;

    console.log(
      [
        stats.symbol,
        `total=${stats.total}`,
        `open=${stats.open}`,
        `closed=${stats.closed}`,
        `winRate=${formatPercent(symbolWinRate)}`,
        `totalR=${formatR(stats.resultR)}`,
        `avgR=${formatR(symbolAvgR)}`,
        `bestMove=${formatR(stats.bestR)}`,
      ].join(" | ")
    );
  }
}

async function run() {
  if (!isSupabaseConfigured()) {
    console.log("Supabase לא מוגדר. צריך SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY כדי להפיק דוח.");
    return;
  }

  const limit = Number(process.env.BACKTEST_ALERT_LIMIT || "1000");
  const alerts = await listTrackedAlerts(limit);

  if (alerts.length === 0) {
    console.log("אין עדיין התראות Trade לדוח.");
    return;
  }

  printSummary(alerts);
}

run().catch((error) => {
  console.error("שגיאה בהרצת backtest:", error);
  process.exit(1);
});
