"use client";

/**
 * WalletConnectButton.tsx
 *
 * Isolated component that bundles WalletProvider + the connect button UI.
 * Exported as a default so it can be dynamically imported via next/dynamic
 * in nav.jsx, keeping WalletProvider out of the initial nav chunk.
 */

import React, { memo, useCallback, useState } from "react";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import { useProgressBar } from "./TopLoadingBar";
import { WalletQRCode } from "@/components/ui/WalletQRCode";
import {
  WalletProvider,
  useWallet,
  useWalletStatus,
  useWalletActions,
} from "@/app/hooks/useWalletState";

const WalletConnectButtonContent = memo(() => {
  const { wallet } = useWallet();
  const { isChecking } = useWalletStatus();
  const { refreshWalletState } = useWalletActions();
  const { start, done } = useProgressBar();
  const [showQRCode, setShowQRCode] = useState(false);

  const walletLabel = wallet?.connected
    ? wallet.publicKey
      ? `${wallet.publicKey.slice(0, 4)}...${wallet.publicKey.slice(-4)}`
      : "Wallet connected"
    : "Connect Wallet";

  const handleConnectWallet = useCallback(async () => {
    if (wallet?.connected && wallet.publicKey) {
      // If already connected, toggle QR code display
      setShowQRCode(!showQRCode);
      return;
    }
    
    start();
    const state = await refreshWalletState();
    done();

    if (state?.connected) {
      setShowQRCode(true);
    } else {
      alert("No active Stellar wallet detected. Please connect your extension.");
    }
  }, [refreshWalletState, start, done, wallet?.connected, wallet?.publicKey, showQRCode]);

  return (
    <div className="relative">
      <button
        data-tour="wallet-connect"
        onClick={handleConnectWallet}
        disabled={isChecking}
        className="wallet-btn group flex min-w-0 items-center gap-2 px-3 sm:gap-2.5 sm:px-4 py-2 rounded-2xl font-semibold text-sm sm:text-base transition-all duration-300 hover:shadow-xl active:scale-95 whitespace-nowrap"
      >
        <Icon
          id={ICON_IDS.wallet}
          size={18}
          className="transition-transform group-hover:rotate-12"
        />
        <span className="truncate">{walletLabel}</span>
        {wallet?.connected && (
           <Icon
             id={ICON_IDS.chevronRight}
             size={14}
             className={`transition-transform ${showQRCode ? "rotate-90" : "-rotate-90"}`}
           />
         )}
      </button>
      
      {/* QR Code dropdown */}
      {showQRCode && wallet?.publicKey && (
        <div className="absolute right-0 mt-2 z-50">
          <WalletQRCode publicKey={wallet.publicKey} />
        </div>
      )}
    </div>
  );
});
WalletConnectButtonContent.displayName = "WalletConnectButtonContent";

/**
 * Self-contained wallet button that owns its provider boundary.
 * Dynamically imported so WalletProvider is excluded from the initial JS bundle.
 */
const WalletConnectButton = memo(() => (
  <WalletProvider>
    <WalletConnectButtonContent />
  </WalletProvider>
));
WalletConnectButton.displayName = "WalletConnectButton";

export default WalletConnectButton;