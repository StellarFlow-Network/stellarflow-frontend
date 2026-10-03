'use client';

/**
 * TokenBadge.tsx
 *
 * Renders a composite badge displaying token/asset identity:
 *   • Token logo image with graceful fallback to initials-based gradient icon
 *   • Verification checkmark for protocol-verified Stellar assets
 *   • Cross-chain network mini-badges (e.g. Ethereum, Polygon, Solana)
 *   • Hover tooltip showing full contract address and issuer public key
 *   • Click-to-copy functionality for both address and issuer
 *
 * Design principles:
 *   • No layout shift on image load/fail — fixed-size container reserves space
 *   • Image onError handler triggers fallback; no broken-image flashing
 *   • Initials-based gradient icon uses deterministic FNV-1a hash (matches AddressBadge)
 *   • Verification icon only renders when asset.verified === true
 *   • Cross-chain badges only render when chain data is present
 *   • Copy-to-clipboard uses native Clipboard API with navigator guard (SSR-safe)
 *   • Tooltip is keyboard-accessible (focusable, not hover-only)
 *   • All text & ARIA labels for accessibility
 */

import React, { useCallback, useId, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Icon from '@/components/icons/Icon';
import { ICON_IDS } from '@/components/icons/iconIds';
import { truncateAddress } from '@/components/ui/AddressBadge';
import type { CustomToken } from '@/lib/customTokens';
import type { BridgeChain } from '@/types/bridge';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TokenBadgeProps {
  /** Token/asset data (reuses CustomToken for logo, symbol, name, verified status) */
  asset: Partial<CustomToken> & {
    symbol: string;
    name: string;
    verified?: boolean;
  };
  /** Token logo URL (optional; fallback renders initials gradient icon) */
  logoUrl?: string;
  /** Cross-chain origin networks (e.g. ['ethereum', 'polygon']) */
  chainOrigins?: BridgeChain[];
  /** Contract address to display in tooltip (typically asset.contractId) */
  contractAddress?: string;
  /** Issuer public key to display in tooltip (typically asset.issuer) */
  issuerPublicKey?: string;
  /** Visual size preset. Default: 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS class names applied to the outer wrapper */
  className?: string;
  /** Callback fired after successful copy */
  onCopy?: (text: string, type: 'address' | 'issuer') => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Size configuration
// ─────────────────────────────────────────────────────────────────────────────

interface SizeConfig {
  iconSize: number;
  textClass: string;
  iconClass: string;
  checkmarkSize: number;
  badgeSize: number;
  gapClass: string;
}

const SIZE_CONFIG: Record<'sm' | 'md' | 'lg', SizeConfig> = {
  sm: {
    iconSize: 24,
    textClass: 'text-xs',
    iconClass: 'h-6 w-6',
    checkmarkSize: 12,
    badgeSize: 16,
    gapClass: 'gap-1.5',
  },
  md: {
    iconSize: 32,
    textClass: 'text-sm',
    iconClass: 'h-8 w-8',
    checkmarkSize: 14,
    badgeSize: 20,
    gapClass: 'gap-2',
  },
  lg: {
    iconSize: 40,
    textClass: 'text-base',
    iconClass: 'h-10 w-10',
    checkmarkSize: 16,
    badgeSize: 24,
    gapClass: 'gap-3',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// FNV-1a hash for deterministic gradient colors (shared with AddressBadge)
// ─────────────────────────────────────────────────────────────────────────────

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return hash >>> 0;
}

/**
 * Derive background and text colors for the initials fallback icon
 * using a deterministic hash. Returns HSL color strings.
 */
function generateInitialsColors(
  seed: string,
): { background: string; text: string } {
  const hash = fnv1a32(seed || 'token');
  const bgHue = hash % 360;
  const textHue = (bgHue + 180) % 360; // Complementary hue

  // Dark, saturated background; light text for contrast
  const background = `hsl(${bgHue}, 70%, 22%)`;
  const text = `hsl(${textHue}, 80%, 85%)`;

  return { background, text };
}

// ─────────────────────────────────────────────────────────────────────────────
// InitialsIcon: Fallback gradient icon with initials
// ─────────────────────────────────────────────────────────────────────────────

interface InitialsIconProps {
  symbol: string;
  size: number;
}

const InitialsIcon = React.memo(function InitialsIcon({
  symbol,
  size,
}: InitialsIconProps) {
  const colors = useMemo(() => generateInitialsColors(symbol), [symbol]);
  const initials = symbol.slice(0, 2).toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: colors.background,
        color: colors.text,
      }}
      className="inline-flex items-center justify-center rounded-full font-semibold"
      aria-label={`${symbol} fallback icon`}
    >
      <span
        style={{
          fontSize: Math.max(8, Math.min(14, Math.floor(size / 2.5))),
        }}
        className="font-mono font-bold"
      >
        {initials}
      </span>
    </div>
  );
});

