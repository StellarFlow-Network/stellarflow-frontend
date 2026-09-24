'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowRight, ClipboardPaste, FileSignature, ShieldCheck, Wallet } from 'lucide-react';
import MultisigSignModal from '@/components/governance/MultisigSignModal';
import { WalletProvider, useWallet } from '@/app/hooks/useWalletState';

const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';

interface PendingEnvelope {
  id: string;
  title: string;
  createdAt: string;
  signatures: number;
  threshold: number;
  xdr: string;
}

const PENDING_ENVELOPES: PendingEnvelope[] = [
  { id: 'PAY-2048', title: 'Treasury operating allocation', createdAt: '12 minutes ago', signatures: 2, threshold: 3, xdr: '' },
  { id: 'OPS-7721', title: 'Relayer reserve top-up', createdAt: '48 minutes ago', signatures: 1, threshold: 3, xdr: '' },
];

function MultisigDashboardContent() {
  const { wallet } = useWallet();
  const [envelopes, setEnvelopes] = useState(PENDING_ENVELOPES);
  const [selected, setSelected] = useState<PendingEnvelope | null>(null);
  const [rawXdr, setRawXdr] = useState('');
  const [intakeError, setIntakeError] = useState<string | null>(null);

  const openEnvelope = (envelope: PendingEnvelope) => {
    if (!envelope.xdr) {
      setIntakeError('This queue item has no envelope attached yet. Paste its raw XDR below to review it.');
      return;
    }
    setIntakeError(null);
    setSelected(envelope);
  };

  const reviewPastedEnvelope = () => {
    const xdr = rawXdr.trim();
    if (!xdr) {
      setIntakeError('Paste a base64 transaction envelope before reviewing it.');
      return;
    }
    setIntakeError(null);
    setSelected({ id: 'IMPORTED', title: 'Imported transaction envelope', createdAt: 'Just now', signatures: 0, threshold: 1, xdr });
  };

  const markSigned = (signedXdr: string, signatureCount: number) => {
    setSelected((current) => current ? { ...current, xdr: signedXdr, signatures: signatureCount } : current);
    setEnvelopes((current) => current.map((envelope) => envelope.id === selected?.id ? { ...envelope, xdr: signedXdr, signatures: signatureCount } : envelope));
  };

  return (
    <main className="min-h-screen bg-[#071016] px-4 py-8 text-slate-100 sm:px-8 lg:px-16">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#f5c842]">Signer workspace</p>
            <h1 className="text-4xl font-semibold tracking-tight">Multi-signature desk</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Inspect every operation in a pending envelope, see exactly what the wallet is authorizing, and add your signature when the payload is verified.</p>
          </div>
          <div className={`flex items-center gap-2 self-start rounded-full border px-3 py-2 text-sm ${wallet?.connected ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>
            <Wallet size={16} />
            {wallet?.connected ? 'Wallet extension connected' : 'Connect a wallet extension to sign'}
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <Metric label="Awaiting your signature" value={String(envelopes.length)} detail="Pending envelopes" />
          <Metric label="Closest to execution" value="1 signature" detail="Needed on PAY-2048" />
          <Metric label="Signing network" value="Testnet" detail="Stellar test network" />
        </section>

        <section className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div><h2 className="text-lg font-semibold">Pending payloads</h2><p className="mt-1 text-sm text-slate-500">Raw XDR is decoded only when you open an envelope.</p></div>
              <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-400">{envelopes.length} open</span>
            </div>
            {envelopes.map((envelope) => {
              const missing = Math.max(envelope.threshold - envelope.signatures, 0);
              return <article key={envelope.id} className="border border-white/10 bg-[#0d1a21] p-5 transition-colors hover:border-[#f5c842]/50">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4"><div className="mt-1 rounded-md bg-[#f5c842]/10 p-2 text-[#f5c842]"><FileSignature size={18} /></div><div><p className="font-mono text-xs text-slate-500">{envelope.id}</p><h3 className="mt-1 font-medium">{envelope.title}</h3><p className="mt-1 text-xs text-slate-500">Received {envelope.createdAt}</p></div></div>
                  <div className="flex items-center gap-5 sm:text-right"><div><p className="text-xs uppercase tracking-wider text-slate-500">Signatures</p><p className="mt-1 font-mono text-sm text-slate-200">{envelope.signatures} / {envelope.threshold}</p></div><button onClick={() => openEnvelope(envelope)} className="flex items-center gap-2 border border-[#f5c842]/40 px-3 py-2 text-sm font-medium text-[#f5c842] hover:bg-[#f5c842]/10">Review <ArrowRight size={15} /></button></div>
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-xs">{missing > 0 ? <><AlertTriangle size={14} className="text-amber-300" /><span className="text-amber-200">{missing} signature{missing === 1 ? '' : 's'} missing before execution</span></> : <><ShieldCheck size={14} className="text-emerald-300" /><span className="text-emerald-300">Threshold met, ready for forwarding</span></>}</div>
              </article>;
            })}
          </div>

          <aside className="h-fit border border-white/10 bg-[#0d1a21] p-5">
            <div className="flex items-center gap-2 text-[#f5c842]"><ClipboardPaste size={18} /><h2 className="font-semibold text-slate-100">Review raw XDR</h2></div>
            <p className="mt-2 text-sm leading-5 text-slate-400">Import a pending base64 envelope from your coordinator or relayer.</p>
            <textarea value={rawXdr} onChange={(event) => setRawXdr(event.target.value)} placeholder="AAAAAgAAA..." className="mt-4 h-32 w-full resize-y border border-white/10 bg-[#071016] p-3 font-mono text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-[#f5c842]/60" aria-label="Raw transaction envelope XDR" />
            {intakeError && <p className="mt-3 flex gap-2 text-xs leading-5 text-amber-200"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{intakeError}</p>}
            <button onClick={reviewPastedEnvelope} className="mt-4 flex w-full items-center justify-center gap-2 bg-[#f5c842] px-4 py-3 text-sm font-semibold text-[#071016] hover:bg-[#ffe083]"><FileSignature size={16} /> Decode and review</button>
            <p className="mt-3 text-[11px] leading-4 text-slate-500">The envelope is decoded locally with the Stellar SDK. Verify the network and every destination before signing.</p>
          </aside>
        </section>
      </div>

      {selected && <MultisigSignModal isOpen envelopeXdr={selected.xdr} networkPassphrase={TESTNET_PASSPHRASE} signatureThreshold={selected.threshold} onClose={() => setSelected(null)} onForwardToRelayer={async ({ xdr, signatureCount }) => { markSigned(xdr, signatureCount); }} />}
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="border border-white/10 bg-[#0d1a21] p-5"><p className="text-xs uppercase tracking-wider text-slate-500">{label}</p><p className="mt-3 text-2xl font-semibold text-[#f5c842]">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}

export default function MultisigPage() {
  return <WalletProvider><MultisigDashboardContent /></WalletProvider>;
}