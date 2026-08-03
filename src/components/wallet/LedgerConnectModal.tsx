"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import OptimizedDialog from "@/app/components/OptimizedDialog";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import { useToast } from "@/components/ui/ToastQueue";

type ConnectionStep =
  | "idle"
  | "connecting"
  | "unlock_device"
  | "open_app"
  | "enable_signing"
  | "fetching_key"
  | "connected"
  | "error";

interface LedgerState {
  step: ConnectionStep;
  publicKey: string | null;
  errorMessage: string | null;
  deviceModel: string | null;
}

export interface LedgerConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: (publicKey: string) => void;
  onSignTransaction?: (
    signedXdr: string,
    publicKey: string,
  ) => void;
}

const STEP_LABELS: Record<ConnectionStep, string> = {
  idle: "Ready to connect",
  connecting: "Connecting to Ledger...",
  unlock_device: "Unlock your Ledger device",
  open_app: "Open the Stellar app on your Ledger",
  enable_signing: "Enable blind signing in Stellar app settings",
  fetching_key: "Retrieving your Stellar public key...",
  connected: "Ledger connected successfully",
  error: "Connection failed",
};

const STEP_ORDER: ConnectionStep[] = [
  "connecting",
  "unlock_device",
  "open_app",
  "enable_signing",
  "fetching_key",
  "connected",
];

function isWebUSBSupported(): boolean {
  return typeof navigator !== "undefined" && "usb" in navigator;
}

