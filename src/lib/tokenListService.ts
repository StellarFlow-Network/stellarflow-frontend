import type { TokenList, TokenListMetadata, TokenListValidationError } from "@/types/tokenList";

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "stellarflow_token_lists";
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const DEFAULT_TOKEN_LISTS: Array<Omit<TokenListMetadata, "lastSynced" | "tokenCount">> = [
  {
    id: "stellarflow-default",
    url: "https://tokens.stellarflow.network/default.json",
    name: "StellarFlow Default",
    enabled: true,
    isDefault: true,
  },
  {
    id: "soroban-community",
    url: "https://tokens.soroban.org/community.json",
    name: "Soroban Community",
    enabled: false,
    isDefault: true,
  },
  {
    id: "verified-fiat-anchors",
    url: "https://tokens.stellar.org/fiat-anchors.json",
    name: "Verified Fiat Anchors",
    enabled: false,
    isDefault: true,
  },
];

// ─── Token List Validation ────────────────────────────────────────────────────

export function validateTokenList(data: unknown): TokenListValidationError[] {
  const errors: TokenListValidationError[] = [];

  if (!data || typeof data !== "object") {
    errors.push({ field: "root", message: "Token list must be a valid JSON object" });
    return errors;
  }

  const list = data as Partial<TokenList>;

  if (!list.name || typeof list.name !== "string") {
    errors.push({ field: "name", message: "Token list must have a valid name" });
  }

  if (!list.version || typeof list.version !== "object") {
    errors.push({ field: "version", message: "Token list must have a version object" });
  } else {
    const v = list.version;
    if (typeof v.major !== "number" || typeof v.minor !== "number" || typeof v.patch !== "number") {
      errors.push({ field: "version", message: "Version must have major, minor, and patch numbers" });
    }
  }

  if (!list.tokens || !Array.isArray(list.tokens)) {
    errors.push({ field: "tokens", message: "Token list must have a tokens array" });
  } else {
    if (list.tokens.length === 0) {
      errors.push({ field: "tokens", message: "Token list must contain at least one token" });
    }

    list.tokens.forEach((token, idx) => {
      if (!token.address || typeof token.address !== "string") {
        errors.push({ field: `tokens[${idx}].address`, message: "Token must have a valid address" });
      }
      if (!token.symbol || typeof token.symbol !== "string") {
        errors.push({ field: `tokens[${idx}].symbol`, message: "Token must have a valid symbol" });
      }
      if (typeof token.decimals !== "number") {
        errors.push({ field: `tokens[${idx}].decimals`, message: "Token must have a valid decimals number" });
      }
    });
  }

  return errors;
}

// ─── Fetch & Validate Token List ──────────────────────────────────────────────

export async function fetchTokenList(url: string): Promise<TokenList> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch token list: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const errors = validateTokenList(data);

  if (errors.length > 0) {
    throw new Error(`Invalid token list: ${errors.map((e) => `${e.field}: ${e.message}`).join(", ")}`);
  }

  return data as TokenList;
}

// ─── Local Storage Management ─────────────────────────────────────────────────

export function getStoredTokenLists(): TokenListMetadata[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // Initialize with defaults
      const defaults = DEFAULT_TOKEN_LISTS.map((list) => ({
        ...list,
        lastSynced: null,
        tokenCount: 0,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
      return defaults;
    }
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function saveTokenLists(lists: TokenListMetadata[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
}

export function addTokenList(url: string, name: string): TokenListMetadata {
  const lists = getStoredTokenLists();
  const id = `custom-${Date.now()}`;
  const newList: TokenListMetadata = {
    id,
    url,
    name,
    enabled: true,
    lastSynced: null,
    tokenCount: 0,
    isDefault: false,
  };
  lists.push(newList);
  saveTokenLists(lists);
  return newList;
}

export function removeTokenList(id: string): void {
  const lists = getStoredTokenLists().filter((list) => list.id !== id);
  saveTokenLists(lists);
}

export function toggleTokenList(id: string, enabled: boolean): void {
  const lists = getStoredTokenLists();
  const list = lists.find((l) => l.id === id);
  if (list) {
    list.enabled = enabled;
    saveTokenLists(lists);
  }
}

export function updateTokenListSync(id: string, tokenCount: number): void {
  const lists = getStoredTokenLists();
  const list = lists.find((l) => l.id === id);
  if (list) {
    list.lastSynced = new Date().toISOString();
    list.tokenCount = tokenCount;
    saveTokenLists(lists);
  }
}

// ─── Background Sync ──────────────────────────────────────────────────────────

export function shouldSync(lastSynced: string | null): boolean {
  if (!lastSynced) return true;
  const lastSyncTime = new Date(lastSynced).getTime();
  const now = Date.now();
  return now - lastSyncTime > SYNC_INTERVAL_MS;
}

export async function syncTokenList(listMeta: TokenListMetadata): Promise<number> {
  try {
    const tokenList = await fetchTokenList(listMeta.url);
    const tokenCount = tokenList.tokens.length;
    updateTokenListSync(listMeta.id, tokenCount);
    return tokenCount;
  } catch (error) {
    console.error(`Failed to sync token list ${listMeta.name}:`, error);
    throw error;
  }
}

export async function syncAllTokenLists(): Promise<void> {
  const lists = getStoredTokenLists().filter((list) => list.enabled);

  await Promise.allSettled(
    lists.map(async (list) => {
      if (shouldSync(list.lastSynced)) {
        await syncTokenList(list);
      }
    })
  );
}

// ─── Get Active Tokens ────────────────────────────────────────────────────────

export async function getActiveTokens(): Promise<TokenList["tokens"]> {
  const lists = getStoredTokenLists().filter((list) => list.enabled);
  const allTokens: TokenList["tokens"] = [];

  await Promise.allSettled(
    lists.map(async (listMeta) => {
      try {
        const tokenList = await fetchTokenList(listMeta.url);
        allTokens.push(...tokenList.tokens);
      } catch (error) {
        console.error(`Failed to fetch tokens from ${listMeta.name}:`, error);
      }
    })
  );

  // Deduplicate by address
  const uniqueTokens = Array.from(
    new Map(allTokens.map((token) => [token.address, token])).values()
  );

  return uniqueTokens;
}
