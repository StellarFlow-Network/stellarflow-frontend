import { requestController } from "@/lib/request-controller";

export type NetworkHealthStatus = "ACTIVE" | "INACTIVE" | "WARNING";

export interface NetworkHealth {
  status: NetworkHealthStatus;
  globalHealth: number;
  activeContracts: number;
  whitelistedRelayers: number;
}

const FALLBACK_NETWORK_HEALTH: NetworkHealth = {
  status: "ACTIVE",
  globalHealth: 0,
  activeContracts: 4,
  whitelistedRelayers: 3,
};

function normalizeNetworkHealth(
  payload: Partial<NetworkHealth>,
): NetworkHealth {
  return {
    status: payload.status ?? FALLBACK_NETWORK_HEALTH.status,
    globalHealth:
      typeof payload.globalHealth === "number"
        ? payload.globalHealth
        : FALLBACK_NETWORK_HEALTH.globalHealth,
    activeContracts:
      typeof payload.activeContracts === "number"
        ? payload.activeContracts
        : FALLBACK_NETWORK_HEALTH.activeContracts,
    whitelistedRelayers:
      typeof payload.whitelistedRelayers === "number"
        ? payload.whitelistedRelayers
        : FALLBACK_NETWORK_HEALTH.whitelistedRelayers,
  };
}

export async function fetchNetworkHealth(): Promise<NetworkHealth> {
  return requestController.dedupe("network-health", async () => {
    const response = await fetch("/api/network-health", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Network health request failed: ${response.status}`);
    }

    const payload = (await response.json()) as Partial<NetworkHealth>;
    return normalizeNetworkHealth(payload);
  });
}

export { FALLBACK_NETWORK_HEALTH };
