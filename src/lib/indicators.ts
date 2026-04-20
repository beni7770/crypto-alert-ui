export function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];

  const k = 2 / (period + 1);
  const emaArray: number[] = [];

  let ema = prices[0];
  emaArray.push(ema);

  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
    emaArray.push(ema);
  }

  return emaArray;
}

export function calculateRSI(prices: number[], period: number = 14): number[] {
  if (prices.length <= period) return [];

  const rsiArray: number[] = new Array(prices.length).fill(NaN);

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  if (avgLoss === 0) {
    rsiArray[period] = 100;
  } else {
    const rs = avgGain / avgLoss;
    rsiArray[period] = 100 - 100 / (1 + rs);
  }

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      rsiArray[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsiArray[i] = 100 - 100 / (1 + rs);
    }
  }

  return rsiArray;
}

export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
) {
  if (prices.length < slowPeriod) {
    return {
      macdLine: [],
      signalLine: [],
      histogram: [],
    };
  }

  const fastEma = calculateEMA(prices, fastPeriod);
  const slowEma = calculateEMA(prices, slowPeriod);

  const macdLine = prices.map((_, i) => {
    const fast = fastEma[i];
    const slow = slowEma[i];
    return fast - slow;
  });

  const signalLine = calculateEMA(macdLine, signalPeriod);
  const histogram = macdLine.map((value, i) => value - signalLine[i]);

  return {
    macdLine,
    signalLine,
    histogram,
  };
}

export function calculateSMA(values: number[], period: number): number[] {
  if (values.length < period) return [];

  const result: number[] = new Array(values.length).fill(NaN);

  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const sum = slice.reduce((acc, val) => acc + val, 0);
    result[i] = sum / period;
  }

  return result;
}

export function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}