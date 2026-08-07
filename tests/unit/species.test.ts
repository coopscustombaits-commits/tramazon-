import assert from 'node:assert/strict';
import test from 'node:test';

import { speciesLabel, speciesSlug } from '../../src/lib/species.ts';

test('normalizes however an angler typed the species', () => {
  // These all have to land in the same Phase 2 species hub.
  for (const input of ['Largemouth Bass', 'largemouth bass', 'LARGEMOUTH  BASS', ' Largemouth-Bass ']) {
    assert.equal(speciesSlug(input), 'largemouth-bass', `failed on "${input}"`);
  }
});

test('drops punctuation rather than encoding it into the slug', () => {
  assert.equal(speciesSlug("Coop's Crappie!"), 'coop-s-crappie');
  assert.equal(speciesSlug('Northern Pike (Esox)'), 'northern-pike-esox');
});

test('treats empty and junk input as no species', () => {
  assert.equal(speciesSlug(''), null);
  assert.equal(speciesSlug('   '), null);
  assert.equal(speciesSlug('!!!'), null);
  assert.equal(speciesSlug(null), null);
  assert.equal(speciesSlug(undefined), null);
});

test('turns a slug back into a display label', () => {
  assert.equal(speciesLabel('largemouth-bass'), 'Largemouth Bass');
  assert.equal(speciesLabel('pike'), 'Pike');
});
