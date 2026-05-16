import type { KlineCandle } from "./binance";
import {
  average,
  calculateATR,
  calculateEMA,
  calculateMACD,
  calculateRSI,
} from "./indicators";

export type MarketStructure = "BULLISH" | "BEARISH" | "RANGE";
export type SignalDecision = "LONG" | "SHORT" | "WAIT";
export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";
export type BosDirection = "BULLISH" | "BEARISH" | "NONE";
export type ChochDirection = "BULLISH" | "BEARISH" | "NONE";
export type HigherTimeframeBias = "BULLISH" | "BEARISH" | "NEUTRAL";
export type SetupState =
  | "NONE"
  | "CONFLICT"
  | "WATCHLIST_LONG"
  | "WATCHLIST_SHORT"
  | "READY_LONG"
  | "READY_SHORT";
export type RangePosition = "LOWER" | "MID" | "UPPER";
export type SetupQuality = "LOW" | "MEDIUM" | "HIGH";
export type TradeDirection = "LONG" | "SHORT";

export type SwingPoint = {
  index: number;
  price: number;
};

export type TradeSetup = {
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskReward1: number;
  riskReward2: number;
  riskReward3: number;
};

export type TimeframeSnapshot = {
  structure: MarketStructure;
  bos: BosDirection;
  choch: ChochDirection;
  bias: HigherTimeframeBias;
  ema9: number;
  ema21: number;
  ema50: number;
  ema200: number;
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  trendStrength: number;
  price: number;
};

export type SignalContext = {
  direction: TradeDirection | "NEUTRAL";
  aligned: boolean;
  conflict: boolean;
  lowTimeframeStructure: MarketStructure;
  highTimeframeBias: HigherTimeframeBias;
  emaStack: "BULLISH" | "BEARISH" | "MIXED";
  momentum: "BULLISH" | "BEARISH" | "NEUTRAL";
  volumeState: "STRONG" | "NORMAL" | "WEAK";
  trendStrength: number;
  noTradeZone: boolean;
};

export type SignalSetup = {
  state: SetupState;
  direction?: TradeDirection;
  quality: SetupQuality;
  score: number;
  rangePosition: RangePosition;
  blockers: string[];
};

export type SignalTrigger = {
  direction?: TradeDirection;
  price?: number;
  validIf?: string;
  invalidIf?: string;
  confirmed: boolean;
  reason?: string;
};

export type TradePlan = TradeSetup & {
  direction: TradeDirection;
  invalidationPrice: number;
  atr: number;
  atrBuffer: number;
};

export type SignalAnalysis = {
  price: number;
  ema9: number;
  ema21: number;
  ema50: number;
  ema200: number;
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  atr: number;

  currentVolume: number;
  averageVolume: number;
  volumeRatio: number;

  trendStrength: number;
  structure: MarketStructure;
  bos: BosDirection;
  choch: ChochDirection;

  higherTimeframe: TimeframeSnapshot;
  context: SignalContext;
  setup: SignalSetup;
  trigger: SignalTrigger;
  tradePlan?: TradePlan;

  setupState: SetupState;
  rangePosition: RangePosition;
  setupQuality: SetupQuality;

  fakeBreakout: boolean;
  liquiditySweep: boolean;
  bullishRejection: boolean;
  bearishRejection: boolean;

  isPullbackLong: boolean;
  isPullbackShort: boolean;
  isBullishCandle: boolean;
  isBearishCandle: boolean;

  previousHigh: number;
  previousLow: number;
  roundLevel: number;

  lastSwingHigh?: number;
  lastSwingLow?: number;
  priorSwingHigh?: number;
  priorSwingLow?: number;

  noTradeZone: boolean;
  longScore: number;
  shortScore: number;
  triggerPrice?: number;
  invalidationPrice?: number;
  validIf?: string;
  invalidIf?: string;

  trade?: TradeSetup;
  reasons: string[];
  confidence: ConfidenceLevel;
  decision: SignalDecision;
};

