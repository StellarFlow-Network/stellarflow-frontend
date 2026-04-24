import { Keypair } from '@stellar/stellar-sdk';

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * Validates that a candidate string is a well-formed Stellar secret key.
 *
 * Uses Keypair.fromSecret() to verify the key starts with 'S' and passes
 * the SDK's internal checksum. The reason field never echoes the candidate
 * value (Requirement 7.1).
 */
export function validate(candidate: string): ValidationResult {
  if (!candidate.startsWith('S')) {
    return { valid: false, reason: "Key does not begin with 'S'" };
  }

  try {
    Keypair.fromSecret(candidate);
    return { valid: true };
  } catch {
    return { valid: false, reason: 'Key failed Stellar SDK validation (invalid format or checksum)' };
  }
}
