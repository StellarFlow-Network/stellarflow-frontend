/**
 * contractVersionService.ts
 *
 * Reads Soroban smart-contract version metadata from the Stellar network and
 * derives display-ready badge tags ("v1.0", "v2.0-beta") for the UI.
 *
 * Soroban does not expose a single "version" RPC field; the authoritative
 * on-chain identity of a deployment is its *wasm hash*.  This service:
 *
 *   1. Resolves a contract's wasm hash via the Soroban RPC endpoint
 *      (`getContractWasmByContractId`), which works for any deployed contract.
 *   2. Optionally combines that hash with a lightweight static registry of
 *      known contract deployments (hash → version tag + `isLatest` flag) so
 *      maintainers can annotate legacies and betas without touching the chain.
 *   3. Falls back to a deterministic, hash-derived tag (e.g. `wasm a1b2…9f3e`)
 *      so the UI always shows something useful even for un-annotated hashes.
 *
 * All reads are cached per `contractId + rpcUrl` and per wasm hash to avoid
 * hammering public RPC endpoints on re-renders.
 */

import type {
  ContractVersionInfo,
  ContractVersionKind,
  ContractVersionOverrides,
} from "@/types/contractVersion";
import { rpcManager } from "@/services/rpc";

/** Guard so this module is safe to import in SSR/RSC contexts. */
const hasWindow = typeof window !== "undefined";

const wasmCache = new Map<string, Promise<string | null>>();
const versionCache = new Map<string, ContractVersionInfo>();

/** Cache TTL for in-memory wasm-hash resolutions (5 minutes). */
const WASM_CACHE_TTL_MS = 5 * 60 * 1000;
const wasmCacheTime = new Map<string, number>();

/**
 * Static deployments registry.  Add known deployments here to surface stable
 * tags ("v1.0", "v2.0-beta") instead of raw wasm hashes.  Only one entry per
 * contract+wasmHash should be marked as the latest (current) deployment.
 *
 * Overridden at runtime by `INJECTED_CONTRACT_VERSIONS` (see below).
 */
const KNOWN_CONTRACT_VERSIONS: ContractVersionOverrides = {};

/**
 * Allows the host page to inject known deployments from an external,
 * client-safe manifest (e.g. an environment-provided JSON blob) without
 * rebuilding.  Parsed defensively; invalid entries are discarded.
 */
export function injectContractVersions(
  overrides: ContractVersionOverrides | null | undefined,
): void {
  if (!overrides || typeof overrides !== "object") return;
  for (const [hash, version] of Object.entries(overrides)) {
    if (typeof hash === "string" && hash.length > 0 && typeof version === "string") {
      KNOWN_CONTRACT_VERSIONS[hash.toLowerCase()] = version;
    }
  }
}

/** A contract whose deployments (wasm hashes) are known, with the latest one. */
export interface KnownDeployment {
  /** Normalised wasm hash (hex, lowercase). */
  wasmHash: string;
  /** Display tag, e.g. "v1.0" or "v2.0-beta". */
  version: string;
  /** True only for the "current" (latest) deployment of the contract. */
  isLatest: boolean;
  kind: ContractVersionKind;
}

const KNOWN_DEPLOYMENTS: KnownDeployment[] = [];

/**
 * Register the full deployment set for a contract.  This lets the service
 * classify a hash as `current` vs `legacy` and render version tags.
 */
export function registerContractDeployments(deployments: KnownDeployment[]): void {
  for (const d of deployments) {
    const hash = d.wasmHash.toLowerCase();
    KNOWN_DEPLOYMENTS.push({ ...d, wasmHash: hash });
  }
  // Clear derived cache entries so re-registrations take effect.
  versionCache.clear();
}

function resolveKind(hashLower: string): {
  version: string;
  kind: ContractVersionKind;
  isLatest: boolean;
} {
  // Prefer the explicit injection map, then the registered deployments list.
  const mapped = KNOWN_CONTRACT_VERSIONS[hashLower];
  const deployment = KNOWN_DEPLOYMENTS.find((d) => d.wasmHash === hashLower);
  const version = mapped ?? deployment?.version;

  if (version !== undefined) {
    const isBeta = /(^|[-.\s])(beta|alpha|rc|preview|dev)/i.test(version);
    let kind: ContractVersionKind;
    if (isBeta) {
      kind = "beta";
    } else if (deployment) {
      kind = deployment.isLatest ? "current" : "legacy";
    } else {
      // No deployment entry — a manually-injected tag carries no authoritative
      // "current"/"legacy" signal, so classify it as unknown.
      kind = "unknown";
    }
    return { version, kind, isLatest: Boolean(deployment?.isLatest) };
  }

  return {
    version: `wasm ${shortenWasmHash(hashLower)}`,
    kind: "unknown",
    isLatest: false,
  };
}

