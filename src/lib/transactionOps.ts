/**
 * Heavy transaction operations module.
 *
 * The Stellar SDK and Freighter wallet adapter are imported lazily inside
 * each function so they are not part of the initial dashboard bundle.
 * These modules are only fetched when a user explicitly clicks an action
 * button that triggers verification or submission.
 */

/**
 * Verifies a transaction on the Stellar ledger using the official Stellar SDK.
 * @param hash The transaction hash to verify.
 */
export async function verifyOnLedger(hash?: string): Promise<boolean> {
  if (!hash) {
    throw new Error("Transaction hash is required for verification.");
  }

  const { Horizon } = await import("@stellar/stellar-sdk");
  const server = new Horizon.Server("https://horizon-testnet.stellar.org");

  console.log("Initializing secure ledger verification via Horizon...");
  try {
    const tx = await server.transactions().transaction(hash).call();
    console.log("Verification complete for hash:", tx.hash);
    return tx.successful;
  } catch (err) {
    console.error("Ledger verification failed:", err);
    return false;
  }
}

/**
 * Builds, signs (via Freighter), and submits a transaction to the Stellar network.
 * @param payload The staking allocations payload.
 */
export async function submitTransaction(payload: Record<string, number>): Promise<string> {
  console.log("Preparing transaction with payload:", payload);

  if (typeof window !== "undefined" && (window as any).__MOCK_TX_CONFIG__) {
    const mockConfig = (window as any).__MOCK_TX_CONFIG__;
    console.log("Mock Provider intercepted transaction:", payload);
    
    await new Promise((resolve) => setTimeout(resolve, mockConfig.delayMs || 1000));
    
    if (mockConfig.simulateFailure) {
      throw new Error("Mock transaction failure simulated.");
    }
    
    // Return fake hash
    return "mock_tx_" + Math.random().toString(36).substring(2, 15);
  }

  const { isConnected, getAddress } = await import("@stellar/freighter-api");
  const { Horizon, TransactionBuilder, Networks, Transaction } = await import("@stellar/stellar-sdk");

  if (!(await isConnected())) {
    throw new Error("Freighter wallet is not connected. Please connect your wallet first.");
  }

  const { address: publicKey } = await getAddress();
  if (!publicKey) {
    throw new Error("Could not retrieve public key from Freighter.");
  }

  const server = new Horizon.Server("https://horizon-testnet.stellar.org");

  // Load account from Horizon to get the current sequence number
  const account = await server.loadAccount(publicKey);
  const fee = await server.fetchBaseFee();

  // Initialize TransactionBuilder
  const txBuilder = new TransactionBuilder(account, {
    fee: fee.toString(),
    networkPassphrase: Networks.TESTNET,
  });

  // A timebounds configuration is required for all transactions
  txBuilder.setTimeout(60); // 60 seconds timeout

  // Build the transaction
  const tx = txBuilder.build();

  // Request the user's signature via the Freighter extension
  const { signedTxXdr, error } = await import("@stellar/freighter-api").then(m => m.signTransaction(tx.toXDR(), {
    networkPassphrase: Networks.TESTNET,
  }));

  if (error || !signedTxXdr) {
    throw new Error(`Transaction signing failed or was canceled.`);
  }

  // Reconstruct the transaction from the signed XDR
  const signedTx = TransactionBuilder.fromXDR(signedTxXdr, Networks.TESTNET);

  // Submit to the Stellar network
  const response = await server.submitTransaction(signedTx);

  if (!response.successful) {
    throw new Error("Transaction failed on the network");
  }

  return response.hash;
}
