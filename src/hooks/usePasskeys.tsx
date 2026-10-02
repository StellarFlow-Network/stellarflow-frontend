"use client";

/**
 * usePasskeys — React context-based hook for passkey (WebAuthn) device management.
 *
 * Devices are persisted to localStorage under STORAGE_KEY so they survive
 * page refreshes.  The actual credential bytes never leave the browser; only
 * the user-visible metadata (name, AAGUID hint, registration timestamp) is
 * stored.
 *
 * Usage:
 *   // Wrap your app (or security section) with the provider:
 *   <PasskeyProvider>{children}</PasskeyProvider>
 *
 *   // Then consume anywhere inside:
 *   const { devices, addDevice, removeDevice } = usePasskeys();
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PasskeyDevice {
  /** Opaque credential ID returned by the authenticator (base64url). */
  credentialId: string;
  /** Human-readable name chosen by the user at registration time. */
  name: string;
  /** ISO date-string for when this passkey was registered. */
  registeredAt: string;
  /**
   * Optional AAGUID hint from the authenticator — used to render a platform
   * icon (e.g. "platform", "cross-platform", "password").
   */
  aaguidHint?: string;
}

export type PasskeyError =
  | "UNSUPPORTED"
  | "USER_CANCELLED"
  | "INVALID_STATE"
  | "REGISTRATION_FAILED"
  | "AUTHENTICATION_FAILED"
  | "TIMEOUT"
  | "UNKNOWN";

export interface PasskeyContextType {
  devices: PasskeyDevice[];
  isSupported: boolean | null; // null = detection pending
  isRegistering: boolean;
  isAuthenticating: boolean;
  error: PasskeyError | null;
  errorMessage: string | null;

  addDevice: (device: PasskeyDevice) => void;
  removeDevice: (credentialId: string) => void;
  renameDevice: (credentialId: string, name: string) => void;
  setRegistering: (value: boolean) => void;
  setAuthenticating: (value: boolean) => void;
  setError: (code: PasskeyError | null, message?: string) => void;
  clearError: () => void;
  clearAllDevices: () => void;
  /** Trigger an explicit re-run of the platform support check. */
  recheckSupport: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const PasskeyContext = createContext<PasskeyContextType | null>(null);

const STORAGE_KEY = "stellarflow.passkeys.v1";

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function loadDevices(): PasskeyDevice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PasskeyDevice[];
  } catch {
    return [];
  }
}

