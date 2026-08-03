"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OptimizedDialog from "@/app/components/OptimizedDialog";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";

type TabMode = "generate" | "scan";

export interface StellarPaymentUri {
  destination: string;
  amount?: string;
  assetCode?: string;
  assetIssuer?: string;
  memo?: string;
}

export interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentScanned?: (payment: StellarPaymentUri) => void;
  defaultAddress?: string;
  defaultAmount?: string;
  defaultAssetCode?: string;
  defaultAssetIssuer?: string;
}

const STELLAR_URI_RE =
  /^web\+stellar:pay\?(.+)$/i;

function parseStellarUri(raw: string): StellarPaymentUri | null {
  const trimmed = raw.trim();

  const uriMatch = trimmed.match(STELLAR_URI_RE);
  if (uriMatch) {
    const params = new URLSearchParams(uriMatch[1]);
    const destination = params.get("destination");
    if (!destination || !/^G[A-Z2-7]{55}$/.test(destination)) return null;
    return {
      destination,
      amount: params.get("amount") ?? undefined,
      assetCode: params.get("asset_code") ?? undefined,
      assetIssuer: params.get("asset_issuer") ?? undefined,
      memo: params.get("memo") ?? undefined,
    };
  }

  if (/^G[A-Z2-7]{55}$/.test(trimmed)) {
    return { destination: trimmed };
  }

  return null;
}

function buildStellarUri(
  address: string,
  amount?: string,
  assetCode?: string,
  assetIssuer?: string,
): string {
  const params = new URLSearchParams();
  params.set("destination", address);
  if (amount) params.set("amount", amount);
  if (assetCode) params.set("asset_code", assetCode);
  if (assetIssuer) params.set("asset_issuer", assetIssuer);
  return `web+stellar:pay?${params.toString()}`;
}

