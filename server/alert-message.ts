import type { SignalAnalysis } from "../src/lib/signal-engine";

type AlertMessageOptions = {
  symbol: string;
  lowInterval: string;
  highInterval: string;
};

function translateDecision(decision: SignalAnalysis["decision"]) {
  switch (decision) {
    case "LONG":
      return "לונג";
    case "SHORT":
      return "שורט";
    default:
      return "המתנה";
  }
}

function translateStructure(structure: SignalAnalysis["structure"]) {
  switch (structure) {
    case "BULLISH":
      return "שורי";
    case "BEARISH":
      return "דובי";
    default:
      return "דשדוש";
  }
}

function translateBias(bias: SignalAnalysis["higherTimeframe"]["bias"]) {
  switch (bias) {
    case "BULLISH":
      return "שורית";
    case "BEARISH":
      return "דובית";
    default:
      return "ניטרלית";
  }
}

function translateQuality(quality: SignalAnalysis["setupQuality"]) {
  switch (quality) {
    case "HIGH":
      return "גבוהה";
    case "MEDIUM":
      return "בינונית";
    default:
      return "נמוכה";
  }
}

export function shouldSendTelegramAlert(result: SignalAnalysis) {
  return result.decision === "LONG" || result.decision === "SHORT";
}

export function createAlertKey(result: SignalAnalysis) {
  return [
    result.decision,
    result.tradePlan?.direction,
    result.triggerPrice?.toFixed(2),
    result.invalidationPrice?.toFixed(2),
    result.validIf,
    result.invalidIf,
  ].join("|");
}

export function buildTelegramMessage(result: SignalAnalysis, options: AlertMessageOptions) {
  const trade = result.tradePlan;

  const lines = [
    "🚨 סוכן התראות קריפטו",
    `צמד: ${options.symbol}`,
    `טיימפריים: ${options.lowInterval} / ${options.highInterval}`,
    `החלטה: ${translateDecision(result.decision)}`,
    `איכות סטאפ: ${translateQuality(result.setupQuality)}`,
    `ביטחון: ${result.confidence}`,
    "",
    "Context:",
    `הטיה ${options.highInterval}: ${translateBias(result.higherTimeframe.bias)}`,
    `מבנה ${options.lowInterval}: ${translateStructure(result.structure)}`,
    `EMA stack: ${result.context.emaStack}`,
    `מומנטום: ${result.context.momentum}`,
    `RSI: ${result.rsi.toFixed(2)}`,
    `MACD: ${result.macd.toFixed(2)}`,
    `יחס נפח: ${result.volumeRatio.toFixed(2)}`,
    "",
    "Trigger:",
    `תנאי כניסה: ${result.validIf ?? "-"}`,
    `תנאי ביטול: ${result.invalidIf ?? "-"}`,
    `מחיר טריגר: ${result.triggerPrice?.toFixed(2) ?? "-"}`,
    `רמת ביטול: ${result.invalidationPrice?.toFixed(2) ?? "-"}`,
  ];

  if (trade) {
    lines.push(
      "",
      "Trade Plan:",
      `כניסה: ${trade.entry.toFixed(2)}`,
      `סטופ: ${trade.stopLoss.toFixed(2)}`,
      `יעד 1 (1R): ${trade.takeProfit1.toFixed(2)}`,
      `יעד 2 (2R): ${trade.takeProfit2.toFixed(2)}`,
      `יעד 3 (3R): ${trade.takeProfit3.toFixed(2)}`,
      `ATR: ${trade.atr.toFixed(2)}`,
      `ATR buffer: ${trade.atrBuffer.toFixed(2)}`
    );
  }

  lines.push("", "סיבות:", ...result.reasons.map((reason) => `• ${reason}`));

  return lines.join("\n");
}
