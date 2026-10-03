/**
 * circuitBreaker.ts
 *
 * TypeScript contracts for on-chain circuit breaker pauses.
 *
 * Every protocol module (swaps, liquidations, bridges, …) sits behind a
 * circuit breaker: a contract guard that halts that module when market
 * volatility breaches a configured threshold. The indexer mirrors the
 * `CircuitBreakerTriggered` / `CircuitBreakerCleared` contract events, and the
 * UI mirrors the indexer so an emergency pause reaches every open view the
 * instant it is emitted — as a top-of-layout banner plus a lock-down on the
 * action CTAs of the affected module views.
 */

/** Protocol modules a circuit breaker can pause independently. */
export type CircuitBreakerModule =
  | "swaps"
  | "liquidations"
  | "bridges"
  | "lending"
  | "staking"
  | "remittance"
  | "governance"
  | "payments";

/** Human-readable module names used in banners and lock-down tooltips. */
export const CIRCUIT_BREAKER_MODULE_LABELS: Record<CircuitBreakerModule, string> = {
  swaps: "Swaps",
  liquidations: "Liquidations",
  bridges: "Bridges",
  lending: "Lending",
  staking: "Staking",
  remittance: "Remittance",
  governance: "Governance",
  payments: "Payments",
};

/** Breaker urgency. `critical` means the contract halted the module outright. */
export type CircuitBreakerSeverity = "warning" | "critical";

/** Lifecycle mirrored from the contract event stream. */
export type CircuitBreakerEventType =
  | "CircuitBreakerTriggered"
  | "CircuitBreakerCleared";

/**
 * Wire envelope the indexer pushes over the realtime feed.
 *
 * Every field past `module` is optional: the contract only guarantees the
 * module and the event type, so the normalizer substitutes protocol defaults
 * for anything the indexer did not populate.
 */
export interface CircuitBreakerIndexerEvent {
  /** Contract event being mirrored. */
  type: CircuitBreakerEventType;
  /** Protocol module the breaker guards, e.g. `"swaps"`. */
  module: string;
  /** Free-form on-chain reason, e.g. `"price deviation exceeded 15%"`. */
  reason?: string;
  /** Breaker urgency. Defaults to `critical` on a trigger. */
  severity?: CircuitBreakerSeverity;
  /** Unix timestamp (ms) the contract emitted the event. */
  timestamp: number;
  /** Transaction hash of the event that tripped (or cleared) the breaker. */
  txHash?: string;
  /** Contract id that owns the breaker, when the indexer resolves it. */
  contractId?: string;
  /** Minutes until risk teams expect the module to be restored. */
  estimatedRecoveryMinutes?: number;
  /** Minutes the multi-sig review window is expected to take. */
  reviewMinutes?: number;
  /** When true the contract re-enables the module on its own at recovery ETA. */
  autoResume?: boolean;
}

/**
 * A breaker pause the UI is currently mirroring, normalised for rendering.
 *
 * Produced by `normalizeCircuitBreakerEvent` so the banner and the CTA
 * lock-down share one shape regardless of which fields the indexer supplied.
 */
export interface ActiveModulePause {
  /** Stable id derived from module + trigger time, used as a React key. */
  readonly id: string;
  readonly module: CircuitBreakerModule;
  /** Resolved display name for `module`, e.g. `"Liquidations"`. */
  readonly moduleLabel: string;
  readonly reason: string;
  readonly severity: CircuitBreakerSeverity;
  /** Unix timestamp (ms) the breaker tripped. */
  readonly triggeredAt: number;
  /** Minutes the module is expected to stay halted. */
  readonly estimatedRecoveryMinutes: number;
  /** Minutes the multi-sig review is expected to take. */
  readonly reviewMinutes: number;
  /** Unix timestamp (ms) recovery is expected at. */
  readonly estimatedRecoveryAt: number;
  /** True when the contract re-enables the module on its own. */
  readonly autoResume: boolean;
  readonly txHash?: string;
  readonly contractId?: string;
}
