import assert from 'node:assert/strict';
import test from 'node:test';

import {
  dayLabel,
  groupByMonth,
  hasPassed,
  isSameDay,
  monthKey,
  timeLabel,
  whenLabel,
} from '../../src/lib/calendar.ts';

/** Stands in for a Firestore Timestamp — only `toDate` is used. */
const at = (date: Date) => ({ toDate: () => date });

const NOW = new Date(2026, 2, 14, 12, 0, 0); // Sat 14 March 2026, local time.
const day = (n: number) => new Date(2026, 2, n, 12, 0, 0);

test('a month heading is the month and year', () => {
  assert.equal(monthKey(new Date(2026, 0, 1)), 'January 2026');
  assert.equal(monthKey(new Date(2026, 11, 31)), 'December 2026');
});

test('same-day comparison is by calendar day, not by 24 hours', () => {
  // 11pm and 1am the next morning are two hours apart and different days.
  assert.equal(isSameDay(new Date(2026, 2, 14, 23, 0), new Date(2026, 2, 14, 0, 1)), true);
  assert.equal(isSameDay(new Date(2026, 2, 14, 23, 0), new Date(2026, 2, 15, 1, 0)), false);
  // Same day number, different month or year, is not the same day.
  assert.equal(isSameDay(new Date(2026, 2, 14), new Date(2026, 3, 14)), false);
  assert.equal(isSameDay(new Date(2025, 2, 14), new Date(2026, 2, 14)), false);
});

test('near dates read as words, further ones as a date', () => {
  assert.equal(dayLabel(day(14), NOW), 'Today');
  assert.equal(dayLabel(day(15), NOW), 'Tomorrow');
  assert.equal(dayLabel(day(21), NOW), 'Sat 21 Mar');
  assert.equal(dayLabel(day(13), NOW), 'Fri 13 Mar');
});

test('"tomorrow" still works across a month boundary', () => {
  // The naive `getDate() + 1` version of this breaks on the 31st.
  const lastOfMarch = new Date(2026, 2, 31, 12, 0);
  assert.equal(dayLabel(new Date(2026, 3, 1, 12, 0), lastOfMarch), 'Tomorrow');
});

test('times are 12-hour, with midnight and noon both reading as 12', () => {
  assert.equal(timeLabel(new Date(2026, 2, 14, 19, 30)), '7:30 PM');
  assert.equal(timeLabel(new Date(2026, 2, 14, 7, 5)), '7:05 AM');
  // The classic off-by-twelve: hours % 12 is 0 for both of these.
  assert.equal(timeLabel(new Date(2026, 2, 14, 0, 0)), '12:00 AM');
  assert.equal(timeLabel(new Date(2026, 2, 14, 12, 0)), '12:00 PM');
});

test('an all-day event has no time', () => {
  assert.equal(timeLabel(new Date(2026, 2, 14, 9, 0), true), '');
});

test('the "when" line covers a single time, a range, and multiple days', () => {
  assert.equal(
    whenLabel({ startsAt: at(new Date(2026, 2, 21, 7, 0)), endsAt: null }, NOW),
    'Sat 21 Mar, 7:00 AM',
  );
  assert.equal(
    whenLabel(
      {
        startsAt: at(new Date(2026, 2, 21, 7, 0)),
        endsAt: at(new Date(2026, 2, 21, 15, 0)),
      },
      NOW,
    ),
    'Sat 21 Mar, 7:00 AM – 3:00 PM',
  );
  // A two-day event needs both dates, not both times.
  assert.equal(
    whenLabel(
      {
        startsAt: at(new Date(2026, 2, 21, 7, 0)),
        endsAt: at(new Date(2026, 2, 22, 15, 0)),
      },
      NOW,
    ),
    'Sat 21 Mar – Sun 22 Mar',
  );
  assert.equal(
    whenLabel({ startsAt: at(day(21)), endsAt: null, allDay: true }, NOW),
    'Sat 21 Mar',
  );
});

test('an undated event says so rather than rendering a blank', () => {
  assert.equal(whenLabel({ startsAt: null }, NOW), 'Date to be confirmed');
});

test('an event has passed once its end is behind us, not its start', () => {
  // A tournament that started this morning and runs till Sunday is not over.
  assert.equal(
    hasPassed({ startsAt: at(day(13)), endsAt: at(day(16)) }, NOW),
    false,
  );
  assert.equal(
    hasPassed({ startsAt: at(day(10)), endsAt: at(day(12)) }, NOW),
    true,
  );
  // With no end, the start is what decides.
  assert.equal(hasPassed({ startsAt: at(day(13)), endsAt: null }, NOW), true);
  assert.equal(hasPassed({ startsAt: at(day(20)), endsAt: null }, NOW), false);
  assert.equal(hasPassed({ startsAt: null }, NOW), false);
});

test('events group into month sections, keeping their order', () => {
  const sections = groupByMonth([
    { startsAt: at(new Date(2026, 2, 14)) },
    { startsAt: at(new Date(2026, 2, 21)) },
    { startsAt: at(new Date(2026, 3, 2)) },
  ]);
  assert.deepEqual(
    sections.map((section) => [section.title, section.data.length]),
    [['March 2026', 2], ['April 2026', 1]],
  );
});

test('an undated event gets its own section rather than vanishing', () => {
  // A draft with no date still has to be findable in the admin list.
  const sections = groupByMonth([
    { startsAt: at(new Date(2026, 2, 14)) },
    { startsAt: null },
  ]);
  assert.deepEqual(sections.map((section) => section.title), ['March 2026', 'No date yet']);
});

test('the same month revisited after another opens a new section', () => {
  // Grouping follows the order given rather than re-sorting, so a list that
  // isn't in date order produces sections that still match what's shown.
  const sections = groupByMonth([
    { startsAt: at(new Date(2026, 2, 14)) },
    { startsAt: at(new Date(2026, 3, 2)) },
    { startsAt: at(new Date(2026, 2, 28)) },
  ]);
  assert.deepEqual(
    sections.map((section) => section.title),
    ['March 2026', 'April 2026', 'March 2026'],
  );
});
