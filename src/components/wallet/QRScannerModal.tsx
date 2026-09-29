"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardPaste,
  Copy,
  Info,
  QrCode,
  RefreshCw,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

import {
  parseAndValidateStellarQR,
  type ScannedStellarPayment,
  STELLAR_PUBKEY_REGEX,
  STELLAR_MUXED_REGEX,
  STELLAR_FEDERATION_REGEX,
  SEP07_URI_REGEX,
} from "@/lib/qrScannerValidation";

export { parseAndValidateStellarQR };
export type { ScannedStellarPayment };

export interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (result: ScannedStellarPayment) => void;
  title?: string;
  description?: string;
}


/**
 * Play a pleasant 2-tone melodic sound chime on successful scan.
 */
function playScanSuccessChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // First tone (A5 - 880 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.12);

    // Second tone (E6 - 1320 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1320, now + 0.08);
    gain2.gain.setValueAtTime(0.12, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.3);
  } catch {
    // Audio playback may be restricted if user hasn't interacted
  }
}

export function QRScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  title = "Scan Stellar QR Code",
  description = "Align the recipient's Stellar address QR code or SEP-07 payment URI inside the camera frame.",
}: QRScannerModalProps) {
  const [activeTab, setActiveTab] = useState<"camera" | "manual">("camera");
  const [permissionStatus, setPermissionStatus] = useState<
    "idle" | "requesting" | "granted" | "denied" | "unsupported"
  >("idle");
  const [scanWarning, setScanWarning] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [manualInput, setManualInput] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [lastScannedResult, setLastScannedResult] = useState<ScannedStellarPayment | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<{ reset: () => void } | null>(null);
  const isScanningRef = useRef(false);

  // Stop camera stream safely
  const stopCamera = useCallback(() => {
    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch {
        // ignore
      }
      readerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    isScanningRef.current = false;
  }, []);

  // Handle successful payload
  const handleSuccess = useCallback(
    (payment: ScannedStellarPayment) => {
      // 1. Haptic vibration
      triggerHaptic("txConfirm", true);

      // 2. Audio Chime
      if (soundEnabled) {
        playScanSuccessChime();
      }

      setLastScannedResult(payment);
      setScanWarning(null);

      // Notify caller after brief visual confirmation
      setTimeout(() => {
        onScanSuccess(payment);
        onClose();
      }, 400);
    },
    [soundEnabled, onScanSuccess, onClose]
  );

  // Start ZXing camera reader
  const startCamera = useCallback(async () => {
    stopCamera();
    setScanWarning(null);
    setPermissionStatus("requesting");

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setPermissionStatus("unsupported");
      return;
    }

    try {
      // Dynamic import of @zxing/library for performance & SSR safety
      const { BrowserQRCodeReader } = await import("@zxing/library");
      const codeReader = new BrowserQRCodeReader();
      readerRef.current = codeReader;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;
      setPermissionStatus("granted");
      isScanningRef.current = true;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();

        codeReader.decodeFromVideoElementContinuously(videoRef.current, (result, error) => {
          if (result && isScanningRef.current) {
            const rawText = result.getText();
            const validation = parseAndValidateStellarQR(rawText);

            if (validation.valid && validation.data) {
              isScanningRef.current = false;
              stopCamera();
              handleSuccess(validation.data);
            } else {
              // Trigger haptic warning for invalid code without closing scanner modal
              triggerHaptic("warning");
              setScanWarning(validation.error || "Unrecognized Stellar QR code format.");
            }
          }
        });
      }
    } catch (err: unknown) {
      console.warn("Camera access failed:", err);
      const errName = err instanceof Error ? err.name : "";
      if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
        setPermissionStatus("denied");
      } else {
        setPermissionStatus("unsupported");
      }
    }
  }, [stopCamera, handleSuccess]);

  // Lifecycle
  useEffect(() => {
    if (isOpen && activeTab === "camera") {
      void startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, startCamera, stopCamera]);

  // Manual submission validation
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    const validation = parseAndValidateStellarQR(manualInput);
    if (validation.valid && validation.data) {
      handleSuccess(validation.data);
    } else {
      setManualError(validation.error || "Invalid Stellar address or SEP-07 URI.");
      triggerHaptic("error");
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setManualInput(text);
      const validation = parseAndValidateStellarQR(text);
      if (!validation.valid) {
        setManualError(validation.error || "Pasted text is not a valid Stellar key.");
      } else {
        setManualError(null);
      }
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0d1a21] text-slate-100 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-scanner-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-[#0a151d]">
          <div className="flex items-center gap-2 text-cyan-400">
            <QrCode size={20} />
            <h2 id="qr-scanner-title" className="font-bold text-white text-base">
              {title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              className={`rounded-lg p-1.5 transition ${
                soundEnabled
                  ? "text-cyan-400 hover:bg-white/5"
                  : "text-slate-500 hover:bg-white/5"
              }`}
              title={soundEnabled ? "Mute scan sound" : "Enable scan sound"}
              aria-label={soundEnabled ? "Mute scan sound" : "Enable scan sound"}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Close scanner modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Selector: Camera vs Manual Paste */}
        <div className="flex border-b border-white/10 bg-[#071016] p-1">
          <button
            type="button"
            onClick={() => setActiveTab("camera")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
              activeTab === "camera"
                ? "bg-cyan-500 text-[#071016]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Camera size={14} /> Scan Camera
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("manual")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
              activeTab === "manual"
                ? "bg-cyan-500 text-[#071016]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ClipboardPaste size={14} /> Paste Key / URI
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4">
          {activeTab === "camera" ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed text-center">
                {description}
              </p>

              {/* Viewport Frame */}
              <div className="relative mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-2xl border-2 border-cyan-500/40 bg-black shadow-inner flex items-center justify-center">
                {permissionStatus === "granted" && (
                  <>
                    <video
                      ref={videoRef}
                      className="h-full w-full object-cover"
                      muted
                      autoPlay
                      playsInline
                    />

                    {/* Reticle / Scanner Overlay Alignment Box */}
                    <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-dashed border-cyan-400/80 animate-pulse flex items-center justify-center">
                      <div className="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-cyan-400" />
                      <div className="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-cyan-400" />
                      <div className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-cyan-400" />
                      <div className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-cyan-400" />
                      {/* Laser scanning bar effect */}
                      <div className="h-0.5 w-full bg-cyan-400/90 shadow-[0_0_8px_#22d3ee] animate-bounce" />
                    </div>
                  </>
                )}

                {permissionStatus === "requesting" && (
                  <div className="flex flex-col items-center gap-2 p-6 text-center text-xs text-slate-300">
                    <RefreshCw size={24} className="animate-spin text-cyan-400" />
                    <span>Requesting camera access...</span>
                  </div>
                )}

                {permissionStatus === "denied" && (
                  <div className="flex flex-col items-center gap-3 p-6 text-center text-xs text-amber-200">
                    <AlertTriangle size={28} className="text-amber-400" />
                    <span className="font-semibold">Camera Permission Blocked</span>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Please allow camera access in your browser settings (Lock icon in URL bar)
                      or use the Paste Key tab.
                    </p>
                    <button
                      type="button"
                      onClick={() => void startCamera()}
                      className="rounded-lg bg-amber-400/20 px-3 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-400/30"
                    >
                      Retry Permission
                    </button>
                  </div>
                )}

                {permissionStatus === "unsupported" && (
                  <div className="flex flex-col items-center gap-3 p-6 text-center text-xs text-slate-300">
                    <Info size={28} className="text-slate-400" />
                    <span className="font-semibold">No Camera Detected</span>
                    <p className="text-[11px] text-slate-400">
                      Camera stream is not supported on this device. Please paste the Stellar key manually.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab("manual")}
                      className="rounded-lg bg-cyan-500/20 px-3 py-1.5 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/30"
                    >
                      Switch to Paste
                    </button>
                  </div>
                )}
              </div>

              {/* Warning alert on invalid scan without closing modal */}
              {scanWarning && (
                <div
                  role="alert"
                  className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 flex items-start gap-2.5 animate-in fade-in duration-150"
                >
                  <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-400" />
                  <div className="flex-1">
                    <p className="font-semibold">Invalid QR Code</p>
                    <p className="text-[11px] text-amber-300/90 mt-0.5">{scanWarning}</p>
                  </div>
                </div>
              )}

              {/* Success indicator */}
              {lastScannedResult && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span className="truncate font-mono">
                    Scanned: {lastScannedResult.destination}
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* Manual Paste Drawer / Form */
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Paste a recipient Stellar public address (G...), Muxed account (M...), or SEP-07 pay URI directly.
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Stellar Public Key or URI
                  </label>
                  <button
                    type="button"
                    onClick={() => void handlePasteClipboard()}
                    className="flex items-center gap-1 text-[11px] text-cyan-400 hover:underline"
                  >
                    <ClipboardPaste size={12} /> Paste from Clipboard
                  </button>
                </div>

                <textarea
                  required
                  rows={4}
                  value={manualInput}
                  onChange={(e) => {
                    setManualInput(e.target.value);
                    setManualError(null);
                  }}
                  placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX or web+stellar:pay?destination=..."
                  className="w-full rounded-xl border border-white/10 bg-[#071016] p-3 font-mono text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-400 transition"
                />
              </div>

              {manualError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200 flex items-start gap-2"
                >
                  <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-400" />
                  <span>{manualError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-cyan-500 py-2.5 text-xs font-bold text-[#071016] hover:bg-cyan-400 transition flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={14} /> Validate & Apply Address
              </button>
            </form>
          )}
        </div>

        {/* Footer info banner */}
        <div className="border-t border-white/10 bg-[#071016]/80 px-5 py-3 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Supported: SEP-07, G..., M...</span>
          <span className="text-cyan-400/80 font-medium">Haptic & Audio Verified</span>
        </div>
      </div>
    </div>
  );
}

export default QRScannerModal;
