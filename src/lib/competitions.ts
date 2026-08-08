/**
 * Competition timing.
 *
 * Pure — no Firestore, no React — so the "is this open?" logic can be unit
 * tested directly, which matters because it decides whether an entry is
 * allowed and the security rules make the same call server-side.
 */

export type CompetitionPhase = 'upcoming' | 'open' | 'ended';

/** Just enough of a Competition to decide its phase. */
export type Timed = {
  startsAt: { toMillis: () => number } | null;
  endsAt: { toMillis: () => number } | null;
};

/**
 * Where a competition is right now.
 *
 * Worked out from the dates every time rather than stored, because a stored
 * status needs something to move it at the right minute — and anything that
 * can fail to run can leave a competition claiming to be open a week after it
 * closed.
 *
 * A null date means "no bound": no start is already-started, no end is
 * open-ended.
 */
export function competitionPhase(competition: Timed, now = Date.now()): CompetitionPhase {
  const start = competition.startsAt?.toMillis() ?? null;
  const end = competition.endsAt?.toMillis() ?? null;

  if (start !== null && now < start) return 'upcoming';
  if (end !== null && now > end) return 'ended';
  return 'open';
}

export function isOpen(competition: Timed, now = Date.now()): boolean {
  return competitionPhase(competition, now) === 'open';
}

/** "Ends in 3 days", "Starts Saturday", "Ended". For the card subtitle. */
export function competitionTiming(competition: Timed, now = Date.now()): string {
  const phase = competitionPhase(competition, now);

  if (phase === 'upcoming') {
    const start = competition.startsAt?.toMillis();
    return start ? `Starts ${relativeTime(start - now)}` : 'Starting soon';
  }

  if (phase === 'ended') return 'Ended';

  const end = competition.endsAt?.toMillis();
  return end ? `Ends ${relativeTime(end - now)}` : 'Open';
}

const HOUR = 3_600_000;
const DAY = 86_400_000;

/**
 * "in 3 days", "in 2 hours", "any minute". Input is a duration in ms.
 *
 * Sub-day durations are counted in hours rather than rounded up to a day,
 * because the difference matters most exactly when it's smallest: "ends in 2
 * hours" is the nudge that gets a catch posted, and "ends tomorrow" for the
 * same deadline is just wrong.
 */
function relativeTime(ms: number): string {
  if (ms <= 0) return 'any minute';

  if (ms < DAY) {
    const hours = Math.round(ms / HOUR);
    if (hours <= 1) return 'within the hour';
    return `in ${hours} hours`;
  }

  const days = Math.round(ms / DAY);
  if (days === 1) return 'tomorrow';
  if (days < 14) return `in ${days} days`;
  return `in ${Math.round(days / 7)} weeks`;
}
