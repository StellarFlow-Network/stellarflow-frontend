/**
 * Stand-ins for `WalletConnectButton`'s peripheral children: the top loading
 * bar context and the QR code dropdown. Neither is needed to assert the button
 * label, disabled state or wallet icon behaviour.
 */
export function useProgressBar() {
  return { start: () => {}, done: () => {} };
}

export const WalletQRCode = () => null;

export default WalletQRCode;
