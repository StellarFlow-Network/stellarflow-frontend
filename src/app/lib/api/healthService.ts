export async function getNetworkHealth() {
  const res = await fetch('https://horizon.stellar.org/fee_stats');
  const data = await res.json();
  const baseFee = data.last_ledger_base_fee;
  return {
    level: baseFee > 1000 ? 'congested' : 'normal',
    baseFee,
    recommendedFeeTier: baseFee > 1000 ? 'high' : 'low',
  };
}
