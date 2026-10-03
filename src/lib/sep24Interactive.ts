export type SEP24Operation = "deposit" | "withdrawal";

export interface SEP24InteractiveRequest {
  operation: SEP24Operation;
  assetCode: string;
  amount?: string;
  account: string;
}

export interface SEP24AnchorMessage {
  type: "sep24:completed" | "sep24:failed";
  transactionId?: string;
  message?: string;
}

export function getConfiguredSEP24AnchorOrigins(): string[] {
  const configured = process.env.NEXT_PUBLIC_SEP24_ANCHOR_ORIGINS ?? "";
  return [...new Set(configured.split(",").flatMap((item) => {
    const value = item.trim();
    if (!value) return [];
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.origin === value.replace(/\/$/, "")
        ? [url.origin]
        : [];
    } catch {
      return [];
    }
  }))];
}

export function validateSEP24InteractiveUrl(
  value: unknown,
  allowedOrigins: readonly string[],
): string {
  if (typeof value !== "string") throw new Error("The anchor did not return an interactive URL.");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("The anchor returned an invalid interactive URL.");
  }

  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    !allowedOrigins.includes(url.origin) ||
    (typeof window !== "undefined" && url.origin === window.location.origin)
  ) {
    throw new Error("The anchor URL is not on the configured trusted-origin list.");
  }

  return url.toString();
}

export function parseSEP24AnchorMessage(value: unknown): SEP24AnchorMessage | null {
  if (typeof value !== "object" || value === null || !("type" in value)) return null;
  const record = value as Record<string, unknown>;
  if (record.type !== "sep24:completed" && record.type !== "sep24:failed") return null;
  if (record.transactionId !== undefined && typeof record.transactionId !== "string") return null;
  if (record.message !== undefined && typeof record.message !== "string") return null;

  return {
    type: record.type,
    ...(typeof record.transactionId === "string" ? { transactionId: record.transactionId } : {}),
    ...(typeof record.message === "string" ? { message: record.message } : {}),
  };
}

export async function createSEP24InteractiveUrl(
  request: SEP24InteractiveRequest,
  signal?: AbortSignal,
): Promise<unknown> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!apiUrl) throw new Error("SEP-24 is unavailable because the anchor backend is not configured.");

  const response = await fetch(`${apiUrl}/anchor/sep24/interactive`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(request),
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`The anchor could not start this flow (${response.status}).`);

  const result: unknown = await response.json();
  if (typeof result !== "object" || result === null || !("url" in result)) {
    throw new Error("The anchor response did not include an interactive URL.");
  }
  return result.url;
}