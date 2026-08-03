'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  X,
  ShieldCheck,
  Copy,
  Download,
  Send,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  KeyRound,
  FileSignature,
} from 'lucide-react';

export interface MultisigSigner {
  publicKey: string;
  label?: string;
}

export interface MultisigForwardPayload {
  xdr: string;
  signatureCount: number;
}

export interface MultisigSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Raw base64-encoded XDR transaction envelope pending co-signatures. */
  envelopeXdr: string;
  /** Defaults to the public Stellar testnet passphrase. */
  networkPassphrase?: string;
  /** Number of signatures required before the envelope can be forwarded. */
  signatureThreshold: number;
  /** Known multisig co-signers, used to label matched signature hints. */
  knownSigners?: MultisigSigner[];
  /** Forward the (partially or fully) signed envelope to a relayer. */
  onForwardToRelayer?: (payload: MultisigForwardPayload) => void | Promise<void>;
}

interface OperationSummary {
  type: string;
  fields: Array<[string, string]>;
}

interface DecodedEnvelope {
  sourceAccount: string;
  fee: string;
  sequence: string;
  memo: string | null;
  operations: OperationSummary[];
  signatureHints: string[];
}

const DEFAULT_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

// ---------------------------------------------------------------------------
// XDR decoding helpers
// ---------------------------------------------------------------------------

function formatAsset(asset: unknown): string {
  const a = asset as {
    isNative?: () => boolean;
    code?: string;
    issuer?: string;
  } | undefined;
  if (!a) return 'native';
  if (typeof a.isNative === 'function' && a.isNative()) return 'XLM (native)';
  if (!a.code) return 'native';
  const issuer = a.issuer ? `${a.issuer.slice(0, 4)}…${a.issuer.slice(-4)}` : '';
  return issuer ? `${a.code}:${issuer}` : a.code;
}

function formatMemo(memo: unknown): string | null {
  const m = memo as { type?: string; value?: unknown } | undefined;
  if (!m || !m.type || m.type === 'none') return null;
  return `${m.type}: ${String(m.value)}`;
}

function summarizeOperation(op: Record<string, unknown>): OperationSummary {
  const fields: Array<[string, string]> = [];
  const type = String(op.type ?? 'unknown');

  switch (type) {
    case 'payment':
      fields.push(['Destination', String(op.destination)]);
      fields.push(['Amount', String(op.amount)]);
      fields.push(['Asset', formatAsset(op.asset)]);
      break;
    case 'createAccount':
      fields.push(['New Account', String(op.destination)]);
      fields.push(['Starting Balance', String(op.startingBalance)]);
      break;
    case 'changeTrust':
      fields.push(['Asset', formatAsset(op.line)]);
      fields.push(['Limit', String(op.limit)]);
      break;
    case 'pathPaymentStrictSend':
    case 'pathPaymentStrictReceive':
      fields.push(['Destination', String(op.destination)]);
      fields.push(['Send Asset', formatAsset(op.sendAsset)]);
      fields.push(['Destination Asset', formatAsset(op.destAsset)]);
      break;
    case 'manageSellOffer':
    case 'manageBuyOffer':
      fields.push(['Selling', formatAsset(op.selling)]);
      fields.push(['Buying', formatAsset(op.buying)]);
      fields.push(['Amount', String(op.amount)]);
      break;
    case 'invokeHostFunction':
      fields.push(['Function', 'Soroban contract invocation']);
      break;
    case 'setOptions': {
      const signer = op.signer as { weight?: number } & Record<string, unknown> | undefined;
      if (signer) {
        const key = (signer.ed25519PublicKey as string) ?? (signer.key as string) ?? 'unknown';
        fields.push(['Signer Update', `${key} (weight ${signer.weight ?? 0})`]);
      }
      if (op.masterWeight !== undefined) fields.push(['Master Weight', String(op.masterWeight)]);
      if (op.lowThreshold !== undefined) fields.push(['Low Threshold', String(op.lowThreshold)]);
      if (op.medThreshold !== undefined) fields.push(['Medium Threshold', String(op.medThreshold)]);
      if (op.highThreshold !== undefined) fields.push(['High Threshold', String(op.highThreshold)]);
      break;
    }
    default:
      Object.entries(op).forEach(([key, value]) => {
        if (key === 'type') return;
        if (typeof value === 'string' || typeof value === 'number') {
          fields.push([key, String(value)]);
        }
      });
  }

  return { type, fields };
}

