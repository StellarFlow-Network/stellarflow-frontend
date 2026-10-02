export function formatTokenAmount(
  amount: string,
  decimals: number = 7,
  maxFractionDigits: number = 7,
): string {
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed === 0) return "0";
  return parsed.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  });
}

export function formatXLM(amount: string): string {
  return formatTokenAmount(amount, 7, 7);
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCountdown(remainingSeconds: number): string {
  const seconds = Math.max(0, Math.floor(remainingSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return [hours, minutes, secs].map((part) => String(part).padStart(2, "0")).join(":");
}

const COMPACT_AMOUNT_UNITS = [
  { threshold: 1_000_000, suffix: "M" },
  { threshold: 1_000, suffix: "K" },
] as const;

export function formatOrderBookPrice(value: number, maxFractionDigits: number = 4): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: Math.min(2, maxFractionDigits),
    maximumFractionDigits: maxFractionDigits,
  });
}

export function formatCompactAmount(value: number): string {
  const unit = COMPACT_AMOUNT_UNITS.find(({ threshold }) => Math.abs(value) >= threshold);
  return unit ? `${(value / unit.threshold).toFixed(2)}${unit.suffix}` : value.toFixed(2);
}

export function formatPercent(value: number, fractionDigits: number = 2): string {
  return `${value.toFixed(fractionDigits)}%`;
}

export function formatStroops(stroops: string): string {
  const stroopValue = BigInt(stroops);
  const xlmValue = Number(stroopValue) / 10_000_000;
  return xlmValue.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 7,
  });
}
