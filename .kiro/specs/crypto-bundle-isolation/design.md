# Design Document — Crypto Bundle Isolation

## Overview

This document describes the technical design for isolating heavy cryptographic keypair utilities from the main dashboard bundle in `stellarflow-frontend`. The solution introduces three coordinated pieces:

1. **`src/lib/crypto/keypairUtils.ts`** — the single authoritative Crypto_Wrapper that holds all static imports of cryptographic libraries.
2. **`src/app/crypto-tools/page.tsx`** — the Lazy_Crypto_Page, a standalone Next.js App Router page that loads the wrapper on demand.
3. **Extensions to `scripts/check-bundle-size.js`** — Exclusion_Assertion logic that scans the built Dashboard_Bundle for forbidden crypto identifiers and reports violations in `.bundle-report.json`.

No changes are made to `src/app/logs/xdr-worker.ts`, `src/app/page.tsx`, or `src/app/layout.tsx`.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Dashboard_Bundle  (page.tsx + layout.tsx + shared chunks)      │
│                                                                 │
│  ✅ Nav, FloatingSidebar, SystemStats, ModularStatsCard, …      │
│  ✅ XDR_Worker  (independent Web Worker thread)                 │
│  ✗  NO stellar-sdk / tweetnacl / @noble/ed25519                 │
└─────────────────────────────────────────────────────────────────┘
          │  Next.js Router navigates to /crypto-tools
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Lazy_Crypto_Page chunk  (src/app/crypto-tools/page.tsx)        │
│                                                                 │
│  next/dynamic(() => import('../../../lib/crypto/keypairUtils')) │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Crypto_Wrapper  (src/lib/crypto/keypairUtils.ts)        │  │
│  │  — static import stellar-sdk (Keypair)                   │  │
│  │  — static import tweetnacl (sign / verify)               │  │
│  │  — exports: generateKeypair, signPayload, verifySignature│  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Bundle_Checker  (scripts/check-bundle-size.js)                 │
│                                                                 │
│  Post-build scan of .next/static/chunks/                        │
│  Exclusion_Assertion: grep main-* chunks for forbidden IDs      │
│  Reports cryptoExclusionViolations[] in .bundle-report.json     │
│  --strict: exit 1 on any violation                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Design

### 1. Crypto_Wrapper — `src/lib/crypto/keypairUtils.ts`

This is the **only** file in `src/` that may contain a static `import` of a cryptographic keypair library.

```typescript
// src/lib/crypto/keypairUtils.ts

import { Keypair } from 'stellar-sdk';
import nacl from 'tweetnacl';

export interface GeneratedKeypair {
  publicKey: string;
  secretKey: string;
}

export interface SignResult {
  signature: string; // hex-encoded
  publicKey: string;
}

export interface VerifyResult {
  valid: boolean;
}

/**
 * Generates a random Stellar keypair.
 * Returns synchronously — Keypair.random() is CPU-bound, not async.
 */
export function generateKeypair(): GeneratedKeypair {
  const kp = Keypair.random();
  return {
    publicKey: kp.publicKey(),
    secretKey: kp.secret(),
  };
}

/**
 * Derives a keypair from an existing Stellar secret key (S…).
 * Throws a descriptive error if the secret is malformed.
 */
export function keypairFromSecret(secret: string): GeneratedKeypair {
  try {
    const kp = Keypair.fromSecret(secret);
    return { publicKey: kp.publicKey(), secretKey: kp.secret() };
  } catch (err) {
    throw new Error(
      `stellar-sdk: Keypair.fromSecret failed — ${(err as Error).message}`
    );
  }
}

/**
 * Signs an arbitrary UTF-8 message with a Stellar secret key.
 * Uses tweetnacl Ed25519 under the hood.
 */
export function signPayload(message: string, secret: string): SignResult {
  const kp = Keypair.fromSecret(secret);
  const msgBytes = new TextEncoder().encode(message);
  const sigBytes = nacl.sign.detached(msgBytes, kp.rawSecretKey());
  return {
    signature: Buffer.from(sigBytes).toString('hex'),
    publicKey: kp.publicKey(),
  };
}

/**
 * Verifies an Ed25519 signature produced by signPayload.
 * publicKey must be a Stellar G… address.
 */
export function verifySignature(
  message: string,
  signatureHex: string,
  publicKey: string
): VerifyResult {
  try {
    const kp = Keypair.fromPublicKey(publicKey);
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = Buffer.from(signatureHex, 'hex');
    const valid = nacl.sign.detached.verify(
      msgBytes,
      sigBytes,
      kp.rawPublicKey()
    );
    return { valid };
  } catch {
    return { valid: false };
  }
}
```

