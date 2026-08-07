/**
 * Username rules.
 *
 * Deliberately free of any Firebase import so it can be unit tested directly —
 * `lib/db/users.ts` re-exports these alongside the functions that actually
 * touch Firestore.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

/** Words we don't want people claiming as usernames. */
const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'coop',
  'coops',
  'coopscustombaits',
  'support',
  'help',
  'moderator',
  'mod',
  'official',
  'staff',
  'root',
  'me',
  'settings',
]);

/** Returns an error message, or null when the username is acceptable. */
export function validateUsername(raw: string): string | null {
  const username = raw.trim();
  if (username.length < USERNAME_MIN) {
    return `Username must be at least ${USERNAME_MIN} characters.`;
  }
  if (username.length > USERNAME_MAX) {
    return `Username must be ${USERNAME_MAX} characters or fewer.`;
  }
  if (!USERNAME_PATTERN.test(username)) {
    return 'Use only letters, numbers, and underscores.';
  }
  if (RESERVED_USERNAMES.has(username.toLowerCase())) {
    return 'That username is reserved.';
  }
  return null;
}

/**
 * Turn an email or display name into a starting-point username, e.g.
 * "Coop Anderson" -> "coopanderson". Callers still have to check availability.
 */
export function suggestUsername(source: string | null | undefined): string {
  const base = (source ?? '')
    .split('@')[0]
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, USERNAME_MAX);

  // Too short to be valid, or reserved — fall back to something random rather
  // than handing the user a name the form will immediately reject.
  if (base.length >= USERNAME_MIN && validateUsername(base) === null) {
    return base.toLowerCase();
  }
  return `anglr${Math.floor(1000 + Math.random() * 9000)}`;
}
