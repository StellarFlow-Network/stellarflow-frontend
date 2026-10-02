'use client';

import { useState } from 'react';
import { AlertTriangle, ClipboardPaste, FileSignature, Wallet } from 'lucide-react';
import MultisigSignModal from '@/components/governance/MultisigSignModal';
import { WalletProvider, useWallet } from '@/app/hooks/useWalletState';
import { MultisigQueueView } from '@/components/multisig';
import type { MultisigQueueFilter } from '@/services/multisigNotifications';

const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';

export interface MultisigDeskProps {
  /** Queue filter requested by the URL (`?filter=pending`) — see #962. */
  initialFilter?: MultisigQueueFilter;
  /** Envelope to focus on arrival (`?request=<id>`) — see #962. */
  highlightRequestId?: string | null;
}

function MultisigDashboardContent({
  initialFilter,
  highlightRequestId,
}: MultisigDeskProps) {
  const { wallet } = useWallet();
  const [rawXdr, setRawXdr] = useState('');
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [selectedXdr, setSelectedXdr] = useState<{ xdr: string; threshold: number } | null>(null);

  const reviewPastedEnvelope = () => {
    const xdr = rawXdr.trim();
    if (!xdr) {
      setIntakeError('Paste a base64 transaction envelope before reviewing it.');
      return;
    }
    setIntakeError(null);
    setSelectedXdr({ xdr, threshold: 1 });
  };

  return (
    <main className="min-h-screen bg-[#071016] px-4 py-8 text-slate-100 sm:px-8 lg:px-16">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#f5c842]">Signer workspace</p>
            <h1 className="text-4xl font-semibold tracking-tight">Multi-signature desk</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
              Inspect pending payloads awaiting co-signer approvals, track real-time signature quorum thresholds, and broadcast verified envelopes.
            </p>
          </div>
          <div className={`flex items-center gap-2 self-start rounded-full border px-3 py-2 text-sm ${wallet?.connected ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>
            <Wallet size={16} />
            {wallet?.connected ? 'Wallet extension connected' : 'Connect a wallet extension to sign'}
          </div>
        </header>

        {/* Core Queue & Threshold Tracker Component */}
        <section>
          <MultisigQueueView
            connectedUserPublicKey={wallet?.publicKey || null}
            initialFilter={initialFilter}
            highlightRequestId={highlightRequestId ?? null}
          />
        </section>

        {/* Raw Envelope Import Drawer */}
        <section className="rounded-2xl border border-white/10 bg-[#0d1a21] p-6 space-y-4">
          <div className="flex items-center gap-2 text-[#f5c842]">
            <ClipboardPaste size={18} />
            <h2 className="font-semibold text-slate-100">Review & Decode Raw Envelope XDR</h2>
          </div>
          <p className="text-xs text-slate-400">
            Import an external base64 transaction envelope from your coordinator or relayer for standalone inspection.
          </p>
          <textarea
            value={rawXdr}
            onChange={(event) => setRawXdr(event.target.value)}
            placeholder="AAAAAgAAA..."
            className="h-28 w-full resize-y rounded-xl border border-white/10 bg-[#071016] p-3 font-mono text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-[#f5c842]/60"
            aria-label="Raw transaction envelope XDR"
          />
          {intakeError && (
            <p className="flex gap-2 text-xs leading-5 text-amber-200">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {intakeError}
            </p>
          )}
          <button
            type="button"
            onClick={reviewPastedEnvelope}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#f5c842] px-4 py-2.5 text-xs font-bold text-[#071016] hover:bg-[#ffe083]"
          >
            <FileSignature size={15} /> Decode and review imported XDR
          </button>
        </section>
      </div>

      {selectedXdr && (
        <MultisigSignModal
          isOpen
          envelopeXdr={selectedXdr.xdr}
          networkPassphrase={TESTNET_PASSPHRASE}
          signatureThreshold={selectedXdr.threshold}
          onClose={() => setSelectedXdr(null)}
          onForwardToRelayer={async () => {
            setSelectedXdr(null);
          }}
        />
      )}
    </main>
  );
}

export function MultisigDesk(props: MultisigDeskProps) {
  return (
    <WalletProvider>
      <MultisigDashboardContent {...props} />
    </WalletProvider>
  );
}

export default MultisigDesk;