**Key constraints:**
- No top-level side effects (no key generation at module evaluation time).
- All exports are pure functions.
- Error messages always name the failing library (`stellar-sdk`, `tweetnacl`).

---

### 2. Lazy_Crypto_Page — `src/app/crypto-tools/page.tsx`

A Next.js App Router page at `/crypto-tools`. It uses `next/dynamic` with `ssr: false` to defer the Crypto_Wrapper chunk until the page is rendered in the browser.

```typescript
// src/app/crypto-tools/page.tsx
'use client';

import dynamic from 'next/dynamic';

// Dynamically import the heavy crypto UI component.
// ssr: false ensures the Crypto_Wrapper chunk is never included in SSR output
// or the Dashboard_Bundle's server-side dependency graph.
const CryptoToolsPanel = dynamic(
  () => import('../../components/crypto/CryptoToolsPanel'),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        aria-label="Loading cryptographic tools"
        className="flex items-center justify-center min-h-[200px] text-gray-400"
      >
        <span className="animate-pulse">Loading crypto tools…</span>
      </div>
    ),
  }
);

export default function CryptoToolsPage() {
  return (
    <main className="min-h-screen bg-[#020817] text-white px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Cryptographic Utilities</h1>
      <CryptoToolsPanel />
    </main>
  );
}
```

---

### 3. CryptoToolsPanel — `src/app/components/crypto/CryptoToolsPanel.tsx`

This client component is the actual consumer of the Crypto_Wrapper. It is only ever loaded via the `dynamic()` call above.

```typescript
// src/app/components/crypto/CryptoToolsPanel.tsx
'use client';

import { useState } from 'react';
import type { GeneratedKeypair, SignResult, VerifyResult } from '../../../lib/crypto/keypairUtils';

// Runtime dynamic import — NOT a static top-level import.
// This is the correct pattern for consuming the Crypto_Wrapper.
async function loadCrypto() {
  const mod = await import('../../../lib/crypto/keypairUtils');
  return mod;
}

export default function CryptoToolsPanel() {
  const [keypair, setKeypair] = useState<GeneratedKeypair | null>(null);
  const [signResult, setSignResult] = useState<SignResult | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [secret, setSecret] = useState('');
  const [sigHex, setSigHex] = useState('');
  const [pubKey, setPubKey] = useState('');

  async function handleGenerate() {
    setError(null);
    try {
      const { generateKeypair } = await loadCrypto();
      setKeypair(generateKeypair());
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSign() {
    setError(null);
    try {
      const { signPayload } = await loadCrypto();
      setSignResult(signPayload(message, secret));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleVerify() {
    setError(null);
    try {
      const { verifySignature } = await loadCrypto();
      setVerifyResult(verifySignature(message, sigHex, pubKey));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <div role="alert" className="text-red-400 border border-red-700 rounded p-3">
          {error}
        </div>
      )}

      {/* Keypair Generation UI */}
      <section aria-labelledby="keygen-heading">
        <h2 id="keygen-heading" className="text-lg font-medium mb-3">Keypair Generation</h2>
        <button onClick={handleGenerate} className="btn-primary">Generate Keypair</button>
        {keypair && (
          <dl className="mt-3 space-y-1 text-sm font-mono break-all">
            <dt className="text-gray-400">Public Key</dt>
            <dd>{keypair.publicKey}</dd>
            <dt className="text-gray-400 mt-2">Secret Key</dt>
            <dd>{keypair.secretKey}</dd>
          </dl>
        )}
      </section>

      {/* Signature Validation UI */}
      <section aria-labelledby="sign-heading">
        <h2 id="sign-heading" className="text-lg font-medium mb-3">Sign &amp; Verify</h2>
        <div className="space-y-2">
          <input value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Message to sign" className="input-field w-full" />
          <input value={secret} onChange={e => setSecret(e.target.value)}
            placeholder="Secret key (S…)" className="input-field w-full" type="password" />
          <button onClick={handleSign} className="btn-primary">Sign</button>
        </div>
        {signResult && (
          <p className="mt-2 text-sm font-mono break-all">Signature: {signResult.signature}</p>
        )}
        <div className="space-y-2 mt-4">
          <input value={sigHex} onChange={e => setSigHex(e.target.value)}
            placeholder="Signature (hex)" className="input-field w-full" />
          <input value={pubKey} onChange={e => setPubKey(e.target.value)}
            placeholder="Public key (G…)" className="input-field w-full" />
          <button onClick={handleVerify} className="btn-primary">Verify</button>
        </div>
        {verifyResult && (
          <p className={`mt-2 font-semibold ${verifyResult.valid ? 'text-green-400' : 'text-red-400'}`}>
            {verifyResult.valid ? '✓ Valid signature' : '✗ Invalid signature'}
          </p>
        )}
      </section>
    </div>
  );
}
```