export function LedgerConnectModal({
  isOpen,
  onClose,
  onConnected,
  onSignTransaction,
}: LedgerConnectModalProps) {
  const { addToast, updateToast } = useToast();

  const [state, setState] = useState<LedgerState>({
    step: "idle",
    publicKey: null,
    errorMessage: null,
    deviceModel: null,
  });

  const [txXdr, setTxXdr] = useState("");
  const [isSigning, setIsSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  const webUSBAvailable = useMemo(() => isWebUSBSupported(), []);

  useEffect(() => {
    if (!isOpen) {
      setState({
        step: "idle",
        publicKey: null,
        errorMessage: null,
        deviceModel: null,
      });
      setTxXdr("");
      setIsSigning(false);
      setSignError(null);
    }
  }, [isOpen]);

  const handleConnect = useCallback(async () => {
    if (!webUSBAvailable) {
      setState((s) => ({
        ...s,
        step: "error",
        errorMessage:
          "WebUSB is not supported in this browser. Please use Chrome, Edge, or Opera.",
      }));
      return;
    }

    setState((s) => ({
      ...s,
      step: "connecting",
      errorMessage: null,
      publicKey: null,
    }));

    try {
      setState((s) => ({ ...s, step: "unlock_device" }));
      const TransportWebUSB = await import("@ledgerhq/hw-transport-webusb").then(
        (m) => m.default,
      );

      setState((s) => ({ ...s, step: "open_app" }));
      const transport = await TransportWebUSB.create();

      const deviceName =
        (transport as unknown as Record<string, { productName?: string }>)
          .device?.productName ?? "Ledger Device";
      setState((s) => ({ ...s, deviceModel: deviceName }));

      setState((s) => ({ ...s, step: "enable_signing" }));

      setState((s) => ({ ...s, step: "fetching_key" }));
      const Str = await import("@ledgerhq/hw-app-str").then((m) => m.default);
      const stellarApp = new Str(transport);

      const { publicKey } = await stellarApp.getPublicKey("44'/148'/0'");

      setState((s) => ({
        ...s,
        step: "connected",
        publicKey,
      }));

      onConnected?.(publicKey);

      await transport.close();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown error occurred.";

      let userMessage = message;
      if (message.includes("denied")) {
        userMessage =
          "USB device access was denied. Please approve the connection prompt.";
      } else if (message.includes("0x6e01") || message.includes("0x6e00")) {
        userMessage =
          "The Stellar app is not open on your Ledger. Please open it and try again.";
      } else if (message.includes("Locked")) {
        userMessage =
          "Your Ledger device is locked. Please unlock it with your PIN.";
      }

      setState((s) => ({
        ...s,
        step: "error",
        errorMessage: userMessage,
      }));
    }
  }, [webUSBAvailable, onConnected]);

  const handleSign = useCallback(async () => {
    if (!state.publicKey || !txXdr.trim()) return;

    setIsSigning(true);
    setSignError(null);

    const toastId = addToast({
      title: "Ledger signing",
      description: "Review the transaction on your Ledger device.",
      status: "processing",
    });

    try {
      const TransportWebUSB = await import("@ledgerhq/hw-transport-webusb").then(
        (m) => m.default,
      );
      const transport = await TransportWebUSB.create();
      const Str = await import("@ledgerhq/hw-app-str").then((m) => m.default);
      const stellarApp = new Str(transport);

      const { Networks, TransactionBuilder } = await import(
        "@stellar/stellar-sdk"
      );
      const tx = TransactionBuilder.fromXDR(txXdr.trim(), Networks.TESTNET);
      const signatureBuffer = tx.signatureBase();

      const result = await stellarApp.signTransaction(
        "44'/148'/0'",
        signatureBuffer,
      );

      const signedXdr = Buffer.from(result.signature).toString("base64");

      updateToast(toastId, {
        status: "confirmed",
        title: "Transaction signed",
        description: "Your Ledger has signed the transaction.",
      });

      onSignTransaction?.(signedXdr, state.publicKey);
      await transport.close();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Signing failed.";

      let userMessage = message;
      if (message.includes("denied") || message.includes("0x6985")) {
        userMessage = "Transaction was rejected on the Ledger device.";
      }

      setSignError(userMessage);
      updateToast(toastId, {
        status: "failed",
        title: "Signing failed",
        description: userMessage,
      });
    } finally {
      setIsSigning(false);
    }
  }, [state.publicKey, txXdr, addToast, updateToast, onSignTransaction]);

  const currentStepIndex = STEP_ORDER.indexOf(state.step);

  return (
    <OptimizedDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Connect Ledger Wallet"
      size="lg"
    >
      <div className="space-y-5">
        {/* WebUSB Warning */}
        {!webUSBAvailable && (
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-950/20 px-3 py-2 text-sm text-yellow-300">
            WebUSB is not available. Ledger connections require Chrome, Edge, or
            Opera on desktop.
          </div>
        )}

        {/* Connection Steps Guide */}
        <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-4">
          <p className="mb-3 text-xs uppercase font-bold text-gray-500">
            Connection Guide
          </p>
          <div className="space-y-3">
            {[
              {
                step: "unlock_device" as ConnectionStep,
                label: "Unlock your Ledger with your PIN",
                icon: ICON_IDS.unlock,
              },
              {
                step: "open_app" as ConnectionStep,
                label: "Open the Stellar app",
                icon: ICON_IDS.globe,
              },
              {
                step: "enable_signing" as ConnectionStep,
                label: "Enable blind signing in app settings",
                icon: ICON_IDS.shieldCheck,
              },
              {
                step: "fetching_key" as ConnectionStep,
                label: "Approve the connection on device",
                icon: ICON_IDS.key,
              },
            ].map(({ step, label, icon }) => {
              const stepIdx = STEP_ORDER.indexOf(step);
              const isCompleted = currentStepIndex > stepIdx;
              const isActive = state.step === step;

              return (
                <div
                  key={step}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                    isActive
                      ? "bg-blue-950/30 border border-blue-500/30"
                      : isCompleted
                        ? "bg-emerald-950/10"
                        : "bg-transparent"
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      isCompleted
                        ? "bg-emerald-500/20 text-emerald-400"
                        : isActive
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-gray-800 text-gray-500"
                    }`}
                  >
                    <Icon
                      id={isCompleted ? ICON_IDS.check : icon}
                      size={14}
                    />
                  </div>
                  <span
                    className={`text-sm ${
                      isCompleted
                        ? "text-emerald-300"
                        : isActive
                          ? "text-blue-300 font-medium"
                          : "text-gray-400"
                    }`}
                  >
                    {label}
                  </span>
                  {isActive && (
                    <div className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-blue-500" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Status */}
        <div
          className={`rounded-lg border p-4 ${
            state.step === "connected"
              ? "border-emerald-500/40 bg-emerald-950/20"
              : state.step === "error"
                ? "border-red-500/40 bg-red-950/20"
                : state.step === "idle"
                  ? "border-gray-800 bg-[#0d1117]"
                  : "border-blue-500/30 bg-blue-950/10"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Icon
              id={
                state.step === "connected"
                  ? ICON_IDS.checkCircle
                  : state.step === "error"
                    ? ICON_IDS.alertTriangle
                    : ICON_IDS.wallet
              }
              size={16}
              className={
                state.step === "connected"
                  ? "text-emerald-400"
                  : state.step === "error"
                    ? "text-red-400"
                    : "text-blue-400"
              }
            />
            <p className="text-sm font-semibold text-gray-200">
              {STEP_LABELS[state.step]}
            </p>
          </div>

          {state.publicKey && (
            <p className="mt-2 font-mono text-xs text-gray-400 break-all">
              {state.publicKey}
            </p>
          )}

          {state.deviceModel && state.step === "connected" && (
            <p className="mt-1 text-xs text-gray-500">
              Device: {state.deviceModel}
            </p>
          )}

          {state.errorMessage && (
            <p className="mt-2 text-sm text-red-300">{state.errorMessage}</p>
          )}
        </div>

        {/* Transaction Signing (only when connected) */}
        {state.step === "connected" && state.publicKey && (
          <div className="space-y-3">
            <label
              htmlFor="ledger-tx-xdr"
              className="text-xs uppercase font-bold text-gray-500"
            >
              Transaction XDR (optional)
            </label>
            <textarea
              id="ledger-tx-xdr"
              value={txXdr}
              onChange={(e) => setTxXdr(e.target.value)}
              rows={3}
              spellCheck={false}
              autoComplete="off"
              placeholder="Paste a transaction XDR to sign with your Ledger..."
              disabled={isSigning}
              className="w-full resize-none rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2.5 font-mono text-sm text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />

            {signError && (
              <div
                className="rounded-lg border border-red-500/40 bg-red-950/20 px-3 py-2 text-sm text-red-300"
                role="alert"
              >
                {signError}
              </div>
            )}

            {txXdr.trim() && (
              <button
                type="button"
                onClick={handleSign}
                disabled={isSigning}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSigning
                  ? "Review on Ledger..."
                  : "Sign Transaction with Ledger"}
              </button>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800"
          >
            {state.step === "connected" ? "Done" : "Cancel"}
          </button>
          {state.step !== "connected" && (
            <button
              type="button"
              onClick={handleConnect}
              disabled={
                !webUSBAvailable ||
                (state.step !== "idle" && state.step !== "error")
              }
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state.step === "error"
                ? "Retry Connection"
                : state.step === "idle"
                  ? "Connect Ledger"
                  : "Connecting..."}
            </button>
          )}
        </div>
      </div>
    </OptimizedDialog>
  );
}

export default LedgerConnectModal;
