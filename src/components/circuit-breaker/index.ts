/**
 * src/components/circuit-breaker/index.ts
 *
 * Barrel file — re-exports the circuit breaker pause surface.
 */

export {
  CircuitBreakerProvider,
  useCircuitBreakerState,
  useModulePause,
  type CircuitBreakerContextValue,
  type CircuitBreakerProviderProps,
} from "./CircuitBreakerContext";

export { CircuitBreakerBanner, type CircuitBreakerBannerProps } from "./CircuitBreakerBanner";

export { PausedActionButton, type PausedActionButtonProps } from "./PausedActionButton";
