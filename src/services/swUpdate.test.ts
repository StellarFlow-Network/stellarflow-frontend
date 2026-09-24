/**
 * Unit tests for SW auto-update guard helpers (#761).
 *
 * Run: node --experimental-strip-types --test src/services/swUpdate.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

// ── Lightweight browser API mocks ───────────────────────────────────────────

interface MockListener {
  type: string;
  listener: EventListener;
}

class MockServiceWorkerContainer {
  private listeners: MockListener[] = [];
  controller: ServiceWorker | null = null;

  addEventListener(type: string, listener: EventListener) {
    this.listeners.push({ type, listener });
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners = this.listeners.filter(
      (l) => l.type !== type || l.listener !== listener,
    );
  }

  dispatch(type: string) {
    this.listeners
      .filter((l) => l.type === type)
      .forEach((l) => l.listener({} as Event));
  }

  getRegistration = () => Promise.resolve<ServiceWorkerRegistration | null>(null);
}

// Set up global mocks before importing the module
const swContainer = new MockServiceWorkerContainer();
const reloads: string[] = [];

Object.defineProperty(globalThis, "navigator", {
  value: { serviceWorker: swContainer },
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, "window", {
  value: {
    location: {
      reload: () => reloads.push("reloaded"),
    },
  },
  writable: true,
  configurable: true,
});

const {
  isServiceWorkerSupported,
  subscribeToSwUpdates,
  getSwUpdateState,
  applySwUpdate,
  initSwUpdateListener,
} = await import("./swUpdate.ts");

// ── Tests ───────────────────────────────────────────────────────────────────

test("isServiceWorkerSupported returns true when SW API is present", () => {
  assert.equal(isServiceWorkerSupported(), true);
});

test("isServiceWorkerSupported returns false when navigator is missing", () => {
  const original = (globalThis as Record<string, unknown>).navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: undefined,
    writable: true,
    configurable: true,
  });
  assert.equal(isServiceWorkerSupported(), false);
  Object.defineProperty(globalThis, "navigator", {
    value: original,
    writable: true,
    configurable: true,
  });
});

test("subscribeToSwUpdates immediately emits current state", () => {
  const received: ReturnType<typeof getSwUpdateState>[] = [];
  const unsub = subscribeToSwUpdates((s) => received.push(s));
  assert.equal(received.length, 1);
  assert.equal(received[0].updateAvailable, false);
  assert.equal(received[0].status, "idle");
  assert.equal(received[0].registration, null);
  unsub();
});

test("getSwUpdateState returns consistent object shape", () => {
  const state = getSwUpdateState();
  assert.ok("status" in state);
  assert.ok("updateAvailable" in state);
  assert.ok("registration" in state);
});

test("initSwUpdateListener returns a cleanup function that does not throw", () => {
  const cleanup = initSwUpdateListener();
  assert.equal(typeof cleanup, "function");
  cleanup();
  assert.doesNotThrow(() => cleanup());
});

test("initSwUpdateListener cleans up event listeners on return", () => {
  const cleanup = initSwUpdateListener();

  const beforeCount = swContainer.listeners.filter(
    (l) => l.type === "controllerchange",
  ).length;
  assert.ok(beforeCount >= 1, "controllerchange listener was registered");

  cleanup();

  const afterCount = swContainer.listeners.filter(
    (l) => l.type === "controllerchange",
  ).length;
  assert.equal(afterCount, 0, "controllerchange listener was removed");
});

test("controllerchange event triggers updateAvailable state", async () => {
  const received: ReturnType<typeof getSwUpdateState>[] = [];
  const unsub = subscribeToSwUpdates((s) => received.push(s));
  const cleanup = initSwUpdateListener();

  // Simulate controllerchange
  swContainer.dispatch("controllerchange");

  assert.ok(
    received.some((s) => s.updateAvailable === true),
    "updateAvailable should be true after controllerchange",
  );

  const last = received[received.length - 1];
  assert.equal(last.status, "ready");

  unsub();
  cleanup();
});

test("applySwUpdate posts SKIP_WAITING to waiting SW and reloads", async () => {
  const messages: unknown[] = [];
  const waitingSW = {
    postMessage: (msg: unknown) => messages.push(msg),
  } as unknown as ServiceWorker;

  const mockReg = {
    waiting: waitingSW,
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as ServiceWorkerRegistration;

  swContainer.getRegistration = () => Promise.resolve(mockReg);

  const cleanup = initSwUpdateListener();
  await Promise.resolve(); // let getRegistration resolve

  await applySwUpdate();

  assert.deepEqual(messages, [{ type: "SKIP_WAITING" }]);
  assert.equal(reloads.length, 1);
  assert.equal(reloads[0], "reloaded");

  cleanup();
});

test("applySwUpdate reloads even when no waiting SW exists", async () => {
  const mockReg = {
    waiting: null,
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as ServiceWorkerRegistration;

  swContainer.getRegistration = () => Promise.resolve(mockReg);

  const cleanup = initSwUpdateListener();
  await Promise.resolve();

  const beforeReloads = reloads.length;
  await applySwUpdate();
  assert.equal(reloads.length, beforeReloads + 1, "page should reload");

  cleanup();
});
