import test from 'node:test';
import assert from 'node:assert/strict';

import { QuorumProgressBar, computeQuorumProgress } from '@/components/governance/QuorumProgressBar';
import { renderToHtml } from './helpers/render';

test('participation is total votes over required quorum', () => {
  const p = computeQuorumProgress({ totalVotes: 300, quorumRequired: 600, eligibleVotes: 1000 });
  assert.equal(p.participationPct, 50);
  assert.equal(p.fillPct, 30);
  assert.equal(p.markerPct, 60);
  assert.equal(p.reached, false);
  assert.equal(p.remaining, 300);
});

test('quorum counts as reached exactly at the threshold', () => {
  const p = computeQuorumProgress({ totalVotes: 600, quorumRequired: 600, eligibleVotes: 1000 });
  assert.equal(p.reached, true);
  assert.equal(p.remaining, 0);
  assert.equal(p.participationPct, 100);
});

test('without an electorate the bar leaves headroom past the marker', () => {
  const p = computeQuorumProgress({ totalVotes: 0, quorumRequired: 800 });
  assert.equal(p.markerPct, 80);
  assert.equal(p.fillPct, 0);

  const over = computeQuorumProgress({ totalVotes: 2000, quorumRequired: 800 });
  assert.equal(over.fillPct, 100);
  assert.equal(over.markerPct, 40);
  assert.equal(over.participationPct, 250);
});

test('handles zero, negative and non-finite input without NaN', () => {
  assert.equal(computeQuorumProgress({ totalVotes: 10, quorumRequired: 0 }).reached, true);
  const p = computeQuorumProgress({ totalVotes: Number.NaN, quorumRequired: 100, eligibleVotes: -5 });
  assert.equal(p.participationPct, 0);
  assert.ok(Number.isFinite(p.fillPct) && Number.isFinite(p.markerPct));
});

test('renders progressbar semantics, the marker and the not-reached colour', () => {
  const html = renderToHtml(<QuorumProgressBar totalVotes={300} quorumRequired={600} eligibleVotes={1000} />);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-valuenow="50"/);
  assert.match(html, /data-testid="quorum-marker"[^>]*style="left:60%"/);
  assert.match(html, /data-reached="false"[^>]*bg-indigo-500|bg-indigo-500[^>]*data-reached="false"/);
  assert.match(html, /50\.0% of quorum/);
  assert.match(html, /300 more needed/);
});

test('turns green once quorum is reached', () => {
  const html = renderToHtml(<QuorumProgressBar totalVotes={700} quorumRequired={600} eligibleVotes={1000} />);
  assert.match(html, /bg-emerald-500/);
  assert.match(html, /data-reached="true"/);
  assert.match(html, /Quorum reached/);
});
