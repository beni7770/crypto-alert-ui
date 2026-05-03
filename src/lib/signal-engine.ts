import type { KlineCandle } from "./binance";
import {
  average,
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

  currentVolume: number;
  averageVolume: number;
  volumeRatio: number;

  trendStrength: number;
  structure: MarketStructure;
  bos: BosDirection;
  choch: ChochDirection;

  higherTimeframe: TimeframeSnapshot;

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

function isPivotHigh(
  candles: KlineCandle[],
  index: number,
  left: number = 2,
  right: number = 2
): boolean {
  const current = candles[index];
  for (let i = index - left; i <= index + right; i++) {
    if (i === index) continue;
    if (i < 0 || i >= candles.length) return false;
    if (candles[i].high >= current.high) return false;
  }
  return true;
}

function isPivotLow(
  candles: KlineCandle[],
  index: number,
  left: number = 2,
  right: number = 2
): boolean {
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
    if (isPivotHigh(candles, i)) {
      points.push({ index: i, price: candles[i].high });
    }
  }
  return points;
}

function getSwingLows(candles: KlineCandle[]): SwingPoint[] {
  const points: SwingPoint[] = [];
  for (let i = 2; i < candles.length - 2; i++) {
    if (isPivotLow(candles, i)) {
      points.push({ index: i, price: candles[i].low });
    }
  }
  return points;
}

function detectMarketStructure(
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[]
): MarketStructure {
  if (swingHighs.length < 2 || swingLows.length < 2) return "RANGE";

  const lastHigh = swingHighs[swingHighs.length - 1];
  const prevHigh = swingHighs[swingHighs.length - 2];
  const lastLow = swingLows[swingLows.length - 1];
  const prevLow = swingLows[swingLows.length - 2];

  const higherHigh = lastHigh.price > prevHigh.price;
  const higherLow = lastLow.price > prevLow.price;
  const lowerHigh = lastHigh.price < prevHigh.price;
  const lowerLow = lastLow.price < prevLow.price;

  if (higherHigh && higherLow) return "BULLISH";
  if (lowerHigh && lowerLow) return "BEARISH";
  return "RANGE";
}

function detectBOS(
  candles: KlineCandle[],
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[]
): BosDirection {
  if (!swingHighs.length || !swingLows.length) return "NONE";

  const lastClose = candles[candles.length - 1].close;
  const lastSwingHigh = swingHighs[swingHighs.length - 1].price;
  const lastSwingLow = swingLows[swingLows.length - 1].price;

  if (lastClose > lastSwingHigh) return "BULLISH";
  if (lastClose < lastSwingLow) return "BEARISH";
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
  const lastSwingHigh = swingHighs[swingHighs.length - 1].price;
  const lastSwingLow = swingLows[swingLows.length - 1].price;

  if (structure === "BEARISH" && lastClose > lastSwingHigh) return "BULLISH";
  if (structure === "BULLISH" && lastClose < lastSwingLow) return "BEARISH";
  return "NONE";
}

function detectRange(candles: KlineCandle[], price: number): boolean {
  const recent = candles.slice(-30);
  const high = Math.max(...recent.map((c) => c.high));
  const low = Math.min(...recent.map((c) => c.low));
  const widthPct = (high - low) / price;
  return widthPct < 0.012;
}

function detectFakeBreakout(
  candles: KlineCandle[],
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[]
): boolean {
  if (!swingHighs.length || !swingLows.length) return false;

  const last = candles[candles.length - 1];
  const lastSwingHigh = swingHighs[swingHighs.length - 1].price;
  const lastSwingLow = swingLows[swingLows.length - 1].price;

  const fakeUp = last.high > lastSwingHigh && last.close < lastSwingHigh;
  const fakeDown = last.low < lastSwingLow && last.close > lastSwingLow;

  return fakeUp || fakeDown;
}

