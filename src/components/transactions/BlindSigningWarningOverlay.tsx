'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  HelpCircle,
  ArrowRight,
  Cpu,
  Smartphone,
  Usb,
  EyeOff,
  Eye,
  Clock,
} from 'lucide-react';

export interface HardwareWalletInfo {
  type: 'ledger' | 'trezor' | 'keystone' | 'unknown';
  name: string;
  appName: string;
  blindSigningPath: string[];
  connected: boolean;
}

export interface BlindSigningWarningProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  contractAddress: string;
  functionName: string;
  hardwareWallet?: HardwareWalletInfo;
  extendedTimeout?: number;
}

const HARDWARE_WALLET_GUIDES: Record<string, HardwareWalletInfo> = {
  ledger: {
    type: 'ledger',
    name: 'Ledger',
    appName: 'Stellar App',
    blindSigningPath: [
      'Open the Stellar app on your Ledger device',
      'Navigate to Settings → Blind Signing',
      'Enable "Allow Blind Signing"',
      'Confirm on device by pressing both buttons',
    ],
    connected: false,
  },
  trezor: {
    type: 'trezor',
    name: 'Trezor',
    appName: 'Trezor Suite',
    blindSigningPath: [
      'Open Trezor Suite on your computer',
      'Go to Device Settings → Advanced',
      'Enable "Blind Signing" for Stellar',
      'Confirm on your Trezor device',
    ],
    connected: false,
  },
  keystone: {
    type: 'keystone',
    name: 'Keystone',
    appName: 'Keystone App',
    blindSigningPath: [
      'Open the Stellar app on your Keystone',
      'Go to Settings → Transaction Signing',
      'Enable "Blind Signing Mode"',
      'Verify on device screen',
    ],
    connected: false,
  },
};

interface USBDevice {
  vendorId: number;
  productId: number;
}

function detectHardwareWallet(): Promise<HardwareWalletInfo | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);

  // Check for Ledger via WebUSB
  const nav = navigator as Navigator & { usb?: { getDevices(): Promise<USBDevice[]> } };
  if (nav.usb) {
    return nav.usb.getDevices().then((devices: USBDevice[]) => {
      const ledger = devices.find((d) => d.vendorId === 0x2c97);
      if (ledger) return HARDWARE_WALLET_GUIDES.ledger;
      return null;
    }).catch(() => null);
  }

  return Promise.resolve(null);
}

