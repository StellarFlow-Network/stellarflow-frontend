/**
 * Tests for FreighterWalletContext, useWallet, and useReAuth
 *
 * These tests mock @stellar/freighter-api so they run without a browser
 * extension. They verify the three technical requirements from issue #519:
 *
 *  1. Freighter connection state listener integration
 *  2. Public key persistence in localStorage across reloads
 *  3. Graceful re-authentication on session expiry
 */

import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { FreighterWalletProvider } from "@/context/FreighterWalletContext";
import { useWallet } from "@/hooks/useWallet";
import { useReAuth } from "@/hooks/useReAuth";

// ─── Mock @stellar/freighter-api ─────────────────────────────────────────────

const mockIsConnected = jest.fn();
const mockGetAddress = jest.fn();
const mockRequestAccess = jest.fn();
const mockGetNetwork = jest.fn();
const mockWatchStop = jest.fn();
const mockWatchWatch = jest.fn();

jest.mock("@stellar/freighter-api", () => ({
  isConnected: (...args) => mockIsConnected(...args),
  getAddress: (...args) => mockGetAddress(...args),
  requestAccess: (...args) => mockRequestAccess(...args),
  getNetwork: (...args) => mockGetNetwork(...args),
  WatchWalletChanges: jest.fn().mockImplementation(() => ({
    watch: mockWatchWatch,
    stop: mockWatchStop,
  })),
}));

// ─── Mock ToastQueue ─────────────────────────────────────────────────────────

const mockAddToast = jest.fn();

