import { useEffect, useMemo, useState } from "react";
import type { DashboardAlert, DashboardResponse, DashboardSymbol } from "./lib/dashboard-types";

type AlertFilter = "ALL" | "OPEN" | "CLOSED" | "WATCHLIST";

function formatNumber(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toLocaleString("he-IL", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function translateDecision(decision: string) {
  switch (decision) {
    case "LONG":
      return "לונג";
    case "SHORT":
      return "שורט";
    default:
      return "המתנה";
  }
}

function translateQuality(quality: string) {
  switch (quality) {
    case "HIGH":
      return "גבוהה";
    case "MEDIUM":
      return "בינונית";
    default:
      return "נמוכה";
  }
}

function translateStatus(status: string) {
  switch (status) {
    case "OPEN":
      return "פתוחה";
    case "TP1":
      return "TP1";
    case "TP2":
      return "TP2";
    case "CLOSED":
      return "סגורה";
    case "WATCHLIST":
      return "מעקב";
    default:
      return status;
  }
}

function decisionClass(decision: string, setupState?: string) {
  if (decision === "LONG") return "positive";
  if (decision === "SHORT") return "negative";
  if (setupState?.startsWith("WATCHLIST")) return "info";
  return "neutral";
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <article className={`stat-card ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function SymbolCard({ symbol }: { symbol: DashboardSymbol }) {
  return (
    <article className={`symbol-card ${decisionClass(symbol.decision, symbol.setupState)}`}>
      <header>
        <div>
          <h2>{symbol.symbol}</h2>
          <span>{formatDate(symbol.createdAt)}</span>
        </div>
        <b>{translateDecision(symbol.decision)}</b>
      </header>

      <dl>
        <div>
          <dt>מחיר</dt>
          <dd>{formatNumber(symbol.price)}</dd>
        </div>
        <div>
          <dt>איכות</dt>
          <dd>{translateQuality(symbol.setupQuality)}</dd>
        </div>
        <div>
          <dt>BTC</dt>
          <dd>{symbol.btcContext}</dd>
        </div>
        <div>
          <dt>מומנטום</dt>
          <dd>{symbol.momentum}</dd>
        </div>
        <div>
          <dt>EMA</dt>
          <dd>{symbol.emaStack}</dd>
        </div>
        <div>
          <dt>נפח</dt>
          <dd>{symbol.volumeState}</dd>
        </div>
      </dl>

      <footer>
        <p>{symbol.validIf ?? "אין טריגר כניסה כרגע"}</p>
        <p>{symbol.invalidIf ?? "אין תנאי ביטול פעיל"}</p>
      </footer>
    </article>
  );
}

function alertMatchesFilter(alert: DashboardAlert, filter: AlertFilter) {
  if (filter === "ALL") return true;
  if (filter === "WATCHLIST") return alert.alertType === "WATCHLIST";
  if (filter === "OPEN") return alert.alertType === "TRADE" && alert.status !== "CLOSED";
  return alert.alertType === "TRADE" && alert.status === "CLOSED";
}

function AlertsTable({ alerts }: { alerts: DashboardAlert[] }) {
  const [filter, setFilter] = useState<AlertFilter>("ALL");
  const filteredAlerts = useMemo(
    () => alerts.filter((alert) => alertMatchesFilter(alert, filter)),
    [alerts, filter]
  );

  return (
    <section className="table-section">
      <header className="section-header">
        <div>
          <h2>התראות ועסקאות</h2>
          <p>מעקב אחר התראות Telegram, TP/SL ותוצאה ביחידות R</p>
        </div>
        <div className="segmented">
          {(["ALL", "OPEN", "CLOSED", "WATCHLIST"] as AlertFilter[]).map((option) => (
            <button
              key={option}
              className={filter === option ? "active" : ""}
              type="button"
              onClick={() => setFilter(option)}
            >
              {option === "ALL"
                ? "הכול"
                : option === "OPEN"
                  ? "פתוחות"
                  : option === "CLOSED"
                    ? "סגורות"
                    : "מעקב"}
            </button>
          ))}
        </div>
      </header>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>צמד</th>
              <th>כיוון</th>
              <th>איכות</th>
              <th>סטטוס</th>
              <th>כניסה</th>
              <th>סטופ</th>
              <th>TP1</th>
              <th>TP2</th>
              <th>TP3</th>
              <th>Max R</th>
              <th>Result R</th>
              <th>זמן</th>
            </tr>
          </thead>
          <tbody>
            {filteredAlerts.map((alert) => (
              <tr key={alert.id}>
                <td>
                  <strong>{alert.symbol}</strong>
                  <span>{alert.setupState}</span>
                </td>
                <td className={decisionClass(alert.decision)}>{translateDecision(alert.decision)}</td>
                <td>{translateQuality(alert.setupQuality)}</td>
                <td>{translateStatus(alert.status)}</td>
                <td>{formatNumber(alert.entryPrice)}</td>
                <td>{formatNumber(alert.stopLoss)}</td>
                <td>{formatNumber(alert.takeProfit1)}</td>
                <td>{formatNumber(alert.takeProfit2)}</td>
                <td>{formatNumber(alert.takeProfit3)}</td>
                <td>{formatNumber(alert.maxR)}</td>
                <td className={(alert.resultR ?? 0) >= 0 ? "positive" : "negative"}>
                  {alert.resultR === null ? "-" : `${formatNumber(alert.resultR)}R`}
                </td>
                <td>{formatDate(alert.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function App() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setError("");
        const res = await fetch("/api/dashboard");
        const payload = (await res.json()) as DashboardResponse | { error?: string };

        if (!res.ok) {
          throw new Error("error" in payload && payload.error ? payload.error : "טעינת הדשבורד נכשלה");
        }

        setData(payload as DashboardResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : "שגיאה לא ידועה");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
    const interval = setInterval(loadDashboard, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="app-shell" dir="rtl">
      <section className="topbar">
        <div>
          <h1>Crypto Alert Agent</h1>
          <p>דשבורד ביצועים והתראות מתוך Supabase</p>
        </div>
        <div className="sync-status">
          <span>{loading ? "טוען נתונים" : "עדכון אחרון"}</span>
          <strong>{data ? formatDate(data.generatedAt) : "-"}</strong>
        </div>
      </section>

      {error && <div className="error-banner">{error}</div>}

      {data && (
        <>
          <section className="stats-grid">
            <StatCard label="סה״כ התראות" value={String(data.summary.totalAlerts)} />
            <StatCard label="עסקאות פתוחות" value={String(data.summary.openTrades)} tone="info" />
            <StatCard label="עסקאות סגורות" value={String(data.summary.closedTrades)} />
            <StatCard label="Win rate" value={formatPercent(data.summary.winRate)} tone="positive" />
            <StatCard label="Total R" value={`${formatNumber(data.summary.totalR)}R`} tone="positive" />
            <StatCard label="Average R" value={`${formatNumber(data.summary.averageR)}R`} />
            <StatCard label="צמד חזק" value={data.summary.bestSymbol ?? "-"} />
            <StatCard label="צמד חלש" value={data.summary.worstSymbol ?? "-"} tone="negative" />
          </section>

          <section className="section-block">
            <header className="section-header">
              <div>
                <h2>כרטיסי מצב</h2>
                <p>הניתוח האחרון שנשמר לכל צמד</p>
              </div>
            </header>
            <div className="symbols-grid">
              {data.symbols.map((symbol) => (
                <SymbolCard key={symbol.symbol} symbol={symbol} />
              ))}
            </div>
          </section>

          <AlertsTable alerts={data.alerts} />
        </>
      )}
    </main>
  );
}