InitialsIcon.displayName = 'InitialsIcon';

// ─────────────────────────────────────────────────────────────────────────────
// NetworkChainIcon: Small badge for cross-chain networks
// ─────────────────────────────────────────────────────────────────────────────

interface NetworkChainIconProps {
  chain: BridgeChain;
  size: number;
}

const NetworkChainIcon = React.memo(function NetworkChainIcon({
  chain,
  size,
}: NetworkChainIconProps) {
  // Map BridgeChain to display label and color
  const chainConfig: Record<BridgeChain, { label: string; bgClass: string }> = {
    stellar: { label: 'XLM', bgClass: 'bg-blue-600' },
    ethereum: { label: 'ETH', bgClass: 'bg-blue-500' },
    polygon: { label: 'POL', bgClass: 'bg-purple-600' },
    bsc: { label: 'BSC', bgClass: 'bg-yellow-600' },
  };

  const config = chainConfig[chain];

  return (
    <div
      style={{ width: size, height: size }}
      className={`inline-flex items-center justify-center rounded-full font-mono text-[8px] font-bold text-white ${config.bgClass}`}
      title={`Cross-chain: ${config.label}`}
      aria-label={`${config.label} network badge`}
    >
      {config.label.slice(0, 1)}
    </div>
  );
});

NetworkChainIcon.displayName = 'NetworkChainIcon';

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip content: copyable address and issuer
// ─────────────────────────────────────────────────────────────────────────────

interface TooltipContentProps {
  contractAddress?: string;
  issuerPublicKey?: string;
  symbol: string;
  onCopy: (text: string, type: 'address' | 'issuer') => void;
}

const TooltipContent = React.memo(function TooltipContent({
  contractAddress,
  issuerPublicKey,
  symbol,
  onCopy,
}: TooltipContentProps) {
  const [copiedField, setCopiedField] = useState<'address' | 'issuer' | null>(
    null,
  );
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(
    async (text: string, type: 'address' | 'issuer') => {
      if (typeof navigator === 'undefined' || !navigator.clipboard) return;

      try {
        await navigator.clipboard.writeText(text);
        setCopiedField(type);
        onCopy(text, type);

        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(() => {
          setCopiedField(null);
          resetTimerRef.current = null;
        }, 2000);
      } catch {
        // Silently fail if clipboard not available
      }
    },
    [onCopy],
  );

  React.useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  return (
    <div className="space-y-2">
      {contractAddress && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-200">
            Contract Address
          </label>
          <div className="flex items-center gap-1.5">
            <code className="flex-1 break-all rounded bg-slate-950 px-2 py-1 font-mono text-[11px] text-slate-300 select-all">
              {contractAddress}
            </code>
            <button
              type="button"
              onClick={() => handleCopy(contractAddress, 'address')}
              className="inline-flex shrink-0 items-center justify-center rounded bg-slate-700 p-1 transition-colors hover:bg-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Copy contract address"
              title="Copy contract address"
            >
              <Icon
                id={copiedField === 'address' ? ICON_IDS.check : ICON_IDS.copy}
                size={12}
                aria-hidden
              />
            </button>
          </div>
        </div>
      )}

      {issuerPublicKey && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-200">
            Issuer Public Key
          </label>
          <div className="flex items-center gap-1.5">
            <code className="flex-1 break-all rounded bg-slate-950 px-2 py-1 font-mono text-[11px] text-slate-300 select-all">
              {issuerPublicKey}
            </code>
            <button
              type="button"
              onClick={() => handleCopy(issuerPublicKey, 'issuer')}
              className="inline-flex shrink-0 items-center justify-center rounded bg-slate-700 p-1 transition-colors hover:bg-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Copy issuer public key"
              title="Copy issuer public key"
            >
              <Icon
                id={copiedField === 'issuer' ? ICON_IDS.check : ICON_IDS.copy}
                size={12}
                aria-hidden
              />
            </button>
          </div>
        </div>
      )}

      {!contractAddress && !issuerPublicKey && (
        <p className="text-xs text-slate-400">
          No contract address or issuer data available
        </p>
      )}
    </div>
  );
});

TooltipContent.displayName = 'TooltipContent';

// ─────────────────────────────────────────────────────────────────────────────
// Main TokenBadge component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TokenBadge
 *
 * Displays a badge for a token/asset with:
 *   • Logo image (or initials gradient fallback)
 *   • Verification checkmark (if verified === true)
 *   • Cross-chain network mini-badges (if chains provided)
 *   • Hover tooltip with copyable contract address and issuer key
 *
 * @example
 * <TokenBadge
 *   asset={{ symbol: 'USDC', name: 'USD Coin', verified: true }}
 *   logoUrl="https://..."
 *   contractAddress="CAB3..."
 *   issuerPublicKey="GXXXXX..."
 *   chainOrigins={['ethereum', 'polygon']}
 *   size="md"
 * />
 */
