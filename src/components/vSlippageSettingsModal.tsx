// src/components/SlippageSettingsModal.tsx
import React, { useState, useEffect } from 'react';

interface SlippageSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  slippage: number;
  setSlippage: (val: number) => void;
}

const PRESETS = [0.1, 0.5, 1.0];

export const SlippageSettingsModal: React.FC<SlippageSettingsModalProps> = ({
  isOpen,
  onClose,
  slippage,
  setSlippage,
}) => {
  const [customValue, setCustomValue] = useState<string>(slippage.toString());
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    setCustomValue(slippage.toString());
    validateSlippage(slippage);
  }, [slippage]);

  if (!isOpen) return null;

  const validateSlippage = (val: number) => {
    setError(null);
    setWarning(null);

    if (val > 50) {
      setError('Slippage cannot exceed 50%');
    } else if (val > 5) {
      setWarning('Your transaction may be frontrun');
    }
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setCustomValue(valStr);

    const num = parseFloat(valStr);
    if (!isNaN(num)) {
      validateSlippage(num);
      if (num <= 50) {
        setSlippage(num);
        localStorage.setItem('stellarflow_slippage', num.toString());
      }
    }
  };

  const handlePresetClick = (val: number) => {
    setCustomValue(val.toString());
    validateSlippage(val);
    setSlippage(val);
    localStorage.setItem('stellarflow_slippage', val.toString());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-200 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-100">Transaction Settings</h3>
          <button 
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Slippage Tolerance
          </label>
          <div className="flex gap-2 mb-3">
            {PRESETS.map((preset) => {
              const isSelected = slippage === preset;
              return (
                <button
                  key={preset}
                  onClick={() => handlePresetClick(preset)}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all border ${
                    isSelected 
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow' 
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {preset}%
                </button>
              );
            })}
          </div>

          <div className="relative">
            <input
              type="number"
              step="0.1"
              value={customValue}
              onChange={handleCustomChange}
              placeholder="Custom"
              className={`w-full rounded-lg bg-slate-950 px-4 py-2.5 pr-8 text-sm font-medium text-slate-100 border focus:outline-none transition-colors ${
                error 
                  ? 'border-rose-500 focus:border-rose-500' 
                  : warning 
                  ? 'border-amber-500 focus:border-amber-500' 
                  : 'border-slate-800 focus:border-indigo-500'
              }`}
            />
            <span className="absolute right-3 top-3 text-xs text-slate-400">%</span>
          </div>

          {warning && !error && (
            <p className="mt-2 text-xs font-medium text-amber-400">⚠️ {warning}</p>
          )}
          {error && (
            <p className="mt-2 text-xs font-medium text-rose-400">❌ {error}</p>
          )}
        </div>

        <button
          onClick={onClose}
          disabled={!!error}
          className={`w-full rounded-lg py-3 text-xs font-bold transition-all ${
            error 
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
              : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg'
          }`}
        >
          Save Settings
        </button>
      </div>
    </div>
  );
};