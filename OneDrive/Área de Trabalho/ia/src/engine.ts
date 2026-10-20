import type { Candle, FibonacciLevels, IndicatorValues, SignalDirection, Timeframe, TradeSignal } from "./types";

export const timeframeMs: Record<Timeframe, number> = {
  "1m": 60_000, "5m": 300_000, "15m": 900_000, "1h": 3_600_000, "1d": 86_400_000,
};

const decimalsFor = (symbol: string, price: number) =>
  symbol.includes("JPY") ? 3 : /BTC|ETH/.test(symbol) || price >= 100 ? 2 : 5;
const round = (value: number, decimals: number) => Number(value.toFixed(decimals));

export function generateCandles(symbol: string, count = 90, periodMs = timeframeMs["1m"]): Candle[] {
  const now = Date.now();
  const latest = Math.floor(now / periodMs) * periodMs;
  const crypto = /BTC|ETH/.test(symbol);
  const base = symbol === "BTC/USD" ? 67400 : symbol === "ETH/USD" ? 3450 : symbol.includes("JPY") ? 149.25 : 1.0842;
  const decimals = decimalsFor(symbol, base);
  const volatility = crypto ? 0.003 : 0.0008;
  const result: Candle[] = [];
  let previous = base;
  for (let i = count - 1; i >= 0; i--) {
    const timestamp = latest - i * periodMs;
    const open = previous;
    const close = Math.max(10 ** -decimals, round(open + (Math.random() - 0.49) * open * volatility, decimals));
    const wick = Math.random() * open * volatility * 0.6;
    result.push({
      timestamp, open, close,
      high: round(Math.max(open, close) + wick, decimals),
      low: round(Math.max(10 ** -decimals, Math.min(open, close) - wick), decimals),
      volume: Math.floor(50 + Math.random() * 950),
    });
    previous = close;
  }
  return result;
}

export function tickPrice(last: number, symbol: string) {
  const decimals = decimalsFor(symbol, last);
  const volatility = /BTC|ETH/.test(symbol) ? 0.00045 : 0.00012;
  return round(Math.max(10 ** -decimals, last + (Math.random() - 0.5) * last * volatility), decimals);
}

export function calculateEMA(candles: Candle[], period = 20): number[] {
  if (candles.length < period) return [];
  const prices = candles.map(c => c.close);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const values = [ema];
  const multiplier = 2 / (period + 1);
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * multiplier + ema * (1 - multiplier);
    values.push(ema);
  }
  return values;
}

export function calculateRSI(candles: Candle[], period = 14): number[] {
  if (candles.length <= period) return [];
  const prices = candles.map(c => c.close);
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    gain += Math.max(diff, 0);
    loss += Math.max(-diff, 0);
  }
  let avgGain = gain / period, avgLoss = loss / period;
  const value = () => avgGain === 0 && avgLoss === 0 ? 50 : avgLoss === 0 ? 100 : avgGain === 0 ? 0 : 100 - 100 / (1 + avgGain / avgLoss);
  const values = [value()];
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    values.push(value());
  }
  return values;
}

export function calculateATR(candles: Candle[], period = 14): number[] {
  if (candles.length <= period) return [];
  const trs = candles.slice(1).map((c, i) => Math.max(c.high - c.low, Math.abs(c.high - candles[i].close), Math.abs(c.low - candles[i].close)));
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const values = [atr];
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    values.push(atr);
  }
  return values;
}

export function calculateFibonacci(candles: Candle[], lookback = 35): FibonacciLevels | null {
  if (candles.length < lookback) return null;
  const window = candles.slice(-lookback);
  let high = -Infinity, low = Infinity, highIndex = -1, lowIndex = -1;
  window.forEach((c, i) => {
    if (c.high > high) { high = c.high; highIndex = i; }
    if (c.low < low) { low = c.low; lowIndex = i; }
  });
  if (high <= low || highIndex === lowIndex) return null;
  const trend = lowIndex < highIndex ? "UP" : "DOWN";
  const startPrice = trend === "UP" ? low : high;
  const endPrice = trend === "UP" ? high : low;
  const range = endPrice - startPrice;
  const level = (pct: number) => endPrice - range * pct / 100;
  return {
    trend, startPrice, endPrice,
    levels: {
      "0.0": level(0), "23.6": level(23.6), "38.2": level(38.2),
      "50.0": level(50), "61.8": level(61.8), "78.6": level(78.6), "100.0": level(100),
    },
  };
}

export function latestIndicators(candles: Candle[]): IndicatorValues {
  const ema = calculateEMA(candles, 20);
  const rsi = calculateRSI(candles, 14);
  const atr = calculateATR(candles, 14);
  return {
    ema: ema.at(-1),
    rsi: rsi.at(-1),
    atr: atr.at(-1),
  };
}

export function generateSignal(symbol: string, timeframe: Timeframe, candles: Candle[], price: number): TradeSignal | null {
  const fib = calculateFibonacci(candles);
  const indicators = latestIndicators(candles);
  if (!fib || indicators.rsi === undefined || indicators.ema === undefined) return null;
  const { rsi, ema } = indicators;
  const range = Math.abs(fib.endPrice - fib.startPrice);
  let direction: SignalDirection | null = null;
  let target = 0, stop = 0;
  if (fib.trend === "UP" && rsi <= 35 && price <= fib.levels["61.8"] * 1.002 && price > ema) {
    direction = "CALL"; target = fib.levels["0.0"]; stop = fib.levels["100.0"] - range * 0.1;
  } else if (fib.trend === "DOWN" && rsi >= 65 && price >= fib.levels["61.8"] * 0.998 && price < ema) {
    direction = "PUT"; target = fib.levels["0.0"]; stop = fib.levels["100.0"] + range * 0.1;
  }
  if (!direction || target <= 0 || stop <= 0) return null;
  if (direction === "CALL" && !(stop < price && price < target)) return null;
  if (direction === "PUT" && !(target < price && price < stop)) return null;
  const decimals = decimalsFor(symbol, price);
  const now = Date.now();
  return {
    id: `sig-${now}-${Math.random().toString(36).slice(2, 7)}`,
    symbol, timeframe, direction,
    entryPrice: round(price, decimals), targetPrice: round(target, decimals), stopLoss: round(stop, decimals),
    timestamp: now, expirationTime: now + timeframeMs[timeframe] * 2,
    status: "PENDING", fibonacciLevels: fib,
  };
}

export function settleSignals(signals: TradeSignal[], priceBySymbol: Record<string, number>, now = Date.now()): TradeSignal[] {
  return signals.map(signal => {
    if (signal.status !== "PENDING") return signal;
    const price = priceBySymbol[signal.symbol];
    if (price === undefined) return signal;
    if (signal.direction === "CALL") {
      if (price >= signal.targetPrice) return { ...signal, status: "WIN" };
      if (price <= signal.stopLoss) return { ...signal, status: "LOSS" };
    } else {
      if (price <= signal.targetPrice) return { ...signal, status: "WIN" };
      if (price >= signal.stopLoss) return { ...signal, status: "LOSS" };
    }
    if (now >= signal.expirationTime) return { ...signal, status: "EXPIRED" };
    return signal;
  });
}