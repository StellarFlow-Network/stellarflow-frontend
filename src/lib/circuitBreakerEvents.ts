/**
 * circuitBreakerEvents.ts
 *
 * Pure helpers for turning raw `CircuitBreakerTriggered` indexer frames into
 * the normalised `ActiveModulePause` records the banner and the CTA lock-down
 * render from.
 *
 * Everything here is deliberately free of React and of transport concerns so
 * the parsing rules can be reasoned about — and tested — in isolation.
 */

import {
  CIRCUIT_BREAKER_MODULE_LABELS,
  type ActiveModulePause,
  type CircuitBreakerEventType,
  type CircuitBreakerIndexerEvent,
  type CircuitBreakerModule,
  type CircuitBreakerSeverity,
} from "@/types/circuitBreaker";

/**
 * Realtime feed frame that carries a mirrored contract event. The indexer
 * envelope is nested under `data` so it rides the same socket as price ticks
 * without colliding with them.
 */
export const CIRCUIT_BREAKER_MESSAGE_TYPE = "circuit_breaker_event";

/** Fallback recovery ETA, in minutes, when the indexer omits one. */
export const DEFAULT_ESTIMATED_RECOVERY_MINUTES = 30;

/** Fallback multi-sig review window, in minutes, when the indexer omits one. */
export const DEFAULT_REVIEW_MINUTES = 15;

const MODULE_ALIASES: Record<string, CircuitBreakerModule> = {
  swap: "swaps",
  swaps: "swaps",
  liquidation: "liquidations",
  liquidations: "liquidations",
  liquidate: "liquidations",
  bridge: "bridges",
  bridges: "bridges",
  lending: "lending",
  borrow: "lending",
  stake: "staking",
  staking: "staking",
  remittance: "remittance",
  payout: "remittance",
  governance: "governance",
  voting: "governance",
  payment: "payments",
  payments: "payments",
  transfer: "payments",
  transfers: "payments",
};

/** Prefixes a contract may prepend to a module name, e.g. "Pause Swaps". */
const MODULE_PREFIXES = ["emergencypause", "circuitbreaker", "emergency", "paused", "pause"];

function canonicalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Resolve a module key emitted by the indexer onto a known module.
 *
 * The contract and the indexer are free to name the module `swaps`,
 * `Pause Swaps` or `swap_module`; all three mean the same thing. Unknown keys
 * resolve to `null` so a newly deployed module degrades to "ignored" rather
 * than locking down a view it has nothing to do with.
 */
export function normalizeCircuitBreakerModule(value: unknown): CircuitBreakerModule | null {
  if (typeof value !== "string") return null;

  let key = canonicalize(value);
  if (key.length === 0) return null;

  for (const prefix of MODULE_PREFIXES) {
    if (key.length > prefix.length && key.startsWith(prefix)) {
      key = key.slice(prefix.length);
      break;
    }
  }

  const exact = MODULE_ALIASES[key];
  if (exact) return exact;

  // Fall back to the longest alias that shares a prefix, so `swap_router`
  // still resolves to `swaps` without every contract variant being enumerated.
  // Short keys are excluded so an unrecognised 2–3 character module name
  // cannot be force-fitted onto an unrelated module.
  if (key.length < 4) return null;

  let matchedAlias: string | null = null;
  let matchedModule: CircuitBreakerModule | null = null;
  for (const [alias, module] of Object.entries(MODULE_ALIASES)) {
    const sharesPrefix = key.startsWith(alias) || alias.startsWith(key);
    if (sharesPrefix && (matchedAlias === null || alias.length > matchedAlias.length)) {
      matchedAlias = alias;
      matchedModule = module;
    }
  }

  return matchedModule;
}

