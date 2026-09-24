/**
 * Custom token import library.
 *
 * Two responsibilities, kept out of the initial bundle where possible:
 *
 *  1. Pure, synchronous input validation + local-storage persistence for
 *     user-imported custom tokens (no SDK — safe to run on every keystroke).
 *  2. On-demand metadata resolution against Soroban RPC / Horizon. The
 *     Stellar SDK is lazy-loaded inside {@link fetchTokenMetadata} so it is
 *     only fetched when the user explicitly resolves a token.
 *
 * A "custom token" is any Stellar Asset Contract (SAC) or SEP-41 token that
 * the user chose to import manually. These are inherently **unverified** —
 * they are not part of any curated allow-list — so every persisted record is
 * flagged accordingly for the UI to surface a security warning.
 */

import { getItem, setItem } from "@/utils/storage";

const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
const SIMULATION_FEE = "100";
const STORAGE_KEY = "stellarflow.customTokens.v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A user-imported custom token persisted to local browser storage. */
export interface CustomToken {
  /** Soroban contract address (SAC/SEP-41) — the canonical identifier. */
  contractId: string;
  /** Token symbol / asset code (e.g. "USDC"). */
  symbol: string;
  /** Human-readable token name. */
  name: string;
  /** On-chain decimal precision. */
  decimals: number;
  /** Classic asset issuer, present only for code+issuer imports. */
  issuer?: string;
  /** Epoch ms when the user imported this token. */
  addedAt: number;
  /**
   * Always `false` for manually imported tokens. Persisted explicitly so the
   * UI can render the unverified-asset warning without re-deriving trust.
   */
  verified: boolean;
}

/** Metadata resolved from the network before an import is committed. */
export interface TokenMetadata {
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  issuer?: string;
}

/** Import by raw Soroban contract address. */
export interface ContractImportInput {
  mode: "contract";
  contractId: string;
}

/** Import by classic asset code + issuer pair (SAC is derived). */
export interface AssetImportInput {
  mode: "asset";
  code: string;
  issuer: string;
}

export type TokenImportInput = ContractImportInput | AssetImportInput;

export interface ValidationResult {
  valid: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Pure validation (no SDK — safe on every render)
// ---------------------------------------------------------------------------

// StrKey base32 alphabet is RFC 4648 (A–Z, 2–7). Contract ids start with `C`,
// ed25519 public keys (issuers) with `G`; both encode to 56 chars.
const CONTRACT_ID_PATTERN = /^C[A-Z2-7]{55}$/;
const PUBLIC_KEY_PATTERN = /^G[A-Z2-7]{55}$/;
// Classic asset codes: 1–12 alphanumeric characters.
const ASSET_CODE_PATTERN = /^[A-Za-z0-9]{1,12}$/;

/** Validates a Soroban contract address (StrKey `C…`) by format. */
export function validateContractId(value: string): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: false, error: "Contract address is required." };
  }
  if (!CONTRACT_ID_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: "Enter a valid Stellar contract address (starts with C, 56 characters).",
    };
  }
  return { valid: true, error: null };
}

/** Validates a classic asset code + issuer pair by format. */
export function validateAssetInput(
  code: string,
  issuer: string,
): ValidationResult {
  const trimmedCode = code.trim();
  const trimmedIssuer = issuer.trim();

  if (!trimmedCode) {
    return { valid: false, error: "Asset code is required." };
  }
  if (!ASSET_CODE_PATTERN.test(trimmedCode)) {
    return {
      valid: false,
      error: "Asset code must be 1–12 alphanumeric characters.",
    };
  }
  if (!trimmedIssuer) {
    return { valid: false, error: "Issuer address is required." };
  }
  if (!PUBLIC_KEY_PATTERN.test(trimmedIssuer)) {
    return {
      valid: false,
      error: "Enter a valid issuer address (starts with G, 56 characters).",
    };
  }
  return { valid: true, error: null };
}

/** Validates whichever input mode is active. */
export function validateImportInput(input: TokenImportInput): ValidationResult {
  return input.mode === "contract"
    ? validateContractId(input.contractId)
    : validateAssetInput(input.code, input.issuer);
}

// ---------------------------------------------------------------------------
// Local-storage persistence
// ---------------------------------------------------------------------------