/** Decodes a raw XDR envelope into a readable summary using the Stellar SDK. */
async function decodeEnvelope(
  xdr: string,
  networkPassphrase: string,
): Promise<DecodedEnvelope> {
  const { TransactionBuilder } = await import('@stellar/stellar-sdk');
  const parsed = TransactionBuilder.fromXDR(xdr, networkPassphrase) as unknown as {
    signatures: Array<{ hint: () => Buffer }>;
    innerTransaction?: unknown;
  };

  const inner = (parsed.innerTransaction ?? parsed) as {
    source: string;
    fee: string | number;
    sequence: string;
    memo: unknown;
    operations: Array<Record<string, unknown>>;
  };

  return {
    sourceAccount: inner.source,
    fee: String(inner.fee),
    sequence: inner.sequence,
    memo: formatMemo(inner.memo),
    operations: inner.operations.map(summarizeOperation),
    signatureHints: parsed.signatures.map((sig) => sig.hint().toString('hex')),
  };
}

function matchSignerLabel(hint: string, signers: MultisigSigner[] | undefined): string {
  if (!signers?.length) return `Signature (hint ${hint})`;
  const match = signers.find((s) => s.publicKey.toLowerCase().endsWith(hint.toLowerCase()));
  return match ? match.label ?? match.publicKey : `Unknown signer (hint ${hint})`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MultisigSignModal({
  isOpen,
  onClose,
  envelopeXdr,
  networkPassphrase = DEFAULT_NETWORK_PASSPHRASE,
  signatureThreshold,
  knownSigners,
  onForwardToRelayer,
}: MultisigSignModalProps) {
  const [workingXdr, setWorkingXdr] = useState(envelopeXdr);
  const [decoded, setDecoded] = useState<DecodedEnvelope | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  const [isSigning, setIsSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  const [isForwarding, setIsForwarding] = useState(false);
  const [forwarded, setForwarded] = useState(false);
  const [copied, setCopied] = useState(false);

  const decode = useCallback(
    async (xdr: string) => {
      setIsDecoding(true);
      setDecodeError(null);
      try {
        const result = await decodeEnvelope(xdr, networkPassphrase);
        setDecoded(result);
      } catch (err) {
        setDecodeError(
          err instanceof Error ? err.message : 'Failed to decode transaction envelope.',
        );
      } finally {
        setIsDecoding(false);
      }
    },
    [networkPassphrase],
  );

  useEffect(() => {
    if (!isOpen) return;
    setWorkingXdr(envelopeXdr);
    setForwarded(false);
    setSignError(null);
    void decode(envelopeXdr);
  }, [isOpen, envelopeXdr, decode]);

  const handleSign = async () => {
    setIsSigning(true);
    setSignError(null);
    try {
      const { isConnected, getAddress, signTransaction } = await import(
        '@stellar/freighter-api'
      );

      if (!(await isConnected())) {
        throw new Error('Connect a Freighter wallet to add your signature.');
      }

      const { address } = await getAddress();
      const { signedTxXdr, error } = await signTransaction(workingXdr, {
        networkPassphrase,
        address,
      });

      if (error || !signedTxXdr) {
        throw new Error(error?.message ?? 'Signing was cancelled or failed.');
      }

      setWorkingXdr(signedTxXdr);
      await decode(signedTxXdr);
    } catch (err) {
      setSignError(err instanceof Error ? err.message : 'Signing failed.');
    } finally {
      setIsSigning(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(workingXdr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    const blob = new Blob([workingXdr], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `multisig-envelope-${Date.now()}.xdr.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleForward = async () => {
    setIsForwarding(true);
    setSignError(null);
    try {
      if (onForwardToRelayer) {
        await onForwardToRelayer({ xdr: workingXdr, signatureCount: signatureCount });
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setForwarded(true);
    } catch (err) {
      setSignError(
        err instanceof Error ? err.message : 'Failed to forward the envelope to the relayer.',
      );
    } finally {
      setIsForwarding(false);
    }
  };

  if (!isOpen) return null;

  const signatureCount = decoded?.signatureHints.length ?? 0;
  const thresholdMet = signatureCount >= signatureThreshold;
  const progressPct = Math.min(100, (signatureCount / Math.max(signatureThreshold, 1)) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-800 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FileSignature size={22} className="text-blue-500" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Co-Sign Transaction</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {isDecoding && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 size={16} className="animate-spin" /> Decoding transaction envelope…
            </div>
          )}

          {decodeError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-sm text-red-600 dark:text-red-300">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              {decodeError}
            </div>
          )}

          {decoded && (
            <>
              {/* Signature progress */}
              <div className="rounded-lg border border-blue-500/20 bg-blue-50 dark:bg-blue-950/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400">
                    <ShieldCheck size={16} /> Signature Threshold
                  </div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {signatureCount} / {signatureThreshold}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${thresholdMet ? 'bg-emerald-500' : 'bg-blue-500'}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                {decoded.signatureHints.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    {decoded.signatureHints.map((hint, idx) => (
                      <li key={`${hint}-${idx}`} className="flex items-center gap-2">
                        <KeyRound size={12} className="text-blue-400 shrink-0" />
                        {matchSignerLabel(hint, knownSigners)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Transaction summary */}
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 divide-y divide-gray-200 dark:divide-gray-800">
                <div className="p-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs uppercase font-semibold text-gray-500 mb-0.5">Source Account</p>
                    <p className="font-mono text-gray-800 dark:text-gray-200 break-all">{decoded.sourceAccount}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase font-semibold text-gray-500 mb-0.5">Sequence</p>
                    <p className="font-mono text-gray-800 dark:text-gray-200">{decoded.sequence}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase font-semibold text-gray-500 mb-0.5">Fee</p>
                    <p className="font-mono text-gray-800 dark:text-gray-200">{decoded.fee} stroops</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase font-semibold text-gray-500 mb-0.5">Memo</p>
                    <p className="font-mono text-gray-800 dark:text-gray-200">{decoded.memo ?? '—'}</p>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <p className="text-xs uppercase font-semibold text-gray-500">
                    Operations ({decoded.operations.length})
                  </p>
                  {decoded.operations.map((op, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-3"
                    >
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{op.type}</p>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        {op.fields.map(([label, value]) => (
                          <React.Fragment key={label}>
                            <dt className="text-gray-500">{label}</dt>
                            <dd className="font-mono text-gray-700 dark:text-gray-300 break-all">{value}</dd>
                          </React.Fragment>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              </div>

              {signError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-sm text-red-600 dark:text-red-300">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  {signError}
                </div>
              )}

              {forwarded && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-300">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  Envelope forwarded to the relayer for execution.
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!decoded}
            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center gap-2 text-gray-700 dark:text-gray-300 transition-colors"
          >
            <Copy size={16} /> {copied ? 'Copied!' : 'Copy XDR'}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!decoded}
            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center gap-2 text-gray-700 dark:text-gray-300 transition-colors"
          >
            <Download size={16} /> Export
          </button>
          <button
            type="button"
            onClick={handleSign}
            disabled={!decoded || isSigning}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 font-medium transition-colors"
          >
            {isSigning ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            {isSigning ? 'Signing…' : 'Sign with Connected Key'}
          </button>
          <button
            type="button"
            onClick={handleForward}
            disabled={!thresholdMet || isForwarding || forwarded}
            className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 font-medium transition-colors"
          >
            {isForwarding ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {forwarded ? 'Forwarded' : 'Forward to Relayer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MultisigSignModal;
