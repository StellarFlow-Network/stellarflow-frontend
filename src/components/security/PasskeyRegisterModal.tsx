"use client";

/**
 * PasskeyRegisterModal
 *
 * Guides the user through registering a hardware passkey / Touch ID / Face ID.
 * Falls back to a password form when the browser doesn't support WebAuthn.
 *
 * Calls @simplewebauthn/browser's startRegistration() after receiving a
 * registration options object from your backend (or a simulated one when no
 * backend URL is configured).
 *
 * Props:
 *   isOpen          — Controls visibility.
 *   onClose         — Callback to hide the modal.
 *   onSuccess       — Callback fired with the new PasskeyDevice after success.
 *   getOptions      — Async fn that fetches RegistrationResponseJSON options
 *                     from your backend.  If omitted a stub is used.
 *   verifyResponse  — Async fn that sends the signed credential to your
 *                     backend for verification.  If omitted the modal always
 *                     treats the response as verified.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Shield, Key, Eye, EyeOff, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import {
  classifyPasskeyError,
  detectPasskeySupport,
  usePasskeys,
  type PasskeyDevice,
} from "@/hooks/usePasskeys";
import { BiometricAnimation } from "./BiometricAnimation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PasskeyRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (device: PasskeyDevice) => void;
  /**
   * Fetch registration options from your WebAuthn backend.
   * Receives the display name the user entered.
   */
  getOptions?: (
    userName: string,
  ) => Promise<PublicKeyCredentialCreationOptionsJSON>;
  /**
   * Send the signed credential back to your backend for storage.
   * Return true on success, throw on failure.
   */
  verifyResponse?: (response: RegistrationResponseJSON) => Promise<boolean>;
}

type Step = "name" | "challenge" | "success" | "fallback";

// ---------------------------------------------------------------------------
// Stub helpers (used when no backend integration is provided)
// ---------------------------------------------------------------------------

