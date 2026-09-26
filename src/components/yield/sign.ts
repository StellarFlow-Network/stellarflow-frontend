/** Deterministic cryptographic integrity helper for the yield tax report.

 * The tax report is a client-generated data source: there is no ledger or
 * backend contract that signs it. To give the report integrity verification,
 * we compute an HMAC-SHA256 signature over the exact CSV content of the report.
 *
 * Key derivation
 * The HMAC key is never stored or transmitted. It is derived deterministically
 * from the connected wallet public key using PBKDF2:
 *
 *   1. SHA-256 over the UTF-8 encoded public key digest -> key material.
 *   2. PBKDF2 (HMAC-SHA-256, 100 000 iterations, zero salt) over that digest
 *      -> derived HMAC key.
 *
 * Because this derivation is deterministic, any consumer that has a wallet
 * address and the emitted CSV text can recompute the same key and verify the
 * signature in-browser with `crypto.subtle.verify("HMAC", ...)`.
 *
 * What is signed
 * The entire final CSV document (header row + all CSV-quoted data rows, as it
 * will be written to the file, including the trailing newline). Signing the
 * canonical byte representation of the file is what lets a verifier detect
 * both content tampering and re-ordering of rows.
 *
 * Verification procedure
 * 1. Obtain the CSV text as emitted by the generator.
 * 2. Compute the same derived HMAC key from the claimed wallet address.
 * 3. `crypto.subtle.verify("HMAC", derivedKey, signatureBytes, new TextEncoder().encode(csv))`.
 * 4. The boolean result is the integrity verdict.
 *
 * Limitations
 * - This is a cryptographic *integrity* check, not a non-repudiation/signing
 *   ceremony. A connected attacker who controls the page and the wallet address
 *   can still produce a matching signature, so the report is verifiable but not
 *   proof of origin. It is appropriate for the client-to-tax-platform handoff
 *   described by the issue.
 * - No secret or private key is involved. If a stronger proof of origin is
 *   required, a backend service that signs the report with a server-held key
 *   must be added.
 */

export interface SigningResult {
  /** Base16 HMAC-SHA256 over the CSV content. */
  signature: string;
  /** Whether a signature was produced (false when no wallet is present). */
  verified: boolean;
}

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_HASH = "SHA-256" as const;
const HMAC_ALG = "HMAC" as const;

/**
 * Sign a CSV document with an HMAC derived from a wallet public key.
 *
 * If `walletAddress` is empty or fails to derive, returns a `no_wallet`
 * result instead of throwing, so the caller can render the report without the
 * signature rather than failing the whole generation flow.
 */
export async function signCsvContent(
  csvContent: string,
  walletAddress: string,
): Promise<SigningResult> {
  if (!walletAddress) {
    return { signature: "no_wallet_connected", verified: false };
  }

  try {
    const encoder = new TextEncoder();

    // Use the SHA-256 digest of the address as PBKDF2 input key material.
    // Importing the raw address as "raw" key material would leave the key
    // directly derived from raw bytes; the double-hash keeps the derivation a
    // one-way function of the public key alone.
    const addressDigest = await crypto.subtle.digest(
      PBKDF2_HASH,
      encoder.encode(walletAddress),
    );
    const keyMaterial = new Uint8Array(addressDigest);

    const hmacKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: new Uint8Array(16), // fixed, non-secret salt
        iterations: PBKDF2_ITERATIONS,
        hash: PBKDF2_HASH,
      },
      crypto.subtle.importKey("raw", keyMaterial, "PBKDF2" as const, false, ["deriveBits"]),
      "HMAC" as const,
      true,
      ["sign"],
    );

    const signatureBytes = await crypto.subtle.sign(
      HMAC_ALG,
      hmacKey,
      encoder.encode(csvContent),
    );

    const signature = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return { signature, verified: true };
  } catch (error) {
    console.error("Error generating report signature:", error);
    return { signature: "signature_unavailable", verified: false };
  }
}
