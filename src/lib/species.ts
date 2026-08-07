// Relative, with the extension, rather than the usual `@/` alias: the unit
// tests run this file directly in Node, which doesn't know about the alias.
import { labelFromSlug, slugify } from './slug.ts';

/**
 * Species names, normalized.
 *
 * Anglers type "Largemouth bass", "largemouth Bass", "LARGEMOUTH BASS". A slug
 * derived at write time is what lets the species hubs be an exact-match query
 * instead of a full scan, and it costs nothing to record now.
 *
 * The normalization itself lives in `lib/slug.ts` because bait names need the
 * same treatment for the same reason.
 */
export function speciesSlug(species: string | null | undefined): string | null {
  return slugify(species);
}

/** Title-case a slug for display: "largemouth-bass" -> "Largemouth Bass". */
export function speciesLabel(slug: string): string {
  return labelFromSlug(slug);
}
