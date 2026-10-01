import React, { useEffect, useState } from 'react';
import { addressSecurityChecker, SecurityCheckResult } from '../../utils/addressSecurityChecker';

export interface AddressSecurityWarningModalProps {
  address: string;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onBlocked?: (result: SecurityCheckResult) => void;
}

const AddressSecurityWarningModal: React.FC < AddressSecurityWarningModalProps > = ({
  address,
  open,
  onClose,
  onConfirm,
  onBlocked,
}) => {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<SecurityCheckResult | null>(null);
  const [override, setOverride] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!open || !address) {
      setResult(null);
      setOverride(false);
      return;
    }

    setChecking(true);
    addressSecurityChecker.checkAddress(address).then((checkResult) => {
      if (cancelled) return;
      setResult(checkResult);
      setChecking(false);
      if (checkResult.isBlacklisted) {
        addressSecurityChecker.logBlockedAttempt(address, checkResult);
        onBlocked?.(checkResult);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [address, open, onBlocked]);

  if (!open) return null;

  const isBlacklisted = Boolean(result?.isBlacklisted);
  const canProceed = !isBlacklisted || override;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className={`flex items-center gap-2 px-6 py-4 ${isBlacklisted ? 'bg-red-600' : 'bg-emerald-600'} text-white`}>
          <span className="text-xl">{isBlacklisted ? '🛠️' : '✅'}</span>
          <h2 className="text-lg font-semibold">
            {isBlacklisted ? 'Security Alert: Flagged Address' : 'Address Verified'}
          </h2>
        </div>

        <div className="px-6 py-5">
          {checking ? (
            <p className="text-gray-700">Checking address against scam databases...</p>
          ) :             <div className="space-y-4">
              <div className="bg-gray-100 rounded md p-3 font-mono text-sm break-all">
                {address}
              </div>

              {isBlacklisted ? (
                <div className="space-3">
                  <div className="bg-red-50 border border-red-200 text-red-800 rounded md p-4">
                    <p className="font-semibold mb-1">
                      This address is flagged as a known phishing threat.
                    </p>
                    {result?.reason && (
                      <p className="text-sm">{`Reason: ${result.reason}`}</p>
                    )}
                    {result?.source && (
                      <p className="text-sm mt-1">{`Source: ${result.source}`}</p>
                    )}
                  </div>

                  <label className="flex items-start gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={override}
                      onChange={(e) => setOverride(e.target.checked)}
                    />
                    <span>
                      I understand the risk and wish to override this security warning.
                    </span>
                  </label>
                </div>
              ) : (
                <p className="text-gray-700">
                  No known scam or phishing reports were found for this address.
                </p>
              )}
            </div>
          )
        }</div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50">
          <button
            type="button"
            className="px-4 by-2 rounded border text-gray-700 hover:bg-gray-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canProceed}
            className={`px-4 py-2 rounded text-white ${canProceed ? 'hover:opacity-90 ' : 'opacity-50 cursor-not-allowed '}${isBlacklisted ? 'bg-red-600' : 'bg-emerald-600'}`}
            onClick={onConfirm}
          >
            {isBlacklisted ? 'Proceed Anyway' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddressSecurityWarningModal;
