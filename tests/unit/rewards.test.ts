import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { POINT_VALUES, badgeMetricLabel, pointsReasonLabel } from '../../src/lib/rewards.ts';

test('the app and the Cloud Function agree on what things are worth', () => {
  // The app never awards points — the function does. This copy exists only so
  // the leaderboard can explain the scoring, which makes drifting apart a
  // silent way to lie to users. Parsed rather than imported because the
  // functions directory is a separate package with its own build.
  const source = readFileSync(
    new URL('../../functions/src/index.ts', import.meta.url),
    'utf8',
  );
  const block = /const POINT_VALUES = \{([\s\S]*?)\} as const;/.exec(source);
  assert.ok(block, 'could not find POINT_VALUES in the Cloud Function');

  const fromFunction: Record<string, number> = {};
  for (const [, key, value] of block[1].matchAll(/(\w+):\s*(\d+)/g)) {
    fromFunction[key] = Number(value);
  }

  assert.deepEqual(fromFunction, { ...POINT_VALUES });
});

test('every point value is positive — an award that costs points is a bug', () => {
  for (const [reason, value] of Object.entries(POINT_VALUES)) {
    assert.ok(value > 0, `${reason} should be worth something`);
  }
});

test('winning is worth more than any single routine action', () => {
  const routine = Math.max(
    POINT_VALUES.post_approved,
    POINT_VALUES.like_received,
    POINT_VALUES.review_written,
    POINT_VALUES.competition_entered,
  );
  assert.ok(POINT_VALUES.competition_won > routine);
});

test('every ledger reason has a human label', () => {
  const reasons = [
    ...Object.keys(POINT_VALUES),
    'admin_adjustment',
  ] as Parameters<typeof pointsReasonLabel>[0][];

  for (const reason of reasons) {
    const label = pointsReasonLabel(reason);
    assert.ok(label.length > 0);
    // A raw enum name leaking into the UI is the failure this catches.
    assert.ok(!label.includes('_'), `"${label}" looks like a raw key`);
  }
});

test('every badge metric has a human label', () => {
  for (const metric of ['postCount', 'points', 'followerCount', 'fishLoggedCount'] as const) {
    const label = badgeMetricLabel(metric);
    assert.ok(label.length > 0);
    // A camelCase key leaking into "10 postCount" is the failure this catches.
    // `points` legitimately maps to itself — it's already the English word.
    assert.ok(!/[A-Z]/.test(label), `"${label}" looks like a raw field name`);
  }
});

test('the starter badges are internally consistent', async () => {
  const { STARTER_BADGES } = await import('../../src/lib/rewards.ts');

  const ids = new Set<string>();
  for (const badge of STARTER_BADGES) {
    assert.ok(badge.id, 'every badge needs an id — it is also the award id');
    assert.ok(!ids.has(badge.id), `duplicate badge id: ${badge.id}`);
    ids.add(badge.id);
    assert.ok(badge.title.trim().length > 0);
    assert.ok(badge.threshold >= 1, `${badge.id} needs a threshold of at least 1`);
  }

  // Same metric, ascending thresholds should mean ascending sort order, or
  // the shelf shows "Serious Angler" above "First Catch".
  const byMetric = new Map<string, typeof STARTER_BADGES>();
  for (const badge of STARTER_BADGES) {
    byMetric.set(badge.metric, [...(byMetric.get(badge.metric) ?? []), badge]);
  }
  for (const [metric, group] of byMetric) {
    const byThreshold = [...group].sort((a, b) => a.threshold - b.threshold);
    const byOrder = [...group].sort((a, b) => a.order - b.order);
    assert.deepEqual(
      byThreshold.map((badge) => badge.id),
      byOrder.map((badge) => badge.id),
      `${metric} badges are ordered differently than they are earned`,
    );
  }
});
