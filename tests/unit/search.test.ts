import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_KEYWORDS,
  extractKeywords,
  normalizeSearchTerm,
  prefixRangeEnd,
} from '../../src/lib/search.ts';

test('pulls the searchable words out of a caption', () => {
  const keywords = extractKeywords('Caught a big largemouth on a Coop jig!');
  assert.deepEqual(keywords.sort(), ['big', 'caught', 'coop', 'jig', 'largemouth'].sort());
});

test('lowercases and strips punctuation so search terms match', () => {
  assert.ok(extractKeywords("PIKE!!! -- Northern's").includes('pike'));
  assert.ok(extractKeywords("PIKE!!! -- Northern's").includes('northern'));
});

test('drops stop words and words shorter than three characters', () => {
  const keywords = extractKeywords('I was out on the ice with my dad');
  for (const dropped of ['i', 'was', 'out', 'on', 'the', 'with', 'my']) {
    assert.ok(!keywords.includes(dropped), `expected "${dropped}" to be dropped`);
  }
  assert.ok(keywords.includes('ice'));
  assert.ok(keywords.includes('dad'));
});

test('keeps numbers — people search for weights and years', () => {
  const keywords = extractKeywords('5lb hog in 2024');
  assert.ok(keywords.includes('5lb'));
  assert.ok(keywords.includes('2024'));
});

test('de-duplicates, so a repeated word costs one array slot', () => {
  const keywords = extractKeywords('bass bass BASS Bass!');
  assert.deepEqual(keywords, ['bass']);
});

test('indexes every source it is given', () => {
  const keywords = extractKeywords('sunset session', 'Walleye', 'riverrat');
  assert.ok(keywords.includes('sunset'));
  assert.ok(keywords.includes('walleye'));
  assert.ok(keywords.includes('riverrat'));
});

test('ignores null and undefined sources', () => {
  assert.deepEqual(extractKeywords(null, undefined, ''), []);
  assert.deepEqual(extractKeywords(null, 'pike', undefined), ['pike']);
});

test('caps the keyword array so a wall of text cannot bloat the document', () => {
  const wall = Array.from({ length: 200 }, (_, index) => `word${index}`).join(' ');
  assert.equal(extractKeywords(wall).length, MAX_KEYWORDS);
});

test('normalizes a query to its most specific word', () => {
  // `array-contains` matches one value, so a multi-word query has to collapse.
  assert.equal(normalizeSearchTerm('big largemouth'), 'largemouth');
  assert.equal(normalizeSearchTerm('  PIKE  '), 'pike');
});

test('a query of only stop words has nothing to search for', () => {
  assert.equal(normalizeSearchTerm('the and with'), null);
  assert.equal(normalizeSearchTerm('a b c'), null);
  assert.equal(normalizeSearchTerm('   '), null);
});

test('a normalized query matches the keywords extracted from the same text', () => {
  // This is the property the whole feature rests on: what search normalizes a
  // query to has to be a value that `extractKeywords` would have stored.
  const caption = 'Nice smallmouth off the rocks';
  const keywords = extractKeywords(caption);
  const term = normalizeSearchTerm('smallmouth');
  assert.ok(term && keywords.includes(term));
});

test('the prefix range end sorts after any ordinary character', () => {
  const end = prefixRangeEnd('coop');
  assert.ok(end.startsWith('coop'));
  assert.ok('coopz' < end, 'expected "coopz" to fall inside the range');
  assert.ok('coop9' < end, 'expected "coop9" to fall inside the range');
  assert.ok(!('cooq' < end), 'expected "cooq" to fall outside the range');
});
