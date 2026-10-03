'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, CreditCard, Landmark, Wallet, CheckCircle2, XCircle, ShieldCheck, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import { BENEFICIARY_COUNTRIES } from '@/lib/beneficiaries';

export type OnRampProvider = 'moonpay' | 'transak' | 'walletconnect';

export interface FiatOnRampResult {
  provider: OnRampProvider;
  amount: number;
  currency: string;
  destinationAddress: string;
}

export interface FiatOnRampModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Destination Stellar wallet address the purchased asset is delivered to. */
  walletAddress: string;
  /** Pre-selected asset code. Defaults to 'XLM'. */
  assetCode?: string;
  /** Pre-filled fiat purchase amount. */
  fiatAmount?: number;
  /** Pre-selected or detected user ISO-3166-1 alpha-2 country code (e.g. 'US', 'GB', 'NG'). */
  defaultCountry?: string;
  /** Which on-ramp SDK widget to embed. Defaults to 'moonpay'. */
  defaultProvider?: OnRampProvider;
  /** Called once the widget confirms a completed fiat deposit. */
  onDepositConfirmed?: (result: FiatOnRampResult) => void;
  /** Called when the user cancels the flow before completion. */
  onCancelled?: () => void;
  /** Called after a successful deposit so the caller can re-query wallet balance. */
  onRefreshBalance?: () => void | Promise<void>;
}

export interface ProviderConfig {
  id: OnRampProvider;
  label: string;
  description: string;
  accent: string;
  icon: React.ReactNode;
  /** Supported ISO 3166-1 alpha-2 country codes ('*' means global/all non-sanctioned). */
  supportedCountries?: string[] | '*';
  /** Prohibited ISO country codes */
  unsupportedCountries?: string[];
  /** Builds the embeddable widget URL, passing the destination wallet address through. */
  buildWidgetUrl: (address: string, asset?: string, amount?: number) => string;
}

export const PROVIDERS: Record<OnRampProvider, ProviderConfig> = {
  moonpay: {
    id: 'moonpay',
    label: 'MoonPay',
    description: 'Card or bank transfer, available in 160+ countries.',
    accent: 'border-violet-500/50 bg-violet-500/10 text-violet-600 dark:text-violet-400',
    icon: <CreditCard size={18} />,
    supportedCountries: '*',
    // MoonPay restricted jurisdictions (example OFAC/unsupported regions)
    unsupportedCountries: ['CU', 'IR', 'KP', 'SY', 'RU'],
    buildWidgetUrl: (address, asset = 'XLM', amount) => {
      const key = process.env.NEXT_PUBLIC_MOONPAY_API_KEY || 'pk_test_demo';
      const params = new URLSearchParams({
        apiKey: key,
        currencyCode: asset.toLowerCase(),
        walletAddress: address,
        colorCode: '#635bff',
      });
      if (amount && amount > 0) {
        params.set('baseCurrencyAmount', String(amount));
      }
      return `https://buy.moonpay.com?${params.toString()}`;
    },
  },
  transak: {
    id: 'transak',
    label: 'Transak',
    description: 'Bank transfer and local payment methods (SEPA, Faster Payments, Pix, etc.).',
    accent: 'border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400',
    icon: <Landmark size={18} />,
    supportedCountries: '*',
    unsupportedCountries: ['CU', 'IR', 'KP', 'SY', 'RU', 'BY'],
    buildWidgetUrl: (address, asset = 'XLM', amount) => {
      const key = process.env.NEXT_PUBLIC_TRANSAK_API_KEY || 'demo';
      const params = new URLSearchParams({
        apiKey: key,
        cryptoCurrencyCode: asset.toUpperCase(),
        walletAddress: address,
        disableWalletAddressForm: 'true',
      });
      if (amount && amount > 0) {
        params.set('fiatAmount', String(amount));
      }
      return `https://global.transak.com?${params.toString()}`;
    },
  },
  walletconnect: {
    id: 'walletconnect',
    label: 'WalletConnect Pay',
    description: 'Pay directly from a linked bank, card, or Web3 wallet.',
    accent: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    icon: <Wallet size={18} />,
    supportedCountries: '*',
    unsupportedCountries: ['CU', 'IR', 'KP', 'SY'],
    buildWidgetUrl: (address, asset = 'XLM', amount) => {
      const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo';
      const params = new URLSearchParams({
        projectId,
        chain: 'stellar',
        address,
        asset: asset.toUpperCase(),
      });
      if (amount && amount > 0) {
        params.set('amount', String(amount));
      }
      return `https://pay.walletconnect.com?${params.toString()}`;
    },
  },
};

