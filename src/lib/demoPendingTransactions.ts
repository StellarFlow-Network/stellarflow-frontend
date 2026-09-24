/**
 * Demo pending-transaction generator.
 *
 * There is no production endpoint yet that surfaces a user's in-flight
 * Horizon submissions independent of the transaction history API, so the
 * "stuck transaction" feed that powers {@link TxSpeedUpModal} is seeded here
 * with signed, structurally valid envelopes built from throwaway keypairs.
 *
 * The envelopes are real (built and signed with `@stellar/stellar-sdk`), so
 * `inspectTransaction` reads genuine fee/sequence/operation data out of them
 * — only the "is this actually still queued on Horizon" polling step is
 * mocked, matching the demo-mode convention already used by the remittance
 * status page (`IS_DEMO_MODE` / `useMockStatus`).
 *
 * Swap this module for a real "list my pending submissions" API once one
 * exists; the shape it must produce is {@link DemoPendingTransfer}.
 */
import type { NetworkContext, PendingTransactionRef } from "@/lib/txSpeedUpOps";

export interface DemoPendingTransfer {
  id: string;
  /** Short human label, e.g. "Swap 250 XLM → USDC" */
  description: string;
  pending: PendingTransactionRef;
}

/**
 * Builds one signed classic payment envelope from a fresh random keypair,
 * back-dated past the stuck threshold so it immediately renders as
 * rescuable in the UI.
 */
async function buildDemoEnvelope(
  network: NetworkContext,
  ageMs: number,
  amount: string,
): Promise<PendingTransactionRef> {
  const { Keypair, Account, Asset, Operation, TransactionBuilder, TimeoutInfinite } =
    await import("@stellar/stellar-sdk");

  const source = Keypair.random();
  const destination = Keypair.random();
  // Sequence number is arbitrary here — nothing dereferences the account on
  // a real ledger in demo mode — but it must be numeric and non-negative.
  const account = new Account(source.publicKey(), "100");

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: network.networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: destination.publicKey(),
        asset: Asset.native(),
        amount,
      }),
    )
    .setTimeout(TimeoutInfinite)
    .build();

  tx.sign(source);

  return {
    hash: Buffer.from(tx.hash()).toString("hex"),
    xdr: tx.toXDR(),
    submittedAt: Date.now() - ageMs,
  };
}

/**
 * Produces a small set of demo "stuck" transfers, all older than the
 * 30-second threshold, so `TxSpeedUpModal` opens straight into the rescuable
 * state.
 */
export async function fetchDemoPendingTransfers(
  network: NetworkContext,
): Promise<DemoPendingTransfer[]> {
  const [swap, remittance] = await Promise.all([
    buildDemoEnvelope(network, 96_000, "250"),
    buildDemoEnvelope(network, 47_000, "100"),
  ]);

  return [
    {
      id: "pending-demo-1",
      description: "Swap 250 XLM → USDC",
      pending: swap,
    },
    {
      id: "pending-demo-2",
      description: "Remittance payout 100 XLM",
      pending: remittance,
    },
  ];
}
