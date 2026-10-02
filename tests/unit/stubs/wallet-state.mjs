/**
 * Deterministic double for the wallet session module
 * (`@/app/components/providers/WalletProvider` and its `@/app/hooks/useWalletState`
 * re-export). Specs configure the session with `__setWalletState` so the
 * components under test can be rendered in connected and disconnected states
 * without a browser extension or network access.
 */
let walletState = {
  wallet: null,
  isConnected: false,
  isChecking: false,
  error: null,
};

export function __setWalletState(next) {
  walletState = { ...walletState, ...next };
}

export function __resetWalletState() {
  walletState = { wallet: null, isConnected: false, isChecking: false, error: null };
}

export function useWallet() {
  return { wallet: walletState.wallet, isConnected: Boolean(walletState.wallet?.connected) };
}

export function useWalletStatus() {
  return { isChecking: walletState.isChecking, error: walletState.error };
}

export function useWalletActions() {
  return { refreshWalletState: async () => walletState.wallet };
}

export function useWalletState() {
  return {
    wallet: walletState.wallet,
    isChecking: walletState.isChecking,
    error: walletState.error,
    refreshWalletState: async () => walletState.wallet,
  };
}

export function WalletProvider({ children }) {
  return children;
}

export default WalletProvider;
