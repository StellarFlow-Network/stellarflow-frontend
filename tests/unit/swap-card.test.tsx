import test from 'node:test';
import assert from 'node:assert/strict';

import { SwapCard } from '@/components/swap/SwapCard';
import type { TokenOption } from '@/components/swap/SwapForm';
import { renderToHtml } from './helpers/render';
import { __resetSwapState, __setSlippage } from './stubs/swap-state.mjs';
import { __resetWalletState, __setWalletState } from './stubs/wallet-state.mjs';

const TOKENS: TokenOption[] = [
  { symbol: 'XLM', name: 'Stellar Lumens', address: 'native', decimals: 7 },
  { symbol: 'USDC', name: 'USD Coin', address: 'CUSDC', decimals: 7 },
];

const CONNECTED_SESSION = {
  publicKey: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  connected: true,
  source: 'extension' as const,
  lastCheckedAt: 0,
};

test.beforeEach(() => {
  __resetWalletState();
  __resetSwapState();
});

test('renders both token fields, the switch control and the default slippage', () => {
  const html = renderToHtml(<SwapCard tokens={TOKENS} />);

  assert.match(html, />Swap</);
  assert.match(html, />You Pay</);
  assert.match(html, /You Receive \(Estimated\)/);
  assert.match(html, /Balance: 0 XLM/);
  assert.match(html, /Balance: 0 USDC/);
  assert.match(html, />MAX</);
  assert.match(html, /aria-label="Switch tokens"/);
  assert.match(html, /0\.5% slippage/);
  assert.equal((html.match(/type="number"/g) ?? []).length, 2);
});

test('asks the user to connect a wallet before an amount is entered', () => {
  const html = renderToHtml(<SwapCard tokens={TOKENS} />);

  assert.match(html, />Connect Wallet</);
  assert.doesNotMatch(html, /disabled=""/);
});

test('disables submission with an amount prompt once a wallet is connected', () => {
  __setWalletState({ wallet: CONNECTED_SESSION });

  const html = renderToHtml(<SwapCard tokens={TOKENS} />);

  assert.match(html, />Enter an Amount</);
  assert.match(html, /disabled=""/);
});

test('reflects the persisted slippage tolerance in the settings trigger', () => {
  __setSlippage({ slippagePercent: 2.5 });

  const html = renderToHtml(<SwapCard tokens={TOKENS} />);

  assert.match(html, /2\.5% slippage/);
  assert.doesNotMatch(html, /danger threshold/);
});

test('requires acknowledgement when slippage exceeds the danger threshold', () => {
  __setSlippage({ slippagePercent: 4 });

  const html = renderToHtml(<SwapCard tokens={TOKENS} />);

  assert.match(html, /Slippage tolerance is 4%, above the 3% danger threshold/);
  assert.match(html, /I understand the risks and want to proceed anyway\./);
});
