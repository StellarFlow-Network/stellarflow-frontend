/**
 * contractVersion.ts
 *
 * TypeScript contracts for Soroban smart-contract version metadata.
 *
 * A Soroban contract's on-chain identity is its WebAssembly (wasm) hash.  The
 * same logical contract can be re-deployed with a *new* wasm hash, which is how
 * network participants distinguish a "legacy" deployment from the "current"
 * (or "live") one.  These types capture that metadata so the UI can render
 * version badge tags ("v1.0", "v2.0-beta") next to contract action titles.
 */

/** How the repository classifies a given deployment. */
export type ContractVersionKind = "current" | "legacy" | "beta" | "unknown";

/** A fully-resolved, display-ready version for one contract deployment. */
export interface ContractVersionInfo {
  /** The on-chain wasm hash (hex) for the deployment. */
  wasmHash: string;
  /** Truncated wasm hash for dense UI surfaces (e.g. `a1b2…9f3e`). */
  wasmHashShort: string;
  /**
   * Human-friendly version tag derived from on-chain metadata, e.g.
   * "v1.0", "v2.0-beta".  When the network only exposes the wasm hash this
   * falls back to the truncated hash so the badge is always informative.
   */
  version: string;
  /** Semantic classification used to theme the badge colours. */
  kind: ContractVersionKind;
  /** Whether the version is the latest known deployment of the contract. */
  isLatest: boolean;
  /** ISO timestamp of when the version metadata was read, if known. */
  readAt?: string;
}

/** Result wrapper returned by the async read path. */
export type ContractVersionResult =
  | { status: "success"; data: ContractVersionInfo }
  | { status: "loading" }
  | { status: "error"; message: string };

/** Optional mapping of known wasm hashes to stable version tags. */
export interface ContractVersionOverrides {
  /** Map of wasm hash (hex) → version tag (e.g. "v2.0-beta"). */
  [wasmHash: string]: string;
}
