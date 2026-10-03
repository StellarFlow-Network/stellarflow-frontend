/**
 * Token approval audit operations.
 *
 * Scans every smart contract instance the connected account has approved to
 * spend its tokens and evaluates each one's risk (see `computeRiskLevel`).
 * No Soroban indexer for "all approvals granted by this account" exists yet,
 * so `scanAccountAllowances` is mocked against the shape that indexer would
 * return; `revokeAllowance` simulates the `approve(spender, 0)` transaction
 * a real revoke sends. Swap both for real calls once the indexer and
 * contract bindings land — the UI only depends on these two functions.
 */
import {
  computeRiskLevel,
  UNLIMITED_ALLOWANCE_THRESHOLD,
  type TokenAllowance,
} from "@/types/allowance";

function buildAllowance(
  input: Omit<TokenAllowance, "isUnlimited" | "riskLevel" | "allowanceAmount">,
): TokenAllowance {
  const isUnlimited = input.allowanceAmountRaw >= UNLIMITED_ALLOWANCE_THRESHOLD;
  return {
    ...input,
    isUnlimited,
    allowanceAmount: isUnlimited
      ? "Unlimited"
      : input.allowanceAmountRaw.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        }),
    riskLevel: computeRiskLevel(input.allowanceAmountRaw, input.expirationLedger),
  };
}

const MOCK_ALLOWANCES: TokenAllowance[] = [
  buildAllowance({
    id: "1",
    contractId: "CBLZ5K7QQOVOQKZ3P7NHJ4XVJQGK3QF4KPFWX3XZ5N2Q7Y6C4M8A1B2",
    contractName: "StellarFlow AMM Pool",
    assetCode: "USDC",
    allowanceAmountRaw: 5_000,
    expirationLedger: 52_140_000,
    lastUpdated: new Date(Date.now() - 86_400_000).toISOString(),
  }),
  buildAllowance({
    id: "2",
    contractId: "CABC123XQOVOQKZ3P7NHJ4XVJQGK3QF4KPFWX3XZ5N2Q7Y6C4M8A1B2",
    contractName: "Lending Protocol V2",
    assetCode: "XLM",
    allowanceAmountRaw: 10_000_000_000,
    expirationLedger: null,
    lastUpdated: new Date(Date.now() - 172_800_000).toISOString(),
  }),
  buildAllowance({
    id: "3",
    contractId: "CDXYZ789QOVOQKZ3P7NHJ4XVJQGK3QF4KPFWX3XZ5N2Q7Y6C4M8A1B2",
    contractName: "Unknown Yield Aggregator",
    assetCode: "yXLM",
    allowanceAmountRaw: 50_000_000_000,
    expirationLedger: null,
    lastUpdated: new Date(Date.now() - 259_200_000).toISOString(),
  }),
  buildAllowance({
    id: "4",
    contractId: "CFARM456QOVOQKZ3P7NHJ4XVJQGK3QF4KPFWX3XZ5N2Q7Y6C4M8A1B2",
    contractName: "StellarFlow Farm Vault",
    assetCode: "USDC",
    allowanceAmountRaw: 1_250,
    expirationLedger: 52_500_000,
    lastUpdated: new Date(Date.now() - 3_600_000).toISOString(),
  }),
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Scans every connected smart contract instance for active spend approvals. */
export async function scanAccountAllowances(publicKey: string): Promise<TokenAllowance[]> {
  await delay(700);
  console.log(`Scanning allowances for public key: ${publicKey}`);
  return MOCK_ALLOWANCES.map((a) => ({ ...a }));
}

/**
 * Revokes a single approval by simulating an `approve(spender, 0)` call —
 * in production this signs and submits that invocation through the
 * connected wallet.
 */
export async function revokeAllowance(id: string): Promise<void> {
  await delay(1_200);
  void id;
}
