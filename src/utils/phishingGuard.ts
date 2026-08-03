/**
 * Phishing guard — validates Stellar addresses against blocklists and
 * flags newly-created or unverified accounts before transaction submission.
 *
 * All network-dependent imports are lazy so the module stays out of
 * the initial dashboard bundle.
 */

const BLOCKLIST_URL =
  "https://raw.githubusercontent.com/AcidVenom/stellar-scam-list/main/list.json";

const CACHE_TTL_MS = 15 * 60 * 1000;

interface BlocklistCache {
  addresses: Set<string>;
  fetchedAt: number;
}

let cache: BlocklistCache | null = null;
let pendingFetch: Promise<Set<string>> | null = null;

export interface PhishingCheckResult {
  safe: boolean;
  reason:
    | "clean"
    | "blocklisted"
    | "new_account"
    | "unverified"
    | "invalid_address"
    | "fetch_error";
  severity: "none" | "warning" | "critical";
  message: string;
}

function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address);
}

async function fetchBlocklist(): Promise<Set<string>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.addresses;
  }

  if (pendingFetch) {
    return pendingFetch;
  }

  pendingFetch = (async () => {
    try {
      const response = await fetch(BLOCKLIST_URL, {
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        throw new Error(`Blocklist fetch failed: ${response.status}`);
      }

      const data: unknown = await response.json();

      const addresses = new Set<string>();

      if (Array.isArray(data)) {
        for (const entry of data) {
          const addr =
            typeof entry === "string"
              ? entry
              : typeof entry === "object" && entry !== null && "address" in entry
                ? String((entry as Record<string, unknown>).address)
                : null;
          if (addr && isValidStellarAddress(addr)) {
            addresses.add(addr);
          }
        }
      }

      cache = { addresses, fetchedAt: Date.now() };
      return addresses;
    } finally {
      pendingFetch = null;
    }
  })();

  return pendingFetch;
}

async function checkAccountAge(
  address: string,
): Promise<{ isNew: boolean; isUnfunded: boolean }> {
  const { Horizon } = await import("@stellar/stellar-sdk");
  const server = new Horizon.Server("https://horizon-testnet.stellar.org");

  try {
    const account = await server.accounts().accountId(address).call();
    const createdAt = new Date(
      (account as Record<string, unknown>).last_modified_time as string,
    ).getTime();
    const ageMs = Date.now() - createdAt;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    return { isNew: ageMs < sevenDaysMs, isUnfunded: false };
  } catch (err: unknown) {
    const status =
      typeof err === "object" &&
      err !== null &&
      "response" in err &&
      typeof (err as Record<string, unknown>).response === "object" &&
      (err as Record<string, Record<string, unknown>>).response !== null
        ? ((err as Record<string, Record<string, unknown>>).response
            .status as number)
        : 0;

    if (status === 404) {
      return { isNew: false, isUnfunded: true };
    }
    throw err;
  }
}

export async function validateAddress(
  address: string,
): Promise<PhishingCheckResult> {
  if (!isValidStellarAddress(address)) {
    return {
      safe: false,
      reason: "invalid_address",
      severity: "critical",
      message:
        "The provided address is not a valid Stellar public key (must start with G and be 56 characters).",
    };
  }

  let blocklist: Set<string>;
  try {
    blocklist = await fetchBlocklist();
  } catch {
    return {
      safe: false,
      reason: "fetch_error",
      severity: "warning",
      message:
        "Could not verify address against scam registries. Proceed with caution.",
    };
  }

  if (blocklist.has(address)) {
    return {
      safe: false,
      reason: "blocklisted",
      severity: "critical",
      message:
        "This address has been flagged as malicious in known scam registries. Transaction blocked.",
    };
  }

  try {
    const { isNew, isUnfunded } = await checkAccountAge(address);

    if (isUnfunded) {
      return {
        safe: false,
        reason: "unverified",
        severity: "warning",
        message:
          "This account does not exist on the network yet. It may be unfunded or fraudulent.",
      };
    }

    if (isNew) {
      return {
        safe: false,
        reason: "new_account",
        severity: "warning",
        message:
          "This account was created within the last 7 days. Verify the recipient before sending funds.",
      };
    }
  } catch {
    return {
      safe: false,
      reason: "fetch_error",
      severity: "warning",
      message:
        "Could not verify account age on the Stellar network. Proceed with caution.",
    };
  }

  return {
    safe: true,
    reason: "clean",
    severity: "none",
    message: "Address passed all security checks.",
  };
}

export function shouldBlockTransaction(result: PhishingCheckResult): boolean {
  return result.reason === "blocklisted";
}

export function shouldWarnUser(result: PhishingCheckResult): boolean {
  return result.severity === "warning";
}

export function clearBlocklistCache(): void {
  cache = null;
}
