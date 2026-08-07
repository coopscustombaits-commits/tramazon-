/**
 * Search keywords.
 *
 * Firestore has no full-text search. What it does have is `array-contains`, so
 * each post carries a pre-computed list of the words someone might search for.
 * That handles "find posts about pike" well; it does not handle typos or
 * ranking. If the community outgrows it, an Algolia or Typesense extension
 * mirrors the same collection without changing how posts are stored.
 *
 * Pure and dependency-free so it can be unit tested directly.
 */

/** Words too common to be worth indexing. */
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'was', 'were', 'out',
  'got', 'get', 'had', 'has', 'have', 'but', 'not', 'you', 'your', 'his',
  'her', 'its', 'they', 'them', 'she', 'him', 'are', 'all', 'any', 'one',
  'today', 'yesterday', 'just', 'about', 'into', 'over', 'been', 'than',
  'then', 'some', 'what', 'when', 'where', 'who', 'how', 'why',
]);

const MIN_WORD = 3;
/** Firestore caps an `array-contains-any` at 30, and huge arrays cost writes. */
export const MAX_KEYWORDS = 40;

/**
 * Break text into searchable words: lowercased, punctuation stripped,
 * de-duplicated, stop words and very short words dropped.
 */
export function extractKeywords(...sources: (string | null | undefined)[]): string[] {
  const words = new Set<string>();

  for (const source of sources) {
    if (!source) continue;
    for (const raw of source.toLowerCase().split(/[^a-z0-9]+/)) {
      // Numbers stay — "5lb" and "2024" are things people search for.
      if (raw.length < MIN_WORD || STOP_WORDS.has(raw)) continue;
      words.add(raw);
      if (words.size >= MAX_KEYWORDS) return [...words];
    }
  }

  return [...words];
}

/**
 * Normalize what someone typed into a single search term.
 *
 * Multi-word queries collapse to the longest word: `array-contains` matches one
 * value, and the longest word is the most specific thing they typed.
 */
export function normalizeSearchTerm(input: string): string | null {
  const words = input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= MIN_WORD && !STOP_WORDS.has(word));

  if (words.length === 0) return null;
  return words.reduce((longest, word) => (word.length > longest.length ? word : longest));
}

/**
 * Upper bound for a Firestore prefix query. U+F8FF sorts after any ordinary
 * character, so the range [term, prefixRangeEnd(term)] is every value starting
 * with `term`.
 */
export function prefixRangeEnd(term: string): string {
  return term + '\uf8ff';
}