---

## Bundle_Checker Extensions

### New fields in `.bundle-limits.json`

```json
{
  "maxMainBundle": 250,
  "maxPageBundle": 100,
  "maxTotalGzipped": 500,
  "maxIndividualGzipped": 150,
  "cryptoIsolation": true,
  "cryptoWrapperChunkWarningKb": 150,
  "forbiddenInMainBundle": [
    "stellar-sdk",
    "stellar_sdk",
    "tweetnacl",
    "@noble/ed25519",
    "noble/ed25519",
    "keypairUtils"
  ]
}
```

- `cryptoIsolation: true` — activates Exclusion_Assertion scanning.
- `forbiddenInMainBundle` — exhaustive list of identifiers that must not appear in main-* chunks.
- `cryptoWrapperChunkWarningKb` — threshold for the non-blocking warning on the lazy crypto chunk.

### Extended report schema (`.bundle-report.json`)

```jsonc
{
  "timestamp": "…",
  "limits": { /* .bundle-limits.json contents */ },
  "bundles": [ /* existing per-chunk entries */ ],
  "totalGzipped": 0,
  "violations": [ /* existing size violations */ ],
  "passed": true,

  // NEW fields
  "cryptoIsolation": {
    "enabled": true,
    "cryptoExclusionViolations": [
      // populated when a forbidden identifier is found in a main-* chunk
      {
        "chunk": "main-abc123.js",
        "identifier": "stellar-sdk",
        "message": "Forbidden identifier 'stellar-sdk' found in main chunk 'main-abc123.js'"
      }
    ],
    "cryptoWrapperChunk": {
      "name": "crypto-keypairUtils-xyz.js",  // null if not found
      "gzipped": 0                            // KB
    },
    "verified": true   // true when cryptoExclusionViolations is empty
  }
}
```

### Logic additions to `scripts/check-bundle-size.js`

The following logic is added after the existing bundle scan loop:

```javascript
// ── Crypto Exclusion Assertion ────────────────────────────────────────────────
function runCryptoExclusionAssertion(report, limits, jsDir, files) {
  if (!limits.cryptoIsolation) return;

  const forbidden = limits.forbiddenInMainBundle || [];
  const cryptoExclusionViolations = [];
  let cryptoWrapperChunk = { name: null, gzipped: 0 };

  files.forEach(file => {
    const filePath = path.join(jsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Identify the crypto wrapper lazy chunk by filename pattern
    if (file.includes('crypto') || file.includes('keypairUtils')) {
      const gzipped = parseFloat(getGzippedSizeKb(filePath));
      cryptoWrapperChunk = { name: file, gzipped };

      // Warn (non-blocking) if the lazy chunk is too large
      if (gzipped > (limits.cryptoWrapperChunkWarningKb || 150)) {
        console.warn(
          `⚠️  Crypto wrapper chunk '${file}' is ${gzipped}KB gzipped ` +
          `(>${limits.cryptoWrapperChunkWarningKb}KB). Consider further code splitting.`
        );
      }
    }

    // Only scan main-* chunks for forbidden identifiers
    if (!file.startsWith('main')) return;

    forbidden.forEach(id => {
      if (content.includes(id)) {
        const msg = `Forbidden identifier '${id}' found in main chunk '${file}'`;
        cryptoExclusionViolations.push({ chunk: file, identifier: id, message: msg });
        report.violations.push(msg);
        report.passed = false;
      }
    });
  });

  const verified = cryptoExclusionViolations.length === 0;

  report.cryptoIsolation = {
    enabled: true,
    cryptoExclusionViolations,
    cryptoWrapperChunk,
    verified,
  };

  if (verified) {
    console.log('🔐 Crypto isolation verified — no forbidden identifiers in main bundle.');
  } else {
    console.error(`❌ Crypto isolation FAILED — ${cryptoExclusionViolations.length} violation(s) found.`);
    cryptoExclusionViolations.forEach(v => console.error(`   • ${v.message}`));
  }
}
```

