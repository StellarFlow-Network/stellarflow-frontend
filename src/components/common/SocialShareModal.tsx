"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  Share2,
  Copy,
  Check,
  Download,
  X,
  Sparkles,
  ShieldCheck,
  Send,
} from "lucide-react";

export type ShareCategory = "trade" | "yield" | "governance";

export interface SocialShareData {
  type: ShareCategory;
  title: string;
  fromSymbol: string;
  fromAmount: string;
  toSymbol: string;
  toAmount: string;
  roiPercentage?: number;
  timestamp: string;
  txHash?: string;
  badgeLabel?: string;
}

export interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareData: SocialShareData;
}

/**
 * Community Social Sharing Modal Component (#958)
 *
 * Generates dynamic, high-resolution visual cards celebrating completed trades,
 * yield milestones, or governance votes on StellarFlow using zero-dependency HTML5 2D Canvas.
 */
export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  isOpen,
  onClose,
  shareData,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [generationTimeMs, setGenerationTimeMs] = useState<number | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  // Generate high-resolution 1200x630 social share preview card on canvas
  const generateSocialCard = useCallback(() => {
    const startTime = performance.now();
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    // 1. Background Gradient (Dark Slate & Deep Navy)
    const bgGradient = ctx.createLinearGradient(0, 0, 1200, 630);
    bgGradient.addColorStop(0, "#090D16");
    bgGradient.addColorStop(0.5, "#0F172A");
    bgGradient.addColorStop(1, "#030712");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 1200, 630);

    // 2. Ambient Glowing Accents (Cyan & Emerald Radial Glows)
    const cyanGlow = ctx.createRadialGradient(200, 150, 10, 200, 150, 450);
    cyanGlow.addColorStop(0, "rgba(6, 182, 212, 0.25)");
    cyanGlow.addColorStop(1, "rgba(6, 182, 212, 0)");
    ctx.fillStyle = cyanGlow;
    ctx.fillRect(0, 0, 1200, 630);

    const emeraldGlow = ctx.createRadialGradient(1000, 480, 10, 1000, 480, 500);
    emeraldGlow.addColorStop(0, "rgba(16, 185, 129, 0.2)");
    emeraldGlow.addColorStop(1, "rgba(16, 185, 129, 0)");
    ctx.fillStyle = emeraldGlow;
    ctx.fillRect(0, 0, 1200, 630);

    // 3. Card Outer Border Frame with Gradient
    ctx.lineWidth = 4;
    const strokeGrad = ctx.createLinearGradient(0, 0, 1200, 630);
    strokeGrad.addColorStop(0, "rgba(6, 182, 212, 0.6)");
    strokeGrad.addColorStop(0.5, "rgba(59, 130, 246, 0.3)");
    strokeGrad.addColorStop(1, "rgba(16, 185, 129, 0.6)");
    ctx.strokeStyle = strokeGrad;
    ctx.strokeRect(20, 20, 1160, 590);

    // 4. Header: StellarFlow Brand Mark & Logo
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 42px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("STELLARFLOW", 70, 95);

    ctx.fillStyle = "#06B6D4";
    ctx.font = "700 22px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("DEX & ORACLE PROTOCOL", 375, 95);

    // Category Badge
    const categoryBadgeText = (
      shareData.badgeLabel ||
      (shareData.type === "yield"
        ? "YIELD MILESTONE"
        : shareData.type === "governance"
        ? "GOVERNANCE VOTE"
        : "TRADE EXECUTED")
    ).toUpperCase();

    ctx.fillStyle = "rgba(6, 182, 212, 0.15)";
    ctx.strokeStyle = "rgba(6, 182, 212, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(850, 60, 280, 48, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#38BDF8";
    ctx.font = "800 18px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(categoryBadgeText, 990, 91);
    ctx.textAlign = "left";

    // Header Divider Line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(70, 130);
    ctx.lineTo(1130, 130);
    ctx.stroke();

    // 5. Main Card Body: Container Box
    ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(70, 160, 1060, 340, 24);
    ctx.fill();
    ctx.stroke();

    // Event Title
    ctx.fillStyle = "#94A3B8";
    ctx.font = "600 22px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(shareData.title.toUpperCase(), 110, 215, 980);

    // Swap / Transaction Execution Metrics
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 54px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const metricLabel = shareData.type === "yield"
      ? "DEPOSIT  ➔  REWARDS EARNED"
      : shareData.type === "governance"
        ? "VOTE  ➔  VOTING POWER"
        : "SENT  ➔  RECEIVED";
    ctx.fillStyle = "#94A3B8";
    ctx.font = "700 16px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(metricLabel, 110, 258);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 54px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const metrics = `${shareData.fromAmount} ${shareData.fromSymbol}  ➔  ${shareData.toAmount} ${shareData.toSymbol}`;
    ctx.fillText(metrics, 110, 290, 980);

    // ROI Pill Badge (if available)
    if (shareData.roiPercentage !== undefined && shareData.roiPercentage !== null) {
      const isPositive = shareData.roiPercentage >= 0;
      const roiText = `${isPositive ? "+" : ""}${shareData.roiPercentage.toFixed(2)}% ROI`;

      const badgeBg = isPositive ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)";
      const badgeBorder = isPositive ? "rgba(16, 185, 129, 0.6)" : "rgba(239, 68, 68, 0.6)";
      const badgeTextCol = isPositive ? "#34D399" : "#F87171";

      ctx.fillStyle = badgeBg;
      ctx.strokeStyle = badgeBorder;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(110, 335, 240, 56, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = badgeTextCol;
      ctx.font = "900 28px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(roiText, 140, 373);
    }

    // Secondary Metric Tag
    ctx.fillStyle = "#64748B";
    ctx.font = "500 20px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Verified On-Chain via Soroban Smart Contract", 110, 445);

    // Truncated Transaction Hash (Public proof, excluding private keys)
    if (shareData.txHash) {
      const truncatedHash = `Tx: ${shareData.txHash.slice(0, 8)}...${shareData.txHash.slice(-8)}`;
      ctx.fillStyle = "#38BDF8";
      ctx.font = "600 20px monospace";
      ctx.fillText(truncatedHash, 780, 445);
    }

    // 6. Footer Signature & Date Stamp
    ctx.fillStyle = "#475569";
    ctx.font = "500 18px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const dateLabel = shareData.type === "governance" ? "Voted" : shareData.type === "yield" ? "Recorded" : "Executed";
    ctx.fillText(`${dateLabel}: ${shareData.timestamp}`, 70, 560);

    ctx.fillStyle = "#06B6D4";
    ctx.font = "700 20px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("https://stellarflow.app", 1130, 560);
    ctx.textAlign = "left";

    // Export Canvas to Data URL & Update State
    const dataUrl = canvas.toDataURL("image/png");
    setImagePreviewUrl(dataUrl);

    const duration = Math.round(performance.now() - startTime);
    setGenerationTimeMs(duration);
  }, [shareData]);

  // Generate preview card when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsCopied(false);
      setCopyError(null);
      setImagePreviewUrl(null);
      setGenerationTimeMs(null);
      const timer = setTimeout(() => {
        generateSocialCard();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [isOpen, generateSocialCard]);

  // Handle ESC key dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !portalReady) return null;

  // Social Share Constructs
  const shareText = (() => {
    const roi = shareData.roiPercentage === undefined
      ? ""
      : ` (${shareData.roiPercentage >= 0 ? "+" : ""}${shareData.roiPercentage.toFixed(2)}% ROI)`;
    if (shareData.type === "yield") {
      return `${shareData.title}: ${shareData.toAmount} ${shareData.toSymbol} earned${roi}. #Stellar #Soroban #DeFi`;
    }
    if (shareData.type === "governance") {
      return `${shareData.title}: ${shareData.toAmount} ${shareData.toSymbol} voting power${roi}. #Stellar #Soroban #DeFi`;
    }
    return `Just swapped ${shareData.fromAmount} ${shareData.fromSymbol} ➔ ${shareData.toAmount} ${shareData.toSymbol} on @StellarFlow${roi}. #Stellar #Soroban #DeFi`;
  })();

  const shareUrl = "https://stellarflow.app";

  const handleShareX = () => {
    const twitterUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
  };

  const handleShareTelegram = () => {
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(telegramUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyImage = async () => {
    if (!imagePreviewUrl) return;

    const copyShareText = async () => {
      const text = `${shareText} ${shareUrl}`;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }

      const input = document.createElement("textarea");
      input.value = text;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand("copy");
      input.remove();
      if (!copied) throw new Error("Clipboard access is unavailable in this browser.");
    };

    setCopyError(null);
    try {
      const response = await fetch(imagePreviewUrl);
      const blob = await response.blob();

      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob,
          }),
        ]);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
      } else {
        // Fallback: Copy share text
        await copyShareText();
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
      }
    } catch (err) {
      console.error("Failed to copy image to clipboard:", err);
      // Text fallback
      try {
        await copyShareText();
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
      } catch (fallbackErr) {
        console.error("Clipboard text fallback failed:", fallbackErr);
        setCopyError("Could not access the clipboard. Please use Download Image instead.");
      }
    }
  };

  const handleDownloadImage = () => {
    if (!imagePreviewUrl) return;
    const link = document.createElement("a");
    link.download = `stellarflow-share-${shareData.fromSymbol}-${shareData.toSymbol}.png`;
    link.href = imagePreviewUrl;
    link.click();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="social-share-modal-title"
    >
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-cyan-500/30 bg-gray-950 p-6 shadow-2xl shadow-cyan-950/40">
        {/* Decorative Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 via-emerald-400 to-blue-600" />

        {/* Close Modal Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-xl p-2 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Share2 className="h-6 w-6" />
          </div>
          <div>
            <h3
              id="social-share-modal-title"
              className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2"
            >
              {shareData.type === "yield" ? "Share Yield Milestone" : shareData.type === "governance" ? "Share Governance Vote" : "Share Completed Swap"}
              <Sparkles className="h-4 w-4 text-amber-400 inline" />
            </h3>
            <p className="text-xs text-gray-400 font-medium flex items-center gap-2">
              Generate stylized, high-res social card preview
              {generationTimeMs !== null && (
                <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800/50 px-2 py-0.5 rounded-full">
                  {generationTimeMs}ms
                </span>
              )}
            </p>
          </div>
        </div>
        {copyError && <p role="status" className="mb-3 text-center text-xs text-red-300">{copyError}</p>}

        {/* Hidden Render Canvas */}
        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

        {/* Image Preview Container */}
        <div className="relative mb-5 overflow-hidden rounded-xl border border-gray-800 bg-gray-900/90 p-2 shadow-inner">
          {imagePreviewUrl ? (
            <Image
              src={imagePreviewUrl}
              alt="StellarFlow Social Trade Milestone Preview"
              width={1200}
              height={630}
              unoptimized
              className="w-full h-auto rounded-lg shadow-md object-contain max-h-[320px]"
            />
          ) : (
            <div className="flex h-56 w-full items-center justify-center text-sm text-gray-500">
              Generating High-Res Social Card...
            </div>
          )}

          {/* Privacy Notice Badge */}
          <div className="mt-2 flex items-center justify-between px-2 text-[11px] text-gray-400">
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Private balances & keys strictly excluded
            </span>
            <span className="font-mono text-gray-500">1200x630 PNG @ 2x DPI</span>
          </div>
        </div>

        {/* Action Sharing Buttons */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Share to X / Twitter */}
            <button
              type="button"
              onClick={handleShareX}
              className="flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold py-3 px-4 text-xs transition-all shadow-lg shadow-sky-500/20 active:scale-[0.98]"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Share to X / Twitter
            </button>

            {/* Share to Telegram */}
            <button
              type="button"
              onClick={handleShareTelegram}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 text-xs transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
            >
              <Send className="h-4 w-4" />
              Share to Telegram
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Copy Image to Clipboard */}
            <button
              type="button"
              onClick={handleCopyImage}
              disabled={!imagePreviewUrl}
              className={`flex items-center justify-center gap-2 rounded-xl font-bold py-3 px-4 text-xs border transition-all ${
                isCopied
                  ? "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                  : "bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-200"
              } ${!imagePreviewUrl ? "cursor-not-allowed opacity-50" : ""}`}
            >
              {isCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-gray-400" />}
              {isCopied ? "Copied to Clipboard!" : "Copy Image to Clipboard"}
            </button>

            {/* Download Image */}
            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={!imagePreviewUrl}
              className="flex items-center justify-center gap-2 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 font-bold py-3 px-4 text-xs transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4 text-gray-400" />
              Download Image (PNG)
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
