/**
 * Slugs — the normalized, url-safe form of a free-text name.
 *
 * Used anywhere people type the same thing three different ways and we still
 * want one exact-match query: species names, bait names. Pure and
 * dependency-free so it can be unit tested directly.
 */

/** Lowercase, punctuation collapsed to hyphens, trimmed. Null if nothing left. */
export function slugify(value: string | null | undefined): string | null {
  if (!value) return null;
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || null;
}

/** Title-case a slug for display: "chatterbait-jack-hammer" -> "Chatterbait Jack Hammer". */
export function labelFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
