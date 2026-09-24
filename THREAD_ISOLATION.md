# Thread Isolation: Heavy XDR Payload Parsing (#314)

## Overview

This implementation offloads heavy XDR (External Data Representation) payload parsing and transaction data extraction from the browser's main thread to a dedicated Web Worker. This prevents layout frame blocking during audit dashboard operations and ensures smooth 60fps rendering even when processing large batches of Soroban transaction XDR streams.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Main UI Thread                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  React Component (page.tsx)                             │    │
│  │  - Renders log table with virtual scrolling             │    │
│  │  - Maintains filtered results state                     │    │
│  │  - Handles search & filter interactions                 │    │
│  └───────────────────┬─────────────────────────────────────┘    │
│                      │                                            │
│  ┌───────────────────┴────────────────────────────────────────┐  │
│  │  useXdrWorker Hook                                         │  │
│  │  - Message-passing API (postMessage/onMessage)           │  │
│  │  - Batch decode coordination                             │  │
│  │  - Error handling & timeouts                             │  │
│  │  - State management (decoding, error, clearError)        │  │
│  └───────────────────┬────────────────────────────────────────┘  │
│                      │                                            │
│         ┌────────────┴──────────────┐                             │
│         │  Message Passing Queue    │                             │
│         │  (non-blocking)           │                             │
│         └────────────┬──────────────┘                             │
│                      │                                            │
└──────────────────────┼─────────────────────────────────────────┘
                       │
         ┌─────────────┴──────────────┐
         │  Browser Event Loop        │
         │  (serializes messages)     │
         └─────────────┬──────────────┘
                       │
┌──────────────────────┼─────────────────────────────────────────┐
│                      ▼                                          │
│         ┌────────────────────────────┐                          │
│         │  Dedicated Worker Thread    │                          │
│         │  (Independent Event Loop)   │                          │
│         └───────────┬────────────────┘                          │
│                     │                                            │
│         ┌───────────┴────────────────┐                          │
│         │  xdr-worker.ts             │                          │
│         │  - Base64 decoding (atob)  │                          │
│         │  - XDR binary reconstruction│                          │
│         │  - Envelope type detection │                          │
│         │  - Hex string generation   │                          │
│         │  - Parallel item processing│                          │
│         └───────────┬────────────────┘                          │
│                     │                                            │
│         ┌───────────┴────────────────┐                          │
│         │  Message Passing Result    │                          │
│         │  (non-blocking)            │                          │
│         └───────────┬────────────────┘                          │
└──────────────────────┼────────────────────────────────────────┘
                       │
         ┌─────────────┴──────────────┐
         │  Browser Event Loop        │
         │  (serializes messages)     │
         └─────────────┬──────────────┘
                       │
┌──────────────────────┼─────────────────────────────────────────┐
│                      ▼                                          │
│  Main Thread Receives Result                                    │
│  - Updates component state                                      │
│  - Re-renders with decoded data                                 │
│  - No layout blocking or frame drops                            │
└──────────────────────────────────────────────────────────────────┘
```

## Key Files

### 1. **xdr-worker.ts**

- Dedicated Web Worker running on background thread
- Handles XDR base64 decoding and binary reconstruction
- Supports single decode (DECODE_XDR) and batch operations (BATCH_DECODE)
- Returns detailed parsed XDR fields including envelope type and hex representations
- Never blocks the main UI thread

### 2. **useXdrWorker.ts**

- React hook that abstracts worker lifecycle management
- Provides `batchDecode()` function with Promise-based API
- Implements timeout safety (default 30 seconds)
- Error handling with `error` state and `clearError()` function
- Automatic worker cleanup on component unmount
- Message routing for BATCH_RESULT, DECODED_XDR, and XDR_ERROR

### 3. **worker-types.ts**

- TypeScript interfaces for all message types
- `DecodeXdrPayload`: Single item to decode
- `BatchDecodePayload`: Multiple items batch
- `XdrFields`: Parsed result structure
- `BatchDecodeResult`: Result item type
- `XdrWorkerOutboundMessage`: Union of all response types

### 4. **page.tsx** (Integration Point)

- Uses `useXdrWorker()` hook for decoding
- Filters log entries starting with "XDR: " prefix
- Calls `batchDecode('initial-batch', xdrItems)` on mount
- Updates component state with decoded data (no main-thread blocking)
- Displays decoded results in virtualized log table

## Message Protocol

### Inbound (Main Thread → Worker)

#### DECODE_XDR (Single Item)

```typescript
{
  type: 'DECODE_XDR',
  payload: {
    id: 'log-101',
    xdr: 'AAAAAEAAAAAEAAAAC...' // base64-encoded XDR
  }
}
```

#### BATCH_DECODE (Multiple Items)

```typescript
{
  type: 'BATCH_DECODE',
  payload: {
    batchId: 'initial-batch',
    items: [
      { id: 'log-101', xdr: 'AAAAAEAAAAAEAAAAC...' },
      { id: 'log-102', xdr: 'BBBBBEEEEEEFFFFF...' },
      // ... more items
    ]
  }
}
```

### Outbound (Worker → Main Thread)

#### DECODED_XDR (Success - Single)

```typescript
{
  type: 'DECODED_XDR',
  payload: {
    id: 'log-101',
    status: 'SUCCESS',
    decoded_payload: {
      byteLength: 128,
      envelopeType: 2,
      envelopeTypeLabel: 'ENVELOPE_TYPE_TX',
      headerHex: 'aabbccdd...',
      rawHex: 'aabbccdd...',
      decodedAt: '2026-04-28T12:40:01.000Z'
    }
  }
}
```

#### BATCH_RESULT (Success - Batch)

```typescript
{
  type: 'BATCH_RESULT',
  payload: {
    batchId: 'initial-batch',
    results: [
      { id: 'log-101', status: 'SUCCESS', decoded_payload: { ... } },
      { id: 'log-102', status: 'SUCCESS', decoded_payload: { ... } },
      { id: 'log-103', status: 'ERROR', error: 'Invalid base64' }
    ]
  }
}
```

#### XDR_ERROR (Failure)

```typescript
{
  type: 'XDR_ERROR',
  payload: {
    id: 'log-101',
    error: 'base64 decode failed — payload contains invalid characters'
  }
}
```

## Usage

### Basic Usage

```typescript
import { useXdrWorker } from '@/app/logs/useXdrWorker';

