/**
 * Calendar formatting and grouping.
 *
 * Pure — no Firestore, no React — so the date maths can be unit tested, which
 * matters because "is this today?" is the sort of thing that quietly breaks
 * around midnight and month boundaries.
 */

/** Just enough of a CalendarEvent to be grouped and labelled. */
export type Dated = {
  startsAt: { toDate: () => Date } | null;
  endsAt?: { toDate: () => Date } | null;
  allDay?: boolean;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "March 2026" — the heading a month's events sit under. */
export function monthKey(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Group events into month sections, in the order they were given.
 *
 * Events with no date fall into a section of their own at the end rather than
 * being dropped — a draft that hasn't been dated yet still has to be findable
 * in the admin list.
 */
export function groupByMonth<T extends Dated>(events: T[]): { title: string; data: T[] }[] {
  const sections: { title: string; data: T[] }[] = [];

  for (const event of events) {
    const date = event.startsAt?.toDate();
    const title = date ? monthKey(date) : 'No date yet';
    const last = sections.at(-1);
    if (last?.title === title) {
      last.data.push(event);
    } else {
      sections.push({ title, data: [event] });
    }
  }

  return sections;
}

/** True if two dates land on the same calendar day in the local timezone. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * "Sat 14 Mar", or "Today" / "Tomorrow" when it's close enough that the date
 * itself is less useful than the word.
 */
export function dayLabel(date: Date, now = new Date()): string {
  if (isSameDay(date, now)) return 'Today';

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameDay(date, tomorrow)) return 'Tomorrow';

  return `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)}`;
}

/** "7:30 PM". Empty for an all-day event, where a time would be noise. */
export function timeLabel(date: Date, allDay = false): string {
  if (allDay) return '';
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const suffix = hours < 12 ? 'AM' : 'PM';
  // 0 and 12 both display as 12 — midnight is 12 AM, noon is 12 PM.
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${minutes} ${suffix}`;
}

/** The full "when" line: day, time, and an end if there is one. */
export function whenLabel(event: Dated, now = new Date()): string {
  const start = event.startsAt?.toDate();
  if (!start) return 'Date to be confirmed';

  const day = dayLabel(start, now);
  const time = timeLabel(start, event.allDay);
  const end = event.endsAt?.toDate() ?? null;

  if (!end) return time ? `${day}, ${time}` : day;

  // A multi-day event needs both dates; a same-day one only needs both times.
  if (!isSameDay(start, end)) {
    return `${day} – ${dayLabel(end, now)}`;
  }
  if (!time) return day;
  return `${day}, ${time} – ${timeLabel(end, event.allDay)}`;
}

/** True once the event's end (or its start, if open-ended) is in the past. */
export function hasPassed(event: Dated, now = new Date()): boolean {
  const end = event.endsAt?.toDate() ?? event.startsAt?.toDate() ?? null;
  return end !== null && end.getTime() < now.getTime();
}
