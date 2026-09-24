export interface FederationRecord {
  account: string;
  memo?: string;
  memo_type?: string;
  [key: string]: string | undefined;
}

export interface ResolvedAddress {
  input: string;
  address: string;
  displayName?: string;
  source: "stellar" | "federation" | "ens" | "identicon";
  federation?: FederationRecord;
}

export const STELLAR_PUBLIC_KEY_RE = /^G[A-Z2-7]{55}$/;
export const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function isFederationName(value: string): boolean {
  return /^[^*@\s]+\*[a-z0-9.-]+$/i.test(value);
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Address lookup failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export async function resolveAddress(
  input: string,
  signal: AbortSignal,
): Promise<ResolvedAddress> {
  const trimmed = input.trim();

  if (STELLAR_PUBLIC_KEY_RE.test(trimmed)) {
    return { input: trimmed, address: trimmed, source: "stellar" };
  }

  if (isFederationName(trimmed)) {
    const [accountName, domain] = trimmed.split("*");
    const federation = await fetchJson<FederationRecord>(
      `https://${domain}/federation?type=name&q=${encodeURIComponent(accountName)}`,
      signal,
    );
    if (!STELLAR_PUBLIC_KEY_RE.test(federation.account)) {
      throw new Error("Federation server returned an invalid account");
    }
    return {
      input: trimmed,
      address: federation.account,
      displayName: trimmed,
      source: "federation",
      federation,
    };
  }

  if (EVM_ADDRESS_RE.test(trimmed)) {
    try {
      const ens = await fetchJson<{ name?: string }>(
        `https://api.ensideas.com/v1/name/${trimmed}`,
        signal,
      );
      return {
        input: trimmed,
        address: trimmed,
        displayName: ens.name,
        source: "ens",
      };
    } catch {
      return { input: trimmed, address: trimmed, source: "identicon" };
    }
  }

  return { input: trimmed, address: trimmed, source: "identicon" };
}