import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Reconnect detection and re-sync (#1146). */
const online = vi.hoisted(() => ({ isOnline: true }));

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => ({ isOnline: online.isOnline, lastOnlineTime: null, lastOfflineTime: null }),
}));

import { isReconnect, resyncAppState, useReconnectResync } from "@/hooks/useReconnectResync";

describe("isReconnect", () => {
  it("is true only for offline to online", () => {
    expect(isReconnect(false, true)).toBe(true);
    expect(isReconnect(true, true)).toBe(false);
    expect(isReconnect(true, false)).toBe(false);
    expect(isReconnect(undefined, true)).toBe(false);
  });
});

describe("useReconnectResync", () => {
  beforeEach(() => {
    online.isOnline = true;
  });

  it("does not fire on mount, fires once per reconnect", () => {
    const onReconnect = vi.fn();
    const { rerender } = renderHook(() => useReconnectResync(onReconnect));
    expect(onReconnect).not.toHaveBeenCalled();

    online.isOnline = false;
    rerender();
    expect(onReconnect).not.toHaveBeenCalled();

    online.isOnline = true;
    rerender();
    expect(onReconnect).toHaveBeenCalledTimes(1);

    rerender();
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });
});

describe("resyncAppState", () => {
  it("invalidates queries and reconnects the socket", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const reconnect = vi.fn();
    await resyncAppState({ queryClient: { invalidateQueries }, socket: { reconnect } });
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(reconnect).toHaveBeenCalledTimes(1);
  });

  it("still invalidates queries when the socket reconnect throws", async () => {
    const invalidateQueries = vi.fn();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await resyncAppState({
      queryClient: { invalidateQueries },
      socket: {
        reconnect: () => {
          throw new Error("boom");
        },
      },
    });
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });
});