/** Checks if a provider is supported in a given country code */
export function isProviderAvailableInCountry(provider: OnRampProvider, countryCode?: string): boolean {
  if (!countryCode) return true;
  const upper = countryCode.toUpperCase();
  const cfg = PROVIDERS[provider];
  if (!cfg) return false;

  if (cfg.unsupportedCountries && cfg.unsupportedCountries.includes(upper)) {
    return false;
  }
  if (cfg.supportedCountries === '*') {
    return true;
  }
  if (Array.isArray(cfg.supportedCountries)) {
    return cfg.supportedCountries.includes(upper);
  }
  return true;
}

/** Finds a fallback provider when the selected provider is unavailable in target jurisdiction */
export function getFallbackProvider(preferred: OnRampProvider, countryCode?: string): OnRampProvider {
  if (isProviderAvailableInCountry(preferred, countryCode)) {
    return preferred;
  }
  const providers = Object.keys(PROVIDERS) as OnRampProvider[];
  const available = providers.find((p) => isProviderAvailableInCountry(p, countryCode));
  return available || preferred;
}

type Stage = 'select' | 'widget' | 'success' | 'cancelled';

/** Recognized postMessage event shapes emitted by the embedded on-ramp SDKs. */
export interface OnRampWidgetEvent {
  type: 'onramp:success' | 'onramp:cancel' | 'onramp:close';
  amount?: number;
  currency?: string;
}

export function isOnRampWidgetEvent(data: unknown): data is OnRampWidgetEvent {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    typeof (data as { type: unknown }).type === 'string' &&
    (data as { type: string }).type.startsWith('onramp:')
  );
}

