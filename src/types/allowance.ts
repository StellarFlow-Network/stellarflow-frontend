/**
 * Token approval / allowance types for the revocation audit dashboard.
 *
 * "Unlimited" mirrors the classic ERC-20-style max-uint approval pattern
 * ported to Soroban token contracts: an `approve` call whose amount is set
 * far beyond any amount the granter would ever plausibly move, so the
 * spender contract can pull funds indefinitely without a fresh signature.
 * Any allowance at or above {@link UNLIMITED_ALLOWANCE_THRESHOLD} is flagged
 * as unlimited and, combined with no expiration, as high risk.
 */

export type AllowanceRiskLevel = "high" | "medium" | "low";

export interface TokenAllowance {
  id: string;
  /** Full Soroban contract address holding the spender's approval */
  contractId: string;
  contractName: string;
  assetCode: string;
  assetIssuer?: string;
  /** Approved amount as a display string, e.g. "5000.00" or "Unlimited" */
  allowanceAmount: string;
  /** Raw approved amount for threshold comparisons */
  allowanceAmountRaw: number;
  /** Ledger sequence the approval expires at, or null for no expiration */
  expirationLedger: number | null;
  lastUpdated: string;
  isUnlimited: boolean;
  riskLevel: AllowanceRiskLevel;
}

/** Approvals at or above this raw amount are treated as effectively unlimited. */
export const UNLIMITED_ALLOWANCE_THRESHOLD = 1_000_000;

export function computeRiskLevel(
  allowanceAmountRaw: number,
  expirationLedger: number | null,
): AllowanceRiskLevel {
  const isUnlimited = allowanceAmountRaw >= UNLIMITED_ALLOWANCE_THRESHOLD;
  if (isUnlimited && expirationLedger === null) return "high";
  if (isUnlimited || expirationLedger === null) return "medium";
  return "low";
}
