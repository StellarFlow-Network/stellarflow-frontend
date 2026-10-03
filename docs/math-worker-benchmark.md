# Math Worker Benchmark Plan

## Metrics

Record:
- worker calculation duration
- request-to-response round-trip duration
- p50, p95, and p99 latency
- timeout and error rate
- main-thread long-task count
- dropped-frame count
- React commit duration

## Acceptance test

Use a representative workload that includes:
- concentrated-liquidity tick conversions
- multiple route candidates
- yield calculations
- repeated requests under UI interaction

The acceptance target is a measured worker response within 20 ms for the defined workload. Do not claim zero dropped frames without a browser Performance recording.

## Browser procedure

1. Open Chrome DevTools Performance.
2. Record while executing the heavy calculation workload.
3. Interact with the relevant React screen during calculation.
4. Inspect the Main track for long tasks and frame gaps.
5. Compare worker-enabled and main-thread fallback runs.
6. Record hardware, browser version, payload size, and test repetitions.