export function QrScannerModal({
  isOpen,
  onClose,
  onPaymentScanned,
  defaultAddress = "",
  defaultAmount = "",
  defaultAssetCode = "XLM",
  defaultAssetIssuer = "",
}: QrScannerModalProps) {
  const [tab, setTab] = useState<TabMode>("generate");
  const [address, setAddress] = useState(defaultAddress);
  const [amount, setAmount] = useState(defaultAmount);
  const [assetCode, setAssetCode] = useState(defaultAssetCode);
  const [assetIssuer, setAssetIssuer] = useState(defaultAssetIssuer);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<StellarPaymentUri | null>(null);

  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<unknown>(null);

  const isValidAddress = useMemo(
    () => /^G[A-Z2-7]{55}$/.test(address),
    [address],
  );

  const stellarUri = useMemo(
    () =>
      isValidAddress
        ? buildStellarUri(address, amount, assetCode, assetIssuer)
        : "",
    [isValidAddress, address, amount, assetCode, assetIssuer],
  );

  const generateQr = useCallback(async () => {
    if (!isValidAddress) return;
    setIsGenerating(true);
    try {
      const QRCode = await import("qrcode");
      const dataUrl = await QRCode.toDataURL(stellarUri, {
        width: 280,
        margin: 2,
        color: { dark: "#ffffff", light: "#0d1117" },
        errorCorrectionLevel: "M",
      });
      setQrDataUrl(dataUrl);
    } catch {
      setQrDataUrl(null);
    } finally {
      setIsGenerating(false);
    }
  }, [isValidAddress, stellarUri]);

  useEffect(() => {
    if (isOpen && tab === "generate" && isValidAddress) {
      generateQr();
    }
  }, [isOpen, tab, isValidAddress, generateQr]);

  const handleCopyUri = useCallback(async () => {
    if (!stellarUri) return;
    try {
      await navigator.clipboard.writeText(stellarUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be blocked */
    }
  }, [stellarUri]);

  const stopScanner = useCallback(async () => {
    const scanner = html5QrRef.current as
      | { stop: () => Promise<void>; clear: () => void }
      | null
      | undefined;
    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch {
        /* may already be stopped */
      }
      html5QrRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    if (!scannerRef.current) return;
    setScanError(null);
    setScanResult(null);
    setIsScanning(true);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scannerId = "qr-scanner-viewport";

      scannerRef.current.id = scannerId;
      const html5Qr = new Html5Qrcode(scannerId);
      html5QrRef.current = html5Qr;

      await html5Qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          const payment = parseStellarUri(decodedText);
          if (payment) {
            setScanResult(payment);
            html5Qr.stop().then(() => html5Qr.clear()).catch(() => {});
            html5QrRef.current = null;
            setIsScanning(false);
          }
        },
        () => {
          /* scan miss — expected while user positions the code */
        },
      );
    } catch {
      setScanError(
        "Camera access denied or unavailable. Please allow camera permissions and try again.",
      );
      setIsScanning(false);
    }
  }, []);

  const handleApplyScannedPayment = useCallback(() => {
    if (!scanResult) return;
    onPaymentScanned?.(scanResult);
    onClose();
  }, [scanResult, onPaymentScanned, onClose]);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setScanResult(null);
      setScanError(null);
      setCopied(false);
      setQrDataUrl(null);
    }
  }, [isOpen, stopScanner]);

  useEffect(() => {
    if (tab === "scan" && isOpen) {
      const timer = setTimeout(startScanner, 300);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    }
    return () => stopScanner();
  }, [tab, isOpen, startScanner, stopScanner]);

  const handleClose = useCallback(() => {
    stopScanner();
    onClose();
  }, [stopScanner, onClose]);

  return (
    <OptimizedDialog
      isOpen={isOpen}
      onClose={handleClose}
      title="QR Payment"
      size="lg"
    >
      <div className="space-y-5">
        {/* Tab Switcher */}
        <div className="flex rounded-lg border border-gray-800 bg-[#0d1117] p-1">
          <button
            type="button"
            onClick={() => setTab("generate")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "generate"
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Icon id={ICON_IDS.creditCard} size={16} />
              Generate QR
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("scan")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "scan"
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Icon id={ICON_IDS.search} size={16} />
              Scan QR
            </span>
          </button>
        </div>

        {/* Generate Tab */}
        {tab === "generate" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="qr-address"
                className="text-xs uppercase font-bold text-gray-500"
              >
                Recipient Address
              </label>
              <input
                id="qr-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="GXXXXXXXXX..."
                spellCheck={false}
                autoComplete="off"
                className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2.5 font-mono text-sm text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none"
              />
              {address && !isValidAddress && (
                <p className="text-xs text-red-400">
                  Invalid Stellar address format.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label
                  htmlFor="qr-amount"
                  className="text-xs uppercase font-bold text-gray-500"
                >
                  Amount
                </label>
                <input
                  id="qr-amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="any"
                  className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2.5 font-mono text-sm text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="qr-asset"
                  className="text-xs uppercase font-bold text-gray-500"
                >
                  Asset Code
                </label>
                <input
                  id="qr-asset"
                  type="text"
                  value={assetCode}
                  onChange={(e) => setAssetCode(e.target.value.toUpperCase())}
                  placeholder="XLM"
                  maxLength={12}
                  className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2.5 font-mono text-sm text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="qr-issuer"
                className="text-xs uppercase font-bold text-gray-500"
              >
                Asset Issuer (optional)
              </label>
              <input
                id="qr-issuer"
                type="text"
                value={assetIssuer}
                onChange={(e) => setAssetIssuer(e.target.value)}
                placeholder="GXXXXXXXXX... (leave empty for native XLM)"
                spellCheck={false}
                autoComplete="off"
                className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2.5 font-mono text-sm text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* QR Code Display */}
            {isValidAddress && (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-gray-800 bg-[#0d1117] p-6">
                {isGenerating ? (
                  <div className="flex h-[280px] w-[280px] items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-blue-500" />
                  </div>
                ) : qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Stellar payment QR code"
                    width={280}
                    height={280}
                    className="rounded-lg"
                  />
                ) : null}

                <p className="max-w-full break-all text-center font-mono text-xs text-gray-500">
                  {stellarUri}
                </p>

                <button
                  type="button"
                  onClick={handleCopyUri}
                  className="flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800"
                >
                  <Icon
                    id={copied ? ICON_IDS.check : ICON_IDS.copy}
                    size={14}
                  />
                  {copied ? "Copied!" : "Copy Payment URI"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Scan Tab */}
        {tab === "scan" && (
          <div className="space-y-4">
            {!scanResult && (
              <>
                <div
                  ref={scannerRef}
                  className="relative mx-auto overflow-hidden rounded-lg border border-gray-800 bg-black"
                  style={{ minHeight: 300 }}
                />
                {isScanning && (
                  <p className="text-center text-xs text-gray-400">
                    Point your camera at a Stellar payment QR code...
                  </p>
                )}
              </>
            )}

            {scanError && (
              <div
                className="rounded-lg border border-red-500/40 bg-red-950/20 px-3 py-2 text-sm text-red-300"
                role="alert"
              >
                {scanError}
              </div>
            )}

            {scanResult && (
              <div className="space-y-4">
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Icon
                      id={ICON_IDS.checkCircle}
                      size={18}
                      className="text-emerald-400"
                    />
                    <p className="text-sm font-semibold text-emerald-300">
                      Payment QR Code Detected
                    </p>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Recipient</span>
                      <span className="font-mono text-xs text-gray-200">
                        {scanResult.destination.slice(0, 8)}...
                        {scanResult.destination.slice(-8)}
                      </span>
                    </div>
                    {scanResult.amount && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Amount</span>
                        <span className="font-mono text-gray-200">
                          {scanResult.amount}
                        </span>
                      </div>
                    )}
                    {scanResult.assetCode && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Asset</span>
                        <span className="text-gray-200">
                          {scanResult.assetCode}
                        </span>
                      </div>
                    )}
                    {scanResult.memo && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Memo</span>
                        <span className="font-mono text-xs text-gray-200">
                          {scanResult.memo}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setScanResult(null);
                      startScanner();
                    }}
                    className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800"
                  >
                    Scan Again
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyScannedPayment}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    Use This Payment
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </OptimizedDialog>
  );
}

export default QrScannerModal;
