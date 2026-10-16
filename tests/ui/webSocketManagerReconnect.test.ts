import { afterEach, describe, expect, it, vi } from "vitest";

import { WebSocketManager } from "@/utils/WebSocketManager";

/** `WebSocketManager.reconnect` replaces the socket after an outage (#1146). */
class FakeSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances: FakeSocket[] = [];
  readyState = FakeSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: unknown = null;
  onclose: unknown = null;
  onerror: unknown = null;
  close = vi.fn();
  send = vi.fn();
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
}

describe("WebSocketManager.reconnect", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeSocket.instances = [];
  });

  it("closes the old socket and opens a new one while consumers remain", () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    const manager = WebSocketManager.getInstance();
    manager.addConsumer();
    expect(FakeSocket.instances).toHaveLength(1);
    const first = FakeSocket.instances[0];
    first.readyState = FakeSocket.OPEN;

    manager.reconnect();
    expect(first.close).toHaveBeenCalled();
    expect(FakeSocket.instances).toHaveLength(2);

    manager.removeConsumer();
    const before = FakeSocket.instances.length;
    manager.reconnect();
    expect(FakeSocket.instances).toHaveLength(before);
  });
});
