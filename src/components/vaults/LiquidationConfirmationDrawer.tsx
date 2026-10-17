"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatRiskUsd, type RiskVault } from "./vaultRisk";

interface Props {
  vault: RiskVault | null;
  onClose: () => void;
  onConfirm?: (vaultId: string) => Promise<void>;
}

export default function LiquidationConfirmationDrawer({ vault, onClose, onConfirm }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const eligible = vault !== null && Number.isFinite(vault.healthFactor) && vault.healthFactor >= 0 && vault.healthFactor < 1;

  useEffect(() => {
    mounted.current = true;
    const opener = document.activeElement;
    return () => {
      mounted.current = false;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const element = dialog.current;
    if (vault && element && !element.open) element.showModal();
    if (!vault && element?.open) element.close();
  }, [vault]);

  async function confirm() {
    if (!vault || !eligible || !onConfirm || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await onConfirm(vault.id);
      if (mounted.current) onClose();
    } catch {
      if (mounted.current) setError("Liquidation could not be submitted. Please refresh the vault and try again.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setPending(false);
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}
      className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-md border-l border-slate-700 bg-slate-950 p-6 text-slate-100 shadow-2xl backdrop:bg-black/60">
      <div className="flex items-center justify-between gap-4">
        <h2 id={titleId} className="text-xl font-semibold">Confirm liquidation</h2>
        <button type="button" disabled={pending} onClick={onClose} aria-label="Close liquidation drawer" className="rounded px-3 py-2 hover:bg-slate-800">Close</button>
      </div>
      {vault && <>
        <label className="mt-8 block text-sm text-slate-300">Vault ID
          <input readOnly value={vault.id} className="mt-2 w-full rounded border border-slate-700 bg-slate-900 p-3 font-mono text-slate-100" />
        </label>
        <dl className="my-6 grid grid-cols-2 gap-3 text-sm">
          <dt>Health factor</dt><dd>{vault.healthFactor}</dd>
          <dt>Debt</dt><dd>{formatRiskUsd(vault.debtUsd)}</dd>
          <dt>Collateral</dt><dd>{formatRiskUsd(vault.collateralUsd)} {vault.collateralSymbol}</dd>
        </dl>
        {!eligible && <p role="status" className="my-4 text-amber-200">This vault is no longer eligible for liquidation.</p>}
        {!onConfirm && <p className="my-4 text-slate-300">Preview only. Live liquidation is not connected; no transaction will be submitted.</p>}
        {error && <p role="alert" className="my-4 text-red-300">{error}</p>}
        <button type="button" onClick={() => void confirm()} disabled={!eligible || !onConfirm || pending}
          className="w-full rounded-lg bg-red-700 px-4 py-3 font-medium hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-400">
          {pending ? "Submitting…" : "Confirm liquidation"}
        </button>
      </>}
    </dialog>
  );
}
