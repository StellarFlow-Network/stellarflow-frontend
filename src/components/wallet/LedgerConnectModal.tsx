"use client";

import React, { useState, useEffect } from "react";
import OptimizedDialog from "@/app/components/OptimizedDialog";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import { useLedgerWallet, LedgerConnectionStep } from "./LedgerWalletProvider";
import { motion, AnimatePresence } from "framer-motion";

export interface LedgerConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: (publicKey: string) => void;
  onSignTransaction?: (signedXdr: string, publicKey: string) => void;
}

const STEP_LABELS: Record<LedgerConnectionStep, string> = {
  idle: "Ready to connect",
  connecting: "Connecting to Ledger...",
  unlock_device: "Unlock your Ledger device",
  open_app: "Open the Stellar app on your Ledger",
  enable_signing: "Enable blind signing in Stellar app settings",
  fetching_key: "Retrieving your Stellar public key...",
  connected: "Ledger connected successfully",
  error: "Connection failed",
};

const STEP_ORDER: LedgerConnectionStep[] = [
  "connecting",
  "unlock_device",
  "open_app",
  "enable_signing",
  "fetching_key",
  "connected",
];

export function LedgerConnectModal({
  isOpen,
  onClose,
  onConnected,
  onSignTransaction,
}: LedgerConnectModalProps) {
  const {
    isSupported,
    state,
    isSigning,
    signError,
    connect,
    signTransaction,
    resetError,
  } = useLedgerWallet();

  const [txXdr, setTxXdr] = useState("");

  const handleConnect = async () => {
    await connect();
  };

  useEffect(() => {
    if (state.step === "connected" && state.publicKey) {
      onConnected?.(state.publicKey);
    }
  }, [state.step, state.publicKey, onConnected]);

  const handleSign = async () => {
    if (!state.publicKey || !txXdr.trim()) return;
    const signedXdr = await signTransaction(txXdr);
    if (signedXdr) {
      onSignTransaction?.(signedXdr, state.publicKey);
      setTxXdr("");
    }
  };

  const currentStepIndex = STEP_ORDER.indexOf(state.step);

  return (
    <OptimizedDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Connect Ledger Wallet"
      size="lg"
    >
      <div className="space-y-5 relative">
        {/* WebUSB Warning */}
        {!isSupported && (
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
                step: "unlock_device" as LedgerConnectionStep,
                label: "Unlock your Ledger with your PIN",
                icon: ICON_IDS.unlock,
              },
              {
                step: "open_app" as LedgerConnectionStep,
                label: "Open the Stellar app",
                icon: ICON_IDS.globe,
              },
              {
                step: "enable_signing" as LedgerConnectionStep,
                label: "Enable blind signing in app settings",
                icon: ICON_IDS.shieldCheck,
              },
              {
                step: "fetching_key" as LedgerConnectionStep,
                label: "Approve the connection on device",
                icon: ICON_IDS.key,
              },
            ].map(({ step, label, icon }) => {
              const stepIdx = STEP_ORDER.indexOf(step);
              const isCompleted = currentStepIndex > stepIdx && state.step !== "error";
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

        {/* Status Display */}
        <div
          className={`rounded-lg border p-4 transition-colors ${
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
            <div className="mt-2 text-sm text-red-300">
              <p>{state.errorMessage}</p>
              <div className="mt-2">
                <p className="text-xs text-red-400/80 mb-1">Troubleshooting Tips:</p>
                <ul className="list-disc list-inside text-xs space-y-1">
                  <li>Ensure the device is plugged in securely.</li>
                  <li>Unlock your Ledger and open the Stellar app.</li>
                  <li>Check if another application is using the device.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Transaction Signing Form */}
        {state.step === "connected" && state.publicKey && !isSigning && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <label
              htmlFor="ledger-tx-xdr"
              className="text-xs uppercase font-bold text-gray-500"
            >
              Transaction XDR
            </label>
            <textarea
              id="ledger-tx-xdr"
              value={txXdr}
              onChange={(e) => setTxXdr(e.target.value)}
              rows={3}
              spellCheck={false}
              autoComplete="off"
              placeholder="Paste a transaction XDR to sign with your Ledger..."
              className="w-full resize-none rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2.5 font-mono text-sm text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none"
            />

            {signError && (
              <div
                className="rounded-lg border border-red-500/40 bg-red-950/20 px-3 py-3 text-sm text-red-300"
                role="alert"
              >
                <div className="flex items-start gap-2 mb-2">
                  <Icon id={ICON_IDS.alertTriangle} className="text-red-400 shrink-0 mt-0.5" size={16} />
                  <p className="font-semibold text-red-200">Signature Error</p>
                </div>
                <p className="mb-2">{signError}</p>
                
                <p className="text-xs font-medium text-red-200/80 mb-1">Troubleshooting:</p>
                <ul className="list-disc list-inside text-xs space-y-1 text-red-300/80 mb-3">
                  <li>Check if your device disconnected or went to sleep.</li>
                  <li>Make sure you approve the transaction on the device screen.</li>
                  <li>Enable "Hash Signing" or "Blind Signing" in the Stellar app settings on your Ledger.</li>
                </ul>
                <button
                  type="button"
                  onClick={resetError}
                  className="rounded bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/30 transition-colors"
                >
                  Dismiss Error
                </button>
              </div>
            )}

            {txXdr.trim() && !signError && (
              <button
                type="button"
                onClick={handleSign}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 shadow-lg shadow-blue-500/20"
              >
                Sign Transaction with Ledger
              </button>
            )}
          </motion.div>
        )}

        {/* Animated Signing Overlay */}
        <AnimatePresence>
          {isSigning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0d1117]/95 backdrop-blur-sm rounded-lg border border-blue-500/30 p-6 text-center"
            >
              {/* Graphic Device Simulation */}
              <div className="relative mb-6">
                <motion.div
                  animate={{ 
                    boxShadow: ["0px 0px 0px rgba(59,130,246,0)", "0px 0px 20px rgba(59,130,246,0.5)", "0px 0px 0px rgba(59,130,246,0)"]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="h-12 w-32 rounded bg-gray-800 border border-gray-600 flex items-center justify-center relative overflow-hidden"
                >
                  {/* Ledger screen glare effect */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />
                  
                  {/* Scrolling Text Simulation */}
                  <motion.div
                    animate={{ x: ["100%", "-100%"] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="whitespace-nowrap text-[10px] font-mono text-blue-400 font-bold tracking-widest"
                  >
                    REVIEW TRANSACTION
                  </motion.div>
                </motion.div>
                
                {/* Simulated Ledger Buttons */}
                <div className="absolute -top-1.5 left-4 h-1.5 w-6 rounded-t bg-gray-500" />
                <div className="absolute -top-1.5 right-4 h-1.5 w-6 rounded-t bg-gray-500" />
                
                {/* Connecting wire */}
                <div className="absolute top-1/2 -right-12 h-1 w-12 bg-gray-700" />
              </div>
              
              <h3 className="text-lg font-bold text-white mb-2">Verify Transaction on Ledger Device</h3>
              <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">
                Please check your Ledger device screen to review the transaction hash and approve it.
              </p>
              
              <div className="flex items-center justify-center gap-2 text-xs text-blue-400 font-medium">
                <Icon id={ICON_IDS.loader} className="animate-spin" size={14} />
                Waiting for device approval...
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSigning}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            {state.step === "connected" ? "Done" : "Cancel"}
          </button>
          
          {state.step !== "connected" && (
            <button
              type="button"
              onClick={handleConnect}
              disabled={
                !isSupported ||
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