function isEventType(value: unknown): value is CircuitBreakerEventType {
  return value === "CircuitBreakerTriggered" || value === "CircuitBreakerCleared";
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toSeverity(value: unknown, fallback: CircuitBreakerSeverity): CircuitBreakerSeverity {
  return value === "warning" || value === "critical" ? value : fallback;
}

function toPositiveMinutes(value: unknown, fallback: number): number {
  const parsed = toFiniteNumber(value);
  if (parsed === null || parsed < 0) return fallback;
  return Math.round(parsed);
}

/** Validate a candidate envelope, narrowing it to the indexer event shape. */
function asIndexerEvent(candidate: Record<string, unknown>): CircuitBreakerIndexerEvent | null {
  if (!isEventType(candidate.type)) return null;
  if (normalizeCircuitBreakerModule(candidate.module) === null) return null;
  return candidate as unknown as CircuitBreakerIndexerEvent;
}

/**
 * Parse one realtime feed frame.
 *
 * Returns `null` for anything that is not a well-formed circuit breaker
 * envelope so a malformed frame can never take the banner down.
 */
export function parseCircuitBreakerFrame(payload: unknown): CircuitBreakerIndexerEvent | null {
  if (typeof payload !== "object" || payload === null) return null;

  const frame = payload as Record<string, unknown>;
  const data = frame.data;

  // Normal shape: the socket frame is tagged with the channel type and the
  // contract event envelope rides inside `data`.
  if (typeof data === "object" && data !== null) {
    if (frame.type !== CIRCUIT_BREAKER_MESSAGE_TYPE) return null;
    return asIndexerEvent(data);
  }

  // Flattened shape: the caller already unwrapped the envelope.
  return asIndexerEvent(frame);
}

/**
 * Normalise a parsed event into a renderable pause record.
 *
 * Returns `null` for `CircuitBreakerCleared` — the caller removes the record
 * from its map rather than rendering it — and for events naming a module this
 * build does not know about.
 */
export function toActiveModulePause(
  event: CircuitBreakerIndexerEvent,
  receivedAt: number = Date.now(),
): ActiveModulePause | null {
  if (event.type !== "CircuitBreakerTriggered") return null;

  const pausedModule = normalizeCircuitBreakerModule(event.module);
  if (pausedModule === null) return null;

  const triggeredAt = toFiniteNumber(event.timestamp) ?? receivedAt;
  const estimatedRecoveryMinutes = toPositiveMinutes(
    event.estimatedRecoveryMinutes,
    DEFAULT_ESTIMATED_RECOVERY_MINUTES,
  );
  const reviewMinutes = toPositiveMinutes(event.reviewMinutes, DEFAULT_REVIEW_MINUTES);
  const moduleLabel = CIRCUIT_BREAKER_MODULE_LABELS[pausedModule];

  return {
    id: `${pausedModule}:${triggeredAt}`,
    module: pausedModule,
    moduleLabel,
    reason:
      typeof event.reason === "string" && event.reason.trim().length > 0
        ? event.reason.trim()
        : `Market volatility breached the ${moduleLabel} circuit breaker threshold.`,
    severity: toSeverity(event.severity, "critical"),
    triggeredAt,
    estimatedRecoveryMinutes,
    reviewMinutes,
    estimatedRecoveryAt: triggeredAt + estimatedRecoveryMinutes * 60_000,
    autoResume: event.autoResume !== false,
    ...(typeof event.txHash === "string" && event.txHash.length > 0
      ? { txHash: event.txHash }
      : {}),
    ...(typeof event.contractId === "string" && event.contractId.length > 0
      ? { contractId: event.contractId }
      : {}),
  };
}

/** True once the recovery ETA has elapsed and the contract resumes itself. */
export function hasPauseElapsed(pause: ActiveModulePause, now: number): boolean {
  return pause.autoResume && now >= pause.estimatedRecoveryAt;
}

/** `45` → `"45m"`, `90` → `"1h 30m"`. */
export function formatDurationMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  if (safe < 60) return `${safe}m`;

  const hours = Math.floor(safe / 60);
  const remainder = safe % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

/** Remaining time until `timestamp`, as a short relative phrase. */
export function formatRecoveryCountdown(timestamp: number, now: number): string {
  const remainingMs = timestamp - now;
  if (remainingMs <= 0) return "any moment";

  // Rounded up so the final minute reads "in 1m" rather than "in 0m" — a
  // countdown that hits zero early is worse than one that is a minute pessimistic.
  return `in ${formatDurationMinutes(Math.ceil(remainingMs / 60_000))}`;
}

/** Absolute wall-clock time for recovery and review estimates, in UTC. */
export function formatRecoveryClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/**
 * Tooltip copy shown on a locked-down CTA.
 *
 * A `disabled` button emits no pointer or focus events of its own, so this
 * string is what the user actually reads to find out why the action died.
 */
export function buildPauseTooltip(pause: ActiveModulePause, now: number): string {
  const review = formatDurationMinutes(pause.reviewMinutes);
  const recovery = formatRecoveryCountdown(pause.estimatedRecoveryAt, now);

  return [
    `${pause.moduleLabel} are paused by an automatic circuit breaker.`,
    `Reason: ${pause.reason}`,
    `Risk review: ~${review}. Estimated recovery: ${recovery}.`,
    pause.autoResume
      ? "This action re-enables automatically once recovery completes."
      : "This action re-enables once the risk team clears the breaker.",
  ].join(" ");
}

/** Sort order for the banner: most severe first, then longest halted. */
export function comparePauses(a: ActiveModulePause, b: ActiveModulePause): number {
  if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
  return b.estimatedRecoveryAt - a.estimatedRecoveryAt;
}
