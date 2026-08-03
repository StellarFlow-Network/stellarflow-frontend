/**
 * Delegation Transaction Operations
 *
 * Builds, signs (via Freighter), and submits a delegation transaction
 * that transfers voting weight to a trusted community delegate.
 *
 * This module is lazily loaded — the Stellar SDK and Freighter adapter
 * are only fetched when the user explicitly clicks "Delegate".
 */

/**
 * Submits a delegation transaction assigning voting weight to a delegate.
 *
 * @param delegateAddress - The Stellar public key of the delegate
 * @param amount - Amount of XLM voting weight to delegate (as string to avoid float issues)
 * @returns The transaction hash on success
 */
export async function submitDelegation(
  delegateAddress: string,
  amount: string,
): Promise<string> {
  const { isConnected, getAddress } = await import('@stellar/freighter-api');
  const {
    TransactionBuilder,
    Networks,
    Operation,
    Asset,
  } = await import('@stellar/stellar-sdk');

  // ── Pre-flight checks ──────────────────────────────────────────────────
  if (!delegateAddress || !delegateAddress.startsWith('G')) {
    throw new Error('Invalid delegate address.');
  }

  if (!(await isConnected())) {
    throw new Error(
      'Freighter wallet is not connected. Please connect your wallet first.',
    );
  }

  const { address: publicKey } = await getAddress();
  if (!publicKey) {
    throw new Error('Could not retrieve public key from Freighter.');
  }

  // ── Build transaction ──────────────────────────────────────────────────
  const Horizon = (await import('@stellar/stellar-sdk')).Horizon;
  const server = new Horizon.Server('https://horizon-testnet.stellar.org');

  const account = await server.loadAccount(publicKey);
  const fee = await server.fetchBaseFee();

  const txBuilder = new TransactionBuilder(account, {
    fee: fee.toString(),
    networkPassphrase: Networks.TESTNET,
  });

  // Add a payment operation with a memo identifying this as a delegation
  txBuilder.addOperation(
    Operation.payment({
      destination: delegateAddress,
      asset: Asset.native(),
      amount: '0.0000001', // Minimum dust amount to record the delegation on-chain
    }),
  );

  txBuilder.setTimeout(60);
  txBuilder.addMemo(
    (await import('@stellar/stellar-sdk')).Memo.text('delegate:' + amount),
  );

  const tx = txBuilder.build();

  // ── Sign with Freighter ────────────────────────────────────────────────
  const { signTransaction } = await import('@stellar/freighter-api');
  const { signedTxXdr, error } = await signTransaction(tx.toXDR(), {
    networkPassphrase: Networks.TESTNET,
  });

  if (error || !signedTxXdr) {
    throw new Error('Transaction signing failed or was canceled.');
  }

  // ── Submit ─────────────────────────────────────────────────────────────
  const signedTx = TransactionBuilder.fromXDR(
    signedTxXdr,
    Networks.TESTNET,
  );

  const response = await server.submitTransaction(signedTx);

  if (!response.successful) {
    throw new Error('Delegation transaction failed on the network.');
  }

  return response.hash;
}
