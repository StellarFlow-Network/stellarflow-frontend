"use client";

// src/app/workers/xdrWorker.ts
// Minimal Web Worker to parse base64‑encoded Soroban XDR logs.
// In a real implementation you would import the @stellar/stellar‑sdk XDR parser.
// Here we simply decode base64 and wrap it in an object for demonstration.

self.addEventListener('message', (event: MessageEvent) => {
  const { id, payload } = event.data;
  try {
    // Decode base64 string – placeholder for real XDR parsing.
    const decoded = atob(payload);
    // Simulate parsed structure.
    const result = { id, parsed: decoded };
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: (error as Error).message });
  }
});