export function BlindSigningWarningOverlay({
  isOpen,
  onClose,
  onProceed,
  contractAddress,
  functionName,
  hardwareWallet,
  extendedTimeout = 300000,
}: BlindSigningWarningProps) {
  const [detectedWallet, setDetectedWallet] = useState<HardwareWalletInfo | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<string>('');
  const [isProceeding, setIsProceeding] = useState(false);
  const [timeoutRemaining, setTimeoutRemaining] = useState(extendedTimeout / 1000);
  const [showDetails, setShowDetails] = useState(false);

  // Detect hardware wallet on mount
  useEffect(() => {
    if (isOpen) {
      if (hardwareWallet) {
        const timer = setTimeout(() => {
          setDetectedWallet(hardwareWallet);
          setSelectedWallet(hardwareWallet.type);
        }, 0);
        return () => clearTimeout(timer);
      } else {
        detectHardwareWallet().then(wallet => {
          if (wallet) {
            setDetectedWallet(wallet);
            setSelectedWallet(wallet.type);
          }
        });
      }
    }
  }, [isOpen, hardwareWallet]);

  // Extended timeout countdown
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      setTimeoutRemaining(extendedTimeout / 1000);
    }, 0);

    const interval = setInterval(() => {
      setTimeoutRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [isOpen, extendedTimeout]);

  const formatTimeout = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const walletOptions = Object.entries(HARDWARE_WALLET_GUIDES).map(([key, wallet]) => ({
    key,
    ...wallet,
  }));

  const currentGuide = selectedWallet ? HARDWARE_WALLET_GUIDES[selectedWallet] : null;

  const handleProceed = async () => {
    setIsProceeding(true);
    try {
      await onProceed();
    } finally {
      setIsProceeding(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-800 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/20">
              <AlertTriangle size={22} className="text-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Blind Signing Required</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Hardware wallet configuration needed</p>
            </div>
          </div>

          {/* Timeout indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-500/30">
            <Clock size={14} className="text-amber-500" />
            <span className="text-sm font-mono font-medium text-amber-700 dark:text-amber-300">
              {formatTimeout(timeoutRemaining)}
            </span>
            <span className="text-xs text-amber-500">Extended timeout</span>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Warning Description */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-900/20 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200 space-y-2">
                <p>
                  <strong>The contract call you&apos;re attempting requires blind signing.</strong> This means your hardware
                  wallet cannot display the full transaction details on its screen.
                </p>
                <p>
                  <strong>Contract:</strong> <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">
                    {contractAddress.slice(0, 12)}...{contractAddress.slice(-8)}
                  </code>
                </p>
                <p>
                  <strong>Function:</strong> <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">
                    {functionName}
                  </code>
                </p>
                <p>
                  You must enable blind signing on your hardware device before proceeding.
                </p>
              </div>
            </div>
          </div>

          {/* Hardware Wallet Selection */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Cpu size={16} className="text-gray-400" />
              Select Your Hardware Wallet
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {walletOptions.map((wallet) => (
                <button
                  key={wallet.key}
                  type="button"
                  onClick={() => {
                    setSelectedWallet(wallet.key);
                  }}
                  className={`relative p-4 rounded-lg border-2 transition-all ${
                    selectedWallet === wallet.key
                      ? 'border-violet-500 bg-violet-500/10 dark:bg-violet-500/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      {wallet.type === 'ledger' && <Usb size={20} className="text-gray-600 dark:text-gray-300" />}
                      {wallet.type === 'trezor' && <Smartphone size={20} className="text-gray-600 dark:text-gray-300" />}
                      {wallet.type === 'keystone' && <Cpu size={20} className="text-gray-600 dark:text-gray-300" />}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{wallet.name}</p>
                      <p className="text-xs text-gray-500">{wallet.appName}</p>
                    </div>
                  </div>
                  {selectedWallet === wallet.key && (
                    <CheckCircle2 size={20} className="absolute top-2 right-2 text-violet-500" />
                  )}
                  {detectedWallet?.type === wallet.key && (
                    <span className="absolute bottom-2 right-2 text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                      Detected
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Step-by-step Guide */}
          {currentGuide && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <HelpCircle size={16} className="text-gray-400" />
                  Enable Blind Signing on {currentGuide.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-xs text-violet-500 hover:text-violet-400 flex items-center gap-1"
                >
                  {showDetails ? <EyeOff size={14} /> : <Eye size={14} />}
                  {showDetails ? 'Hide steps' : 'Show steps'}
                </button>
              </div>

              {showDetails && (
                <ol className="space-y-3">
                  {currentGuide.blindSigningPath.map((stepText, index) => (
                    <li key={index} className="flex items-start gap-3 relative">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-violet-500 flex items-center justify-center text-xs font-bold text-violet-500 bg-white dark:bg-gray-900">
                        {index + 1}
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm text-gray-700 dark:text-gray-300">{stepText}</p>
                      </div>
                      {index < currentGuide.blindSigningPath.length - 1 && (
                        <div className="absolute left-10 top-8 bottom-0 w-0.5 border-l border-dashed border-violet-500/30" />
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {/* What is Blind Signing? Expandable */}
          <details className="group rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <summary className="p-4 flex items-center gap-2 cursor-pointer list-none text-sm font-medium text-gray-700 dark:text-gray-300">
              <HelpCircle size={18} className="text-gray-400" />
              What is blind signing and why is it needed?
              <ArrowRight size={16} className="ml-auto text-gray-400 group-open:rotate-90 transition-transform" />
            </summary>
            <div className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-400 space-y-3">
              <p>
                <strong>Blind signing</strong> allows your hardware wallet to sign a transaction without displaying
                its full contents on the device screen. This is required for complex Soroban contract interactions
                where the transaction data exceeds the device&apos;s display capacity.
              </p>
              <p>
                <strong>When you enable blind signing:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Your device will show a generic &apos;Sign transaction&apos; prompt instead of detailed parameters</li>
                <li>You must trust that the transaction was constructed correctly by the application</li>
                <li>Always verify the contract address and function name in this dialog before confirming</li>
              </ul>
              <p>
                <strong>Security best practices:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Only enable blind signing for trusted contracts and applications</li>
                <li>Verify the contract address matches what you expect</li>
                <li>Disable blind signing when not actively using complex contracts</li>
                <li>Consider using a dedicated wallet for DeFi interactions</li>
              </ul>
            </div>
          </details>

          {/* Connection Help */}
          {selectedWallet && !detectedWallet && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-50 dark:bg-blue-900/20 p-4">
              <div className="flex items-start gap-3">
                <HelpCircle size={20} className="text-blue-500 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium">Device not detected?</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Ensure your {currentGuide?.name} is connected via USB</li>
                    <li>Unlock the device and open the {currentGuide?.appName}</li>
                    <li>Allow browser access to USB devices if prompted</li>
                    <li>Try refreshing this page after connecting</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isProceeding}
            className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleProceed}
            disabled={!selectedWallet || isProceeding}
            className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 font-medium transition-colors"
          >
            {isProceeding ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            {isProceeding ? 'Proceeding…' : 'I\'ve Enabled Blind Signing — Proceed'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BlindSigningWarningOverlay;