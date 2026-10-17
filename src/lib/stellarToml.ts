import { fetchTokenMetadata, type TokenMetadata } from "@/lib/customTokens";

export interface ResolvedDomainToken extends TokenMetadata {
  iconUrl?: string;
}

export interface StellarTomlCurrency {
  code?: string;
  issuer?: string;
  contract?: string;
  image?: string;
}

function tomlString(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return undefined;
    }
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  return undefined;
}

export function parseStellarTomlCurrencies(content: string): StellarTomlCurrency[] {
  const currencies: StellarTomlCurrency[] = [];
  let current: StellarTomlCurrency | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "[[CURRENCIES]]") {
      current = {};
      currencies.push(current);
      continue;
    }
    if (line.startsWith("[") && line.endsWith("]")) {
      current = null;
      continue;
    }
    if (!current) continue;

    const separator = line.indexOf("=");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    if (key !== "code" && key !== "issuer" && key !== "contract" && key !== "image") continue;
    const value = tomlString(line.slice(separator + 1).split(/\s+#/, 1)[0]);
    if (value) current[key] = value;
  }

  return currencies;
}

function safeHttpsUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeStellarDomain(input: string): string {
  const candidate = input.includes("://") ? input : `https://${input}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Enter a valid asset domain.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  ) {
    throw new Error("Asset domains must be HTTPS hostnames without a path.");
  }
  return url.hostname.toLowerCase();
}

export async function resolveStellarDomainAsset(
  input: string,
  signal: AbortSignal,
): Promise<ResolvedDomainToken> {
  const domain = normalizeStellarDomain(input);
  const response = await fetch(`https://${domain}/.well-known/stellar.toml`, {
    signal,
    headers: { Accept: "text/plain" },
  });
  if (!response.ok) {
    throw new Error(`Could not load ${domain} stellar.toml (${response.status}).`);
  }

  const currency = parseStellarTomlCurrencies(await response.text()).find(
    (entry) => Boolean(entry.contract || (entry.code && entry.issuer)),
  );
  if (!currency) {
    throw new Error("This domain does not publish a resolvable Stellar asset.");
  }

  const metadata = currency.contract
    ? await fetchTokenMetadata({ mode: "contract", contractId: currency.contract })
    : await fetchTokenMetadata({
      mode: "asset",
      code: currency.code as string,
      issuer: currency.issuer as string,
    });

  return {
    ...metadata,
    iconUrl: safeHttpsUrl(currency.image),
  };
}
