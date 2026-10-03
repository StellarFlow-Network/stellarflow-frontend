'client';

import React from 'react';
import { Volume2, VolumeX, Music } from 'lucide-react';
import { useTransactionAudio, SoundPack } from '@/hooks/useTransactionAudio';

export function AudioSettingsSection() {
  const { isEnabled, toggle, currentPack, setSoundPack, playPreview } = useTransactionAudio();

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500">
            {isEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Transaction Audio Feedback</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Play subtle audio chimes when transaction events complete</p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggle}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            isEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
          }`}
          role="switch"
          aria-checked={isEnabled}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
              isEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {isEnabled && (
        <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Sound Pack
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(['minimalist', 'retro', 'futuristic'] as SoundPack[]).map((pack) => (
              <button
                key={pack}
                onClick={() => {
                  setSoundPack(pack);
                  playPreview(pack);
                }}
                className={`flex items-center justify-between p-3 rounded-lg border text-sm font-medium transition-all ${
                  currentPack === pack
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="capitalize flex items-center gap-2">
                  <Music size={14} />
                  {pack}
                </span>
                {currentPack === pack && <span className="text-xs text-blue-500 font-semibold">Active</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