function detectLiquiditySweep(
  candles: KlineCandle[],
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[]
): boolean {
  if (!swingHighs.length || !swingLows.length) return false;

  const last = candles[candles.length - 1];
  const body = Math.abs(last.close - last.open);
  const fullRange = Math.max(last.high - last.low, 1e-9);

  const upperWick = last.high - Math.max(last.open, last.close);
  const lowerWick = Math.min(last.open, last.close) - last.low;

  const lastSwingHigh = swingHighs[swingHighs.length - 1].price;
  const lastSwingLow = swingLows[swingLows.length - 1].price;

  const sweepUp =
    last.high > lastSwingHigh &&
    last.close < lastSwingHigh &&
    upperWick / fullRange > 0.4 &&
    upperWick > body;

  const sweepDown =
    last.low < lastSwingLow &&
    last.close > lastSwingLow &&
    lowerWick / fullRange > 0.4 &&
    lowerWick > body;

  return sweepUp || sweepDown;
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

function calculateTrendStrength(
  price: number,
  ema9: number,
  ema21: number,
  ema50: number,
  ema200: number
): number {
  const raw =
    Math.abs(ema9 - ema21) +
    Math.abs(ema21 - ema50) +
    Math.abs(ema50 - ema200);

  return raw / price;
}

function getHigherTimeframeBias(snapshot: TimeframeSnapshot): HigherTimeframeBias {
  const bullish =
    snapshot.price > snapshot.ema50 &&
    snapshot.ema50 > snapshot.ema200 &&
    snapshot.rsi > 52 &&
    snapshot.macd > snapshot.macdSignal &&
    snapshot.trendStrength > 0.01;

  const bearish =
    snapshot.price < snapshot.ema50 &&
    snapshot.ema50 < snapshot.ema200 &&
    snapshot.rsi < 48 &&
    snapshot.macd < snapshot.macdSignal &&
    snapshot.trendStrength > 0.01;

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

  return {
    ...partial,
    bias: getHigherTimeframeBias(partial),
  };
}

function getRangeBounds(candles: KlineCandle[]) {
  const recent = candles.slice(-30);
  const high = Math.max(...recent.map((c) => c.high));
  const low = Math.min(...recent.map((c) => c.low));
  return { high, low, width: Math.max(high - low, 1e-9) };
}

function getRangePosition(price: number, low: number, high: number): RangePosition {
  const width = Math.max(high - low, 1e-9);
  const normalized = (price - low) / width;
  if (normalized <= 0.33) return "LOWER";
  if (normalized >= 0.67) return "UPPER";
  return "MID";
}

function getSetupQuality(score: number): SetupQuality {
  if (score >= 9) return "HIGH";
  if (score >= 6) return "MEDIUM";
  return "LOW";
}

function buildLongTrade(
  entryBase: number,
  stopBase: number,
  price: number
): TradeSetup | undefined {
  const entry = entryBase;
  const stopLoss = Math.min(stopBase, entry * 0.995);

  if (entry <= stopLoss) return undefined;

  const risk = entry - stopLoss;
  if (risk / price < 0.0015) return undefined;

  return {
    entry,
    stopLoss,
    takeProfit1: entry + risk * 1,
    takeProfit2: entry + risk * 2,
    takeProfit3: entry + risk * 3,
    riskReward1: 1,
    riskReward2: 2,
    riskReward3: 3,
  };
}

function buildShortTrade(
  entryBase: number,
  stopBase: number,
  price: number
): TradeSetup | undefined {
  const entry = entryBase;
  const stopLoss = Math.max(stopBase, entry * 1.005);

  if (stopLoss <= entry) return undefined;

  const risk = stopLoss - entry;
  if (risk / price < 0.0015) return undefined;

  return {
    entry,
    stopLoss,
    takeProfit1: entry - risk * 1,
    takeProfit2: entry - risk * 2,
    takeProfit3: entry - risk * 3,
    riskReward1: 1,
    riskReward2: 2,
    riskReward3: 3,
  };
}

export function analyzeSignal(
  candles5m: KlineCandle[],
  candles1h: KlineCandle[]
): SignalAnalysis {
  if (candles5m.length < 200) {
    throw new Error("Need at least 200 candles on 5m");
  }

  if (candles1h.length < 200) {
    throw new Error("Need at least 200 candles on 1h");
  }

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

  const currentVolume = volumes[volumes.length - 1];
  const averageVolume = average(volumes.slice(-20));
  const volumeRatio = averageVolume === 0 ? 0 : currentVolume / averageVolume;

  const swingHighs = getSwingHighs(candles5m);
  const swingLows = getSwingLows(candles5m);

  const structure = detectMarketStructure(swingHighs, swingLows);
  const bos = detectBOS(candles5m, swingHighs, swingLows);
  const choch = detectCHOCH(structure, candles5m, swingHighs, swingLows);

  const higherTimeframe = analyzeTimeframe(candles1h);

  const fakeBreakout = detectFakeBreakout(candles5m, swingHighs, swingLows);
  const liquiditySweep = detectLiquiditySweep(candles5m, swingHighs, swingLows);

  const lastCandle = candles5m[candles5m.length - 1];
  const previousCandle = candles5m[candles5m.length - 2];
  const isBullishCandle = lastCandle.close > lastCandle.open;
  const isBearishCandle = lastCandle.close < lastCandle.open;

  const bullishRejection = detectBullishRejection(lastCandle);
  const bearishRejection = detectBearishRejection(lastCandle);

  const isPullbackLong =
    price > ema21 && Math.abs(price - ema21) / price < 0.0025;
  const isPullbackShort =
    price < ema21 && Math.abs(price - ema21) / price < 0.0025;

  const trendStrength = calculateTrendStrength(price, ema9, ema21, ema50, ema200);

  const previousHigh = Math.max(...candles5m.slice(-20, -1).map((c) => c.high));
  const previousLow = Math.min(...candles5m.slice(-20, -1).map((c) => c.low));
  const roundLevel = getRoundLevel(price);

  const lastSwingHigh = swingHighs[swingHighs.length - 1]?.price;
  const lastSwingLow = swingLows[swingLows.length - 1]?.price;
  const priorSwingHigh = swingHighs[swingHighs.length - 2]?.price;
  const priorSwingLow = swingLows[swingLows.length - 2]?.price;

  const isRange = detectRange(candles5m, price);
  const { high: rangeHigh, low: rangeLow } = getRangeBounds(candles5m);
  const rangePosition = getRangePosition(price, rangeLow, rangeHigh);
  const midRange = isRange && rangePosition === "MID";
  const noTradeZone = midRange;

  let longScore = 0;
  let shortScore = 0;
  let setupState: SetupState = "NONE";
  const reasons: string[] = [];

  const bullishEmaStack = ema9 > ema21 && ema21 > ema50 && ema50 > ema200;
  const bearishEmaStack = ema9 < ema21 && ema21 < ema50 && ema50 < ema200;
  const bullishMomentum = rsi > 52 && rsi >= prevRsi && macdLine > macdSignal && macdHistogram >= prevMacdHistogram;
  const bearishMomentum = rsi < 48 && rsi <= prevRsi && macdLine < macdSignal && macdHistogram <= prevMacdHistogram;
  const strongVolume = volumeRatio >= 1.05;
  const weakVolume = volumeRatio < 0.85;

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

  if (bos === "BULLISH") longScore += 2;
  if (bos === "BEARISH") shortScore += 2;

  if (choch === "BULLISH") longScore += 1;
  if (choch === "BEARISH") shortScore += 1;

  if (isPullbackLong) longScore += 1;
  if (isPullbackShort) shortScore += 1;

  if (bullishRejection) longScore += 1;
  if (bearishRejection) shortScore += 1;

  if (strongVolume) {
    if (longScore >= shortScore) longScore += 1;
    if (shortScore >= longScore) shortScore += 1;
  }

  if (isRange && rangePosition === "LOWER") longScore += 1;
  if (isRange && rangePosition === "UPPER") shortScore += 1;

  const bullishAligned =
    higherTimeframe.bias === "BULLISH" &&
    price > ema21 &&
    ema21 > ema50 &&
    (structure === "BULLISH" || bos === "BULLISH" || choch === "BULLISH");

  const bearishAligned =
    higherTimeframe.bias === "BEARISH" &&
    price < ema21 &&
    ema21 < ema50 &&
    (structure === "BEARISH" || bos === "BEARISH" || choch === "BEARISH");

  const timeframeConflict =
    (structure === "BULLISH" && (bos === "BEARISH" || choch === "BEARISH")) ||
    (structure === "BEARISH" && (bos === "BULLISH" || choch === "BULLISH")) ||
    (higherTimeframe.bias === "BULLISH" &&
      (bos === "BEARISH" || choch === "BEARISH")) ||
    (higherTimeframe.bias === "BEARISH" &&
      (bos === "BULLISH" || choch === "BULLISH"));

  const fakeBreakoutUp = !!(lastSwingHigh && lastCandle.high > lastSwingHigh && lastCandle.close < lastSwingHigh);
  const fakeBreakoutDown = !!(lastSwingLow && lastCandle.low < lastSwingLow && lastCandle.close > lastSwingLow);

  const longTrigger =
    bullishAligned &&
    !midRange &&
    !timeframeConflict &&
    !fakeBreakoutUp &&
    !weakVolume &&
    trendStrength >= 0.008 &&
    rsi >= 50 &&
    rsi <= 69 &&
    (bos === "BULLISH" || bullishRejection || (isBullishCandle && lastCandle.close > previousCandle.high));

  const shortTrigger =
    bearishAligned &&
    !midRange &&
    !timeframeConflict &&
    !fakeBreakoutDown &&
    !weakVolume &&
    trendStrength >= 0.008 &&
    rsi <= 50 &&
    rsi >= 31 &&
    (bos === "BEARISH" || bearishRejection || (isBearishCandle && lastCandle.close < previousCandle.low));

  const bullishWatch =
    bullishAligned &&
    !midRange &&
    !timeframeConflict &&
    !fakeBreakoutUp;

  const bearishWatch =
    bearishAligned &&
    !midRange &&
    !timeframeConflict &&
    !fakeBreakoutDown;

  if (timeframeConflict) {
    setupState = "CONFLICT";
  } else if (longTrigger) {
    setupState = "READY_LONG";
  } else if (shortTrigger) {
    setupState = "READY_SHORT";
  } else if (bullishWatch) {
    setupState = "WATCHLIST_LONG";
  } else if (bearishWatch) {
    setupState = "WATCHLIST_SHORT";
  }

  if (midRange) reasons.push("המחיר באמצע הטווח - אזור חלש לכניסה");
  if (isRange && rangePosition === "LOWER") reasons.push("המחיר בחלק התחתון של הטווח");
  if (isRange && rangePosition === "UPPER") reasons.push("המחיר בחלק העליון של הטווח");
  if (weakVolume) reasons.push("הנפח חלש מדי");
  if (trendStrength < 0.008) reasons.push("עוצמת המגמה חלשה מדי");
  if (fakeBreakoutUp) reasons.push("זוהתה פריצת שווא כלפי מעלה");
  if (fakeBreakoutDown) reasons.push("זוהתה פריצת שווא כלפי מטה");
  if (liquiditySweep) reasons.push("זוהתה גריפת נזילות");
  if (rsi > 72) reasons.push("RSI בקניית יתר");
  if (rsi < 28) reasons.push("RSI במכירת יתר");
  if (higherTimeframe.bias === "NEUTRAL") reasons.push("ההטיה בטיימפריים הגבוה ניטרלית");
  if (setupState === "CONFLICT") {
    reasons.push("יש סתירה בין מבנה הטיימפריים הנמוך לבין ההטיה או שבירת המבנה");
  }
  if (setupState === "WATCHLIST_LONG") {
    reasons.push("יש קונטקסט שורי, אבל עדיין חסר טריגר כניסה נקי");
  }
  if (setupState === "WATCHLIST_SHORT") {
    reasons.push("יש קונטקסט דובי, אבל עדיין חסר טריגר כניסה נקי");
  }
  if (higherTimeframe.bias === "BULLISH" && structure === "BEARISH") {
    reasons.push("המבנה בטיימפריים הנמוך חלש מההטיה השורית של הטיימפריים הגבוה");
  }
  if (higherTimeframe.bias === "BEARISH" && structure === "BULLISH") {
    reasons.push("המבנה בטיימפריים הנמוך חלש מההטיה הדובית של הטיימפריים הגבוה");
  }

  const hardBlockLong =
    timeframeConflict ||
    midRange ||
    weakVolume ||
    trendStrength < 0.008 ||
    fakeBreakoutUp ||
    rsi > 72 ||
    higherTimeframe.bias === "BEARISH";

  const hardBlockShort =
    timeframeConflict ||
    midRange ||
    weakVolume ||
    trendStrength < 0.008 ||
    fakeBreakoutDown ||
    rsi < 28 ||
    higherTimeframe.bias === "BULLISH";

  const setupQuality = getSetupQuality(Math.max(longScore, shortScore));
  const triggerPriceLong = Math.max(lastCandle.high, previousCandle.high);
  const triggerPriceShort = Math.min(lastCandle.low, previousCandle.low);
  const invalidationLong = lastSwingLow ?? Math.min(lastCandle.low, ema21);
  const invalidationShort = lastSwingHigh ?? Math.max(lastCandle.high, ema21);

  if (setupState === "READY_LONG" && !hardBlockLong) {
    const trade = buildLongTrade(triggerPriceLong, invalidationLong, price);

    if (trade) {
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
        currentVolume,
        averageVolume,
        volumeRatio,
        trendStrength,
        structure,
        bos,
        choch,
        higherTimeframe,
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
        roundLevel,
        lastSwingHigh,
        lastSwingLow,
        priorSwingHigh,
        priorSwingLow,
        noTradeZone,
        longScore,
        shortScore,
        triggerPrice: triggerPriceLong,
        invalidationPrice: invalidationLong,
        validIf: `סגירת נר מעל ${triggerPriceLong.toFixed(2)}`,
        invalidIf: `סגירת נר מתחת ${invalidationLong.toFixed(2)}`,
        trade,
        reasons: [
          "קיים יישור שורי בין הטיימפריים הגבוה והנמוך",
          "יש טריגר לונג תקף עם אישור נר / מבנה",
          `הכניסה נשענת על פריצת ${triggerPriceLong.toFixed(2)} והסטופ מתחת ${invalidationLong.toFixed(2)}`,
        ],
        confidence: setupQuality === "HIGH" ? "HIGH" : "MEDIUM",
        decision: "LONG",
      };
    }
  }

  if (setupState === "READY_SHORT" && !hardBlockShort) {
    const trade = buildShortTrade(triggerPriceShort, invalidationShort, price);

    if (trade) {
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
        currentVolume,
        averageVolume,
        volumeRatio,
        trendStrength,
        structure,
        bos,
        choch,
        higherTimeframe,
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
        roundLevel,
        lastSwingHigh,
        lastSwingLow,
        priorSwingHigh,
        priorSwingLow,
        noTradeZone,
        longScore,
        shortScore,
        triggerPrice: triggerPriceShort,
        invalidationPrice: invalidationShort,
        validIf: `סגירת נר מתחת ${triggerPriceShort.toFixed(2)}`,
        invalidIf: `סגירת נר מעל ${invalidationShort.toFixed(2)}`,
        trade,
        reasons: [
          "קיים יישור דובי בין הטיימפריים הגבוה והנמוך",
          "יש טריגר שורט תקף עם אישור נר / מבנה",
          `הכניסה נשענת על שבירה של ${triggerPriceShort.toFixed(2)} והסטופ מעל ${invalidationShort.toFixed(2)}`,
        ],
        confidence: setupQuality === "HIGH" ? "HIGH" : "MEDIUM",
        decision: "SHORT",
      };
    }
  }

  if (setupState === "READY_LONG" && hardBlockLong) {
    reasons.push("הקונטקסט שורי, אבל יש חסם איכות שמונע כניסה עכשיו");
  }

  if (setupState === "READY_SHORT" && hardBlockShort) {
    reasons.push("הקונטקסט דובי, אבל יש חסם איכות שמונע כניסה עכשיו");
  }

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
    currentVolume,
    averageVolume,
    volumeRatio,
    trendStrength,
    structure,
    bos,
    choch,
    higherTimeframe,
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
    roundLevel,
    lastSwingHigh,
    lastSwingLow,
    priorSwingHigh,
    priorSwingLow,
    noTradeZone,
    longScore,
    shortScore,
    triggerPrice:
      setupState === "WATCHLIST_LONG" || setupState === "READY_LONG"
        ? triggerPriceLong
        : setupState === "WATCHLIST_SHORT" || setupState === "READY_SHORT"
          ? triggerPriceShort
          : undefined,
    invalidationPrice:
      setupState === "WATCHLIST_LONG" || setupState === "READY_LONG"
        ? invalidationLong
        : setupState === "WATCHLIST_SHORT" || setupState === "READY_SHORT"
          ? invalidationShort
          : undefined,
    validIf:
      setupState === "WATCHLIST_LONG" || setupState === "READY_LONG"
        ? `סגירת נר מעל ${triggerPriceLong.toFixed(2)}`
        : setupState === "WATCHLIST_SHORT" || setupState === "READY_SHORT"
          ? `סגירת נר מתחת ${triggerPriceShort.toFixed(2)}`
          : undefined,
    invalidIf:
      setupState === "WATCHLIST_LONG" || setupState === "READY_LONG"
        ? `סגירת נר מתחת ${invalidationLong.toFixed(2)}`
        : setupState === "WATCHLIST_SHORT" || setupState === "READY_SHORT"
          ? `סגירת נר מעל ${invalidationShort.toFixed(2)}`
          : undefined,
    trade: undefined,
    reasons: reasons.length ? reasons : ["כרגע עדיף להמתין לאישור נוסף, אין טרייד איכותי."],
    confidence: setupQuality === "HIGH" ? "MEDIUM" : "LOW",
    decision: "WAIT",
  };
}
