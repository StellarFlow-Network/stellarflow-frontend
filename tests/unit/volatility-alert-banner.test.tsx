import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SPREAD_ALERT_THRESHOLD_PCT,
  VolatilityAlertBanner,
  assessVolatility,
} from '@/components/swap/VolatilityAlertBanner';
import { renderToHtml } from './helpers/render';

test('alerts only when the spread is strictly above 1.5%', () => {
  assert.equal(SPREAD_ALERT_THRESHOLD_PCT, 1.5);
  assert.equal(assessVolatility({ spreadPct: 1.5 }).highVolatility, false);
  assert.equal(assessVolatility({ spreadPct: 1.51 }).highVolatility, true);
  assert.equal(assessVolatility({}).shouldAlert, false);
});

test('flags thin liquidity from trade size against pool depth', () => {
  const deep = assessVolatility({ tradeAmount: 100, poolDepth: 100_000 });
  assert.equal(deep.lowLiquidity, false);
  assert.equal(deep.depthUsagePct, 0.1);

  const thin = assessVolatility({ tradeAmount: 5_000, poolDepth: 100_000 });
  assert.equal(thin.lowLiquidity, true);
  assert.equal(thin.shouldAlert, true);
  assert.ok(Math.abs((thin.estimatedImpactPct ?? 0) - 4.7619) < 1e-3);

  assert.equal(assessVolatility({ tradeAmount: 1, poolDepth: 0 }).lowLiquidity, true);
  assert.equal(assessVolatility({ tradeAmount: 0, poolDepth: 10 }).lowLiquidity, false);
});

test('renders nothing in calm, deep markets', () => {
  assert.equal(renderToHtml(<VolatilityAlertBanner spreadPct={0.4} tradeAmount={10} poolDepth={1_000_000} />), '');
});

test('renders the yellow alert with reasons, a routing link and a dismiss button', () => {
  const html = renderToHtml(
    <VolatilityAlertBanner spreadPct={2.25} tradeAmount={5_000} poolDepth={100_000} alternativeRoutesHref="/pools?pair=XLM-USDC" />,
  );
  assert.match(html, /role="alert"/);
  assert.match(html, /bg-yellow-400/);
  assert.match(html, /High volatility and thin liquidity/);
  assert.match(html, /2\.25%, above the 1\.5% volatility threshold/);
  assert.match(html, /5\.0% of the pool/);
  assert.match(html, /href="\/pools\?pair=XLM-USDC"/);
  assert.match(html, /Dismiss volatility alert for this session/);
});
