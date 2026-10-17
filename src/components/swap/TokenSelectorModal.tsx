"use client";

import OptimizedDialog from "@/app/components/OptimizedDialog";
import { SmartAssetResolverInput } from "@/components/tokens/SmartAssetResolverInput";
import type { TokenOption } from "./SwapForm";

export interface TokenSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokens: TokenOption[];
  onSelect: (token: TokenOption) => void;
  /** Address of the token currently selected in this field, highlighted in the list. */
  selectedAddress?: string;
  /** Address already chosen on the opposite side of the swap; shown disabled so it can't be picked twice. */
  disabledAddress?: string;
  /** Balances keyed by token address, rendered next to each row when available. */
  balances?: Record<string, string>;
}

export function TokenSelectorModal({
  isOpen,
  onClose,
  tokens,
  onSelect,
  selectedAddress,
  disabledAddress,
  balances,
}: TokenSelectorModalProps) {
  const handleSelect = (token: TokenOption) => {
    if (token.address === disabledAddress) return;
    onSelect(token);
    onClose();
  };

  return (
    <OptimizedDialog isOpen={isOpen} onClose={onClose} title="Select a token" size="sm">
      <SmartAssetResolverInput
        tokens={tokens}
        onSelect={handleSelect}
        selectedAddress={selectedAddress}
        disabledAddress={disabledAddress}
        balances={balances}
      />
    </OptimizedDialog>
  );
}

export default TokenSelectorModal;
