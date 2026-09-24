"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";

export type NetworkTarget = "testnet" | "mainnet";

interface NetworkContextType {
  network: NetworkTarget;
  horizonUrl: string;
  sorobanUrl: string;
  customHorizonUrl: string;
}

interface NetworkActionsType {
  switchNetwork: (target: NetworkTarget) => Promise<void>;
  setCustomHorizonEndpoint: (url: string) => Promise<boolean>;
  resetToDefaultEndpoint: () => void;
}

interface NetworkStatusType {
  isSwitching: boolean;
  isValidating: boolean;
  error: string | null;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);
const NetworkActionsContext = createContext<NetworkActionsType | undefined>(undefined);
const NetworkStatusContext = createContext<NetworkStatusType | undefined>(undefined);

const DEFAULT_ENDPOINTS: Record<NetworkTarget, { horizon: string; soroban: string }> = {
  testnet: {
    horizon: "https://horizon-testnet.stellar.org",
    soroban: "https://soroban-testnet.stellar.org",
  },
  mainnet: {
    horizon: "https://horizon.stellar.org",
    soroban: "https://soroban-mainnet.stellar.org",
  },
};

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [network, setNetwork] = useState<NetworkTarget>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("stellarflow_network");
      if (saved === "testnet" || saved === "mainnet") return saved;
    }
    return "testnet";
  });

  const [customHorizonUrl, setCustomHorizonUrlState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("stellarflow_custom_horizon") || "";
    }
    return "";
  });

  const [isSwitching, setIsSwitching] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("stellarflow_network", network);
    }
  }, [network]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (customHorizonUrl) {
        localStorage.setItem("stellarflow_custom_horizon", customHorizonUrl);
      } else {
        localStorage.removeItem("stellarflow_custom_horizon");
      }
    }
  }, [customHorizonUrl]);

  const horizonUrl = useMemo(() => {
    if (customHorizonUrl) {
      return customHorizonUrl;
    }
    return DEFAULT_ENDPOINTS[network].horizon;
  }, [network, customHorizonUrl]);

  const sorobanUrl = useMemo(() => {
    return DEFAULT_ENDPOINTS[network].soroban;
  }, [network]);

  const validateEndpoint = async (url: string): Promise<boolean> => {
    if (!url.trim()) return false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      // Try hitting the root or /fee_stats or / to check connectivity
      const response = await fetch(url.replace(/\/+$/, ""), {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.ok || response.status < 500;
    } catch {
      return false;
    }
  };

  const switchNetwork = useCallback(async (target: NetworkTarget) => {
    setIsSwitching(true);
    setError(null);
    try {
      // Simulate client re-instantiation / network ping check
      await new Promise((resolve) => setTimeout(resolve, 300));
      const targetUrl = DEFAULT_ENDPOINTS[target].horizon;
      const ok = await validateEndpoint(targetUrl);
      if (!ok) {
        throw new Error(`Failed to connect to ${target} Horizon node.`);
      }
      setNetwork(target);
      setCustomHorizonUrlState(""); // clear custom when switching network targets
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network switch failed";
      setError(message);
    } finally {
      setIsSwitching(false);
    }
  }, []);

  const setCustomHorizonEndpoint = useCallback(async (url: string): Promise<boolean> => {
    const trimmed = url.trim();
    if (!trimmed) {
      setCustomHorizonUrlState("");
      setError(null);
      return true;
    }

    setIsValidating(true);
    setError(null);

    try {
      const isValid = await validateEndpoint(trimmed);
      if (!isValid) {
        // Fallback to public network default if endpoint ping fails
        setError("Custom endpoint ping failed. Falling back to default network Horizon.");
        setCustomHorizonUrlState("");
        setIsValidating(false);
        return false;
      }

      setCustomHorizonUrlState(trimmed);
      setIsValidating(false);
      return true;
    } catch {
      setError("Connection error. Falling back to default network Horizon.");
      setCustomHorizonUrlState("");
      setIsValidating(false);
      return false;
    }
  }, []);

  const resetToDefaultEndpoint = useCallback(() => {
    setCustomHorizonUrlState("");
    setError(null);
  }, []);

  const contextValue = useMemo(
    () => ({
      network,
      horizonUrl,
      sorobanUrl,
      customHorizonUrl,
    }),
    [network, horizonUrl, sorobanUrl, customHorizonUrl],
  );

  const actionsValue = useMemo(
    () => ({
      switchNetwork,
      setCustomHorizonEndpoint,
      resetToDefaultEndpoint,
    }),
    [switchNetwork, setCustomHorizonEndpoint, resetToDefaultEndpoint],
  );

  const statusValue = useMemo(
    () => ({
      isSwitching,
      isValidating,
      error,
    }),
    [isSwitching, isValidating, error],
  );

  return (
    <NetworkContext.Provider value={contextValue}>
      <NetworkActionsContext.Provider value={actionsValue}>
        <NetworkStatusContext.Provider value={statusValue}>
          {children}
        </NetworkStatusContext.Provider>
      </NetworkActionsContext.Provider>
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}

export function useNetworkActions() {
  const context = useContext(NetworkActionsContext);
  if (!context) {
    throw new Error("useNetworkActions must be used within a NetworkProvider");
  }
  return context;
}

export function useNetworkStatus() {
  const context = useContext(NetworkStatusContext);
  if (!context) {
    throw new Error("useNetworkStatus must be used within a NetworkProvider");
  }
  return context;
}
