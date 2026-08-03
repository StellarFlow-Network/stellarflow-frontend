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

export function formatStroops(stroops: string): string {
  const stroopValue = BigInt(stroops);
  const xlmValue = Number(stroopValue) / 10_000_000;
  return xlmValue.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 7,
  });
}

