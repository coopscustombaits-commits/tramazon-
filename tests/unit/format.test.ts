import assert from 'node:assert/strict';
import test from 'node:test';

import type { Timestamp } from 'firebase/firestore';

import { plural, shortTimeAgo } from '../../src/lib/format.ts';

/** Minimal stand-in for a Firestore Timestamp — only `toDate` is used. */
function at(msAgo: number): Timestamp {
  const date = new Date(Date.now() - msAgo);
  return { toDate: () => date } as Timestamp;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

test('shows "now" for anything under a minute', () => {
  assert.equal(shortTimeAgo(at(0)), 'now');
  assert.equal(shortTimeAgo(at(59 * SECOND)), 'now');
});

test('counts up through minutes, hours, and days', () => {
  assert.equal(shortTimeAgo(at(MINUTE)), '1m');
  assert.equal(shortTimeAgo(at(59 * MINUTE)), '59m');
  assert.equal(shortTimeAgo(at(HOUR)), '1h');
  assert.equal(shortTimeAgo(at(23 * HOUR)), '23h');
  assert.equal(shortTimeAgo(at(DAY)), '1d');
  assert.equal(shortTimeAgo(at(6 * DAY)), '6d');
});

test('switches to a date past a week', () => {
  const result = shortTimeAgo(at(8 * DAY));
  assert.ok(!/^\d+[mhd]$/.test(result), `expected a date, got "${result}"`);
});

test('treats a missing timestamp as "now"', () => {
  // serverTimestamp() reads back as null until the write is acknowledged, so a
  // post the user just created has no createdAt for a moment.
  assert.equal(shortTimeAgo(null), 'now');
  assert.equal(shortTimeAgo(undefined), 'now');
});

test('never shows a negative age when a clock is ahead', () => {
  // Device clocks drift, and the server timestamp can land slightly in the
  // future relative to the phone.
  assert.equal(shortTimeAgo(at(-5 * MINUTE)), 'now');
});

test('pluralizes counts', () => {
  assert.equal(plural(0, 'like'), '0 likes');
  assert.equal(plural(1, 'like'), '1 like');
  assert.equal(plural(2, 'like'), '2 likes');
});

test('uses an irregular plural when given one', () => {
  assert.equal(plural(1, 'catch', 'catches'), '1 catch');
  assert.equal(plural(3, 'catch', 'catches'), '3 catches');
});
