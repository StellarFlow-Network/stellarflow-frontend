/**
 * Relayer Ping Service — Issue #230
 * Checks if a relayer responds to /ping within 500ms.
 * Relayers that fail are considered inactive and removed from the "Active" pool.
 */

export type PingStatus = "active" | "inactive";

export interface PingResult {
  id: string;
  status: PingStatus;
  latency: number | null; // ms, null if timed out
}

const PING_TIMEOUT_MS = 500;

/**
 * Pings a single relayer endpoint.
 * Returns active + latency if it responds within 500ms, otherwise inactive.
 */
export async function pingRelayer(id: string, baseUrl: string): Promise<PingResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  const start = Date.now();

  try {
    const res = await fetch(`${baseUrl}/ping`, { signal: controller.signal, cache: "no-store" });
    const latency = Date.now() - start;
    clearTimeout(timer);
    return { id, status: res.ok ? "active" : "inactive", latency };
  } catch {
    clearTimeout(timer);
    return { id, status: "inactive", latency: null };
  }
}

/**
 * Pings all relayers in parallel and returns only those that are active.
 */
export async function pingAllRelayers(
  relayers: Array<{ id: string; baseUrl: string }>
): Promise<PingResult[]> {
  return Promise.all(relayers.map(({ id, baseUrl }) => pingRelayer(id, baseUrl)));
}
