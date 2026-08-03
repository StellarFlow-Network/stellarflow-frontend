import { rpcManager } from '@/services/rpc';

const DEFAULT_FEE = '100000';

export interface ClaimEscrowParams {
  contractId: string;
  preimageHex: string;
}

export interface ClaimEscrowResult {
  txHash: string;
}

async function waitForTransaction(
  server: InstanceType<
    Awaited<typeof import('@stellar/stellar-sdk')>['rpc']['Server']
  >,
  hash: string,
): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await server.getTransaction(hash);

    if (response.status === 'SUCCESS') {
      return;
    }

    if (response.status === 'FAILED') {
      throw new Error('Claim transaction failed on the Soroban network.');
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error('Timed out waiting for claim transaction confirmation.');
}

export async function claimEscrow({
  contractId,
  preimageHex,
}: ClaimEscrowParams): Promise<ClaimEscrowResult> {
  const { isConnected, getAddress, signTransaction } = await import(
    '@stellar/freighter-api'
  );
  const {
    Contract,
    Networks,
    rpc,
    TransactionBuilder,
    nativeToScVal,
  } = await import('@stellar/stellar-sdk');

  if (!(await isConnected())) {
    throw new Error('Freighter wallet is not connected. Please connect your wallet first.');
  }

  const { address: publicKey } = await getAddress();
  if (!publicKey) {
    throw new Error('Could not retrieve public key from Freighter.');
  }

  const rpcServer = new rpc.Server(SOROBAN_RPC_URL, { allowHttp: true });
  const contract = new Contract(contractId);
  const preimageBytes = Buffer.from(preimageHex, 'hex');

  const sourceAccount = await rpcManager.execute((server) => server.getAccount(publicKey));

  const builtTx = new TransactionBuilder(sourceAccount, {
    fee: DEFAULT_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      contract.call('claim', nativeToScVal(preimageBytes, { type: 'bytes' })),
    )
    .setTimeout(180)
    .build();

  const preparedTx = await rpcManager.execute((server) => server.prepareTransaction(builtTx));

  const { signedTxXdr, error } = await signTransaction(preparedTx.toXDR(), {
    networkPassphrase: Networks.TESTNET,
  });

  if (error || !signedTxXdr) {
    throw new Error('Transaction signing failed or was canceled.');
  }

  const signedTx = TransactionBuilder.fromXDR(
    signedTxXdr,
    Networks.TESTNET,
  );

  const submitResponse = await rpcManager.execute((server) => server.sendTransaction(signedTx));

  if (submitResponse.status === 'ERROR') {
    throw new Error(
      submitResponse.errorResult
        ? `Claim submission failed: ${submitResponse.errorResult}`
        : 'Claim submission failed.',
    );
  }

  const rpcServer = await rpcManager.getServer();
  await waitForTransaction(rpcServer, submitResponse.hash);

  return { txHash: submitResponse.hash };
}