function getRoundLevel(price: number): number {
  return Math.round(price / 100) * 100;
}

function isPivotHigh(candles: KlineCandle[], index: number, left = 2, right = 2): boolean {
  const current = candles[index];
  for (let i = index - left; i <= index + right; i++) {
    if (i === index) continue;
    if (i < 0 || i >= candles.length) return false;
    if (candles[i].high >= current.high) return false;
  }
  return true;
}

function isPivotLow(candles: KlineCandle[], index: number, left = 2, right = 2): boolean {
  const current = candles[index];
  for (let i = index - left; i <= index + right; i++) {
    if (i === index) continue;
    if (i < 0 || i >= candles.length) return false;
    if (candles[i].low <= current.low) return false;
  }
  return true;
}

function getSwingHighs(candles: KlineCandle[]): SwingPoint[] {
  const points: SwingPoint[] = [];
  for (let i = 2; i < candles.length - 2; i++) {
    if (isPivotHigh(candles, i)) points.push({ index: i, price: candles[i].high });
  }
  return points;
}

function getSwingLows(candles: KlineCandle[]): SwingPoint[] {
  const points: SwingPoint[] = [];
  for (let i = 2; i < candles.length - 2; i++) {
    if (isPivotLow(candles, i)) points.push({ index: i, price: candles[i].low });
  }
  return points;
}

function detectMarketStructure(swingHighs: SwingPoint[], swingLows: SwingPoint[]): MarketStructure {
  if (swingHighs.length < 2 || swingLows.length < 2) return "RANGE";

  const lastHigh = swingHighs[swingHighs.length - 1].price;
  const prevHigh = swingHighs[swingHighs.length - 2].price;
  const lastLow = swingLows[swingLows.length - 1].price;
  const prevLow = swingLows[swingLows.length - 2].price;

  if (lastHigh > prevHigh && lastLow > prevLow) return "BULLISH";
  if (lastHigh < prevHigh && lastLow < prevLow) return "BEARISH";
  return "RANGE";
}

function detectBOS(candles: KlineCandle[], swingHighs: SwingPoint[], swingLows: SwingPoint[]): BosDirection {
  if (!swingHighs.length || !swingLows.length) return "NONE";
  const lastClose = candles[candles.length - 1].close;
  if (lastClose > swingHighs[swingHighs.length - 1].price) return "BULLISH";
  if (lastClose < swingLows[swingLows.length - 1].price) return "BEARISH";
  return "NONE";
}

function detectCHOCH(
  structure: MarketStructure,
  candles: KlineCandle[],
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[]
): ChochDirection {
  if (!swingHighs.length || !swingLows.length) return "NONE";
  const lastClose = candles[candles.length - 1].close;
  if (structure === "BEARISH" && lastClose > swingHighs[swingHighs.length - 1].price) return "BULLISH";
  if (structure === "BULLISH" && lastClose < swingLows[swingLows.length - 1].price) return "BEARISH";
  return "NONE";
}

function getRangeBounds(candles: KlineCandle[]) {
  const recent = candles.slice(-30);
  const high = Math.max(...recent.map((c) => c.high));
  const low = Math.min(...recent.map((c) => c.low));
  return { high, low, width: Math.max(high - low, 1e-9) };
}

function detectRange(candles: KlineCandle[], price: number): boolean {
  const { high, low } = getRangeBounds(candles);
  return (high - low) / price < 0.012;
}

function getRangePosition(price: number, low: number, high: number): RangePosition {
  const normalized = (price - low) / Math.max(high - low, 1e-9);
  if (normalized <= 0.33) return "LOWER";
  if (normalized >= 0.67) return "UPPER";
  return "MID";
}

function detectBullishRejection(candle: KlineCandle): boolean {
  const body = Math.abs(candle.close - candle.open);
  const range = Math.max(candle.high - candle.low, 1e-9);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;
  return candle.close > candle.open && lowerWick / range > 0.35 && lowerWick > body;
}

