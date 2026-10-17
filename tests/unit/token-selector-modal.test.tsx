import test from 'node:test';
import assert from 'node:assert/strict';

import { TokenSelectorModal, type TokenOption } from '@/components/swap/TokenSelectorModal';
import { renderToHtml } from './helpers/render';

const TEST_TOKENS: TokenOption[] = [
  {
    symbol: 'XLM',
    name: 'Stellar Lumens',
    address: 'native',
    decimals: 7,
    verified: true,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
    decimals: 7,
    verified: true,
  },
  {
    symbol: 'AQUA',
    name: 'Aquarius',
    address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    decimals: 7,
    verified: true,
  },
  {
    symbol: 'MEME',
    name: 'Custom Community Meme',
    address: 'CA111111111111111111111111111111111111111111111111111111',
    decimals: 7,
    isCustom: true,
  },
];

test('does not render dialog content when isOpen is false', () => {
  const html = renderToHtml(
    <TokenSelectorModal
      isOpen={false}
      onClose={() => {}}
      tokens={TEST_TOKENS}
      onSelect={() => {}}
    />
  );

  assert.equal(html, '');
});

test('renders modal title, search input, filter tabs, and token list when isOpen is true', () => {
  const html = renderToHtml(
    <TokenSelectorModal
      isOpen={true}
      onClose={() => {}}
      tokens={TEST_TOKENS}
      onSelect={() => {}}
    />
  );

  assert.match(html, />Select a token</);
  assert.match(html, /placeholder="Search by name, symbol, or address"/);
  assert.match(html, /role="listbox"/);
  assert.match(html, /role="tablist"/);
  assert.match(html, />All</);
  assert.match(html, />Verified</);
  assert.match(html, />Custom</);
  assert.match(html, />4 tokens</);
  assert.match(html, />XLM</);
  assert.match(html, />Stellar Lumens</);
  assert.match(html, />USDC</);
  assert.match(html, />USD Coin</);
});

test('displays token balances formatted on rows when balances prop is provided', () => {
  const balances = {
    native: '150.5000000',
    CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75: '1250.00',
  };

  const html = renderToHtml(
    <TokenSelectorModal
      isOpen={true}
      onClose={() => {}}
      tokens={TEST_TOKENS}
      onSelect={() => {}}
      balances={balances}
    />
  );

  assert.match(html, /data-testid="token-balance"/);
  assert.match(html, />150\.5</);
  assert.match(html, />1,250</);
});

test('displays custom token import tags for custom tokens', () => {
  const html = renderToHtml(
    <TokenSelectorModal
      isOpen={true}
      onClose={() => {}}
      tokens={TEST_TOKENS}
      onSelect={() => {}}
    />
  );

  assert.match(html, /data-testid="custom-token-tag"/);
  assert.match(html, />Custom</);
});

test('displays verified security badges for protocol-verified tokens', () => {
  const html = renderToHtml(
    <TokenSelectorModal
      isOpen={true}
      onClose={() => {}}
      tokens={TEST_TOKENS}
      onSelect={() => {}}
    />
  );

  assert.match(html, /data-testid="verified-badge"/);
  assert.match(html, /aria-label="Verified asset"/);
});

test('highlights the selected token and disables the opposite-side token', () => {
  const html = renderToHtml(
    <TokenSelectorModal
      isOpen={true}
      onClose={() => {}}
      tokens={TEST_TOKENS}
      onSelect={() => {}}
      selectedAddress="native"
      disabledAddress="CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75"
    />
  );

  // Selected token
  assert.match(html, /aria-selected="true"/);

  // Disabled token
  assert.match(html, /disabled=""/);
  assert.match(html, /title="Already selected on the other side of this swap"/);
});

test('virtualizes large lists over 1,000+ assets maintaining bounded DOM nodes', () => {
  const manyTokens: TokenOption[] = Array.from({ length: 1200 }, (_, i) => ({
    symbol: `TKN${i}`,
    name: `Token Asset ${i}`,
    address: `CA${String(i).padStart(54, '0')}`,
    decimals: 7,
    verified: i % 2 === 0,
    isCustom: i % 5 === 0,
  }));

  const html = renderToHtml(
    <TokenSelectorModal
      isOpen={true}
      onClose={() => {}}
      tokens={manyTokens}
      onSelect={() => {}}
    />
  );

  assert.match(html, />1200 tokens</);
  // Virtualization ensures not all 1200 DOM rows are rendered at once
  const renderedButtons = (html.match(/role="option"/g) ?? []).length;
  assert.ok(
    renderedButtons > 0 && renderedButtons < 100,
    `expected virtualized DOM slice (< 100 items), got ${renderedButtons}`
  );
});
