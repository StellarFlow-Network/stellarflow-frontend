/**
 * Unit tests for the multisig co-signer notification service (#962).
 *
 * Run: node --test src/services/multisigNotifications.test.ts
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  MULTISIG_PENDING_FILTER,
  MULTISIG_PUSH_MESSAGE_TYPE,
  MULTISIG_REQUESTS_STORAGE_KEY,
  MULTISIG_REQUEST_EVENT,
  MAX_TRACKED_REQUESTS,
  buildDemoSignatureRequests,
  buildMultisigApprovalDeepLink,
  buildMultisigPushPayload,
  countPendingSignatureRequests,
  filterPendingSignatureRequests,
  isAwaitingSignature,
  isMultisigAlertEnabled,
  isEnvelopeAwaitingSigner,
  isMultisigDemoMode,
  isRequestTargetingSigner,
  loadCachedSignatureRequests,
  markSignatureRequestResolved,
  mergeSignatureRequests,
  notifySignerOfSignatureRequest,
  parseMultisigApprovalParams,
  parseMultisigApprovalUrl,
  parseMultisigSocketEvent,
  parseServiceWorkerSignatureRequest,
  parseSignatureRequests,
  publishSignatureRequest,
  publishSignatureResolution,
  saveCachedSignatureRequests,
  subscribeToSignatureRequestEvents,
  toSignatureRequest,
  type MultisigEnvelopeSignatureState,
  type MultisigSignatureRequest,
} from "./multisigNotifications.ts";

const SIGNER = "GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXDV90210";
const OTHER_SIGNER = "GCYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYDV11111";

function request(
  overrides: Partial<MultisigSignatureRequest> = {},
): MultisigSignatureRequest {
  return {
    id: "TX-MSIG-0001",
    signerPublicKey: SIGNER,
    title: "Treasury allocation",
    description: "Disburse reserves",
    category: "treasury",
    threshold: 3,
    collectedWeight: 1,
    requestedAt: "2026-09-29T10:00:00.000Z",
    status: "pending",
    ...overrides,
  };
}

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

describe("Multisig signature request targeting (#962)", () => {
  it("only matches requests addressed to the signer", () => {
    assert.equal(isRequestTargetingSigner(request(), SIGNER), true);
    assert.equal(
      isRequestTargetingSigner(request({ signerPublicKey: OTHER_SIGNER }), SIGNER),
      false,
    );
    assert.equal(isRequestTargetingSigner(request(), null), false);
    assert.equal(isRequestTargetingSigner(request(), ""), false);
  });

  it("compares keys case- and whitespace-insensitively", () => {
    assert.equal(
      isRequestTargetingSigner(
        request({ signerPublicKey: `  ${SIGNER.toLowerCase()}  ` }),
        SIGNER,
      ),
      true,
    );
  });

  it("treats approved, revoked and executed requests as no longer awaiting", () => {
    assert.equal(isAwaitingSignature(request(), SIGNER), true);
    for (const status of ["approved", "revoked", "executed"] as const) {
      assert.equal(isAwaitingSignature(request({ status }), SIGNER), false);
    }
  });
});

describe("Pending badge counter (#962)", () => {
  const queue: MultisigSignatureRequest[] = [
    request({ id: "TX-1" }),
    request({ id: "TX-2", collectedWeight: 2 }),
    request({ id: "TX-3", signerPublicKey: OTHER_SIGNER }),
    request({ id: "TX-4", status: "approved" }),
  ];

  it("counts only pending requests awaiting this signer", () => {
    assert.equal(countPendingSignatureRequests(queue, SIGNER), 2);
    assert.equal(countPendingSignatureRequests(queue, OTHER_SIGNER), 1);
    assert.equal(countPendingSignatureRequests(queue, null), 0);
  });

  it("returns the awaiting requests for the filtered queue view", () => {
    const pending = filterPendingSignatureRequests(queue, SIGNER);
    assert.deepEqual(
      pending.map((r) => r.id),
      ["TX-1", "TX-2"],
    );
  });

  it("drops a request from the count once resolved locally", () => {
    const resolved = markSignatureRequestResolved(queue, "TX-1", "approved", 3);
    assert.equal(countPendingSignatureRequests(resolved, SIGNER), 1);
    assert.equal(resolved.find((r) => r.id === "TX-1")?.collectedWeight, 3);
  });

  it("recalculates in real time as new requests arrive", () => {
    const next = mergeSignatureRequests(queue, [request({ id: "TX-5" })]);
    assert.equal(countPendingSignatureRequests(next, SIGNER), 3);
  });
});

describe("Awaiting-my-signature queue filter (#962)", () => {
  const envelope = (overrides: Partial<MultisigEnvelopeSignatureState> = {}) => ({
    status: "pending_signatures",
    threshold: 3,
    currentWeight: 2,
    coSigners: [
      { publicKey: SIGNER, status: "pending" },
      { publicKey: OTHER_SIGNER, status: "pending" },
    ],
    ...overrides,
  });

  it("includes an envelope the signer still has to approve", () => {
    assert.equal(isEnvelopeAwaitingSigner(envelope(), SIGNER), true);
  });

  it("excludes an envelope the signer already approved", () => {
    assert.equal(
      isEnvelopeAwaitingSigner(
        envelope({
          currentWeight: 1,
          coSigners: [
            { publicKey: SIGNER, status: "approved" },
            { publicKey: OTHER_SIGNER, status: "pending" },
          ],
        }),
        SIGNER,
      ),
      false,
    );
  });

  it("excludes the signer's revoked signature and already-quorate envelopes", () => {
    assert.equal(
      isEnvelopeAwaitingSigner(
        envelope({ coSigners: [{ publicKey: SIGNER, status: "revoked" }] }),
        SIGNER,
      ),
      false,
    );
    assert.equal(isEnvelopeAwaitingSigner(envelope({ currentWeight: 3 }), SIGNER), false);
    assert.equal(
      isEnvelopeAwaitingSigner(envelope({ status: "ready_to_execute" }), SIGNER),
      false,
    );
    assert.equal(
      isEnvelopeAwaitingSigner(envelope({ status: "executed" }), SIGNER),
      false,
    );
  });

  it("excludes envelopes the signer is not a co-signer of", () => {
    assert.equal(
      isEnvelopeAwaitingSigner(
        envelope({ coSigners: [{ publicKey: OTHER_SIGNER, status: "pending" }] }),
        SIGNER,
      ),
      false,
    );
    assert.equal(isEnvelopeAwaitingSigner(envelope(), null), false);
  });
});

describe("Queue merging (#962)", () => {
  it("dedupes by id, lets the incoming frame win and sorts newest first", () => {
    const merged = mergeSignatureRequests(
      [
        request({ id: "TX-A", collectedWeight: 1, requestedAt: "2026-09-29T09:00:00.000Z" }),
        request({ id: "TX-B", requestedAt: "2026-09-29T11:00:00.000Z" }),
      ],
      [
        request({ id: "TX-A", collectedWeight: 2, requestedAt: "2026-09-29T09:00:00.000Z" }),
        request({ id: "TX-C", requestedAt: "2026-09-29T12:00:00.000Z" }),
      ],
    );

    assert.deepEqual(
      merged.map((r) => r.id),
      ["TX-C", "TX-B", "TX-A"],
    );
    assert.equal(merged.find((r) => r.id === "TX-A")?.collectedWeight, 2);
  });

  it("caps the tracked queue", () => {
    const many = Array.from({ length: MAX_TRACKED_REQUESTS + 5 }, (_, i) =>
      request({
        id: `TX-${i}`,
        requestedAt: new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString(),
      }),
    );
    assert.equal(mergeSignatureRequests([], many).length, MAX_TRACKED_REQUESTS);
  });
});

describe("Multisig approval deep links (#962)", () => {
  it("builds a pending-filtered queue link", () => {
    assert.equal(buildMultisigApprovalDeepLink(), "/multisig?filter=pending");
  });

  it("focuses one envelope when an id is supplied", () => {
    const link = buildMultisigApprovalDeepLink("TX-MSIG-2048");
    assert.equal(link, "/multisig?filter=pending&request=TX-MSIG-2048");
    assert.deepEqual(parseMultisigApprovalParams(link.split("?")[1]), {
      filter: MULTISIG_PENDING_FILTER,
      requestId: "TX-MSIG-2048",
    });
  });

  it("defaults to the unfiltered view and ignores blank ids", () => {
    assert.deepEqual(parseMultisigApprovalParams("?request=%20%20"), {
      filter: "all",
      requestId: null,
    });
    assert.deepEqual(parseMultisigApprovalParams(null), {
      filter: "all",
      requestId: null,
    });
  });

  it("parses the server-component searchParams record", () => {
    assert.deepEqual(
      parseMultisigApprovalParams({ filter: "pending", request: "TX-MSIG-2048" }),
      { filter: "pending", requestId: "TX-MSIG-2048" },
    );
    assert.deepEqual(
      parseMultisigApprovalParams({ filter: ["pending", "all"], request: undefined }),
      { filter: "pending", requestId: null },
    );
    assert.deepEqual(parseMultisigApprovalParams({}), {
      filter: "all",
      requestId: null,
    });
  });

  it("parses push click URLs and rejects unrelated routes", () => {
    assert.deepEqual(
      parseMultisigApprovalUrl("https://stellarflow.app/multisig?filter=pending&request=TX-9"),
      { filter: "pending", requestId: "TX-9" },
    );
    assert.equal(parseMultisigApprovalUrl("/?tx=abc&type=swap"), null);
    assert.equal(parseMultisigApprovalUrl(null), null);
  });
});

describe("Push payload + delivery (#962)", () => {
  it("describes the request and deep links to the approval drawer", () => {
    const payload = buildMultisigPushPayload(
      request({
        id: "TX-MSIG-2048",
        title: "Treasury Quarterly Liquidity Allocation",
        amount: "50,000.00",
        asset: "USDC",
        collectedWeight: 2,
        initiatorName: "Elena (Lead Treasury)",
      }),
    );

    assert.match(payload.title, /Treasury Quarterly Liquidity Allocation/);
    assert.match(payload.body, /Elena \(Lead Treasury\) requested your signature/);
    assert.match(payload.body, /Amount: 50,000\.00 USDC\./);
    assert.match(payload.body, /2 of 3 signatures collected\./);
    assert.equal(payload.tag, "sf-multisig-TX-MSIG-2048");
    assert.equal(payload.url, "/multisig?filter=pending&request=TX-MSIG-2048");
    assert.equal(payload.data.type, MULTISIG_PUSH_MESSAGE_TYPE);
    assert.equal(payload.data.requestId, "TX-MSIG-2048");
  });

  it("falls back to a truncated initiator key", () => {
    const payload = buildMultisigPushPayload(
      request({ initiatorPublicKey: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ" }),
    );
    assert.match(payload.body, /GA7QYN…VSGZ requested your signature/);
  });

  it("respects the master switch and the multisig category toggle", () => {
    assert.equal(isMultisigAlertEnabled({ enabled: true }), true);
    assert.equal(isMultisigAlertEnabled({ enabled: true, multisigRequests: true }), true);
    assert.equal(isMultisigAlertEnabled({ enabled: true, multisigRequests: false }), false);
    assert.equal(isMultisigAlertEnabled({ enabled: false, multisigRequests: true }), false);
    assert.equal(isMultisigAlertEnabled(null), false);
    assert.equal(isMultisigAlertEnabled(undefined), false);
  });

  it("is a no-op in a non-browser environment", async () => {
    assert.equal(
      await notifySignerOfSignatureRequest(request(), { enabled: true }),
      false,
    );
  });
});

describe("Payload validation (#962)", () => {
  it("accepts a complete frame and normalises optional fields", () => {
    const parsed = toSignatureRequest({
      id: "TX-MSIG-77",
      signerPublicKey: SIGNER,
      requestedAt: "2026-09-29T10:00:00.000Z",
      title: "Upgrade contract",
      threshold: 2,
      collectedWeight: 0,
      status: "pending",
      category: "upgrade",
    });

    assert.deepEqual(parsed, {
      id: "TX-MSIG-77",
      signerPublicKey: SIGNER,
      initiatorPublicKey: undefined,
      initiatorName: undefined,
      title: "Upgrade contract",
      description: "",
      category: "upgrade",
      amount: undefined,
      asset: undefined,
      destination: undefined,
      threshold: 2,
      collectedWeight: 0,
      requestedAt: "2026-09-29T10:00:00.000Z",
      expiresAt: undefined,
      status: "pending",
    });
  });

  it("rejects frames missing the fields the badge depends on", () => {
    assert.equal(toSignatureRequest(null), null);
    assert.equal(toSignatureRequest("nope"), null);
    assert.equal(toSignatureRequest({ signerPublicKey: SIGNER }), null);
    assert.equal(toSignatureRequest({ id: "TX-1", signerPublicKey: SIGNER }), null);
    assert.equal(
      toSignatureRequest({ id: "TX-1", requestedAt: "2026-09-29T10:00:00.000Z" }),
      null,
    );
  });

  it("falls back to safe defaults for unknown status/category and bad weights", () => {
    const parsed = toSignatureRequest({
      id: "TX-2",
      signerPublicKey: SIGNER,
      requestedAt: "2026-09-29T10:00:00.000Z",
      status: "hacked",
      category: "hacked",
      threshold: -4,
      collectedWeight: Number.NaN,
    });
    assert.equal(parsed?.status, "pending");
    assert.equal(parsed?.category, "operations");
    assert.equal(parsed?.threshold, 1);
    assert.equal(parsed?.collectedWeight, 0);
  });

  it("decodes realtime socket frames", () => {
    const frame = {
      type: "multisig_signature_request",
      data: {
        id: "TX-8",
        signerPublicKey: SIGNER,
        requestedAt: "2026-09-29T10:00:00.000Z",
        status: "pending",
      },
    };
    assert.equal(parseMultisigSocketEvent(frame)?.request?.id, "TX-8");
    assert.equal(
      parseMultisigSocketEvent({
        type: "multisig_signature_resolved",
        data: { requestId: "TX-8" },
      })?.resolvedRequestId,
      "TX-8",
    );
    assert.equal(parseMultisigSocketEvent({ type: "price_update", data: {} }), null);
    assert.equal(parseMultisigSocketEvent(null), null);
  });

  it("decodes service-worker relay messages", () => {
    assert.equal(
      parseServiceWorkerSignatureRequest({
        type: MULTISIG_PUSH_MESSAGE_TYPE,
        request: {
          id: "TX-11",
          signerPublicKey: SIGNER,
          requestedAt: "2026-09-29T10:00:00.000Z",
        },
      })?.id,
      "TX-11",
    );
    assert.equal(
      parseServiceWorkerSignatureRequest({ type: "SF_PUSH_DEEP_LINK", url: "/" }),
      null,
    );
  });
});

describe("Realtime bus (#962)", () => {
  it("fans out published requests and resolutions to subscribers", () => {
    const bus = new EventTarget();
    const seen: string[] = [];
    const resolved: string[] = [];

    const unsubscribe = subscribeToSignatureRequestEvents(
      {
        onRequest: (r) => seen.push(r.id),
        onResolution: (id) => resolved.push(id),
      },
      bus,
    );

    publishSignatureRequest(request({ id: "TX-1" }), bus);
    publishSignatureRequest(request({ id: "TX-2" }), bus);
    publishSignatureResolution("TX-1", bus);

    assert.deepEqual(seen, ["TX-1", "TX-2"]);
    assert.deepEqual(resolved, ["TX-1"]);
    assert.equal(bus.dispatchEvent(new Event(MULTISIG_REQUEST_EVENT)), true);

    unsubscribe();
    publishSignatureRequest(request({ id: "TX-3" }), bus);
    assert.deepEqual(seen, ["TX-1", "TX-2"]);
  });

  it("ignores malformed bus payloads", () => {
    const bus = new EventTarget();
    const seen: string[] = [];
    const unsubscribe = subscribeToSignatureRequestEvents(
      { onRequest: (r) => seen.push(r.id) },
      bus,
    );

    bus.dispatchEvent(new CustomEvent(MULTISIG_REQUEST_EVENT, { detail: { id: 1 } }));
    bus.dispatchEvent(new CustomEvent(MULTISIG_REQUEST_EVENT, { detail: null }));

    assert.deepEqual(seen, []);
    unsubscribe();
  });
});

describe("Cached queue (#962)", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it("round-trips the pending queue through storage", () => {
    saveCachedSignatureRequests([request({ id: "TX-1" }), request({ id: "TX-2" })], storage);

    const loaded = loadCachedSignatureRequests(storage);
    assert.deepEqual(
      loaded.map((r) => r.id),
      ["TX-1", "TX-2"],
    );
    assert.equal(countPendingSignatureRequests(loaded, SIGNER), 2);
  });

  it("survives corrupt or unexpected cached JSON", () => {
    storage.setItem(MULTISIG_REQUESTS_STORAGE_KEY, "{not json");
    assert.deepEqual(loadCachedSignatureRequests(storage), []);

    storage.setItem(MULTISIG_REQUESTS_STORAGE_KEY, JSON.stringify({ requests: "no" }));
    assert.deepEqual(loadCachedSignatureRequests(storage), []);

    storage.setItem(
      MULTISIG_REQUESTS_STORAGE_KEY,
      JSON.stringify([{ id: "TX-1" }, request({ id: "TX-2" })]),
    );
    assert.deepEqual(
      loadCachedSignatureRequests(storage).map((r) => r.id),
      ["TX-2"],
    );
  });

  it("parses the { requests } wrapper shape", () => {
    assert.equal(
      parseSignatureRequests(JSON.stringify({ requests: [request({ id: "TX-9" })] }))[0]?.id,
      "TX-9",
    );
  });
});

describe("Demo mode + seed (#962)", () => {
  it("only treats the app as demo without a configured backend", () => {
    assert.equal(isMultisigDemoMode(undefined), true);
    assert.equal(isMultisigDemoMode(""), true);
    assert.equal(isMultisigDemoMode("https://api.stellarflow.network"), false);
  });

  it("addresses every demo envelope to the connected signer", () => {
    const seeded = buildDemoSignatureRequests(SIGNER, Date.UTC(2026, 8, 29, 12));
    assert.equal(seeded.length, 2);
    assert.equal(countPendingSignatureRequests(seeded, SIGNER), 2);
    assert.equal(countPendingSignatureRequests(seeded, OTHER_SIGNER), 0);
  });

  it("falls back to the demo co-signer key when no wallet is connected", () => {
    const seeded = buildDemoSignatureRequests(null);
    assert.equal(
      countPendingSignatureRequests(seeded, seeded[0].signerPublicKey),
      seeded.length,
    );
  });
});
