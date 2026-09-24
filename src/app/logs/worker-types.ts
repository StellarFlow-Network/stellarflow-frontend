// ─── Worker Message Types ────────────────────────────────────────────────────

export type XdrWorkerInboundType = 'DECODE_XDR' | 'BATCH_DECODE';
export type XdrWorkerOutboundType = 'DECODED_XDR' | 'BATCH_RESULT' | 'XDR_ERROR';

// ─── Payloads (Inbound) ──────────────────────────────────────────────────────

export interface DecodeXdrPayload {
  id: string;
  xdr: string;
}

export interface BatchDecodePayload {
  batchId: string;
  items: DecodeXdrPayload[];
}

export type InboundPayload = DecodeXdrPayload | BatchDecodePayload;

export interface InboundMessage {
  type: XdrWorkerInboundType;
  payload: InboundPayload;
}

// ─── Parsed XDR Fields ──────────────────────────────────────────────────────

export interface XdrFields {
  byteLength: number;
  envelopeType: number;
  envelopeTypeLabel: string;
  headerHex: string;
  rawHex: string;
  decodedAt: string;
}

export interface DecodedResult {
  id: string;
  status: 'SUCCESS' | 'ERROR';
  decoded_payload?: XdrFields;
  error?: string;
}

export interface BatchDecodeResult {
  id: string;
  status: 'SUCCESS' | 'ERROR';
  decoded_payload?: XdrFields;
  error?: string;
}

// ─── Outbound Message Types ──────────────────────────────────────────────────

export interface XdrDecodedMessage {
  type: 'DECODED_XDR';
  payload: DecodedResult;
}

export interface BatchResultMessage {
  type: 'BATCH_RESULT';
  payload: {
    batchId: string;
    results: DecodedResult[];
  };
}

export interface XdrErrorMessage {
  type: 'XDR_ERROR';
  payload: {
    id: string;
    error: string;
  };
}

export type XdrWorkerOutboundMessage = XdrDecodedMessage | BatchResultMessage | XdrErrorMessage;

// ─── Deprecated/Compatibility Types ─────────────────────────────────────────

export interface XdrWorkerMessage {
  type: XdrWorkerInboundType;
  payload: XdrWorkerPayload;
}

export interface XdrWorkerPayload {
  id?: string;
  xdr: string;
}
