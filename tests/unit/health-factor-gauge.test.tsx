import test from 'node:test';
import assert from 'node:assert/strict';

import HealthFactorGauge, {
  HealthFactorZone,
} from '@/components/vaults/HealthFactorGauge';
import { renderToHtml } from './helpers/render';

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function dashOffsetFrom(html: string): number {
  const match = html.match(/stroke-dashoffset="([0-9.]+)"/);
  assert.ok(match, 'expected the gauge arc to render a stroke-dashoffset');
  return Number(match[1]);
}

test('maps health factor values onto the three documented zones', () => {
  assert.equal(HealthFactorZone.Safe, 'Safe');
  assert.equal(HealthFactorZone.Warning, 'Warning');
  assert.equal(HealthFactorZone.Critical, 'Critical');
});

test('renders the Safe zone above 1.5 with a mostly-full arc', () => {
  const html = renderToHtml(<HealthFactorGauge healthFactor={1.8} />);

  assert.match(html, />1\.80</);
  assert.match(html, />Safe</);
  assert.match(html, /stroke="#10b981"/);
  assert.doesNotMatch(html, /Add Collateral/);
  assert.ok(Math.abs(dashOffsetFrom(html) - CIRCUMFERENCE * (1 - 0.9)) < 1e-9);
});

test('renders the Warning zone between 1.1 and 1.5 with an Add Collateral action', () => {
  const html = renderToHtml(
    <HealthFactorGauge healthFactor={1.3} onAddCollateral={() => {}} />,
  );

  assert.match(html, />1\.30</);
  assert.match(html, />Warning</);
  assert.match(html, /Add Collateral/);
  assert.match(html, /stroke="#eab308"/);
  assert.ok(Math.abs(dashOffsetFrom(html) - CIRCUMFERENCE * (1 - 0.65)) < 1e-9);
});

test('renders the Critical zone below 1.1 without the collateral action', () => {
  const html = renderToHtml(
    <HealthFactorGauge healthFactor={0.9} onAddCollateral={() => {}} />,
  );

  assert.match(html, />0\.90</);
  assert.match(html, />Critical</);
  assert.match(html, /stroke="#ef4444"/);
  assert.doesNotMatch(html, /Add Collateral/);
});

test('treats 1.1 and 1.5 as Warning boundaries and 1.51 as Safe', () => {
  assert.match(renderToHtml(<HealthFactorGauge healthFactor={1.1} />), />Warning</);
  assert.match(renderToHtml(<HealthFactorGauge healthFactor={1.5} />), />Warning</);
  assert.match(renderToHtml(<HealthFactorGauge healthFactor={1.51} />), />Safe</);
});

test('clamps the arc at full once the health factor exceeds 2', () => {
  const html = renderToHtml(<HealthFactorGauge healthFactor={3.5} />);

  assert.match(html, />3\.50</);
  assert.equal(dashOffsetFrom(html), 0);
});

test('omits the collateral action when no handler is supplied', () => {
  const html = renderToHtml(<HealthFactorGauge healthFactor={1.3} />);

  assert.match(html, />Warning</);
  assert.doesNotMatch(html, /Add Collateral/);
});
