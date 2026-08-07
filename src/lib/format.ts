import type { Timestamp } from 'firebase/firestore';

/**
 * "3h", "2d", "Mar 4" — short enough to sit next to a username without
 * pushing it around.
 *
 * Firestore returns null for a `serverTimestamp()` field until the write is
 * acknowledged, so a locally-created post shows "now" for a moment.
 */
export function shortTimeAgo(timestamp: Timestamp | null | undefined): string {
  if (!timestamp) return 'now';

  const date = timestamp.toDate();
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** "1 like" / "2 likes" — pluralization without pulling in a library. */
export function plural(count: number, singular: string, pluralForm?: string): string {
  const word = count === 1 ? singular : (pluralForm ?? `${singular}s`);
  return `${count} ${word}`;
}