This function is called inside `analyzeBundles()` after the existing per-file loop, passing the same `files` array and `jsDir`.

---

## GitHub Actions Workflow Changes

The existing workflow already runs `npm run build:strict` which invokes `node scripts/check-bundle-size.js --strict`. No structural changes are needed. The Exclusion_Assertion violations are added to `report.violations[]`, so the existing `--strict` exit-1 path already covers them.

The PR comment step is extended to surface crypto isolation status:

```yaml
# In the "Comment PR with bundle report" step, add after the violations block:
if (report.cryptoIsolation) {
  const ci = report.cryptoIsolation;
  comment += ci.verified
    ? '\n🔐 **Crypto isolation: ✅ verified**\n'
    : '\n🔐 **Crypto isolation: ❌ FAILED**\n';
  if (ci.cryptoWrapperChunk.name) {
    comment += `- Crypto wrapper chunk: \`${ci.cryptoWrapperChunk.name}\` — ${ci.cryptoWrapperChunk.gzipped}KB gzipped\n`;
  }
  if (ci.cryptoExclusionViolations.length > 0) {
    comment += '\n### 🔐 Crypto Isolation Violations:\n';
    ci.cryptoExclusionViolations.forEach(v => {
      comment += `- ${v.message}\n`;
    });
  }
}
```

---

## XDR Worker Non-Interference

`src/app/logs/xdr-worker.ts` is a self-contained Web Worker that performs base64 XDR decoding using only browser-native APIs (`atob`, `Uint8Array`, `TextEncoder`). It has no dependency on `stellar-sdk`, `tweetnacl`, or any cryptographic keypair library.

The Crypto_Wrapper (`src/lib/crypto/keypairUtils.ts`) has no import of or dependency on the XDR worker. The two modules are completely orthogonal:

| Module | Imports crypto libs | Imports XDR worker |
|---|---|---|
| `src/lib/crypto/keypairUtils.ts` | ✅ yes (stellar-sdk, tweetnacl) | ✗ no |
| `src/app/logs/xdr-worker.ts` | ✗ no | — |

No modifications to `xdr-worker.ts` are required or permitted.

---

## File Changeset Summary

| File | Action | Purpose |
|---|---|---|
| `src/lib/crypto/keypairUtils.ts` | **Create** | Crypto_Wrapper — sole static importer of crypto libs |
| `src/app/crypto-tools/page.tsx` | **Create** | Lazy_Crypto_Page at `/crypto-tools` |
| `src/app/components/crypto/CryptoToolsPanel.tsx` | **Create** | UI panel loaded via `next/dynamic` |
| `.bundle-limits.json` | **Modify** | Add `cryptoIsolation`, `forbiddenInMainBundle`, `cryptoWrapperChunkWarningKb` |
| `scripts/check-bundle-size.js` | **Modify** | Add `runCryptoExclusionAssertion()` and crypto chunk reporting |
| `.github/workflows/bundle-check.yml` | **Modify** | Extend PR comment to surface crypto isolation status |
| `docs/CRYPTO_BUNDLE_ISOLATION.md` | **Create** | Developer documentation |
| `src/app/logs/xdr-worker.ts` | **No change** | Must remain unmodified |
| `src/app/page.tsx` | **No change** | Dashboard_Bundle entry point — no crypto imports |
| `src/app/layout.tsx` | **No change** | Root layout — no crypto imports |

---

## Dependency Requirements

The Crypto_Wrapper requires `stellar-sdk` and `tweetnacl`. Neither is currently in `package.json`. They must be added as production dependencies with pinned versions:

```json
"stellar-sdk": "12.3.0",
"tweetnacl": "1.0.3"
```

These packages are only reachable via the lazy chunk — they will not appear in the Dashboard_Bundle because no static import path from `page.tsx` or `layout.tsx` reaches `keypairUtils.ts`.
