"use client";

/**
 * PasskeyLoginPrompt
 *
 * Displayed when the app needs to authenticate the current user via a
 * registered passkey before an action (e.g. signing a relayer transaction).
 *
 * Props:
 *   isOpen           — Controls visibility.
 *   onClose          — Cancel / dismiss callback.
 *   onSuccess        — Fired with the credential ID that authenticated.
 *   getOptions       — Fetches AuthenticationOptionsJSON from your backend.
 *   verifyResponse   — Sends the signed assertion to your backend.
 *   title            — Optional prompt heading.
 *   description      — Optional context sentence shown below the heading.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  KeyRound,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type {
  PublicKeyCredentialRequestOptionsJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/browser";
import {
  classifyPasskeyError,
  detectPasskeySupport,
  usePasskeys,
} from "@/hooks/usePasskeys";
import { BiometricAnimation } from "./BiometricAnimation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PasskeyLoginPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (credentialId: string) => void;
  getOptions?: () => Promise<PublicKeyCredentialRequestOptionsJSON>;
  verifyResponse?: (response: AuthenticationResponseJSON) => Promise<boolean>;
  title?: string;
  description?: string;
}

type Phase = "idle" | "scanning" | "success" | "error";

// ---------------------------------------------------------------------------
// Error-specific guidance copy
// ---------------------------------------------------------------------------

const ERROR_GUIDANCE: Record<string, { heading: string; steps: string[] }> = {
  USER_CANCELLED: {
    heading: "Prompt was dismissed",
    steps: [
      "When the browser shows the biometric prompt, complete the scan before tapping elsewhere.",
      "On iOS: make sure Face ID or Touch ID is enabled in Settings → Face ID & Passcode.",
      "On Android: unlock your device first, then try again.",
    ],
  },
  TIMEOUT: {
    heading: "Authenticator timed out",
    steps: [
      "The passkey request expired. Tap Try Again to start a fresh challenge.",
      "Ensure your device screen is on and unlocked.",
    ],
  },
  UNSUPPORTED: {
    heading: "Browser not supported",
    steps: [
      "Update your browser to the latest version.",
      "Use Chrome 108+, Safari 16+, Firefox 119+, or Edge 108+ for passkey support.",
      "Ensure you are on HTTPS — passkeys require a secure context.",
    ],
  },
  DEFAULT: {
    heading: "Authentication failed",
    steps: [
      "Make sure you select the correct passkey when prompted.",
      "Try removing and re-registering this passkey if the problem persists.",
    ],
  },
};

// ---------------------------------------------------------------------------
// Stub helper
// ---------------------------------------------------------------------------

function buildStubOptions(): PublicKeyCredentialRequestOptionsJSON {
  return {
    rpId: window.location.hostname,
    challenge: btoa(
      String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
    ),
    timeout: 60000,
    userVerification: "required",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PasskeyLoginPrompt({
  isOpen,
  onClose,
  onSuccess,
  getOptions,
  verifyResponse,
  title = "Confirm with Passkey",
  description = "Verify your identity using your registered passkey to continue.",
}: PasskeyLoginPromptProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [showGuidance, setShowGuidance] = useState(false);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);

  const { setError: storeSetError } = usePasskeys();
  const isMounted = useRef(true);

  // ── Support detection ────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    detectPasskeySupport().then((s) => {
      if (isMounted.current) setIsSupported(s);
    });
    return () => {
      isMounted.current = false;
    };
  }, []);

  // ── Reset on open ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setPhase("idle");
      setErrorMsg(null);
      setErrorCode(null);
      setShowGuidance(false);
    }
  }, [isOpen]);

  // ── Auto-start challenge on open once support is confirmed ───────────────
  useEffect(() => {
    if (isOpen && isSupported === true && phase === "idle") {
      startAuthentication();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isSupported]);

  // ── Keyboard shortcut ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // ── Authentication flow ──────────────────────────────────────────────────
  const startAuthentication = useCallback(async () => {
    setPhase("scanning");
    setErrorMsg(null);
    setErrorCode(null);
    setShowGuidance(false);

    try {
      const { startAuthentication: webAuthnStartAuth } = await import(
        "@simplewebauthn/browser"
      );

      const options = getOptions ? await getOptions() : buildStubOptions();
      const authResponse = await webAuthnStartAuth({ optionsJSON: options });

      if (verifyResponse) {
        const ok = await verifyResponse(authResponse);
        if (!ok) throw new Error("Authentication verification failed");
      }

      if (!isMounted.current) return;
      setPhase("success");
      onSuccess?.(authResponse.id);

      // Auto-close after brief success flash.
      setTimeout(() => {
        if (isMounted.current) onClose();
      }, 1400);
    } catch (err) {
      if (!isMounted.current) return;
      const { code, message } = classifyPasskeyError(err);
      storeSetError(code, message);
      setPhase("error");
      setErrorMsg(message);
      setErrorCode(code);
    }
  }, [getOptions, verifyResponse, onSuccess, onClose, storeSetError]);

  if (!isOpen) return null;

  const guidance =
    errorCode && ERROR_GUIDANCE[errorCode]
      ? ERROR_GUIDANCE[errorCode]
      : ERROR_GUIDANCE.DEFAULT;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="passkey-login-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div
              className="relative w-full max-w-sm rounded-2xl bg-gray-900 border border-white/10 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-blue-400" aria-hidden="true" />
                  <h2
                    id="passkey-login-title"
                    className="text-base font-semibold text-white"
                  >
                    {title}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 pb-6">
                <AnimatePresence mode="wait">
                  {/* ── Idle / Scanning ───────────────────────────────── */}
                  {(phase === "idle" || phase === "scanning") && (
                    <motion.div
                      key="scanning"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center py-3 gap-4 text-center"
                    >
                      <BiometricAnimation
                        state={phase === "scanning" ? "scanning" : "idle"}
                        size={104}
                      />
                      <div>
                        <p className="text-white font-medium mb-1">
                          {phase === "scanning"
                            ? "Waiting for biometric…"
                            : "Preparing…"}
                        </p>
                        <p className="text-sm text-gray-400 max-w-[260px]">
                          {description}
                        </p>
                      </div>
                      <button
                        onClick={onClose}
                        className="text-xs text-gray-500 hover:text-gray-300 transition mt-1"
                      >
                        Cancel
                      </button>
                    </motion.div>
                  )}

                  {/* ── Success ───────────────────────────────────────── */}
                  {phase === "success" && (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center py-3 gap-3 text-center"
                    >
                      <BiometricAnimation state="success" size={96} />
                      <p className="text-green-400 font-semibold">
                        Identity confirmed
                      </p>
                    </motion.div>
                  )}

                  {/* ── Error ─────────────────────────────────────────── */}
                  {phase === "error" && (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col gap-4"
                    >
                      <div className="flex flex-col items-center pt-2 gap-3 text-center">
                        <BiometricAnimation state="error" size={96} />
                        <div>
                          <p className="text-red-400 font-semibold mb-1">
                            {guidance.heading}
                          </p>
                          <p className="text-sm text-gray-400 max-w-[260px]">
                            {errorMsg}
                          </p>
                        </div>
                      </div>

                      {/* Collapsible guidance */}
                      <div className="rounded-lg border border-white/10 overflow-hidden">
                        <button
                          onClick={() => setShowGuidance((v) => !v)}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition"
                          aria-expanded={showGuidance}
                        >
                          <span className="flex items-center gap-1.5">
                            <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                            How to fix this
                          </span>
                          {showGuidance ? (
                            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                        </button>

                        <AnimatePresence>
                          {showGuidance && (
                            <motion.ul
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              {guidance.steps.map((step, i) => (
                                <li
                                  key={i}
                                  className="flex items-start gap-2 px-4 py-2 text-xs text-gray-400 border-t border-white/5"
                                >
                                  <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                                  {step}
                                </li>
                              ))}
                            </motion.ul>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Actions */}
                      {isSupported !== false && (
                        <button
                          onClick={startAuthentication}
                          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-4 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        >
                          <RefreshCw className="h-4 w-4" aria-hidden="true" />
                          Try again
                        </button>
                      )}

                      {isSupported === false && (
                        <div className="flex items-start gap-2 rounded-lg bg-amber-900/30 border border-amber-700/40 p-3">
                          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
                          <p className="text-xs text-amber-300">
                            Passkeys are not supported in this browser. Please
                            use a supported browser or contact support for
                            alternative authentication.
                          </p>
                        </div>
                      )}

                      <button
                        onClick={onClose}
                        className="w-full text-center text-xs text-gray-500 hover:text-gray-300 py-1 transition"
                      >
                        Cancel
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
