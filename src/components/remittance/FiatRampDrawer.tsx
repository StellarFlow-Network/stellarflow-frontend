'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, CreditCard, Landmark, Smartphone, DollarSign, CheckCircle2, ArrowRight, Info } from 'lucide-react';

export type PaymentMethod = 'credit_card' | 'bank_transfer' | 'apple_pay' | 'mobile_money';
export type FiatRampProvider = 'moonpay' | 'transak' | 'local_anchor';

export interface ProviderFeeStructure {
  processingFee: number; // Percentage
  networkFee: number; // Fixed amount in USD
  estimatedTotal: number; // Total fee in USD
}

export interface FiatRampProviderOption {
  id: FiatRampProvider;
  name: string;
  description: string;
  logo: React.ReactNode;
  supportedPaymentMethods: PaymentMethod[];
  feeStructure: Record<PaymentMethod, ProviderFeeStructure>;
  estimatedDeliveryTime: string;
  trustScore: number; // 1-5 rating
  redirectUrl: (params: {
    walletAddress: string;
    amount: number;
    currency: string;
    paymentMethod: PaymentMethod;
  }) => string;
}

export const PAYMENT_METHODS: Record<PaymentMethod, { label: string; icon: React.ReactNode }> = {
  credit_card: {
    label: 'Credit/Debit Card',
    icon: <CreditCard size={18} />,
  },
  bank_transfer: {
    label: 'Bank Transfer',
    icon: <Landmark size={18} />,
  },
  apple_pay: {
    label: 'Apple Pay',
    icon: <Smartphone size={18} />,
  },
  mobile_money: {
    label: 'Mobile Money',
    icon: <Smartphone size={18} />,
  },
};

export const FIAT_RAMP_PROVIDERS: FiatRampProviderOption[] = [
  {
    id: 'moonpay',
    name: 'MoonPay',
    description: 'Fast and reliable, available globally',
    logo: <CreditCard size={24} className="text-violet-600" />,
    supportedPaymentMethods: ['credit_card', 'bank_transfer', 'apple_pay'],
    feeStructure: {
      credit_card: { processingFee: 4.5, networkFee: 3.99, estimatedTotal: 0 },
      bank_transfer: { processingFee: 1.0, networkFee: 2.99, estimatedTotal: 0 },
      apple_pay: { processingFee: 4.5, networkFee: 3.99, estimatedTotal: 0 },
      mobile_money: { processingFee: 0, networkFee: 0, estimatedTotal: 0 },
    },
    estimatedDeliveryTime: '5-10 minutes',
    trustScore: 4.8,
    redirectUrl: ({ walletAddress, amount, currency, paymentMethod }) => {
      const apiKey = process.env.NEXT_PUBLIC_MOONPAY_API_KEY || 'pk_test_demo';
      const params = new URLSearchParams({
        apiKey,
        currencyCode: currency.toLowerCase(),
        walletAddress,
        baseCurrencyAmount: String(amount),
        paymentMethod: paymentMethod === 'credit_card' ? 'credit_debit_card' : paymentMethod,
      });
      return `https://buy.moonpay.com?${params.toString()}`;
    },
  },
  {
    id: 'transak',
    name: 'Transak',
    description: 'Low fees with local payment methods',
    logo: <Landmark size={24} className="text-blue-600" />,
    supportedPaymentMethods: ['bank_transfer', 'credit_card', 'mobile_money'],
    feeStructure: {
      credit_card: { processingFee: 3.5, networkFee: 2.99, estimatedTotal: 0 },
      bank_transfer: { processingFee: 0.99, networkFee: 1.99, estimatedTotal: 0 },
      apple_pay: { processingFee: 0, networkFee: 0, estimatedTotal: 0 },
      mobile_money: { processingFee: 2.5, networkFee: 1.5, estimatedTotal: 0 },
    },
    estimatedDeliveryTime: '10-30 minutes',
    trustScore: 4.6,
    redirectUrl: ({ walletAddress, amount, currency, paymentMethod }) => {
      const apiKey = process.env.NEXT_PUBLIC_TRANSAK_API_KEY || 'demo';
      const params = new URLSearchParams({
        apiKey,
        cryptoCurrencyCode: currency.toUpperCase(),
        walletAddress,
        fiatAmount: String(amount),
        paymentMethod,
        disableWalletAddressForm: 'true',
      });
      return `https://global.transak.com?${params.toString()}`;
    },
  },
  {
    id: 'local_anchor',
    name: 'Local Anchors',
    description: 'Community-powered, lowest fees',
    logo: <DollarSign size={24} className="text-emerald-600" />,
    supportedPaymentMethods: ['bank_transfer', 'mobile_money'],
    feeStructure: {
      credit_card: { processingFee: 0, networkFee: 0, estimatedTotal: 0 },
      bank_transfer: { processingFee: 0.5, networkFee: 1.0, estimatedTotal: 0 },
      apple_pay: { processingFee: 0, networkFee: 0, estimatedTotal: 0 },
      mobile_money: { processingFee: 1.5, networkFee: 0.5, estimatedTotal: 0 },
    },
    estimatedDeliveryTime: '30-60 minutes',
    trustScore: 4.3,
    redirectUrl: ({ walletAddress, amount, currency, paymentMethod }) => {
      const params = new URLSearchParams({
        destination: walletAddress,
        amount: String(amount),
        asset: currency.toUpperCase(),
        method: paymentMethod,
      });
      return `https://anchor.stellarflow.network/deposit?${params.toString()}`;
    },
  },
];

export interface FiatRampDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
  defaultCurrency?: string;
  defaultAmount?: number;
  onProviderSelected?: (provider: FiatRampProvider, paymentMethod: PaymentMethod) => void;
}