jest.mock("@/components/ui/ToastQueue", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

// ─── Mock storage utils ───────────────────────────────────────────────────────

const mockStorage = {};

jest.mock("@/utils/storage", () => ({
  setItem: jest.fn((key, value) => { mockStorage[key] = value; }),
  getItem: jest.fn((key) => mockStorage[key] ?? null),
  removeItem: jest.fn((key) => { delete mockStorage[key]; }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_PUBLIC_KEY = "GABC1234567890123456789012345678901234567890123456789012345";
const TEST_PUBLIC_KEY_2 = "GXYZ1234567890123456789012345678901234567890123456789012345";

function makeWrapper() {
  return function Wrapper({ children }) {
    return <FreighterWalletProvider>{children}</FreighterWalletProvider>;
  };
}

function setFreighterConnected(address = TEST_PUBLIC_KEY, network = "TESTNET") {
  mockIsConnected.mockResolvedValue({ isConnected: true });
  mockGetAddress.mockResolvedValue({ address });
  mockGetNetwork.mockResolvedValue({ network });
  // WatchWalletChanges.watch does nothing by default (no account changes)
  mockWatchWatch.mockReturnValue({});
}

function setFreighterDisconnected() {
  mockIsConnected.mockResolvedValue({ isConnected: false });
  mockGetAddress.mockResolvedValue({ address: "" });
  mockGetNetwork.mockResolvedValue({ network: "TESTNET" });
  mockWatchWatch.mockReturnValue({});
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  // Default: not connected
  setFreighterDisconnected();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Connection state listener
// ─────────────────────────────────────────────────────────────────────────────

describe("Freighter connection state listener", () => {
  test("starts in idle/checking status then transitions to disconnected when extension not connected", async () => {
    setFreighterDisconnected();

    const { result } = renderHook(() => useWallet(), { wrapper: makeWrapper() });

    // Initially idle or checking (React 19 may begin processing effects before first assertion)
    expect(["idle", "checking"]).toContain(result.current.status);
    expect(result.current.isConnected).toBe(false);

    // Wait for initial refresh to complete
    await waitFor(() => {
      expect(result.current.status).toBe("disconnected");
    });

    expect(result.current.publicKey).toBeNull();
    expect(result.current.isConnected).toBe(false);
  });

  test("transitions to connected status when extension returns a valid address", async () => {
    setFreighterConnected(TEST_PUBLIC_KEY, "TESTNET");

    const { result } = renderHook(() => useWallet(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current.status).toBe("connected");
    });

    expect(result.current.publicKey).toBe(TEST_PUBLIC_KEY);
    expect(result.current.isConnected).toBe(true);
    expect(result.current.network).toBe("TESTNET");
    expect(result.current.networkLabel).toBe("Testnet");
  });

  test("WatchWalletChanges is started on mount and stopped on unmount", async () => {
    setFreighterConnected();

    const { unmount } = renderHook(() => useWallet(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(mockWatchWatch).toHaveBeenCalled();
    });

    unmount();

    expect(mockWatchStop).toHaveBeenCalled();
  });

  test("detects account switch via WatchWalletChanges and sets sessionExpired", async () => {
    setFreighterConnected(TEST_PUBLIC_KEY);

    // Capture the watcher callback so we can simulate an account switch
    let watchCallback;
    mockWatchWatch.mockImplementation((cb) => {
      watchCallback = cb;
      return {};
    });

    const { result } = renderHook(() => useWallet(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.status).toBe("connected"));

    // Simulate Freighter reporting a different address (account switch)
    act(() => {
      watchCallback({
        address: TEST_PUBLIC_KEY_2,
        network: "TESTNET",
        networkPassphrase: "Test SDF Network ; September 2015",
      });
    });

    await waitFor(() => {
      expect(result.current.sessionExpired).toBe(true);
    });

    expect(result.current.publicKey).toBe(TEST_PUBLIC_KEY_2);
  });

  test("connect() calls requestAccess when getAddress returns empty", async () => {
    // getAddress first returns empty (not yet approved), then returns key after approval
    mockGetAddress
      .mockResolvedValueOnce({ address: "" })  // initial refresh
      .mockResolvedValueOnce({ address: "" })  // connect() pre-check
      .mockResolvedValue({ address: TEST_PUBLIC_KEY }); // post-connect refresh
    mockRequestAccess.mockResolvedValue({ address: TEST_PUBLIC_KEY });
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockGetNetwork.mockResolvedValue({ network: "TESTNET" });
    mockWatchWatch.mockReturnValue({});

    const { result } = renderHook(() => useWallet(), { wrapper: makeWrapper() });

    // Initial refresh ends as disconnected (getAddress returned "")
    await waitFor(() => expect(result.current.status).toBe("disconnected"));

    // connect() → requestAccess → sets publicKey → refresh confirms
    let returnedKey;
    await act(async () => {
      returnedKey = await result.current.connect();
    });

    expect(returnedKey).toBe(TEST_PUBLIC_KEY);
    expect(mockRequestAccess).toHaveBeenCalledTimes(1);
    expect(result.current.publicKey).toBe(TEST_PUBLIC_KEY);
  });

  test("disconnect() clears publicKey, network, and storage", async () => {
    setFreighterConnected(TEST_PUBLIC_KEY, "TESTNET");

    const { result } = renderHook(() => useWallet(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.publicKey).toBeNull();
    expect(result.current.network).toBeNull();
    expect(result.current.status).toBe("disconnected");
    expect(result.current.isConnected).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Session persistence
// ─────────────────────────────────────────────────────────────────────────────

describe("Session persistence across reloads", () => {
  const { setItem, getItem } = require("@/utils/storage");

  test("persists public key to storage after successful connect", async () => {
    mockGetAddress.mockResolvedValue({ address: TEST_PUBLIC_KEY });
    mockRequestAccess.mockResolvedValue({ address: TEST_PUBLIC_KEY });
    mockGetNetwork.mockResolvedValue({ network: "TESTNET" });
    mockIsConnected.mockResolvedValue({ isConnected: false });
    mockWatchWatch.mockReturnValue({});

    const { result } = renderHook(() => useWallet(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.connect();
    });

    // setItem should have been called with the public key
    expect(setItem).toHaveBeenCalledWith(
      "stellarflow.freighter.publicKey",
      TEST_PUBLIC_KEY
    );
  });

  test("hydrates publicKey from storage on initial render", async () => {
    // Pre-populate the mock storage to simulate a previous session
    mockStorage["stellarflow.freighter.publicKey"] = TEST_PUBLIC_KEY;
    getItem.mockImplementation((key) => mockStorage[key] ?? null);

    setFreighterConnected(TEST_PUBLIC_KEY);

    const { result } = renderHook(() => useWallet(), { wrapper: makeWrapper() });

    // On first render, publicKey comes from storage before the async refresh
    await waitFor(() => expect(result.current.publicKey).toBe(TEST_PUBLIC_KEY));
  });

  test("removes key from storage on disconnect", async () => {
    const { removeItem } = require("@/utils/storage");
    setFreighterConnected(TEST_PUBLIC_KEY);

    const { result } = renderHook(() => useWallet(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      result.current.disconnect();
    });

    expect(removeItem).toHaveBeenCalledWith("stellarflow.freighter.publicKey");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Re-authentication hook
// ─────────────────────────────────────────────────────────────────────────────

describe("useReAuth — graceful re-authentication", () => {
  test("requireAuth() resolves immediately when session is valid", async () => {
    setFreighterConnected(TEST_PUBLIC_KEY);

    const { result } = renderHook(() => useReAuth(), { wrapper: makeWrapper() });

    await waitFor(() => {
      // Wait for the context to reach connected state
      // We test requireAuth fast-path by calling it after connected
    });

    // Use useWallet alongside to get connected first
    const combined = renderHook(
      () => ({ wallet: useWallet(), reAuth: useReAuth() }),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => expect(combined.result.current.wallet.isConnected).toBe(true));

    let outcome;
    await act(async () => {
      outcome = await combined.result.current.reAuth.requireAuth();
    });

    expect(outcome.publicKey).toBe(TEST_PUBLIC_KEY);
    expect(outcome.wasReAuthenticated).toBe(false);
    expect(mockRequestAccess).not.toHaveBeenCalled();
  });

  test("requireAuth() triggers re-auth flow when session is expired", async () => {
    // Phase 1: start connected with KEY_1
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockGetAddress.mockResolvedValue({ address: TEST_PUBLIC_KEY });
    mockGetNetwork.mockResolvedValue({ network: "TESTNET" });
    mockWatchWatch.mockReturnValue({});

    let watchCallback;
    mockWatchWatch.mockImplementation((cb) => {
      watchCallback = cb;
      return {};
    });

    const { result } = renderHook(
      () => ({ wallet: useWallet(), reAuth: useReAuth() }),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => expect(result.current.wallet.isConnected).toBe(true));

    // Phase 2: simulate account switch via watcher → sets sessionExpired
    act(() => {
      watchCallback({
        address: TEST_PUBLIC_KEY_2,
        network: "TESTNET",
        networkPassphrase: "Test SDF Network ; September 2015",
      });
    });

    await waitFor(() => expect(result.current.wallet.sessionExpired).toBe(true));

    // Phase 3: requireAuth triggers re-auth
    // connect() calls getAddress (returns empty — session expired), then requestAccess
    mockGetAddress.mockResolvedValue({ address: "" });
    mockRequestAccess.mockResolvedValue({ address: TEST_PUBLIC_KEY_2 });

    let outcome;
    await act(async () => {
      outcome = await result.current.reAuth.requireAuth();
    });

    expect(outcome.wasReAuthenticated).toBe(true);
    expect(outcome.publicKey).toBe(TEST_PUBLIC_KEY_2);
    // Success toast emitted
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ status: "confirmed" })
    );
  });

  test("requireAuth() throws and shows error toast when user cancels re-auth", async () => {
    setFreighterDisconnected();
    // getAddress returns empty, requestAccess returns no address (user cancelled)
    mockGetAddress.mockResolvedValue({ address: "" });
    mockRequestAccess.mockResolvedValue({ address: "" });

    const { result } = renderHook(
      () => useReAuth(),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => {});

    // Call requireAuth and catch the rejection — don't wrap in act to let
    // state updates settle naturally with waitFor
    let thrownError;
    try {
      await act(async () => {
        try {
          await result.current.requireAuth();
        } catch (e) {
          thrownError = e;
        }
      });
    } catch {
      // swallow outer act rejection
    }

    expect(thrownError).toBeDefined();
    expect(thrownError.message).toMatch("cancelled or denied");

    await waitFor(() => {
      expect(result.current.reAuthError).not.toBeNull();
    });

    expect(result.current.reAuthError).toMatch("cancelled or denied");
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" })
    );
  });

  test("deduplicates concurrent requireAuth() calls — only one Freighter popup", async () => {
    setFreighterDisconnected();

    let resolveAccess;
    mockRequestAccess.mockReturnValue(
      new Promise((res) => { resolveAccess = res; })
    );

    const { result } = renderHook(
      () => useReAuth(),
      { wrapper: makeWrapper() }
    );

    // Fire two concurrent requireAuth calls
    let p1, p2;
    act(() => {
      p1 = result.current.requireAuth();
      p2 = result.current.requireAuth();
    });

    // Resolve the single popup
    act(() => {
      resolveAccess({ address: TEST_PUBLIC_KEY });
    });

    // Both promises resolve to the same result
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.publicKey).toBe(TEST_PUBLIC_KEY);
    expect(r2.publicKey).toBe(TEST_PUBLIC_KEY);

    // requestAccess was only called once
    expect(mockRequestAccess).toHaveBeenCalledTimes(1);
  });

  test("clearSessionExpired() resets the flag after re-auth", async () => {
    setFreighterConnected(TEST_PUBLIC_KEY);

    let watchCallback;
    mockWatchWatch.mockImplementation((cb) => {
      watchCallback = cb;
      return {};
    });

    const { result } = renderHook(
      () => useWallet(),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    // Trigger account switch to set sessionExpired
    act(() => {
      watchCallback({
        address: TEST_PUBLIC_KEY_2,
        network: "TESTNET",
        networkPassphrase: "Test SDF Network ; September 2015",
      });
    });

    await waitFor(() => expect(result.current.sessionExpired).toBe(true));

    act(() => {
      result.current.clearSessionExpired();
    });

    expect(result.current.sessionExpired).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Computed helpers in useWallet
// ─────────────────────────────────────────────────────────────────────────────

describe("useWallet computed helpers", () => {
  test("shortAddress formats public key as first4…last4", async () => {
    setFreighterConnected(TEST_PUBLIC_KEY);

    const { result } = renderHook(() => useWallet(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    expect(result.current.shortAddress).toBe("GABC…2345");
  });

  test("networkLabel maps TESTNET → Testnet", async () => {
    setFreighterConnected(TEST_PUBLIC_KEY, "TESTNET");

    const { result } = renderHook(() => useWallet(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.networkLabel).toBe("Testnet"));
  });

  test("networkLabel maps PUBLIC → Mainnet", async () => {
    setFreighterConnected(TEST_PUBLIC_KEY, "PUBLIC");

    const { result } = renderHook(() => useWallet(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.networkLabel).toBe("Mainnet"));
  });

  test("isLoading is true during idle and checking states", async () => {
    setFreighterDisconnected();

    const { result } = renderHook(() => useWallet(), { wrapper: makeWrapper() });

    // During initial idle state, isLoading is true
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.status).toBe("disconnected"));

    expect(result.current.isLoading).toBe(false);
  });
});
