export type XdrWorkerMessageType = 'DECODE_XDR' | 'BATCH_DECODE';

export interface DecodeXdrPayload {
  id: string;
  xdr: string;
}

export interface BatchDecodePayload {
  batchId: string;
  items: DecodeXdrPayload[];
}

export interface InboundMessage {
  type: XdrWorkerMessageType;
  payload: DecodeXdrPayload | BatchDecodePayload;
}

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

export interface XdrDecodedMessage {
  type: 'DECODED_XDR';
  payload: DecodedResult;
}

export interface XdrErrorMessage {
  type: 'XDR_ERROR';
  payload: {
    id: string;
    error: string;
  };
}

export type XdrWorkerOutboundMessage = XdrDecodedMessage | XdrErrorMessage;

export interface XdrWorkerMessage {
  type: XdrWorkerMessageType;
  payload: XdrWorkerPayload;
}

export interface XdrWorkerPayload {
  id?: string;
  xdr: string;
}
