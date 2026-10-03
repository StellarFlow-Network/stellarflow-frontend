// src/components/AssetTrustlineModal.tsx
import React, { useState } from 'react';

interface AssetTrustlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (assetCode: string, issuer: string) => void;
}

export const AssetTrustlineModal: React.FC<AssetTrustlineModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [assetCode, setAssetCode] = useState('');
  const [issuer, setIssuer] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [issuerError, setIssuerError] = useState<string | null>(null);

  if (!isOpen) return null;

  const validateAssetCode = (code: string) => {
    if (!code) return 'Asset code is required';
    if (!/^[a-zA-Z0-9]{1,12}$/.test(code)) {
      return 'Asset code must be 1-12 alphanumeric characters';
    }
    return null;
  };

  const validateIssuer = (pubKey: string) => {
    if (!pubKey) return 'Issuer public key is required';
    if (!/^G[A-Z2-7]{55}$/.test(pubKey)) {
      return 'Invalid Stellar public key (must start with G and be 56 chars)';
    }
    return null;
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setAssetCode(val);
    setCodeError(validateAssetCode(val));
  };

  const handleIssuerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    setIssuer(val);
    setIssuerError(validateIssuer(val));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cErr = validateAssetCode(assetCode);
    const iErr = validateIssuer(issuer);

    setCodeError(cErr);
    setIssuerError(iErr);

    if (!cErr && !iErr) {
      onSubmit(assetCode, issuer);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-200 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-100">Add Custom Asset Trustline</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Asset Code
            </label>
            <input
              type="text"
              value={assetCode}
              onChange={handleCodeChange}
              placeholder="e.g. USDC, AQUA"
              maxLength={12}
              className={`w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-slate-100 border focus:outline-none transition-colors ${
                codeError ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-indigo-500'
              }`}
            />
            {codeError && <p className="mt-1 text-xs font-medium text-rose-400">❌ {codeError}</p>}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Issuer Public Key
            </label>
            <input
              type="text"
              value={issuer}
              onChange={handleIssuerChange}
              placeholder="G..."
              className={`w-full font-mono text-xs rounded-lg bg-slate-950 px-4 py-2.5 text-slate-100 border focus:outline-none transition-colors ${
                issuerError ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-indigo-500'
              }`}
            />
            {issuerError && <p className="mt-1 text-xs font-medium text-rose-400">❌ {issuerError}</p>}
          </div>

          <button
            type="submit"
            disabled={!!codeError || !!issuerError || !assetCode || !issuer}
            className={`w-full rounded-lg py-3 text-xs font-bold transition-all shadow-lg ${
              codeError || issuerError || !assetCode || !issuer
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-500'
            }`}
          >
            Create Trustline
          </button>
        </form>
      </div>
    </div>
  );
};