export type Timeframe = "1m" | "5m" | "15m" | "1h" | "1d";
export type SignalDirection = "CALL" | "PUT";
export type SignalStatus = "PENDING" | "WIN" | "LOSS" | "EXPIRED";

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FibonacciLevels {
  trend: "UP" | "DOWN";
  startPrice: number;
  endPrice: number;
  levels: Record<"0.0" | "23.6" | "38.2" | "50.0" | "61.8" | "78.6" | "100.0", number>;
}

export interface TradeSignal {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  direction: SignalDirection;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  timestamp: number;
  expirationTime: number;
  status: SignalStatus;
  fibonacciLevels: FibonacciLevels;
}

export interface IndicatorValues {
  ema?: number;
  rsi?: number;
  atr?: number;
}