export default function AuditDashboard() {
  const { batchDecode, decoding, error, clearError } = useXdrWorker();

  // Decode XDR payloads
  batchDecode('batch-1', [
    { id: '1', xdr: 'AAAAAEAAAAAEAAAAC...' },
    { id: '2', xdr: 'BBBBBEEEEEEFFFFF...' }
  ]).then(results => {
    // Handle results on main thread
    // No blocking occurred during parsing!
  }).catch(err => {
    console.error('XDR decode failed:', err);
  });

  return (
    <>
      {decoding && <div>Decoding XDR payloads...</div>}
      {error && <div>Error: {error}</div>}
    </>
  );
}
```

### With Custom Timeout

```typescript
// Use 60-second timeout for large batches
await batchDecode("large-batch", items, 60000);
```

## Performance Benefits

1. **Main Thread Unblocked**: XDR parsing happens entirely on worker thread
2. **Smooth Rendering**: React components render at 60fps without stutters
3. **Responsive UI**: Search, filter, and scroll interactions feel instant
4. **Parallel Processing**: Multiple XDR payloads decoded simultaneously
5. **Scalable**: Handles arbitrarily large log batches without frame drops

## Stellar XDR Specification

### Envelope Types

The worker extracts the 4-byte big-endian envelope type discriminant from the decoded binary:

| Type | Value                 | Label                               | Description                |
| ---- | --------------------- | ----------------------------------- | -------------------------- |
| 0    | TX_V0                 | ENVELOPE_TYPE_TX_V0                 | Legacy v0 transaction      |
| 1    | SCP                   | ENVELOPE_TYPE_SCP                   | Stellar Consensus Protocol |
| 2    | TX                    | ENVELOPE_TYPE_TX                    | Standard transaction       |
| 3    | AUTH                  | ENVELOPE_TYPE_AUTH                  | Authentication             |
| 4    | SCPVALUE              | ENVELOPE_TYPE_SCPVALUE              | SCP value                  |
| 5    | TX_FEE_BUMP           | ENVELOPE_TYPE_TX_FEE_BUMP           | Fee bump transaction       |
| 6    | OP_ID                 | ENVELOPE_TYPE_OP_ID                 | Operation ID               |
| 7    | POOL_REVOKE_OP_ID     | ENVELOPE_TYPE_POOL_REVOKE_OP_ID     | Pool revoke                |
| 8    | CONTRACT_ID           | ENVELOPE_TYPE_CONTRACT_ID           | Soroban contract           |
| 9    | SOROBAN_AUTHORIZATION | ENVELOPE_TYPE_SOROBAN_AUTHORIZATION | Soroban auth               |

### Base64 Handling

- Handles optional PEM-style headers/footers
- Strips whitespace (newlines, spaces, tabs)
- Compatible with RFC 4648 standard alphabet
- Robust error reporting for malformed input

## Error Handling

The implementation includes comprehensive error handling:

1. **Worker Not Initialized**: Returns error if worker fails to instantiate
2. **Invalid Base64**: Caught and wrapped with descriptive message
3. **XDR Buffer Too Short**: Rejects if buffer < 4 bytes (can't read envelope type)
4. **Timeout Protection**: Automatically rejects after 30s (configurable)
5. **Message Send Failure**: Catches postMessage errors

## Future Enhancements

- [ ] Support for structured XDR parsing (full transaction details)
- [ ] Caching decoded results to avoid re-parsing identical payloads
- [ ] Progress callbacks for UI progress indicators
- [ ] Worker pool for truly parallel multi-core XDR decoding
- [ ] Streaming API for real-time log ingestion
- [ ] Integration with @stellar/stellar-sdk for full XDR deserialization

## References

- [Stellar XDR Specification](https://developers.stellar.org/docs/learn/building-blocks/transactions)
- [Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [RFC 4648: Base64 Data Encoding](https://tools.ietf.org/html/rfc4648)
- [Soroban Documentation](https://soroban.stellar.org/)
- [Next.js Web Worker Support](https://nextjs.org/docs/app/building-your-application/optimizing/package-bundling#webpack-loaders)
