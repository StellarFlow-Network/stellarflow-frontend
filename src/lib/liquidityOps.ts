/**
 * Atomic single-sided liquidity operations.
 *
 * The pool contract performs the internal swap and LP mint in one invocation;
 * the wallet therefore signs one transaction and cannot leave the user with
 * only half of the intended deposit.
 */

const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
const DEFAULT_FEE = "100000";

export interface SingleSidedLiquidityParams {
  poolContractId: string;
  tokenInId: string;
  amountIn: bigint;
  minAmountA: bigint;
  minAmountB: bigint;
  minLpAmount: bigint;
}

export interface SingleSidedLiquidityResult {
  txHash: string;
}

async function waitForTransaction(
  server: InstanceType<
    Awaited<typeof import("@stellar/stellar-sdk/rpc")>["Server"]
  >,
  hash: string,
): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await server.getTransaction(hash);
    if (response.status === "SUCCESS") return;
    if (response.status === "FAILED") {
      throw new Error("Single-sided liquidity transaction failed on Soroban.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Timed out waiting for liquidity transaction confirmation.");
}

export async function submitSingleSidedLiquidity(
  params: SingleSidedLiquidityParams,
): Promise<SingleSidedLiquidityResult> {
  if (typeof window !== "undefined" && (window as any).__MOCK_TX_CONFIG__) {
    const mockConfig = (window as any).__MOCK_TX_CONFIG__;
    await new Promise((resolve) => setTimeout(resolve, mockConfig.delayMs || 1000));
    if (mockConfig.simulateFailure) throw new Error("Mock transaction failure simulated.");
    return { txHash: "mock_tx_" + Math.random().toString(36).substring(2, 15) };
  }

  const { isConnected, getAddress, signTransaction } = await import(
    "@stellar/freighter-api"
  );
  const {
    Address,
    Contract,
    Networks,
    TransactionBuilder,
  } = await import("@stellar/stellar-sdk");
  const { Server } = await import("@stellar/stellar-sdk/rpc");

  if (!(await isConnected())) {
    throw new Error("Freighter wallet is not connected. Please connect your wallet first.");
  }
  const { address: publicKey } = await getAddress();
  if (!publicKey) throw new Error("Could not retrieve public key from Freighter.");

  const server = new Server(SOROBAN_RPC_URL, { allowHttp: true });
  const { nativeToScVal } = await import("@stellar/stellar-sdk");
  const transaction = new TransactionBuilder(await server.getAccount(publicKey), {
    fee: DEFAULT_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      new Contract(params.poolContractId).call(
        "add_liquidity_single_sided",
        Address.fromString(publicKey).toScVal(),
        Address.fromString(params.tokenInId).toScVal(),
        nativeToScVal(params.amountIn, { type: "i128" }),
        nativeToScVal(params.minAmountA, { type: "i128" }),
        nativeToScVal(params.minAmountB, { type: "i128" }),
        nativeToScVal(params.minLpAmount, { type: "i128" }),
      ),
    )
    .setTimeout(180)
    .build();

  const prepared = await server.prepareTransaction(transaction);
  const { signedTxXdr, error } = await signTransaction(prepared.toXDR(), {
    networkPassphrase: Networks.TESTNET,
  });
  if (error || !signedTxXdr) throw new Error("Transaction signing failed or was canceled.");

  const response = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedTxXdr, Networks.TESTNET),
  );
  if (response.status === "ERROR") throw new Error("Liquidity transaction submission failed.");
  await waitForTransaction(server, response.hash);
  return { txHash: response.hash };
}
