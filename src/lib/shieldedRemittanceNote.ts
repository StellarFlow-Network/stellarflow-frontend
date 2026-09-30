const NOTE_VERSION = "sfzk1";
const COMMITMENT_DOMAIN = "stellarflow-shielded-remittance-v1";
const AMOUNT_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,7})?$/;
const HEX_32_BYTES_PATTERN = /^[0-9a-f]{64}$/i;

export interface ShieldedRemittanceNote {
  version: 1;
  asset: "XLM";
  amount: string;
  secret: string;
  commitment: string;
  note: string;
  createdAt: string;
}

export type ShieldedNoteValidation =
  | { valid: true; credentials: ShieldedRemittanceNote }
  | { valid: false; error: string };

function isPositiveStellarAmount(amount: string): boolean {
  if (!AMOUNT_PATTERN.test(amount)) return false;

  const [whole, fraction = ""] = amount.split(".");
  const stroops = BigInt(whole) * 10_000_000n + BigInt(fraction.padEnd(7, "0"));
  return stroops > 0n;
}

async function calculateCommitment(amount: string, secret: string): Promise<string> {
  const payload = new TextEncoder().encode(`${COMMITMENT_DOMAIN}|XLM|${amount}|${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createShieldedRemittanceNote(
  amount: string,
): Promise<ShieldedRemittanceNote> {
  if (!isPositiveStellarAmount(amount)) {
    throw new Error("Enter an XLM amount greater than zero with up to 7 decimal places.");
  }
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error("Secure browser cryptography is unavailable. Open this page in a secure context.");
  }

  const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const commitment = await calculateCommitment(amount, secret);
  const note = `${NOTE_VERSION}:${amount}:${secret}:${commitment}`;

  return {
    version: 1,
    asset: "XLM",
    amount,
    secret,
    commitment,
    note,
    createdAt: new Date().toISOString(),
  };
}

export async function validateShieldedRemittanceNote(
  rawNote: string,
): Promise<ShieldedNoteValidation> {
  const parts = rawNote.trim().split(":");
  if (parts.length !== 4 || parts[0] !== NOTE_VERSION) {
    return { valid: false, error: "Note format not recognized. Paste the complete StellarFlow note." };
  }

  const [, amount, secret, suppliedCommitment] = parts;
  if (!isPositiveStellarAmount(amount)) {
    return { valid: false, error: "The note contains an invalid XLM amount." };
  }
  if (!HEX_32_BYTES_PATTERN.test(secret) || !HEX_32_BYTES_PATTERN.test(suppliedCommitment)) {
    return { valid: false, error: "The note is incomplete or has been altered." };
  }
  if (!globalThis.crypto?.subtle) {
    return { valid: false, error: "Secure browser cryptography is unavailable." };
  }

  let commitment: string;
  try {
    commitment = await calculateCommitment(amount, secret.toLowerCase());
  } catch {
    return { valid: false, error: "The note could not be checked with browser cryptography." };
  }
  if (commitment !== suppliedCommitment.toLowerCase()) {
    return { valid: false, error: "Commitment check failed. This note may be damaged or altered." };
  }

  return {
    valid: true,
    credentials: {
      version: 1,
      asset: "XLM",
      amount,
      secret: secret.toLowerCase(),
      commitment,
      note: `${NOTE_VERSION}:${amount}:${secret.toLowerCase()}:${commitment}`,
      createdAt: "",
    },
  };
}

export interface ZKWithdrawalProofPayload {
  proof: string;
  nullifierHash: string;
  merkleRoot: string;
  recipient: string;
  amount: string;
}

export type ZKWithdrawalProofValidation =
  | { valid: true; proof: ZKWithdrawalProofPayload; rootValidation: import("./merkleRootBuffer").ZKProofRootValidation }
  | { valid: false; error: string; rootValidation?: import("./merkleRootBuffer").ZKProofRootValidation };

export function validateZKProofWithRootHistory(
  payload: ZKWithdrawalProofPayload,
  buffer: import("./merkleRootBuffer").MerkleRootHistoryBuffer,
): ZKWithdrawalProofValidation {
  if (!payload || typeof payload !== "object") {
    return { valid: false, error: "Invalid ZK withdrawal proof payload." };
  }
  if (!payload.proof || !payload.nullifierHash || !payload.merkleRoot) {
    return { valid: false, error: "Missing required ZK proof parameters (proof, nullifierHash, merkleRoot)." };
  }

  const rootValidation = buffer.validateProofRoot(payload.merkleRoot);
  if (!rootValidation.valid) {
    return {
      valid: false,
      error: rootValidation.error || "Merkle root is not present in active history buffer.",
      rootValidation,
    };
  }

  return {
    valid: true,
    proof: payload,
    rootValidation,
  };
}
/** Backwards-compatible name for root-history validation. */
export const validateWithdrawalProofAgainstRootBuffer = validateZKProofWithRootHistory;
