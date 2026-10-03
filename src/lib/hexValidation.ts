const HEX_BODY_PATTERN = /^(?:0x)?([0-9a-fA-F]*)$/;

export interface HexValidationResult {
  valid: boolean;
  normalized: string;
  error: string | null;
}

/**
 * Validates a secret pre-image hex string for HTLC claim submission.
 * Accepts optional 0x prefix; requires even-length hex digits.
 */
export function validatePreimageHex(value: string): HexValidationResult {
  const trimmed = value.trim();

  if (!trimmed) {
    return { valid: false, normalized: '', error: 'Pre-image is required.' };
  }

  const match = HEX_BODY_PATTERN.exec(trimmed);
  if (!match) {
    return {
      valid: false,
      normalized: '',
      error: 'Pre-image must be a valid hex string (0-9, a-f).',
    };
  }

  const normalized = match[1].toLowerCase();

  if (normalized.length === 0) {
    return { valid: false, normalized: '', error: 'Pre-image is required.' };
  }

  if (normalized.length % 2 !== 0) {
    return {
      valid: false,
      normalized: '',
      error: 'Hex length must be even (complete bytes).',
    };
  }

  return { valid: true, normalized, error: null };
}

export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (days > 0) {
    return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  }

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