export function FiatOnRampModal({
  isOpen,
  onClose,
  walletAddress,
  assetCode = 'XLM',
  fiatAmount,
  defaultCountry = '',
  defaultProvider = 'moonpay',
  onDepositConfirmed,
  onCancelled,
  onRefreshBalance,
}: FiatOnRampModalProps) {
  const [country, setCountry] = useState<string>(defaultCountry);
  const [provider, setProvider] = useState<OnRampProvider>(() =>
    getFallbackProvider(defaultProvider, defaultCountry),
  );
  const [stage, setStage] = useState<Stage>('select');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastResult, setLastResult] = useState<FiatOnRampResult | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const isCurrentProviderAvailable = useMemo(
    () => isProviderAvailableInCountry(provider, country),
    [provider, country],
  );

  const fallbackAlternative = useMemo(() => {
    if (isCurrentProviderAvailable) return null;
    const alt = getFallbackProvider(provider, country);
    return alt !== provider ? alt : null;
  }, [provider, country, isCurrentProviderAvailable]);

  const config = PROVIDERS[provider] || PROVIDERS.moonpay;
  const widgetUrl = useMemo(
    () => config.buildWidgetUrl(walletAddress, assetCode, fiatAmount),
    [config, walletAddress, assetCode, fiatAmount],
  );

  const resetState = useCallback(() => {
    setStage('select');
    setCountry(defaultCountry);
    const validProvider = getFallbackProvider(defaultProvider, defaultCountry);
    setProvider(validProvider);
    setLastResult(null);
    setIsRefreshing(false);
  }, [defaultCountry, defaultProvider]);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const handleCancelled = useCallback(() => {
    setStage('cancelled');
    onCancelled?.();
  }, [onCancelled]);

  const handleDepositConfirmed = useCallback(
    async (result: FiatOnRampResult) => {
      setLastResult(result);
      setStage('success');
      onDepositConfirmed?.(result);

      if (onRefreshBalance) {
        setIsRefreshing(true);
        try {
          await onRefreshBalance();
        } finally {
          setIsRefreshing(false);
        }
      }
    },
    [onDepositConfirmed, onRefreshBalance],
  );

  // Listen for postMessage events emitted by the embedded on-ramp widget so
  // success/cancellation can be handled without leaving the modal.
  useEffect(() => {
    if (!isOpen || stage !== 'widget') return;

    const handleMessage = (event: MessageEvent) => {
      if (!isOnRampWidgetEvent(event.data)) return;

      if (event.data.type === 'onramp:success') {
        void handleDepositConfirmed({
          provider,
          amount: event.data.amount ?? fiatAmount ?? 0,
          currency: event.data.currency ?? assetCode,
          destinationAddress: walletAddress,
        });
      } else if (event.data.type === 'onramp:cancel' || event.data.type === 'onramp:close') {
        handleCancelled();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, stage, provider, walletAddress, assetCode, fiatAmount, handleDepositConfirmed, handleCancelled]);

  // Reset local state whenever the modal is reopened.
  useEffect(() => {
    if (isOpen) resetState();
  }, [isOpen, resetState]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-800">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Fund Account</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Buy {assetCode} directly with fiat via integrated on-ramp
            </p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {stage === 'select' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Choose a provider to buy Stellar-native assets directly to your connected wallet.
              </p>

              {/* Destination Wallet Banner */}
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-xs uppercase font-semibold text-gray-500">Destination Wallet</p>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    {assetCode}
                  </span>
                </div>
                <p className="text-sm font-mono text-gray-800 dark:text-gray-200 break-all">{walletAddress}</p>
              </div>

              {/* Jurisdiction / Country selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1.5">
                  Your Jurisdiction (Country)
                </label>
                <select
                  value={country}
                  onChange={(e) => {
                    const newCountry = e.target.value;
                    setCountry(newCountry);
                    if (!isProviderAvailableInCountry(provider, newCountry)) {
                      setProvider(getFallbackProvider(provider, newCountry));
                    }
                  }}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Global / Auto-detect</option>
                  {BENEFICIARY_COUNTRIES.map((c) => (
                    <option key={c.country} value={c.country}>
                      {c.countryName} ({c.country})
                    </option>
                  ))}
                </select>
              </div>

              {/* Provider Selection */}
              <div className="space-y-2">
                {(Object.keys(PROVIDERS) as OnRampProvider[]).map((key) => {
                  const cfg = PROVIDERS[key];
                  const isSelected = provider === key;
                  const isAvailable = isProviderAvailableInCountry(key, country);

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setProvider(key)}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-colors ${
                        isSelected
                          ? cfg.accent
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      } ${!isAvailable ? 'opacity-60' : ''}`}
                      aria-pressed={isSelected}
                    >
                      {cfg.icon}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 dark:text-white">{cfg.label}</p>
                          {!isAvailable && (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              Restricted in {country}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{cfg.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Jurisdiction Warning & Fallback Action */}
              {!isCurrentProviderAvailable && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">Provider Unavailable</p>
                    <p className="mt-0.5">
                      {config.label} has regional restrictions in {country}.
                      {fallbackAlternative && ` We recommend switching to ${PROVIDERS[fallbackAlternative].label}.`}
                    </p>
                    {fallbackAlternative && (
                      <button
                        type="button"
                        onClick={() => setProvider(fallbackAlternative)}
                        className="mt-2 inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Switch to {PROVIDERS[fallbackAlternative].label} <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setStage('widget')}
                disabled={!walletAddress || !isCurrentProviderAvailable}
                className="w-full mt-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                Continue with {config.label}
              </button>
            </div>
          )}

          {stage === 'widget' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <ShieldCheck size={14} />
                <span>Funds are delivered straight to your wallet — StellarFlow never holds custody.</span>
              </div>

              <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50" style={{ height: '480px' }}>
                <iframe
                  ref={iframeRef}
                  src={widgetUrl}
                  title={`${config.label} on-ramp widget`}
                  className="w-full h-full border-0"
                  allow="camera; payment"
                  sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
                />
              </div>

              <div className="flex justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setStage('select')}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCancelled}
                  className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 transition-colors"
                >
                  Cancel Purchase
                </button>
              </div>
            </div>
          )}

          {stage === 'success' && (
            <div className="flex flex-col items-center text-center py-6 space-y-4">
              <div className="p-4 bg-emerald-500/10 rounded-full text-emerald-500">
                <CheckCircle2 size={40} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Deposit Confirmed</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {lastResult && lastResult.amount > 0
                    ? `${lastResult.amount} ${lastResult.currency} is on its way to your wallet.`
                    : 'Your fiat deposit has been confirmed and is on its way to your wallet.'}
                </p>
              </div>
              {isRefreshing ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 size={16} className="animate-spin" /> Refreshing wallet balance…
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500">Wallet balance updated.</p>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {stage === 'cancelled' && (
            <div className="flex flex-col items-center text-center py-6 space-y-4">
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-400">
                <XCircle size={40} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Purchase Cancelled</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  No funds were charged. You can restart the on-ramp flow at any time.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStage('select')}
                  className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 transition-colors"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FiatOnRampModal;