export const TokenBadge = React.memo(function TokenBadge({
  asset,
  logoUrl,
  chainOrigins,
  contractAddress,
  issuerPublicKey,
  size = 'md',
  className = '',
  onCopy,
}: TokenBadgeProps) {
  const cfg = SIZE_CONFIG[size];
  const [imageError, setImageError] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  const handleOpen = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setIsTooltipOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setIsTooltipOpen(false);
    }, 200);
  }, []);

  // Keyboard support: Escape key dismissal
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isTooltipOpen) {
        setIsTooltipOpen(false);
        triggerRef.current?.focus();
      }
    };
    if (isTooltipOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTooltipOpen]);

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const handleCopy = useCallback(
    (text: string, type: 'address' | 'issuer') => {
      onCopy?.(text, type);
    },
    [onCopy],
  );

  // Truncate address for display in badge
  const displayAddress = contractAddress
    ? truncateAddress(contractAddress, { head: 4, tail: 4 })
    : undefined;

  return (
    <div className={`inline-flex items-center ${cfg.gapClass} ${className}`}>
      {/* Main icon container with verification badge and chain badges */}
      <div className="relative inline-flex">
        {/* Logo or fallback initials icon */}
        {!logoUrl || imageError ? (
          <InitialsIcon symbol={asset.symbol} size={cfg.iconSize} />
        ) : (
          <div
            style={{ width: cfg.iconSize, height: cfg.iconSize }}
            className="relative inline-block shrink-0 overflow-hidden rounded-full bg-slate-100"
          >
            <Image
              src={logoUrl}
              alt={`${asset.symbol} logo`}
              width={cfg.iconSize}
              height={cfg.iconSize}
              quality={90}
              loading="lazy"
              onError={() => setImageError(true)}
              className="h-full w-full object-cover transition-opacity duration-200"
            />
          </div>
        )}

        {/* Verification checkmark badge (top-right) */}
        {asset.verified && (
          <div
            className="absolute -right-1 -top-1 rounded-full bg-blue-500 p-0.5 shadow-md"
            title="Protocol-verified asset"
            aria-label="Protocol-verified asset"
          >
            <Icon id={ICON_IDS.check} size={cfg.checkmarkSize} aria-hidden />
          </div>
        )}

        {/* Cross-chain network badges (bottom-right corner, stacked) */}
        {chainOrigins && chainOrigins.length > 0 && (
          <div className="absolute -bottom-1 -right-1 flex flex-col items-end gap-0.5">
            {chainOrigins.slice(0, 2).map((chain) => (
              <NetworkChainIcon key={chain} chain={chain} size={cfg.badgeSize} />
            ))}
            {chainOrigins.length > 2 && (
              <div
                className="text-[8px] font-semibold text-slate-400"
                title={`+${chainOrigins.length - 2} more chains`}
              >
                +{chainOrigins.length - 2}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Token info and tooltip */}
      <div className="flex flex-col">
        {/* Token symbol and name */}
        <div
          ref={triggerRef}
          role="button"
          tabIndex={0}
          onMouseEnter={handleOpen}
          onMouseLeave={handleClose}
          onFocus={handleOpen}
          onBlur={handleClose}
          onClick={() => setIsTooltipOpen(!isTooltipOpen)}
          className={`cursor-help rounded px-2 py-1 transition-colors hover:bg-slate-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent ${cfg.textClass}`}
          aria-expanded={isTooltipOpen}
          aria-haspopup="dialog"
          aria-describedby={isTooltipOpen ? tooltipId : undefined}
        >
          <span className="font-semibold text-gray-100">{asset.symbol}</span>
          <span className="text-gray-400"> • {asset.name}</span>
        </div>

        {/* Contract address truncated display */}
        {displayAddress && (
          <span className="text-[10px] font-mono text-gray-500 px-2">
            {displayAddress}
          </span>
        )}
      </div>

      {/* Tooltip */}
      {isTooltipOpen && (
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="dialog"
          aria-label={`${asset.symbol} token details`}
          className="absolute bottom-full right-0 mb-2 z-50 w-96 rounded-lg shadow-2xl bg-slate-900 border border-slate-700/80 p-4 text-slate-100 text-xs animate-in fade-in zoom-in-95 duration-150"
          onMouseEnter={handleOpen}
          onMouseLeave={handleClose}
        >
          <TooltipContent
            contractAddress={contractAddress}
            issuerPublicKey={issuerPublicKey}
            symbol={asset.symbol}
            onCopy={handleCopy}
          />
        </div>
      )}
    </div>
  );
});

TokenBadge.displayName = 'TokenBadge';