/** Truncate a wasm hash for display: `a1b2…9f3e`. */
export function shortenWasmHash(hash: string, head = 4, tail = 4): string {
  const clean = (hash || "").toLowerCase();
  if (clean.length <= head + tail) return clean || "unknown";
  return `${clean.slice(0, head)}…${clean.slice(-tail)}`;
}

function normalizeHash(hash: string): string {
  return (hash || "").replace(/^0x/i, "").toLowerCase();
}

/**
 * Resolve a contract's wasm hash directly from the network via the Soroban
 * RPC endpoint.  Never throws — resolves to `null` when the hash cannot be
 * read (network error, invalid contract id, etc.) so callers can render
 * graceful fallbacks.
 */
export async function readContractWasmHash(
  contractId: string,
  rpcUrl?: string,
): Promise<string | null> {
  if (!contractId) return null;

  const endpoint = rpcUrl ?? rpcManager.getCurrentEndpoint()?.url;
  const cacheKey = `${endpoint}:${contractId}`;

  const cachedPromise = wasmCache.get(cacheKey);
  const cachedAt = wasmCacheTime.get(cacheKey);
  if (cachedPromise && cachedAt && Date.now() - cachedAt < WASM_CACHE_TTL_MS) {
    return cachedPromise;
  }

  const promise = (async () => {
    try {
      const server = await rpcManager.getServer(endpoint);
      if (!server || typeof server.getContractWasmByContractId !== "function") {
        return null;
      }
      const wasmBytes = await server.getContractWasmByContractId(contractId);
      if (!wasmBytes) return null;
      return normalizeHash(await wasmBytesToHashHex(wasmBytes));
    } catch {
      return null;
    }
  })();

  wasmCache.set(cacheKey, promise);
  wasmCacheTime.set(cacheKey, Date.now());
  return promise;
}

/**
 * Convert raw wasm bytes to the hex-form wasm hash.  The SDK's
 * `getContractWasmByContractId` returns the wasm *bytes*, so we hash them
 * (SHA-256) to compare against conventional wasm-hash identifiers.
 */
export async function wasmBytesToHashHex(wasmBytes: Uint8Array): Promise<string> {
  try {
    const buffer = new Uint8Array(wasmBytes).buffer;
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    // Non-secure-context / old engine fallback: use a stable hex fingerprint.
    let hash = 0;
    const arr = Array.from(wasmBytes);
    for (let i = 0; i < arr.length; i++) {
      hash = (hash * 31 + arr[i]) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }
}

function buildInfo(
  contractId: string,
  wasmHash: string | null,
  readAt?: string,
): ContractVersionInfo | null {
  if (!wasmHash) return null;
  const lower = normalizeHash(wasmHash);
  const { version, kind, isLatest } = resolveKind(lower);
  return {
    wasmHash: lower,
    wasmHashShort: shortenWasmHash(lower),
    version,
    kind,
    isLatest,
    readAt: readAt ?? (hasWindow ? new Date().toISOString() : undefined),
  };
}

/**
 * Highest-level read path: returns the version metadata for a contract by
 * reading its wasm hash from the network and enriching it with the registry.
 * Results are cached by `contractId + rpcUrl`.
 */
export async function getContractVersionInfo(
  contractId: string,
  rpcUrl?: string,
): Promise<ContractVersionInfo | null> {
  if (!contractId) return null;

  const endpoint = rpcUrl ?? rpcManager.getCurrentEndpoint()?.url;
  const cacheKey = `${endpoint}:${contractId}`;
  const cached = versionCache.get(cacheKey);
  if (cached) return cached;

  const wasmHash = await readContractWasmHash(contractId, endpoint);
  const info = buildInfo(contractId, wasmHash);
  if (info) versionCache.set(cacheKey, info);
  return info;
}

/** Deterministic (non-network) build from an already-known wasm hash. */
export function getContractVersionFromHash(wasmHash: string): ContractVersionInfo | null {
  return buildInfo("", wasmHash);
}

/**
 * Best-effort synchronous read used when the network layer is unavailable
 * (SSR, offline).  Returns version metadata from the registry keyed purely by
 * the supplied wasm hash, or `null` when nothing is known.
 */
export function getCachedContractVersion(wasmHash?: string): ContractVersionInfo | null {
  if (!wasmHash) return null;
  const lower = normalizeHash(wasmHash);
  const cached = versionCache.get(`hash:${lower}`);
  if (cached) return cached;
  const info = buildInfo("", lower);
  if (info) versionCache.set(`hash:${lower}`, info);
  return info;
}
