import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { CoSigner } from "../../components/multisig/SignatureStatusCard.tsx";

describe("Multisig Queue & Signature Threshold Tracker (#929)", () => {
  function calculateTotalWeight(signers: CoSigner[]): number {
    return signers.reduce((sum, s) => (s.status === "approved" ? sum + s.weight : sum), 0);
  }

  function isQuorumReached(signers: CoSigner[], threshold: number): boolean {
    return calculateTotalWeight(signers) >= threshold;
  }

  const signers: CoSigner[] = [
    {
      publicKey: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ",
      name: "Signer 1",
      weight: 1,
      status: "approved",
    },
    {
      publicKey: "GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXDV90210",
      name: "Signer 2",
      weight: 1,
      status: "pending",
    },
    {
      publicKey: "GCYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYDV11111",
      name: "Signer 3",
      weight: 1,
      status: "pending",
    },
  ];

  it("calculates initial collected signature weight", () => {
    const weight = calculateTotalWeight(signers);
    assert.equal(weight, 1);
    assert.equal(isQuorumReached(signers, 2), false);
  });

  it("updates threshold status instantly when co-signer approves", () => {
    const updated = signers.map((s) =>
      s.publicKey === "GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXDV90210"
        ? { ...s, status: "approved" as const, signedAt: new Date().toISOString() }
        : s
    );
    const weight = calculateTotalWeight(updated);
    assert.equal(weight, 2);
    assert.equal(isQuorumReached(updated, 2), true);
  });

  it("reverts threshold status when signature is revoked", () => {
    const approvedSigners = signers.map((s) => ({ ...s, status: "approved" as const }));
    assert.equal(isQuorumReached(approvedSigners, 3), true);

    const revoked = approvedSigners.map((s) =>
      s.publicKey === "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ"
        ? { ...s, status: "revoked" as const }
        : s
    );
    const weight = calculateTotalWeight(revoked);
    assert.equal(weight, 2);
    assert.equal(isQuorumReached(revoked, 3), false);
  });
});