export function FiatRampDrawer({
  isOpen,
  onClose,
  walletAddress,
  defaultCurrency = 'USDC',
  defaultAmount = 100,
  onProviderSelected,
}: FiatRampDrawerProps) {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('credit_card');
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [currency] = useState<string>(defaultCurrency);

  // Load preferred payment method from local storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMethod = localStorage.getItem('fiat_ramp_preferred_payment_method');
      if (savedMethod && savedMethod in PAYMENT_METHODS) {
        setSelectedPaymentMethod(savedMethod as PaymentMethod);
      }
    }
  }, []);

  // Calculate fees and rank providers based on selected payment method and amount
  const rankedProviders = useMemo(() => {
    return FIAT_RAMP_PROVIDERS.filter((provider) =>
      provider.supportedPaymentMethods.includes(selectedPaymentMethod)
    )
      .map((provider) => {
        const fees = provider.feeStructure[selectedPaymentMethod];
        const processingFeeAmount = (amount * fees.processingFee) / 100;
        const totalFee = processingFeeAmount + fees.networkFee;
        const netReceived = amount - totalFee;

        return {
          ...provider,
          calculatedFees: {
            processingFee: processingFeeAmount,
            networkFee: fees.networkFee,
            totalFee,
            netReceived,
          },
        };
      })
      .sort((a, b) => b.calculatedFees.netReceived - a.calculatedFees.netReceived);
  }, [selectedPaymentMethod, amount]);

  const handleProviderSelect = useCallback(
    (provider: FiatRampProvider) => {
      // Save preferred payment method to local storage
      if (typeof window !== 'undefined') {
        localStorage.setItem('fiat_ramp_preferred_payment_method', selectedPaymentMethod);
      }

      // Call callback
      onProviderSelected?.(provider, selectedPaymentMethod);

      // Get provider config and redirect
      const providerConfig = FIAT_RAMP_PROVIDERS.find((p) => p.id === provider);
      if (providerConfig) {
        const redirectUrl = providerConfig.redirectUrl({
          walletAddress,
          amount,
          currency,
          paymentMethod: selectedPaymentMethod,
        });

        // Open provider widget in new window
        window.open(redirectUrl, '_blank', 'noopener,noreferrer');
      }

      // Close drawer after redirect
      setTimeout(() => onClose(), 500);
    },
    [walletAddress, amount, currency, selectedPaymentMethod, onProviderSelected, onClose]
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white dark:bg-gray-900 shadow-2xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Buy Crypto</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Choose provider and payment method
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Amount Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Amount (USD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Math.max(10, Number(e.target.value)))}
                min="10"
                className="w-full pl-8 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Destination Wallet */}
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info size={16} className="text-blue-600 dark:text-blue-400" />
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-300 uppercase">
                Destination Wallet
              </p>
            </div>
            <p className="text-sm font-mono text-gray-800 dark:text-gray-200 break-all">
              {walletAddress}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              You will receive {currency}
            </p>
          </div>

          {/* Payment Method Filter */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((method) => {
                const methodInfo = PAYMENT_METHODS[method];
                const isSelected = selectedPaymentMethod === method;

                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setSelectedPaymentMethod(method)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {methodInfo.icon}
                    <span className="text-sm font-medium">{methodInfo.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Provider Rankings */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Available Providers
            </label>

            {rankedProviders.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No providers support {PAYMENT_METHODS[selectedPaymentMethod].label}</p>
                <p className="text-sm mt-1">Please select a different payment method</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rankedProviders.map((provider, index) => (
                  <div
                    key={provider.id}
                    className="relative border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer group"
                    onClick={() => handleProviderSelect(provider.id)}
                  >
                    {/* Best Deal Badge */}
                    {index === 0 && (
                      <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                        <CheckCircle2 size={12} /> Best Deal
                      </div>
                    )}

                    <div className="flex items-start gap-4">
                      {/* Provider Logo */}
                      <div className="flex-shrink-0 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        {provider.logo}
                      </div>

                      {/* Provider Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {provider.name}
                          </h3>
                          <div className="flex items-center gap-1 text-yellow-500">
                            <span className="text-sm font-semibold">{provider.trustScore}</span>
                            <span className="text-xs">★</span>
                          </div>
                        </div>

                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                          {provider.description}
                        </p>

                        {/* Fee Breakdown */}
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between text-gray-600 dark:text-gray-400">
                            <span>Processing Fee ({provider.feeStructure[selectedPaymentMethod].processingFee}%):</span>
                            <span className="font-medium">
                              ${provider.calculatedFees.processingFee.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-gray-600 dark:text-gray-400">
                            <span>Network Fee:</span>
                            <span className="font-medium">
                              ${provider.calculatedFees.networkFee.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between font-semibold text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-gray-700">
                            <span>You Receive:</span>
                            <span className="text-emerald-600 dark:text-emerald-400">
                              ${provider.calculatedFees.netReceived.toFixed(2)} {currency}
                            </span>
                          </div>
                        </div>

                        {/* Delivery Time */}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          ⏱️ Est. delivery: {provider.estimatedDeliveryTime}
                        </p>
                      </div>

                      {/* Arrow Icon */}
                      <ArrowRight
                        size={20}
                        className="flex-shrink-0 text-gray-400 group-hover:text-blue-500 transition-colors mt-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Footer */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 text-xs text-gray-600 dark:text-gray-400">
            <p className="font-semibold mb-1">💡 Your payment method preference will be saved</p>
            <p>
              Funds will be sent directly to your connected wallet. StellarFlow never holds custody of your
              assets.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default FiatRampDrawer;