function saveDevices(devices: PasskeyDevice[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
  } catch {
    /* storage quota exceeded — silently skip */
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function PasskeyProvider({ children }: { children: ReactNode }) {
  const [devices, setDevices] = useState<PasskeyDevice[]>(() => loadDevices());
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setErrorState] = useState<PasskeyError | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isMounted = useRef(true);

  // Persist whenever devices change.
  useEffect(() => {
    saveDevices(devices);
  }, [devices]);

  // Support detection on mount.
  const recheckSupport = useCallback(() => {
    detectPasskeySupport().then((supported) => {
      if (isMounted.current) setIsSupported(supported);
    });
  }, []);

  useEffect(() => {
    isMounted.current = true;
    recheckSupport();
    return () => {
      isMounted.current = false;
    };
  }, [recheckSupport]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const addDevice = useCallback((device: PasskeyDevice) => {
    setDevices((prev) => [
      ...prev.filter((d) => d.credentialId !== device.credentialId),
      device,
    ]);
  }, []);

  const removeDevice = useCallback((credentialId: string) => {
    setDevices((prev) => prev.filter((d) => d.credentialId !== credentialId));
  }, []);

  const renameDevice = useCallback((credentialId: string, name: string) => {
    setDevices((prev) =>
      prev.map((d) =>
        d.credentialId === credentialId ? { ...d, name } : d,
      ),
    );
  }, []);

  const handleSetRegistering = useCallback((value: boolean) => {
    setIsRegistering(value);
    if (value) {
      setErrorState(null);
      setErrorMessage(null);
    }
  }, []);

  const handleSetAuthenticating = useCallback((value: boolean) => {
    setIsAuthenticating(value);
    if (value) {
      setErrorState(null);
      setErrorMessage(null);
    }
  }, []);

  const setError = useCallback(
    (code: PasskeyError | null, message?: string) => {
      setErrorState(code);
      setErrorMessage(message ?? null);
    },
    [],
  );

  const clearError = useCallback(() => {
    setErrorState(null);
    setErrorMessage(null);
  }, []);

  const clearAllDevices = useCallback(() => {
    setDevices([]);
  }, []);

  const value = useMemo<PasskeyContextType>(
    () => ({
      devices,
      isSupported,
      isRegistering,
      isAuthenticating,
      error,
      errorMessage,
      addDevice,
      removeDevice,
      renameDevice,
      setRegistering: handleSetRegistering,
      setAuthenticating: handleSetAuthenticating,
      setError,
      clearError,
      clearAllDevices,
      recheckSupport,
    }),
    [
      devices,
      isSupported,
      isRegistering,
      isAuthenticating,
      error,
      errorMessage,
      addDevice,
      removeDevice,
      renameDevice,
      handleSetRegistering,
      handleSetAuthenticating,
      setError,
      clearError,
      clearAllDevices,
      recheckSupport,
    ],
  );

  return (
    <PasskeyContext.Provider value={value}>{children}</PasskeyContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Consumer hook
// ---------------------------------------------------------------------------

export function usePasskeys(): PasskeyContextType {
  const ctx = useContext(PasskeyContext);
  if (!ctx) {
    throw new Error("usePasskeys must be used inside <PasskeyProvider>.");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Standalone context accessor (for components that want to access the store
// without throwing when the provider is absent — useful for optional usage).
// ---------------------------------------------------------------------------

export function usePasskeyStore(): PasskeyContextType | null {
  return useContext(PasskeyContext);
}

// ---------------------------------------------------------------------------
// Error classification helper
// ---------------------------------------------------------------------------

/**
 * Maps a raw WebAuthn / DOMException to one of our typed error codes.
 */
export function classifyPasskeyError(err: unknown): {
  code: PasskeyError;
  message: string;
} {
  if (err instanceof Error) {
    const name = err.name;
    const msg = err.message;

    if (name === "NotAllowedError") {
      return {
        code: "USER_CANCELLED",
        message:
          "Biometric prompt was dismissed. Please try again and follow the on-device prompt.",
      };
    }
    if (name === "InvalidStateError") {
      return {
        code: "INVALID_STATE",
        message:
          "A passkey is already registered for this device. Remove it first or use a different authenticator.",
      };
    }
    if (name === "TimeoutError" || name === "NotReadableError") {
      return {
        code: "TIMEOUT",
        message: "The authenticator timed out. Please try again.",
      };
    }
    if (name === "SecurityError") {
      return {
        code: "UNSUPPORTED",
        message:
          "WebAuthn is not allowed in this context (insecure origin).",
      };
    }
    if (msg.toLowerCase().includes("registration")) {
      return { code: "REGISTRATION_FAILED", message: msg };
    }
    if (
      msg.toLowerCase().includes("authentication") ||
      msg.toLowerCase().includes("assertion")
    ) {
      return { code: "AUTHENTICATION_FAILED", message: msg };
    }
    return { code: "UNKNOWN", message: msg };
  }
  return { code: "UNKNOWN", message: "An unexpected error occurred." };
}

// ---------------------------------------------------------------------------
// WebAuthn support detection (safe to call in useEffect)
// ---------------------------------------------------------------------------

export async function detectPasskeySupport(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (
    !window.PublicKeyCredential ||
    typeof window.PublicKeyCredential
      .isUserVerifyingPlatformAuthenticatorAvailable !== "function"
  ) {
    return false;
  }
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}