function isCustomTokenArray(value: unknown): value is CustomToken[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as CustomToken).contractId === "string" &&
        typeof (item as CustomToken).symbol === "string" &&
        typeof (item as CustomToken).name === "string" &&
        typeof (item as CustomToken).decimals === "number",
    )
  );
}

/** Returns all imported custom tokens (empty array when none/unavailable). */
export function getCustomTokens(): CustomToken[] {
  return getItem<CustomToken[]>(STORAGE_KEY, isCustomTokenArray, []) ?? [];
}

/** True when a token with the given contract id is already imported. */
export function isTokenImported(contractId: string): boolean {
  return getCustomTokens().some((token) => token.contractId === contractId);
}

/**
 * Persists a custom token, replacing any existing entry with the same
 * contract id. Returns the updated token list.
 */
export function saveCustomToken(
  metadata: TokenMetadata,
): CustomToken[] {
  const existing = getCustomTokens().filter(
    (token) => token.contractId !== metadata.contractId,
  );

  const record: CustomToken = {
    contractId: metadata.contractId,
    symbol: metadata.symbol,
    name: metadata.name,
    decimals: metadata.decimals,
    issuer: metadata.issuer,
    addedAt: Date.now(),
    verified: false,
  };

  const next = [...existing, record];
  setItem(STORAGE_KEY, next);
  return next;
}

/** Removes an imported token by contract id. Returns the updated list. */
export function removeCustomToken(contractId: string): CustomToken[] {
  const next = getCustomTokens().filter(
    (token) => token.contractId !== contractId,
  );
  setItem(STORAGE_KEY, next);
  return next;
}

// ---------------------------------------------------------------------------
// Network metadata resolution (lazy-loads the Stellar SDK)
// ---------------------------------------------------------------------------

/**
 * Resolves token metadata (name, symbol, decimals) from the network.
 *
 * For a raw contract address the token contract is queried directly. For a
 * classic asset code+issuer pair the deterministic SAC contract id is derived
 * first, then queried the same way. Each metadata entry is read via a
 * read-only Soroban `simulateTransaction` — no wallet or funded account is
 * required, so a throwaway source keypair is used purely to satisfy the
 * transaction envelope.
 *
 * @throws if the input is malformed or the contract does not expose the
 *         expected SAC/SEP-41 metadata entry points.
 */
export async function fetchTokenMetadata(
  input: TokenImportInput,
): Promise<TokenMetadata> {
  const {
    Account,
    Asset,
    Contract,
    Keypair,
    Networks,
    rpc,
    TransactionBuilder,
    scValToNative,
  } = await import("@stellar/stellar-sdk");

  let contractId: string;
  let issuer: string | undefined;

  if (input.mode === "asset") {
    const code = input.code.trim();
    const issuerKey = input.issuer.trim();
    let asset: InstanceType<typeof Asset>;
    try {
      asset = new Asset(code, issuerKey);
    } catch {
      throw new Error("Invalid asset code or issuer address.");
    }
    contractId = asset.contractId(Networks.TESTNET);
    issuer = issuerKey;
  } else {
    contractId = input.contractId.trim();
  }

  const server = new rpc.Server(SOROBAN_RPC_URL, { allowHttp: true });
  const contract = new Contract(contractId);
  // Throwaway source account — simulation never touches the ledger.
  const source = new Account(Keypair.random().publicKey(), "0");

  const readEntry = async (method: string): Promise<unknown> => {
    const tx = new TransactionBuilder(source, {
      fee: SIMULATION_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(contract.call(method))
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`Contract does not expose "${method}()": ${sim.error}`);
    }
    const retval = sim.result?.retval;
    if (!retval) {
      throw new Error(`Contract returned no value for "${method}()".`);
    }
    return scValToNative(retval);
  };

  let name: unknown;
  let symbol: unknown;
  let decimals: unknown;
  try {
    [name, symbol, decimals] = await Promise.all([
      readEntry("name"),
      readEntry("symbol"),
      readEntry("decimals"),
    ]);
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error("Failed to read token metadata from the network.");
  }

  const parsedDecimals = Number(decimals);
  if (!Number.isFinite(parsedDecimals)) {
    throw new Error("Contract returned invalid decimals.");
  }

  return {
    contractId,
    name: String(name),
    symbol: String(symbol),
    decimals: parsedDecimals,
    issuer,
  };
}
