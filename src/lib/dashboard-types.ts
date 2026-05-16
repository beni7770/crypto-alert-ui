import type { SignalAnalysis } from "./signal-engine";

export type DashboardAlert = {
  id: number;
  createdAt: string;
  symbol: string;
  alertType: "TRADE" | "WATCHLIST";
  decision: SignalAnalysis["decision"];
  setupState: SignalAnalysis["setupState"];
  setupQuality: SignalAnalysis["setupQuality"];
  status: string;
  outcome: string | null;
  direction: string | null;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  takeProfit3: number | null;
  maxR: number | null;
  resultR: number | null;
  lastCheckedAt: string | null;
  reasons: string[];
};

export type DashboardSymbol = {
  symbol: string;
  createdAt: string;
  decision: SignalAnalysis["decision"];
  setupState: SignalAnalysis["setupState"];
  setupQuality: SignalAnalysis["setupQuality"];
  confidence: SignalAnalysis["confidence"];
  price: number;
  triggerPrice: number | null;
  invalidationPrice: number | null;
  btcContext: string;
  contextDirection: SignalAnalysis["context"]["direction"];
  emaStack: SignalAnalysis["context"]["emaStack"];
  momentum: SignalAnalysis["context"]["momentum"];
  volumeState: SignalAnalysis["context"]["volumeState"];
  validIf?: string;
  invalidIf?: string;
  reasons: string[];
};

export type DashboardSummary = {
  totalAlerts: number;
  tradeAlerts: number;
  watchlistAlerts: number;
  openTrades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalR: number;
  averageR: number;
  bestSymbol?: string;
  worstSymbol?: string;
};

export type PerformanceGroup = {
  key: string;
  label: string;
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalR: number;
  averageR: number;
  bestR: number | null;
  worstR: number | null;
  sampleSize: "SMALL" | "OK";
};

export type DashboardAnalytics = {
  bySymbol: PerformanceGroup[];
  byDirection: PerformanceGroup[];
  bySetupQuality: PerformanceGroup[];
  bySetupState: PerformanceGroup[];
  byBtcContext: PerformanceGroup[];
  byOutcome: PerformanceGroup[];
  topAverageR: PerformanceGroup[];
  bottomAverageR: PerformanceGroup[];
  topTotalR: PerformanceGroup[];
  bottomTotalR: PerformanceGroup[];
};

export type DashboardResponse = {
  generatedAt: string;
  summary: DashboardSummary;
  analytics: DashboardAnalytics;
  symbols: DashboardSymbol[];
  alerts: DashboardAlert[];
};
