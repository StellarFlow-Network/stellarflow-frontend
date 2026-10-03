/**
 * xdrParser.worker.ts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THREAD ISOLATION: Heavy XDR Payload Parsing
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This dedicated Web Worker runs on an independent background thread, completely
 * isolated from the primary UI layout thread. All heavy XDR decoding and binary
 * reconstruction operations execute here, ensuring that audit dashboard frames
 * render smoothly without stutters or layout thrashing.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * Message Protocol (inbound from main thread)
 * ──────────────────────────────────────────────────────────────────────────────
 *
 *   DECODE_XDR
 *     { type: 'DECODE_XDR', payload: { id: string, xdr: string } }
 *     ⟹ Decode a single base64 XDR payload in isolation
 *
 *   BATCH_DECODE
 *     { type: 'BATCH_DECODE', payload: { batchId: string, items: [...] } }
 *     ⟹ Decode multiple XDR payloads without blocking main thread
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * Message Protocol (outbound to main thread)
 * ──────────────────────────────────────────────────────────────────────────────
 *
 *   DECODED_XDR (success for DECODE_XDR)
 *     { type: 'DECODED_XDR', payload: { id, status: 'SUCCESS', decoded_payload } }
 *
 *   BATCH_RESULT (success for BATCH_DECODE)
 *     { type: 'BATCH_RESULT', payload: { batchId, results: [...] } }
 *
 *   XDR_ERROR (failure)
 *     { type: 'XDR_ERROR', payload: { id, error: string } }
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * Stellar XDR Specification References
 * ──────────────────────────────────────────────────────────────────────────────
 *
 *   • TransactionEnvelope discriminant: stellar-xdr/core/xdr_types.go §4.2
 *   • Base64 encoding per RFC 4648 (standard alphabet, no padding required)
 *   • Envelope type mapping: https://developers.stellar.org/docs/learn/building-blocks/transactions
 */

// ─── Type definitions ────────────────────────────────────────────────────────

interface DecodeXdrPayload {
  id: string;
  xdr: string; // raw base64-encoded XDR string (may have whitespace / newlines)
}

interface BatchDecodePayload {
  batchId: string;
  items: DecodeXdrPayload[];
}

interface InboundMessage {
  type: 'DECODE_XDR' | 'BATCH_DECODE';
  payload: DecodeXdrPayload | BatchDecodePayload;
}

// Parsed fields we extract from the raw XDR binary buffer
interface XdrFields {
  /** Raw byte length of the decoded binary */
  byteLength: number;
  /** First 4 bytes as a big-endian uint32 — Stellar envelope type discriminant */
  envelopeType: number;
  /** Human-readable label for the envelope type discriminant */
  envelopeTypeLabel: string;
  /** Hex representation of the first 16 bytes (fingerprint / debug aid) */
  headerHex: string;
  /** Full binary as a hex string for downstream inspection */
  rawHex: string;
  /** ISO timestamp of when decoding was completed in the worker */
  decodedAt: string;
}

interface DecodedResult {
  id: string;
  status: 'SUCCESS' | 'ERROR';
  decoded_payload?: XdrFields;
  error?: string;
}

// ─── Stellar envelope type map ────────────────────────────────────────────────
// XDR discriminant values for TransactionEnvelope (stellar-xdr spec §4.2)
const ENVELOPE_TYPE_MAP: Record<number, string> = {
  0:  'ENVELOPE_TYPE_TX_V0',
  1:  'ENVELOPE_TYPE_SCP',
  2:  'ENVELOPE_TYPE_TX',
  3:  'ENVELOPE_TYPE_AUTH',
  4:  'ENVELOPE_TYPE_SCPVALUE',
  5:  'ENVELOPE_TYPE_TX_FEE_BUMP',
  6:  'ENVELOPE_TYPE_OP_ID',
  7:  'ENVELOPE_TYPE_POOL_REVOKE_OP_ID',
  8:  'ENVELOPE_TYPE_CONTRACT_ID',
  9:  'ENVELOPE_TYPE_SOROBAN_AUTHORIZATION',
};

// ─── Core decode logic ────────────────────────────────────────────────────────

/**
 * Strips optional PEM-style header/footer and all whitespace from a base64
 * string before passing it to atob, which is strict about characters.
 */
function sanitiseBase64(raw: string): string {
  return raw
    .replace(/-----[^-]+-----/g, '') // strip PEM headers if any
    .replace(/\s+/g, '');            // collapse newlines, spaces, tabs
}

/**
 * Decodes a single base64 XDR string into a structured `XdrFields` object.
 * Throws with a descriptive message on any failure so the caller can wrap it
 * in an XDR_ERROR envelope cleanly.
 */
function decodeXdrBuffer(base64: string): XdrFields {
  const sanitised = sanitiseBase64(base64);

  if (sanitised.length === 0) {
    throw new Error('XDR payload is empty after sanitisation');
  }

  // atob is available in all modern Worker scopes (spec §WorkerGlobalScope)
  let binaryString: string;
  try {
    binaryString = atob(sanitised);
  } catch {
    throw new Error(
      `base64 decode failed — payload contains invalid characters ` +
      `(length=${sanitised.length})`
    );
  }

  const byteLength = binaryString.length;
  if (byteLength < 4) {
    throw new Error(
      `XDR buffer too short to contain an envelope type (${byteLength} bytes)`
    );
  }

  // Build Uint8Array without TextEncoder (works in all Worker contexts)
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Read 4-byte big-endian envelope type discriminant (stellar-xdr §4.2)
  const envelopeType =
    (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  const envelopeTypeLabel =
    ENVELOPE_TYPE_MAP[envelopeType] ?? `UNKNOWN_TYPE(${envelopeType})`;

  // Build hex representations
  const toHex = (b: Uint8Array) =>
    Array.from(b)
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('');

  const headerHex = toHex(bytes.subarray(0, Math.min(16, byteLength)));
  const rawHex    = toHex(bytes);

  return {
    byteLength,
    envelopeType,
    envelopeTypeLabel,
    headerHex,
    rawHex,
    decodedAt: new Date().toISOString(),
  };
}

/**
 * Attempts to decode one item and returns a `DecodedResult` — never throws.
 */
function safeDecodeOne(item: DecodeXdrPayload): DecodedResult {
  try {
    const decoded_payload = decodeXdrBuffer(item.xdr);
    return { id: item.id, status: 'SUCCESS', decoded_payload };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { id: item.id, status: 'ERROR', error };
  }
}

// ─── Message handler ──────────────────────────────────────────────────────────

self.onmessage = (event: MessageEvent<InboundMessage>) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'DECODE_XDR': {
      const item = payload as DecodeXdrPayload;
      const result = safeDecodeOne(item);

      if (result.status === 'SUCCESS') {
        self.postMessage({ type: 'DECODED_XDR', payload: result });
      } else {
        self.postMessage({
          type: 'XDR_ERROR',
          payload: { id: item.id, error: result.error },
        });
      }
      break;
    }

    case 'BATCH_DECODE': {
      const { batchId, items } = payload as BatchDecodePayload;
      const results: DecodedResult[] = items.map(safeDecodeOne);

      self.postMessage({
        type: 'BATCH_RESULT',
        payload: { batchId, results },
      });
      break;
    }

    default:
      console.warn(`[xdr-worker] Unknown message type:`, type);
  }
};
