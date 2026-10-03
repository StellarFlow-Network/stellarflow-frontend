export interface OhlcvCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function normalizeTimestamp(value: unknown): number | null {
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return normalizeTimestamp(parsed);
    const date = Date.parse(value);
    return Number.isNaN(date) ? null : Math.floor(date / 1000);
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value > 1e12 ? value / 1000 : value);
}

export function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function mapHistoricalOhlcv(payload: unknown): OhlcvCandle[] {
  let records: unknown = payload;
  if (typeof records === "object" && records !== null && !Array.isArray(records)) {
    const envelope = records as Record<string, unknown>;
    records = envelope.candles ?? envelope.data ?? envelope.results;
  }
  if (!Array.isArray(records)) return [];

  const candles = new Map<number, OhlcvCandle>();
  for (const record of records) {
    if (typeof record !== "object" || record === null) continue;
    const row = record as Record<string, unknown>;
    const time = normalizeTimestamp(row.time ?? row.timestamp ?? row.t ?? row.date);
    const open = finiteNumber(row.open ?? row.o);
    const high = finiteNumber(row.high ?? row.h);
    const low = finiteNumber(row.low ?? row.l);
    const close = finiteNumber(row.close ?? row.c);
    const volume = finiteNumber(row.volume ?? row.vol ?? row.v) ?? 0;

    if (
      time === null || open === null || high === null || low === null || close === null ||
      open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0 ||
      high < Math.max(open, close, low) || low > Math.min(open, close, high)
    ) continue;

    candles.set(time, { time, open, high, low, close, volume });
  }

  return [...candles.values()].sort((left, right) => left.time - right.time);
}