function detectBearishRejection(candle: KlineCandle): boolean {
  const body = Math.abs(candle.close - candle.open);
  const range = Math.max(candle.high - candle.low, 1e-9);
  const upperWick = candle.high - Math.max(candle.open, candle.close);
  return candle.close < candle.open && upperWick / range > 0.35 && upperWick > body;
}

function calculateTrendStrength(price: number, ema9: number, ema21: number, ema50: number, ema200: number): number {
  return (Math.abs(ema9 - ema21) + Math.abs(ema21 - ema50) + Math.abs(ema50 - ema200)) / price;
}

function getHigherTimeframeBias(snapshot: TimeframeSnapshot): HigherTimeframeBias {
  const bullish =
    snapshot.price > snapshot.ema50 &&
    snapshot.ema50 > snapshot.ema200 &&
    snapshot.rsi > 52 &&
    snapshot.macd > snapshot.macdSignal &&
    snapshot.trendStrength > 0.008;

  const bearish =
    snapshot.price < snapshot.ema50 &&
    snapshot.ema50 < snapshot.ema200 &&
    snapshot.rsi < 48 &&
    snapshot.macd < snapshot.macdSignal &&
    snapshot.trendStrength > 0.008;

  if (bullish) return "BULLISH";
  if (bearish) return "BEARISH";
  return "NEUTRAL";
}

function analyzeTimeframe(candles: KlineCandle[]): TimeframeSnapshot {
  const closes = candles.map((c) => c.close);
  const ema9 = calculateEMA(closes, 9).slice(-1)[0];
  const ema21 = calculateEMA(closes, 21).slice(-1)[0];
  const ema50 = calculateEMA(closes, 50).slice(-1)[0];
  const ema200 = calculateEMA(closes, 200).slice(-1)[0];
  const rsiValues = calculateRSI(closes, 14);
  const rsi = rsiValues[rsiValues.length - 1];
  const macd = calculateMACD(closes, 12, 26, 9);
  const macdLine = macd.macdLine[macd.macdLine.length - 1];
  const macdSignal = macd.signalLine[macd.signalLine.length - 1];
  const macdHistogram = macd.histogram[macd.histogram.length - 1];
  const price = closes[closes.length - 1];
  const swingHighs = getSwingHighs(candles);
  const swingLows = getSwingLows(candles);
  const structure = detectMarketStructure(swingHighs, swingLows);
  const bos = detectBOS(candles, swingHighs, swingLows);
  const choch = detectCHOCH(structure, candles, swingHighs, swingLows);
  const trendStrength = calculateTrendStrength(price, ema9, ema21, ema50, ema200);

  const partial: TimeframeSnapshot = {
    structure,
    bos,
    choch,
    bias: "NEUTRAL",
    ema9,
    ema21,
    ema50,
    ema200,
    rsi,
    macd: macdLine,
    macdSignal,
    macdHistogram,
    trendStrength,
    price,
  };

  return { ...partial, bias: getHigherTimeframeBias(partial) };
}

function getSetupQuality(score: number): SetupQuality {
  if (score >= 9) return "HIGH";
  if (score >= 6) return "MEDIUM";
  return "LOW";
}

function buildTradePlan(direction: TradeDirection, entry: number, stopLoss: number, atr: number, atrBuffer: number): TradePlan | undefined {
  const risk = direction === "LONG" ? entry - stopLoss : stopLoss - entry;
  if (risk <= 0 || risk / entry < 0.0015) return undefined;

  const takeProfit1 = direction === "LONG" ? entry + risk : entry - risk;
  const takeProfit2 = direction === "LONG" ? entry + risk * 2 : entry - risk * 2;
  const takeProfit3 = direction === "LONG" ? entry + risk * 3 : entry - risk * 3;

  return {
    direction,
    entry,
    stopLoss,
    takeProfit1,
    takeProfit2,
    takeProfit3,
    riskReward1: 1,
    riskReward2: 2,
    riskReward3: 3,
    invalidationPrice: stopLoss,
    atr,
    atrBuffer,
  };
}

