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

function buildLongTrade(
  ema21: number,
  swingLows: SwingPoint[],
  price: number
): TradeSetup | undefined {
  const stopSource =
    swingLows.length > 0 ? swingLows[swingLows.length - 1].price : ema21 * 0.995;

  const entry = ema21;
  const stopLoss = Math.min(stopSource, entry * 0.995);

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
  ema21: number,
  swingHighs: SwingPoint[],
  price: number
): TradeSetup | undefined {
  const stopSource =
    swingHighs.length > 0 ? swingHighs[swingHighs.length - 1].price : ema21 * 1.005;

  const entry = ema21;
  const stopLoss = Math.max(stopSource, entry * 1.005);

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

  const macd = calculateMACD(closes, 12, 26, 9);
  const macdLine = macd.macdLine[macd.macdLine.length - 1];
  const macdSignal = macd.signalLine[macd.signalLine.length - 1];
  const macdHistogram = macd.histogram[macd.histogram.length - 1];

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
  const noTradeZone = isRange || structure === "RANGE";

  let longScore = 0;
  let shortScore = 0;
  let setupState: SetupState = "NONE";
  const reasons: string[] = [];

  const bullishEmaStack = ema9 > ema21 && ema21 > ema50 && ema50 > ema200;
  const bearishEmaStack = ema9 < ema21 && ema21 < ema50 && ema50 < ema200;

  if (bullishEmaStack) longScore += 2;
  if (bearishEmaStack) shortScore += 2;

  if (price > ema21) longScore += 1;
  if (price < ema21) shortScore += 1;

  if (rsi > 55) longScore += 1;
  if (rsi < 45) shortScore += 1;

  if (macdLine > macdSignal && macdHistogram > 0) longScore += 2;
  if (macdLine < macdSignal && macdHistogram < 0) shortScore += 2;

  if (bos === "BULLISH") longScore += 2;
  if (bos === "BEARISH") shortScore += 2;

  if (isPullbackLong) longScore += 1;
  if (isPullbackShort) shortScore += 1;

  if (bullishRejection) longScore += 1;
  if (bearishRejection) shortScore += 1;

  if (volumeRatio > 1.1) {
    if (longScore >= shortScore) longScore += 1;
    if (shortScore >= longScore) shortScore += 1;
  }

  if (higherTimeframe.bias === "BULLISH") longScore += 2;
  if (higherTimeframe.bias === "BEARISH") shortScore += 2;

const bullishSetupContext =
  higherTimeframe.bias === "BULLISH" &&
  price > ema21 &&
  ema21 > ema50 &&
  macdLine > macdSignal;

const bearishSetupContext =
  higherTimeframe.bias === "BEARISH" &&
  price < ema21 &&
  ema21 < ema50 &&
  macdLine < macdSignal;

const timeframeConflict =
  (structure === "BULLISH" && (bos === "BEARISH" || choch === "BEARISH")) ||
  (structure === "BEARISH" && (bos === "BULLISH" || choch === "BULLISH")) ||
  (higherTimeframe.bias === "BULLISH" &&
    (bos === "BEARISH" || choch === "BEARISH")) ||
  (higherTimeframe.bias === "BEARISH" &&
    (bos === "BULLISH" || choch === "BULLISH"));

if (timeframeConflict) {
  setupState = "CONFLICT";
} else if (bullishSetupContext) {
  setupState = isPullbackLong || bullishRejection ? "READY_LONG" : "WATCHLIST_LONG";
} else if (bearishSetupContext) {
  setupState = isPullbackShort || bearishRejection ? "READY_SHORT" : "WATCHLIST_SHORT";
}
  if (noTradeZone) reasons.push("השוק מדשדש / אזור ללא מסחר");
  if (volumeRatio < 0.8) reasons.push("הנפח חלש מדי");
  if (trendStrength < 0.008) reasons.push("עוצמת המגמה חלשה מדי");
  if (fakeBreakout) reasons.push("זוהתה פריצת שווא");
  if (liquiditySweep) reasons.push("זוהתה גריפת נזילות");
  if (rsi > 72) reasons.push("RSI בקניית יתר");
  if (rsi < 28) reasons.push("RSI במכירת יתר");

  if (higherTimeframe.bias === "NEUTRAL") {
    reasons.push("ההטיה בטיימפריים הגבוה ניטרלית");
  }

  if (setupState === "CONFLICT") {
  reasons.push("מבנה הטיימפריים הנמוך מתנגש עם BOS / CHoCH או עם ההטיה של הטיימפריים הגבוה");
}

  if (setupState === "WATCHLIST_LONG") {
    reasons.push("קיים סטאפ שורי, ממתין לטריגר של פולבק / דחייה");
  }

  if (setupState === "WATCHLIST_SHORT") {
    reasons.push("קיים סטאפ דובי, ממתין לטריגר של פולבק / דחייה");
  }

  if (structure === "BULLISH" && higherTimeframe.bias === "BEARISH") {
    reasons.push("ההטיה בטיימפריים הגבוה מתנגשת עם סטאפ לונג בטיימפריים הנמוך");
  }

  if (structure === "BEARISH" && higherTimeframe.bias === "BULLISH") {
    reasons.push("ההטיה בטיימפריים הגבוה מתנגשת עם סטאפ שורט בטיימפריים הנמוך");
  }

  const hardBlockers = [
    noTradeZone,
    volumeRatio < 0.8,
    trendStrength < 0.008,
    fakeBreakout,
    liquiditySweep,
    higherTimeframe.bias === "NEUTRAL",
    (structure === "BULLISH" && higherTimeframe.bias === "BEARISH") ||
      (structure === "BEARISH" && higherTimeframe.bias === "BULLISH"),
    rsi > 72 || rsi < 28,
  ];

  if (hardBlockers.some(Boolean)) {
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
      trade: undefined,
      reasons,
      confidence: "LOW",
      decision: "WAIT",
    };
  }

  if (
    setupState === "READY_LONG" &&
    rsi > 50 &&
    isBullishCandle
  ) {
    const trade = buildLongTrade(ema21, swingLows, price);

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
        trade,
        reasons: ["הסטאפ השורי אושר עם הטיית טיימפריים גבוה וטריגר כניסה"],
        confidence: longScore >= 9 ? "HIGH" : "MEDIUM",
        decision: "LONG",
      };
    }
  }

  if (
    setupState === "READY_SHORT" &&
    rsi < 50 &&
    isBearishCandle
  ) {
    const trade = buildShortTrade(ema21, swingHighs, price);

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
        trade,
        reasons: ["הסטאפ הדובי אושר עם הטיית טיימפריים גבוה וטריגר כניסה"],
        confidence: shortScore >= 9 ? "HIGH" : "MEDIUM",
        decision: "SHORT",
      };
    }
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
    trade: undefined,
    reasons: reasons.length ? reasons : ["אין כרגע סטאפ נקי"],
    confidence: "LOW",
    decision: "WAIT",
  };
}