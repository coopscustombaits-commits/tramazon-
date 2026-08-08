import assert from 'node:assert/strict';
import test from 'node:test';

import {
  competitionPhase,
  competitionTiming,
  isOpen,
} from '../../src/lib/competitions.ts';

const NOW = Date.UTC(2026, 5, 15, 12, 0, 0);
const DAY = 86_400_000;

/** Stands in for a Firestore Timestamp — only `toMillis` is used. */
const at = (ms: number) => ({ toMillis: () => ms });

test('a competition between its dates is open', () => {
  const competition = { startsAt: at(NOW - DAY), endsAt: at(NOW + DAY) };
  assert.equal(competitionPhase(competition, NOW), 'open');
  assert.equal(isOpen(competition, NOW), true);
});

test('before the start it is upcoming, after the end it has ended', () => {
  assert.equal(
    competitionPhase({ startsAt: at(NOW + DAY), endsAt: at(NOW + 8 * DAY) }, NOW),
    'upcoming',
  );
  assert.equal(
    competitionPhase({ startsAt: at(NOW - 8 * DAY), endsAt: at(NOW - DAY) }, NOW),
    'ended',
  );
});

test('a null date means no bound in that direction', () => {
  // No start is already-started; no end is open-ended. Both are things Coop
  // can actually create from the editor, so both have to behave.
  assert.equal(competitionPhase({ startsAt: null, endsAt: at(NOW + DAY) }, NOW), 'open');
  assert.equal(competitionPhase({ startsAt: at(NOW - DAY), endsAt: null }, NOW), 'open');
  assert.equal(competitionPhase({ startsAt: null, endsAt: null }, NOW), 'open');
});

test('the boundaries are inclusive — the last minute still counts', () => {
  // Someone posting a catch exactly on the deadline should get in, and the
  // security rules make the same call server-side.
  assert.equal(competitionPhase({ startsAt: at(NOW), endsAt: at(NOW + DAY) }, NOW), 'open');
  assert.equal(competitionPhase({ startsAt: at(NOW - DAY), endsAt: at(NOW) }, NOW), 'open');
});

test('one millisecond past the end is ended', () => {
  assert.equal(competitionPhase({ startsAt: null, endsAt: at(NOW - 1) }, NOW), 'ended');
});

test('the timing label says something useful in each phase', () => {
  assert.equal(competitionTiming({ startsAt: null, endsAt: at(NOW - DAY) }, NOW), 'Ended');
  assert.equal(competitionTiming({ startsAt: null, endsAt: null }, NOW), 'Open');
  assert.equal(
    competitionTiming({ startsAt: null, endsAt: at(NOW + 3 * DAY) }, NOW),
    'Ends in 3 days',
  );
  assert.equal(
    competitionTiming({ startsAt: at(NOW + 2 * DAY), endsAt: at(NOW + 9 * DAY) }, NOW),
    'Starts in 2 days',
  );
});

test('the label rounds to weeks once days stop being readable', () => {
  assert.equal(
    competitionTiming({ startsAt: null, endsAt: at(NOW + 21 * DAY) }, NOW),
    'Ends in 3 weeks',
  );
});

test('a deadline hours away is counted in hours, not rounded up to a day', () => {
  // The difference matters most when it's smallest: "ends in 5 hours" is the
  // nudge that gets a catch posted; "ends tomorrow" for the same deadline is
  // just wrong.
  assert.equal(
    competitionTiming({ startsAt: null, endsAt: at(NOW + 5 * 3_600_000) }, NOW),
    'Ends in 5 hours',
  );
  assert.equal(
    competitionTiming({ startsAt: null, endsAt: at(NOW + 20 * 60_000) }, NOW),
    'Ends within the hour',
  );
});
