/**
 * Limit order contract operations.
 *
 * Stellar SDK and Freighter are lazy-loaded so they stay out of the initial
 * bundle until a user explicitly submits or cancels a limit order.
 */

const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
const DEFAULT_FEE = "100000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LimitOrderParams {
  /** Soroban limit-order contract address */
  contractId: string;
  /** Asset being sold (SAC contract address) */
  sellAsset: string;
  /** Asset being bought (SAC contract address) */
  buyAsset: string;
  /** Amount of sellAsset to place */
  sellAmount: string;
  /** Target execution price (buyAsset per unit of sellAsset) */
  targetPrice: string;
  /** Unix timestamp (seconds) after which the order expires */
  expiryTimestamp: number;
}

export interface LimitOrderResult {
  txHash: string;
  orderId: string;
}

export interface ActiveLimitOrder {
  id: string;
  sellAsset: string;
  buyAsset: string;
  /** Human-readable trading pair e.g. "XLM/USDC" */
  pair: string;
  /** "buy" or "sell" */
  side: string;
  targetPrice: string;
  amount: string;
  status: "open" | "filled" | "cancelled" | "expired";
  expiryTimestamp: number;
  createdAt: number;
  contractId: string;
}

export interface CancelOrderParams {
  contractId: string;
  orderId: string;
}

export interface CancelOrderResult {
  txHash: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function waitForTransaction(
  server: InstanceType<
    Awaited<typeof import("@stellar/stellar-sdk")>["SorobanRpc"]["Server"]
  >,
  hash: string,
): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await server.getTransaction(hash);

    if (response.status === "SUCCESS") {
      return;
    }

    if (response.status === "FAILED") {
      throw new Error("Limit order transaction failed on the Soroban network.");
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Timed out waiting for limit order transaction confirmation.");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Submits a new limit order to the Soroban limit-order contract.
 *
 * Builds, signs (via Freighter), and submits a `place_order()` Soroban
 * invocation that places a limit order with the specified parameters.
 */
export async function submitLimitOrder(
  params: LimitOrderParams,
): Promise<LimitOrderResult> {
  const { isConnected, getAddress, signTransaction } = await import(
    "@stellar/freighter-api"
  );
  const {
    Contract,
    Networks,
    SorobanRpc,
    TransactionBuilder,
    nativeToScVal,
    Transaction,
  } = await import("@stellar/stellar-sdk");

  if (!(await isConnected())) {
    throw new Error(
      "Freighter wallet is not connected. Please connect your wallet first.",
    );
  }

  const { address: publicKey } = await getAddress();
  if (!publicKey) {
    throw new Error("Could not retrieve public key from Freighter.");
  }

  const rpcServer = new SorobanRpc.Server(SOROBAN_RPC_URL, {
    allowHttp: true,
  });
  const contract = new Contract(params.contractId);

  const sourceAccount = await rpcServer.getAccount(publicKey);

  // Build the Soroban invocation: contract.place_order(sell_asset, buy_asset, amount, price, expiry)
  const builtTx = new TransactionBuilder(sourceAccount, {
    fee: DEFAULT_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      contract.call(
        "place_order",
        nativeToScVal(params.sellAsset, { type: "address" }),
        nativeToScVal(params.buyAsset, { type: "address" }),
        nativeToScVal(params.sellAmount, { type: "i128" }),
        nativeToScVal(params.targetPrice, { type: "i128" }),
        nativeToScVal(params.expiryTimestamp, { type: "u64" }),
      ),
    )
    .setTimeout(180)
    .build();

  const preparedTx = await rpcServer.prepareTransaction(builtTx);

  const { signedTxXdr, error } = await signTransaction(preparedTx.toXDR(), {
    networkPassphrase: Networks.TESTNET,
  });

  if (error || !signedTxXdr) {
    throw new Error("Transaction signing failed or was canceled.");
  }

  const signedTx = TransactionBuilder.fromXDR(
    signedTxXdr,
    Networks.TESTNET,
  ) as Transaction;

  const submitResponse = await rpcServer.sendTransaction(signedTx);

  if (submitResponse.status === "ERROR") {
    throw new Error(
      submitResponse.errorResult
        ? `Limit order submission failed: ${submitResponse.errorResult}`
        : "Limit order submission failed.",
    );
  }

  await waitForTransaction(rpcServer, submitResponse.hash);

  // Derive a deterministic order ID from the transaction hash
  const orderId = submitResponse.hash.slice(0, 16);

  return { txHash: submitResponse.hash, orderId };
}

/**
 * Cancels an existing open limit order on the Soroban limit-order contract.
 */
export async function cancelLimitOrder(
  params: CancelOrderParams,
): Promise<CancelOrderResult> {
  const { isConnected, getAddress, signTransaction } = await import(
    "@stellar/freighter-api"
  );
  const {
    Contract,
    Networks,
    SorobanRpc,
    TransactionBuilder,
    nativeToScVal,
    Transaction,
  } = await import("@stellar/stellar-sdk");

  if (!(await isConnected())) {
    throw new Error(
      "Freighter wallet is not connected. Please connect your wallet first.",
    );
  }

  const { address: publicKey } = await getAddress();
  if (!publicKey) {
    throw new Error("Could not retrieve public key from Freighter.");
  }

  const rpcServer = new SorobanRpc.Server(SOROBAN_RPC_URL, {
    allowHttp: true,
  });
  const contract = new Contract(params.contractId);

  const sourceAccount = await rpcServer.getAccount(publicKey);

  const builtTx = new TransactionBuilder(sourceAccount, {
    fee: DEFAULT_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      contract.call(
        "cancel_order",
        nativeToScVal(params.orderId, { type: "symbol" }),
      ),
    )
    .setTimeout(180)
    .build();

  const preparedTx = await rpcServer.prepareTransaction(builtTx);

  const { signedTxXdr, error } = await signTransaction(preparedTx.toXDR(), {
    networkPassphrase: Networks.TESTNET,
  });

  if (error || !signedTxXdr) {
    throw new Error("Transaction signing failed or was canceled.");
  }

  const signedTx = TransactionBuilder.fromXDR(
    signedTxXdr,
    Networks.TESTNET,
  ) as Transaction;

  const submitResponse = await rpcServer.sendTransaction(signedTx);

  if (submitResponse.status === "ERROR") {
    throw new Error(
      submitResponse.errorResult
        ? `Order cancellation failed: ${submitResponse.errorResult}`
        : "Order cancellation failed.",
    );
  }

  await waitForTransaction(rpcServer, submitResponse.hash);

  return { txHash: submitResponse.hash };
}

/**
 * Simulates fetching active limit orders for the connected wallet.
 *
 * In a production environment this would query the limit-order contract's
 * `get_orders(owner)` entry point and return the parsed results.
 *
 * Returns mock data shaped like real contract responses so the UI can be
 * developed and tested before the on-chain contract is finalised.
 */
export async function fetchActiveOrders(
  publicKey: string,
): Promise<ActiveLimitOrder[]> {
  void publicKey; // tree-shake guard — real RPC query goes here

  // Simulate network latency
  await new Promise<void>((resolve) => setTimeout(resolve, 400));

  // Return empty by default — real orders would come from contract queries
  return [];
}