function buildStubOptions(
  userName: string,
): PublicKeyCredentialCreationOptionsJSON {
  return {
    rp: { name: "StellarFlow", id: window.location.hostname },
    user: {
      id: btoa(userName + Date.now()),
      name: userName,
      displayName: userName,
    },
    challenge: btoa(
      String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
    ),
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },
      { type: "public-key", alg: -257 },
    ],
    timeout: 60000,
    attestation: "none",
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "required",
      userVerification: "required",
    },
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PasskeyRegisterModal({
  isOpen,
  onClose,
  onSuccess,
  getOptions,
  verifyResponse,
}: PasskeyRegisterModalProps) {
  const [step, setStep] = useState<Step>("name");
  const [deviceName, setDeviceName] = useState("");
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [biometricState, setBiometricState] = useState<
    "idle" | "scanning" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const { addDevice, setError: storeSetError } = usePasskeys();
  const inputRef = useRef<HTMLInputElement>(null);
  const isMounted = useRef(true);

  // ── Support detection ────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    detectPasskeySupport().then((supported) => {
      if (isMounted.current) setIsSupported(supported);
    });
    return () => {
      isMounted.current = false;
    };
  }, []);

  // ── Auto-focus name input on open ────────────────────────────────────────
  useEffect(() => {
    if (isOpen && step === "name") {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen, step]);

  // ── Reset on close ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep("name");
        setDeviceName("");
        setBiometricState("idle");
        setErrorMsg(null);
        setPassword("");
        setPasswordConfirm("");
      }, 300);
    }
  }, [isOpen]);

  // ── Registration flow ────────────────────────────────────────────────────
  const startRegistration = useCallback(async () => {
    if (!deviceName.trim()) return;
    setStep("challenge");
    setBiometricState("scanning");
    setErrorMsg(null);

    try {
      // Dynamic import so the heavy WebAuthn library is not in the initial bundle.
      const { startRegistration: webAuthnStartRegistration } = await import(
        "@simplewebauthn/browser"
      );

      const options = getOptions
        ? await getOptions(deviceName.trim())
        : buildStubOptions(deviceName.trim());

      const regResponse = await webAuthnStartRegistration({ optionsJSON: options });

      // Backend verification (optional).
      if (verifyResponse) {
        await verifyResponse(regResponse);
      }

      const device: PasskeyDevice = {
        credentialId: regResponse.id,
        name: deviceName.trim(),
        registeredAt: new Date().toISOString(),
        aaguidHint: regResponse.response?.transports?.includes("internal")
          ? "platform"
          : "cross-platform",
      };

      addDevice(device);
      setBiometricState("success");
      setStep("success");
      onSuccess?.(device);
    } catch (err) {
      if (!isMounted.current) return;
      const { code, message } = classifyPasskeyError(err);
      storeSetError(code, message);
      setBiometricState("error");
      setErrorMsg(message);
    }
  }, [deviceName, getOptions, verifyResponse, addDevice, storeSetError, onSuccess]);

  // ── Password fallback submit ─────────────────────────────────────────────
  const submitPasswordFallback = useCallback(() => {
    if (password.length < 8 || password !== passwordConfirm) return;
    // In a real implementation you would hash + send to your backend.
    const device: PasskeyDevice = {
      credentialId: `password-fallback-${Date.now()}`,
      name: deviceName.trim() || "Password fallback",
      registeredAt: new Date().toISOString(),
      aaguidHint: "password",
    };
    addDevice(device);
    setBiometricState("success");
    setStep("success");
    onSuccess?.(device);
  }, [password, passwordConfirm, deviceName, addDevice, onSuccess]);

  // ── Keyboard shortcut — Esc closes ──────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const passwordMismatch =
    passwordConfirm.length > 0 && password !== passwordConfirm;
  const passwordTooShort = password.length > 0 && password.length < 8;

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
            aria-labelledby="passkey-register-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div
              className="relative w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-400" aria-hidden="true" />
                  <h2
                    id="passkey-register-title"
                    className="text-lg font-semibold text-white"
                  >
                    Register a Passkey
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 pb-6">
                <AnimatePresence mode="wait">
                  {/* ── Step: Name entry ──────────────────────────────── */}
                  {step === "name" && (
                    <motion.div
                      key="name"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2 }}
                    >
                      <p className="text-sm text-gray-400 mb-4">
                        Register a hardware passkey, Touch ID, or Face ID to
                        protect your wallet and relayer authentication.
                      </p>

                      {/* Unsupported browser info */}
                      {isSupported === false && (
                        <div className="flex items-start gap-2 rounded-lg bg-amber-900/30 border border-amber-700/40 p-3 mb-4">
                          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
                          <p className="text-xs text-amber-300">
                            Your browser doesn&apos;t support biometric
                            passkeys. You can use a password fallback instead.
                          </p>
                        </div>
                      )}

                      <label className="block text-sm font-medium text-gray-300 mb-1.5">
                        Device nickname
                      </label>
                      <input
                        ref={inputRef}
                        type="text"
                        value={deviceName}
                        onChange={(e) => setDeviceName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && deviceName.trim()) {
                            isSupported === false
                              ? setStep("fallback")
                              : startRegistration();
                          }
                        }}
                        placeholder={
                          isSupported === false
                            ? "e.g. MacBook Pro"
                            : "e.g. MacBook Touch ID"
                        }
                        maxLength={48}
                        className="w-full rounded-lg bg-gray-800 border border-white/10 text-white placeholder-gray-500 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        aria-label="Device nickname"
                        autoComplete="off"
                      />

                      <div className="mt-5 flex flex-col gap-2">
                        {isSupported !== false && (
                          <button
                            disabled={!deviceName.trim()}
                            onClick={startRegistration}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                          >
                            <Key className="h-4 w-4" aria-hidden="true" />
                            Register Passkey
                          </button>
                        )}
                        <button
                          onClick={() => setStep("fallback")}
                          className="w-full text-center text-xs text-gray-500 hover:text-gray-300 py-1.5 transition"
                        >
                          Use password instead
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Step: WebAuthn challenge ───────────────────────── */}
                  {step === "challenge" && (
                    <motion.div
                      key="challenge"
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center py-4 gap-5"
                    >
                      <BiometricAnimation state={biometricState} size={112} />

                      <div className="text-center">
                        {biometricState === "scanning" && (
                          <>
                            <p className="text-white font-semibold mb-1">
                              Follow the on-device prompt
                            </p>
                            <p className="text-sm text-gray-400">
                              Touch your fingerprint sensor or use Face ID /
                              Windows Hello to register your passkey.
                            </p>
                          </>
                        )}
                        {biometricState === "error" && (
                          <>
                            <p className="text-red-400 font-semibold mb-1">
                              Registration failed
                            </p>
                            <p className="text-sm text-gray-400 max-w-xs">
                              {errorMsg ??
                                "Something went wrong. Please try again."}
                            </p>
                            <div className="mt-4 flex gap-2 justify-center">
                              <button
                                onClick={() => {
                                  setBiometricState("idle");
                                  setStep("name");
                                }}
                                className="text-sm text-gray-400 hover:text-white transition"
                              >
                                Back
                              </button>
                              <button
                                onClick={startRegistration}
                                className="text-sm text-blue-400 hover:text-blue-300 font-medium transition"
                              >
                                Try again
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* ── Step: Success ─────────────────────────────────── */}
                  {step === "success" && (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center py-4 gap-4 text-center"
                    >
                      <BiometricAnimation state="success" size={96} />
                      <div>
                        <p className="text-white font-semibold text-lg mb-1 flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="h-5 w-5 text-green-400" aria-hidden="true" />
                          Passkey registered!
                        </p>
                        <p className="text-sm text-gray-400">
                          <span className="text-gray-200 font-medium">
                            {deviceName}
                          </span>{" "}
                          has been added to your account.
                        </p>
                      </div>
                      <button
                        onClick={onClose}
                        className="mt-2 w-full rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold py-2.5 px-4 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400"
                      >
                        Done
                      </button>
                    </motion.div>
                  )}

                  {/* ── Step: Password fallback ───────────────────────── */}
                  {step === "fallback" && (
                    <motion.div
                      key="fallback"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="flex items-start gap-2 rounded-lg bg-blue-950/40 border border-blue-700/30 p-3 mb-4">
                        <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" aria-hidden="true" />
                        <p className="text-xs text-blue-300">
                          Passkeys are more secure. Use this option only if
                          your device doesn&apos;t support biometric
                          authentication.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1.5">
                            Password
                          </label>
                          <div className="relative">
                            <input
                              type={showPassword ? "text" : "password"}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="At least 8 characters"
                              autoComplete="new-password"
                              className={`w-full rounded-lg bg-gray-800 border ${
                                passwordTooShort
                                  ? "border-red-500"
                                  : "border-white/10"
                              } text-white placeholder-gray-500 px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((v) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition"
                              aria-label={
                                showPassword ? "Hide password" : "Show password"
                              }
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" aria-hidden="true" />
                              ) : (
                                <Eye className="h-4 w-4" aria-hidden="true" />
                              )}
                            </button>
                          </div>
                          {passwordTooShort && (
                            <p className="text-xs text-red-400 mt-1">
                              Must be at least 8 characters.
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1.5">
                            Confirm password
                          </label>
                          <input
                            type="password"
                            value={passwordConfirm}
                            onChange={(e) => setPasswordConfirm(e.target.value)}
                            placeholder="Repeat password"
                            autoComplete="new-password"
                            className={`w-full rounded-lg bg-gray-800 border ${
                              passwordMismatch
                                ? "border-red-500"
                                : "border-white/10"
                            } text-white placeholder-gray-500 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition`}
                          />
                          {passwordMismatch && (
                            <p className="text-xs text-red-400 mt-1">
                              Passwords don&apos;t match.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 flex gap-2">
                        <button
                          onClick={() => setStep("name")}
                          className="flex-1 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 font-medium py-2.5 px-4 text-sm transition"
                        >
                          Back
                        </button>
                        <button
                          disabled={
                            password.length < 8 ||
                            password !== passwordConfirm
                          }
                          onClick={submitPasswordFallback}
                          className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        >
                          Save password
                        </button>
                      </div>
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
