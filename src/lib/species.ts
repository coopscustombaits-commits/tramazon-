/**
 * Species names, normalized.
 *
 * Anglers type "Largemouth bass", "largemouth Bass", "LARGEMOUTH BASS". A slug
 * derived at write time is what lets Phase 2's species hubs be an exact-match
 * query instead of a full scan, and it costs nothing to record now.
 */
export function speciesSlug(species: string | null | undefined): string | null {
  if (!species) return null;
  const slug = species
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || null;
}

/** Title-case a slug for display: "largemouth-bass" -> "Largemouth Bass". */
export function speciesLabel(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
