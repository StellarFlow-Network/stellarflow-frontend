import test from 'node:test';
import assert from 'node:assert/strict';

import WalletConnectButton from '@/app/components/WalletConnectButton';
import { renderToHtml } from './helpers/render';
import { __resetWalletState, __setWalletState } from './stubs/wallet-state.mjs';

const PUBLIC_KEY = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ';

test.beforeEach(() => {
  __resetWalletState();
});

test('renders the connect prompt and wallet icon when no session is active', () => {
  const html = renderToHtml(<WalletConnectButton />);

  assert.match(html, /data-tour="wallet-connect"/);
  assert.match(html, />Connect Wallet</);
  assert.match(html, /sprite\.svg#icon-wallet/);
  assert.doesNotMatch(html, /icon-chevron-right/);
  assert.doesNotMatch(html, /disabled=""/);
});

test('renders the truncated public key once a wallet is connected', () => {
  __setWalletState({
    wallet: { publicKey: PUBLIC_KEY, connected: true, source: 'extension', lastCheckedAt: 0 },
  });

  const html = renderToHtml(<WalletConnectButton />);
  const truncated = `${PUBLIC_KEY.slice(0, 4)}...${PUBLIC_KEY.slice(-4)}`;

  assert.ok(html.includes(truncated), `expected the truncated key ${truncated}`);
  assert.match(html, /icon-chevron-right/);
});

test('falls back to a generic label when a connected session has no public key', () => {
  __setWalletState({
    wallet: { publicKey: null, connected: true, source: 'fallback', lastCheckedAt: 0 },
  });

  const html = renderToHtml(<WalletConnectButton />);

  assert.match(html, />Wallet connected</);
  assert.doesNotMatch(html, /icon-chevron-right/);
});

test('disables the trigger while the wallet status is being checked', () => {
  __setWalletState({ isChecking: true });

  const html = renderToHtml(<WalletConnectButton />);

  assert.match(html, />Connect Wallet</);
  assert.match(html, /disabled=""/);
});
