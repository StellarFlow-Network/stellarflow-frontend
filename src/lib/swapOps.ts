/**
 * Soroban swap contract operations.
 *
 * Stellar SDK and Freighter are lazy-loaded so they stay out of the initial bundle
 * until a user explicitly submits a swap transaction.
 */

const SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';
const DEFAULT_FEE = '100000';

export interface SwapParams {
  /** Soroban AMM/router contract address */
  contractId: string;
  /** Contract address of the asset being sold */
  tokenInId: string;
  /** Contract address of the asset being bought */
  tokenOutId: string;
  /** Amount of `tokenIn` to sell, in the token's smallest unit (stroops) */
  amountIn: bigint;
  /**
   * Minimum acceptable amount of `tokenOut` to receive, in the token's
   * smallest unit. Derived from the quoted output and the user's slippage
   * tolerance via `calculateMinAmountOut` — the contract call reverts if the
   * realized output would fall below this guard.
   */
  minAmountOut: bigint;
}

export interface SwapResult {
  txHash: string;
}

async function waitForTransaction(
  server: InstanceType<
    Awaited<typeof import('@stellar/stellar-sdk')>['SorobanRpc']['Server']
  >,
  hash: string,
): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await server.getTransaction(hash);

    if (response.status === 'SUCCESS') {
      return;
    }

    if (response.status === 'FAILED') {
      throw new Error('Swap transaction failed on the Soroban network.');
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error('Timed out waiting for swap transaction confirmation.');
}

/**
 * Builds, signs (via Freighter), and submits a `swap()` Soroban invocation
 * with the `min_amount_out` guard populated from the caller's slippage
 * tolerance selection.
 */
export async function submitSwap({
  contractId,
  tokenInId,
  tokenOutId,
  amountIn,
  minAmountOut,
}: SwapParams): Promise<SwapResult> {
  const { isConnected, getAddress, signTransaction } = await import(
    '@stellar/freighter-api'
  );
  const {
    Address,
    Contract,
    Networks,
    SorobanRpc,
    TransactionBuilder,
    nativeToScVal,
    Transaction,
  } = await import('@stellar/stellar-sdk');

  if (!(await isConnected())) {
    throw new Error('Freighter wallet is not connected. Please connect your wallet first.');
  }

  const { address: publicKey } = await getAddress();
  if (!publicKey) {
    throw new Error('Could not retrieve public key from Freighter.');
  }

  const rpcServer = new SorobanRpc.Server(SOROBAN_RPC_URL, { allowHttp: true });
  const contract = new Contract(contractId);

  const sourceAccount = await rpcServer.getAccount(publicKey);

  const builtTx = new TransactionBuilder(sourceAccount, {
    fee: DEFAULT_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      contract.call(
        'swap',
        Address.fromString(publicKey).toScVal(),
        Address.fromString(tokenInId).toScVal(),
        Address.fromString(tokenOutId).toScVal(),
        nativeToScVal(amountIn, { type: 'i128' }),
        nativeToScVal(minAmountOut, { type: 'i128' }),
      ),
    )
    .setTimeout(180)
    .build();

  const preparedTx = await rpcServer.prepareTransaction(builtTx);

  const { signedTxXdr, error } = await signTransaction(preparedTx.toXDR(), {
    networkPassphrase: Networks.TESTNET,
  });

  if (error || !signedTxXdr) {
    throw new Error('Transaction signing failed or was canceled.');
  }

  const signedTx = TransactionBuilder.fromXDR(
    signedTxXdr,
    Networks.TESTNET,
  ) as InstanceType<typeof Transaction>;

  const submitResponse = await rpcServer.sendTransaction(signedTx);

  if (submitResponse.status === 'ERROR') {
    throw new Error(
      submitResponse.errorResult
        ? `Swap submission failed: ${submitResponse.errorResult}`
        : 'Swap submission failed.',
    );
  }

  await waitForTransaction(rpcServer, submitResponse.hash);

  return { txHash: submitResponse.hash };
}
