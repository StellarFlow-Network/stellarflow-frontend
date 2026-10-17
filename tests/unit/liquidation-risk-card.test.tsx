import test from 'node:test';
import assert from 'node:assert/strict';

import LiquidationRiskCard, { formatCurrency } from '@/components/vaults/LiquidationRiskCard';
import { renderToHtml } from './helpers/render';

test('formatCurrency correctly formats varying magnitudes of prices', () => {
  assert.equal(formatCurrency(0.0825), '$0.0825');
  assert.equal(formatCurrency(1.5), '$1.50');
  assert.equal(formatCurrency(2450.75), '$2,450.75');
  assert.equal(formatCurrency(NaN), '$0.00');
});

test('calculates and renders positive delta P when current price is well above liquidation price (Safe zone)', () => {
  const html = renderToHtml(
    <LiquidationRiskCard
      collateralSymbol="XLM"
      currentPrice={0.25}
      liquidationPrice={0.10}
      referencePrice={0.30}
    />
  );

  // Checks collateral symbol & badge
  assert.match(html, /XLM Collateral Risk/);
  assert.match(html, /Safe Zone/);

  // Checks current price & liquidation price
  assert.match(html, />\$0\.25</);
  assert.match(html, />\$0\.10</);

  // Delta P is 0.25 - 0.10 = +$0.15
  assert.match(html, />\+\$0\.15</);
  assert.match(html, /\+60\.0%/);

  // Progress zones exist
  assert.match(html, /data-testid="zone-liquidation"/);
  assert.match(html, /data-testid="zone-warning"/);
  assert.match(html, /data-testid="zone-safe"/);
});

test('renders Warning zone when price drops within warning threshold', () => {
  // Liquidation = 100, default 15% warning threshold -> warning price is 115
  // Current price = 110 (which is <= 115 and > 100)
  const html = renderToHtml(
    <LiquidationRiskCard
      collateralSymbol="ETH"
      currentPrice={110}
      liquidationPrice={100}
    />
  );

  assert.match(html, /Warning Zone/);
  assert.match(html, />\$110\.00</);
  assert.match(html, />\$100\.00</);
  // Delta P = 110 - 100 = 10.00
  assert.match(html, />\+\$10\.00</);
});

test('renders Liquidation zone when current price drops to or below liquidation price', () => {
  const html = renderToHtml(
    <LiquidationRiskCard
      collateralSymbol="XLM"
      currentPrice={0.09}
      liquidationPrice={0.10}
    />
  );

  assert.match(html, /liquidation Zone/);
  // Delta P = 0.09 - 0.10 = -0.01
  assert.match(html, />-\$0\.0100</);
});

test('renders custom user alert trigger threshold and allows editing', () => {
  const html = renderToHtml(
    <LiquidationRiskCard
      collateralSymbol="USDC"
      currentPrice={1.0}
      liquidationPrice={0.8}
      customWarningPrice={0.9}
    />
  );

  assert.match(html, /Custom Warning Alert Trigger/);
  assert.match(html, />\$0\.90</);
  assert.match(html, />Edit</);
});
