# Subresource Integrity (SRI)

This document describes how Subresource Integrity (SRI) is enforced in the StellarFlow project for external scripts and fonts.

## What is SRI?
Subresource Integrity (SRI) is a security feature that enables browsers to verify that resources they fetch (for example, from a CDN) are delivered without unexpected manipulation. It works by allowing you to provide a cryptographic hash that a fetched resource must match.

## Updating Asset Hashes

If an external asset (like the polyfill loader or a font stylesheet) is updated or changed, you must update the SRI hash in the corresponding component (e.g. `src/app/layout.tsx`).

### How to generate a new hash:

You can generate a SHA-384 hash using `openssl` or PowerShell:

**Using OpenSSL (Git Bash, Linux, macOS):**
```bash
curl -L -o script.js "https://example.com/script.js"
openssl dgst -sha384 -binary script.js | openssl base64 -A
```

**Using Node.js:**
```javascript
const crypto = require('crypto');
const fs = require('fs');

const fileBuffer = fs.readFileSync('script.js');
const hashSum = crypto.createHash('sha384');
hashSum.update(fileBuffer);

console.log('sha384-' + hashSum.digest('base64'));
```

### Apply the new hash:

1. Locate the `<Script>` or `<link>` tag loading the asset.
2. Update the `integrity` attribute with the newly generated `sha384-...` string.
3. Ensure that `crossOrigin="anonymous"` is set on the tag.

## Build-time Enforcement

We enforce SRI validation during the Next.js build pipeline to prevent accidentally omitting integrity attributes for external assets.
The script located at `scripts/check-sri.js` runs automatically during `npm run build` and will fail the build if it detects any external scripts without valid cryptographic integrity hashes.
