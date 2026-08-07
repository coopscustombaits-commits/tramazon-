/**
 * The species hubs shown in the app.
 *
 * Curated rather than derived from existing posts: an empty hub reads as an
 * invitation, while a list built from what's already been posted would hide
 * the species nobody has filled in yet.
 *
 * `slug` must match what `speciesSlug()` produces for the corresponding free
 * text, since that's what the query matches on.
 */
export const SPECIES_HUBS: { slug: string; label: string; note?: string }[] = [
  { slug: 'largemouth-bass', label: 'Largemouth Bass' },
  { slug: 'smallmouth-bass', label: 'Smallmouth Bass' },
  { slug: 'crappie', label: 'Crappie' },
  { slug: 'bluegill', label: 'Bluegill', note: 'and panfish' },
  { slug: 'walleye', label: 'Walleye' },
  { slug: 'northern-pike', label: 'Northern Pike' },
  { slug: 'muskie', label: 'Muskie' },
  { slug: 'trout', label: 'Trout' },
  { slug: 'catfish', label: 'Catfish' },
  { slug: 'perch', label: 'Perch' },
  { slug: 'salmon', label: 'Salmon' },
  { slug: 'striped-bass', label: 'Striped Bass' },
];
