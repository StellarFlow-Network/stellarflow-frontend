"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clipboard, Download, X } from "lucide-react";
import QRCode from "qrcode";

export interface ZKNoteQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: string;
}

export function ZKNoteQRCodeModal({ isOpen, onClose, note }: ZKNoteQRCodeModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    let isCurrent = true;
    setError("");
    setCopied(false);
    setIsGenerating(true);
    QRCode.toCanvas(canvasRef.current, note, {
      width: 320,
      margin: 4,
      errorCorrectionLevel: "H",
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then(() => {
        if (isCurrent) setIsGenerating(false);
      })
      .catch((cause: unknown) => {
        if (isCurrent) {
          setError(cause instanceof Error ? cause.message : "Could not generate the QR code.");
          setIsGenerating(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [isOpen, note]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(note);
      setCopied(true);
      setError("");
    } catch {
      setError("Clipboard access was denied. Copy the note from the original screen instead.");
    }
  };

  const handleSaveImage = () => {
    const canvas = canvasRef.current;
    if (!canvas || isGenerating) {
      setError("The QR code is not ready to download.");
      return;
    }

    try {
      const anchor = document.createElement("a");
      anchor.href = canvas.toDataURL("image/png");
      anchor.download = "stellarflow-remittance-note.png";
      anchor.click();
    } catch {
      setError("Could not save the QR code image.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close QR code dialog"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="zk-note-qr-title"
        className="relative z-[1] w-full max-w-md rounded-t-2xl border border-white/10 bg-[#101713] p-5 text-white shadow-2xl sm:rounded-2xl sm:p-7"
      >
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lime-300">Private note</p>
            <h2 id="zk-note-qr-title" className="mt-1 text-xl font-semibold">Remittance note QR code</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close QR code dialog"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white/65 hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </header>

        <div className="mb-4 flex justify-center rounded-xl bg-white p-3">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="QR code containing the secret remittance note"
            className="h-auto max-w-full"
          />
        </div>

        <p className="mb-4 text-sm leading-relaxed text-amber-100/80">
          Anyone who scans this QR code can access the secret needed to redeem the funds. Share it only
          with the intended recipient.
        </p>
        {error && <p className="mb-4 text-sm text-rose-300" role="alert">{error}</p>}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleSaveImage}
            disabled={isGenerating || Boolean(error)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-lime-300 px-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={16} />
            {isGenerating ? "Generating..." : "Save Image"}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/15 px-3 text-sm font-medium text-white/85 transition-colors hover:bg-white/5"
          >
            {copied ? <Check size={16} /> : <Clipboard size={16} />}
            {copied ? "Copied" : "Copy Secret"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default ZKNoteQRCodeModal;
