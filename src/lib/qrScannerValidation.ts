export interface ScannedStellarPayment {
  destination: string;
  amount?: string;
  assetCode?: string;
  assetIssuer?: string;
  memo?: string;
  memoType?: string;
  raw: string;
}

export const STELLAR_PUBKEY_REGEX = /^G[A-Z2-7]{55}$/;
export const STELLAR_MUXED_REGEX = /^M[A-Z2-7]{55,75}$/;
export const STELLAR_FEDERATION_REGEX = /^[a-zA-Z0-9._-]+(\*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/;
export const SEP07_URI_REGEX = /^web\+stellar:pay\?(.+)$/i;

/**
 * Validate and parse QR payload into a structured Stellar payment or address object.
 */
export function parseAndValidateStellarQR(rawText: string): {
  valid: boolean;
  data?: ScannedStellarPayment;
  error?: string;
} {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { valid: false, error: "Empty QR code detected." };
  }

  // 1. Check for SEP-07 URI: web+stellar:pay?...
  const sep07Match = trimmed.match(SEP07_URI_REGEX);
  if (sep07Match) {
    try {
      const params = new URLSearchParams(sep07Match[1]);
      const destination = params.get("destination") || "";
      if (
        !STELLAR_PUBKEY_REGEX.test(destination) &&
        !STELLAR_MUXED_REGEX.test(destination) &&
        !STELLAR_FEDERATION_REGEX.test(destination)
      ) {
        return {
          valid: false,
          error: "SEP-07 URI contains an invalid Stellar destination address.",
        };
      }
      return {
        valid: true,
        data: {
          destination,
          amount: params.get("amount") || undefined,
          assetCode: params.get("asset_code") || undefined,
          assetIssuer: params.get("asset_issuer") || undefined,
          memo: params.get("memo") || undefined,
          memoType: params.get("memo_type") || undefined,
          raw: trimmed,
        },
      };
    } catch {
      return { valid: false, error: "Malformed SEP-07 payment URI." };
    }
  }

  // 2. Standard Public Key G...
  if (STELLAR_PUBKEY_REGEX.test(trimmed)) {
    return {
      valid: true,
      data: { destination: trimmed, raw: trimmed },
    };
  }

  // 3. Muxed Account M...
  if (STELLAR_MUXED_REGEX.test(trimmed)) {
    return {
      valid: true,
      data: { destination: trimmed, raw: trimmed },
    };
  }

  // 4. Federation Address username*domain.com
  if (STELLAR_FEDERATION_REGEX.test(trimmed)) {
    return {
      valid: true,
      data: { destination: trimmed, raw: trimmed },
    };
  }

  return {
    valid: false,
    error: "Scanned QR does not contain a valid Stellar address (G...), Muxed key (M...), or SEP-07 URI.",
  };
}
