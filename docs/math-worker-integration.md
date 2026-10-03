# Integration Notes

1. Replace the example formulas with the project's canonical concentrated-liquidity math.
2. Keep request and response payloads structured-clone compatible.
3. Use transferable `ArrayBuffer` or typed-array buffers for large numeric datasets when beneficial.
4. Add cancellation or request supersession for stale React renders.
5. Dispose the worker when the owning hook or component unmounts.
6. Add a timeout policy and fallback behavior for worker failures.
7. Validate numeric precision and rounding against existing math tests.
8. Do not assume that worker execution alone guarantees a 20 ms response; serialization and queueing also contribute to round-trip latency.