function toTradeSetup(tradePlan?: TradePlan): TradeSetup | undefined {
  if (!tradePlan) return undefined;
  return {
    entry: tradePlan.entry,
    stopLoss: tradePlan.stopLoss,
    takeProfit1: tradePlan.takeProfit1,
    takeProfit2: tradePlan.takeProfit2,
    takeProfit3: tradePlan.takeProfit3,
    riskReward1: tradePlan.riskReward1,
    riskReward2: tradePlan.riskReward2,
    riskReward3: tradePlan.riskReward3,
  };
}

export function analyzeSignal(candles5m: KlineCandle[], candles1h: KlineCandle[]): SignalAnalysis {
  if (candles5m.length < 200) throw new Error("Need at least 200 candles on 5m");
  if (candles1h.length < 200) throw new Error("Need at least 200 candles on 1h");

  const closes = candles5m.map((c) => c.close);
  const volumes = candles5m.map((c) => c.volume);
  const ema9 = calculateEMA(closes, 9).slice(-1)[0];
  const ema21 = calculateEMA(closes, 21).slice(-1)[0];
  const ema50 = calculateEMA(closes, 50).slice(-1)[0];
  const ema200 = calculateEMA(closes, 200).slice(-1)[0];
  const price = closes[closes.length - 1];
  const rsiValues = calculateRSI(closes, 14);
  const rsi = rsiValues[rsiValues.length - 1];
  const prevRsi = rsiValues[rsiValues.length - 2] ?? rsi;
  const macd = calculateMACD(closes, 12, 26, 9);
  const macdLine = macd.macdLine[macd.macdLine.length - 1];
  const macdSignal = macd.signalLine[macd.signalLine.length - 1];
  const macdHistogram = macd.histogram[macd.histogram.length - 1];
  const prevMacdHistogram = macd.histogram[macd.histogram.length - 2] ?? macdHistogram;
  const atrValues = calculateATR(candles5m, 14);
  const atr = atrValues[atrValues.length - 1];
  const safeAtr = Number.isFinite(atr) ? atr : Math.max(price * 0.002, 1);
  const atrBuffer = safeAtr * 0.35;

  const currentVolume = volumes[volumes.length - 1];
  const averageVolume = average(volumes.slice(-20));
  const volumeRatio = averageVolume === 0 ? 0 : currentVolume / averageVolume;
  const swingHighs = getSwingHighs(candles5m);
  const swingLows = getSwingLows(candles5m);
  const structure = detectMarketStructure(swingHighs, swingLows);
  const bos = detectBOS(candles5m, swingHighs, swingLows);
  const choch = detectCHOCH(structure, candles5m, swingHighs, swingLows);
  const higherTimeframe = analyzeTimeframe(candles1h);

  const lastCandle = candles5m[candles5m.length - 1];
  const previousCandle = candles5m[candles5m.length - 2];
  const isBullishCandle = lastCandle.close > lastCandle.open;
  const isBearishCandle = lastCandle.close < lastCandle.open;
  const bullishRejection = detectBullishRejection(lastCandle);
  const bearishRejection = detectBearishRejection(lastCandle);
  const trendStrength = calculateTrendStrength(price, ema9, ema21, ema50, ema200);

  const previousHigh = Math.max(...candles5m.slice(-20, -1).map((c) => c.high));
  const previousLow = Math.min(...candles5m.slice(-20, -1).map((c) => c.low));
  const lastSwingHigh = swingHighs[swingHighs.length - 1]?.price;
  const lastSwingLow = swingLows[swingLows.length - 1]?.price;
  const priorSwingHigh = swingHighs[swingHighs.length - 2]?.price;
  const priorSwingLow = swingLows[swingLows.length - 2]?.price;
  const isRange = detectRange(candles5m, price);
  const { high: rangeHigh, low: rangeLow } = getRangeBounds(candles5m);
  const rangePosition = getRangePosition(price, rangeLow, rangeHigh);
  const noTradeZone = isRange && rangePosition === "MID";

  const bullishEmaStack = ema9 > ema21 && ema21 > ema50 && ema50 > ema200;
  const bearishEmaStack = ema9 < ema21 && ema21 < ema50 && ema50 < ema200;
  const emaStack = bullishEmaStack ? "BULLISH" : bearishEmaStack ? "BEARISH" : "MIXED";
  const bullishMomentum = rsi > 52 && rsi >= prevRsi && macdLine > macdSignal && macdHistogram >= prevMacdHistogram;
  const bearishMomentum = rsi < 48 && rsi <= prevRsi && macdLine < macdSignal && macdHistogram <= prevMacdHistogram;
  const momentum = bullishMomentum ? "BULLISH" : bearishMomentum ? "BEARISH" : "NEUTRAL";
  const volumeState = volumeRatio >= 1.15 ? "STRONG" : volumeRatio < 0.85 ? "WEAK" : "NORMAL";
  const weakVolume = volumeState === "WEAK";

  const fakeBreakoutUp = !!(lastSwingHigh && lastCandle.high > lastSwingHigh && lastCandle.close < lastSwingHigh);
  const fakeBreakoutDown = !!(lastSwingLow && lastCandle.low < lastSwingLow && lastCandle.close > lastSwingLow);
  const fakeBreakout = fakeBreakoutUp || fakeBreakoutDown;
  const liquiditySweep = fakeBreakout && (bullishRejection || bearishRejection);
  const isPullbackLong = price > ema21 && Math.abs(price - ema21) / price < 0.0025;
  const isPullbackShort = price < ema21 && Math.abs(price - ema21) / price < 0.0025;

  let longScore = 0;
  let shortScore = 0;
  if (bullishEmaStack) longScore += 2;
  if (bearishEmaStack) shortScore += 2;
  if (higherTimeframe.bias === "BULLISH") longScore += 3;
  if (higherTimeframe.bias === "BEARISH") shortScore += 3;
  if (higherTimeframe.structure === "BULLISH") longScore += 1;
  if (higherTimeframe.structure === "BEARISH") shortScore += 1;
  if (price > ema21) longScore += 1;
  if (price < ema21) shortScore += 1;
  if (bullishMomentum) longScore += 2;
  if (bearishMomentum) shortScore += 2;
  if (bos === "BULLISH" || choch === "BULLISH") longScore += 2;
  if (bos === "BEARISH" || choch === "BEARISH") shortScore += 2;
  if (bullishRejection || isPullbackLong) longScore += 1;
  if (bearishRejection || isPullbackShort) shortScore += 1;
  if (volumeState === "STRONG") {
    if (longScore >= shortScore) longScore += 1;
    if (shortScore >= longScore) shortScore += 1;
  }
  if (isRange && rangePosition === "LOWER") longScore += 1;
  if (isRange && rangePosition === "UPPER") shortScore += 1;

  const bullishAligned =
    higherTimeframe.bias === "BULLISH" &&
    emaStack === "BULLISH" &&
    (structure === "BULLISH" || bos === "BULLISH" || choch === "BULLISH");
  const bearishAligned =
    higherTimeframe.bias === "BEARISH" &&
    emaStack === "BEARISH" &&
    (structure === "BEARISH" || bos === "BEARISH" || choch === "BEARISH");
  const timeframeConflict =
    (higherTimeframe.bias === "BULLISH" && (bos === "BEARISH" || choch === "BEARISH")) ||
    (higherTimeframe.bias === "BEARISH" && (bos === "BULLISH" || choch === "BULLISH")) ||
    (structure === "BULLISH" && choch === "BEARISH") ||
    (structure === "BEARISH" && choch === "BULLISH");

  const triggerPriceLong = Math.max(lastCandle.high, previousCandle.high);
  const triggerPriceShort = Math.min(lastCandle.low, previousCandle.low);
  const sweepLow = fakeBreakoutDown ? lastCandle.low : undefined;
  const sweepHigh = fakeBreakoutUp ? lastCandle.high : undefined;
  const invalidationLongBase = Math.min(lastSwingLow ?? lastCandle.low, sweepLow ?? lastCandle.low, ema21);
  const invalidationShortBase = Math.max(lastSwingHigh ?? lastCandle.high, sweepHigh ?? lastCandle.high, ema21);
  const invalidationLong = invalidationLongBase - atrBuffer;
  const invalidationShort = invalidationShortBase + atrBuffer;

  const longBlockers = [
    timeframeConflict ? "קונפליקט בין הטיימפריים הגבוה לנמוך" : "",
    noTradeZone ? "המחיר באמצע הטווח" : "",
    weakVolume ? "הנפח חלש מדי" : "",
    trendStrength < 0.006 ? "עוצמת המגמה חלשה מדי" : "",
    fakeBreakoutUp ? "זוהתה פריצת שווא כלפי מעלה" : "",
    rsi > 72 ? "RSI בקניית יתר" : "",
    higherTimeframe.bias === "BEARISH" ? "הטיימפריים הגבוה דובי" : "",
  ].filter(Boolean);
  const shortBlockers = [
    timeframeConflict ? "קונפליקט בין הטיימפריים הגבוה לנמוך" : "",
    noTradeZone ? "המחיר באמצע הטווח" : "",
    weakVolume ? "הנפח חלש מדי" : "",
    trendStrength < 0.006 ? "עוצמת המגמה חלשה מדי" : "",
    fakeBreakoutDown ? "זוהתה פריצת שווא כלפי מטה" : "",
    rsi < 28 ? "RSI במכירת יתר" : "",
    higherTimeframe.bias === "BULLISH" ? "הטיימפריים הגבוה שורי" : "",
  ].filter(Boolean);

  const longTriggerConfirmed =
    bullishAligned &&
    longBlockers.length === 0 &&
    longScore >= 7 &&
    rsi >= 50 &&
    rsi <= 69 &&
    (bos === "BULLISH" || bullishRejection || (isBullishCandle && lastCandle.close > previousCandle.high));
  const shortTriggerConfirmed =
    bearishAligned &&
    shortBlockers.length === 0 &&
    shortScore >= 7 &&
    rsi <= 50 &&
    rsi >= 31 &&
    (bos === "BEARISH" || bearishRejection || (isBearishCandle && lastCandle.close < previousCandle.low));

  let setupState: SetupState = "NONE";
  if (timeframeConflict) setupState = "CONFLICT";
  else if (longTriggerConfirmed) setupState = "READY_LONG";
  else if (shortTriggerConfirmed) setupState = "READY_SHORT";
  else if (bullishAligned && longBlockers.length <= 1) setupState = "WATCHLIST_LONG";
  else if (bearishAligned && shortBlockers.length <= 1) setupState = "WATCHLIST_SHORT";

  const direction: TradeDirection | undefined =
    setupState === "READY_LONG" || setupState === "WATCHLIST_LONG"
      ? "LONG"
      : setupState === "READY_SHORT" || setupState === "WATCHLIST_SHORT"
        ? "SHORT"
        : undefined;
  const setupQuality = getSetupQuality(Math.max(longScore, shortScore));
  const selectedScore = direction === "LONG" ? longScore : direction === "SHORT" ? shortScore : Math.max(longScore, shortScore);
  const blockers = direction === "LONG" ? longBlockers : direction === "SHORT" ? shortBlockers : [];
  const triggerPrice = direction === "LONG" ? triggerPriceLong : direction === "SHORT" ? triggerPriceShort : undefined;
  const invalidationPrice = direction === "LONG" ? invalidationLong : direction === "SHORT" ? invalidationShort : undefined;
  const triggerConfirmed = longTriggerConfirmed || shortTriggerConfirmed;
  const validIf =
    direction === "LONG"
      ? `סגירת נר 5 דקות מעל ${triggerPriceLong.toFixed(2)}`
      : direction === "SHORT"
        ? `סגירת נר 5 דקות מתחת ${triggerPriceShort.toFixed(2)}`
        : undefined;
  const invalidIf =
    direction === "LONG"
      ? `סגירת נר 5 דקות מתחת ${invalidationLong.toFixed(2)}`
      : direction === "SHORT"
        ? `סגירת נר 5 דקות מעל ${invalidationShort.toFixed(2)}`
        : undefined;
  const tradePlan =
    direction === "LONG" && triggerConfirmed
      ? buildTradePlan("LONG", triggerPriceLong, invalidationLong, safeAtr, atrBuffer)
      : direction === "SHORT" && triggerConfirmed
        ? buildTradePlan("SHORT", triggerPriceShort, invalidationShort, safeAtr, atrBuffer)
        : undefined;
  const decision: SignalDecision = tradePlan?.direction ?? "WAIT";

  const context: SignalContext = {
    direction: bullishAligned ? "LONG" : bearishAligned ? "SHORT" : "NEUTRAL",
    aligned: bullishAligned || bearishAligned,
    conflict: timeframeConflict,
    lowTimeframeStructure: structure,
    highTimeframeBias: higherTimeframe.bias,
    emaStack,
    momentum,
    volumeState,
    trendStrength,
    noTradeZone,
  };
  const setup: SignalSetup = {
    state: setupState,
    direction,
    quality: setupQuality,
    score: selectedScore,
    rangePosition,
    blockers,
  };
  const trigger: SignalTrigger = {
    direction: triggerConfirmed ? direction : undefined,
    price: triggerPrice,
    validIf,
    invalidIf,
    confirmed: triggerConfirmed && !!tradePlan,
    reason: triggerConfirmed ? "אישור נר/מבנה התקבל בטיימפריים 5 דקות" : "עדיין חסר טריגר כניסה נקי",
  };

  const reasons = decision !== "WAIT"
    ? [
        `קיים יישור ${decision === "LONG" ? "שורי" : "דובי"} בין 1h ל-5m`,
        trigger.reason ?? "טריגר כניסה מאושר",
        `הסטופ מחושב לפי סווינג + ATR buffer (${atrBuffer.toFixed(2)})`,
      ]
    : [
        ...blockers,
        context.aligned ? "יש קונטקסט למעקב, אבל אין טריגר מאושר" : "אין יישור מספיק ברור בין 1h ל-5m",
      ].filter(Boolean);

  return {
    price,
    ema9,
    ema21,
    ema50,
    ema200,
    rsi,
    macd: macdLine,
    macdSignal,
    macdHistogram,
    atr: safeAtr,
    currentVolume,
    averageVolume,
    volumeRatio,
    trendStrength,
    structure,
    bos,
    choch,
    higherTimeframe,
    context,
    setup,
    trigger,
    tradePlan,
    setupState,
    rangePosition,
    setupQuality,
    fakeBreakout,
    liquiditySweep,
    bullishRejection,
    bearishRejection,
    isPullbackLong,
    isPullbackShort,
    isBullishCandle,
    isBearishCandle,
    previousHigh,
    previousLow,
    roundLevel: getRoundLevel(price),
    lastSwingHigh,
    lastSwingLow,
    priorSwingHigh,
    priorSwingLow,
    noTradeZone,
    longScore,
    shortScore,
    triggerPrice,
    invalidationPrice,
    validIf,
    invalidIf,
    trade: toTradeSetup(tradePlan),
    reasons: reasons.length ? reasons : ["כרגע עדיף להמתין לאישור נוסף, אין טרייד איכותי."],
    confidence: decision !== "WAIT" ? (setupQuality === "HIGH" ? "HIGH" : "MEDIUM") : "LOW",
    decision,
  };
}
