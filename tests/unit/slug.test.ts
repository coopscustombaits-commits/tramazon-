import assert from 'node:assert/strict';
import test from 'node:test';

import { labelFromSlug, slugify } from '../../src/lib/slug.ts';

test('normalizes the ways people type the same name', () => {
  // This is the whole point: three spellings, one bait.
  for (const spelling of ['Chatterbait', 'chatterbait', 'CHATTERBAIT', '  Chatterbait  ']) {
    assert.equal(slugify(spelling), 'chatterbait');
  }
});

test('collapses punctuation and spaces to single hyphens', () => {
  assert.equal(slugify('Ned rig'), 'ned-rig');
  assert.equal(slugify('Zoom  Super   Fluke'), 'zoom-super-fluke');
  assert.equal(slugify("Coop's Deep-Diver!"), 'coop-s-deep-diver');
});

test('keeps digits — bait names have them', () => {
  assert.equal(slugify('Rapala DT6'), 'rapala-dt6');
});

test('never leaves a leading or trailing hyphen', () => {
  assert.equal(slugify('!!! Jig !!!'), 'jig');
  assert.equal(slugify('---spinner---'), 'spinner');
});

test('returns null when there is nothing left to key on', () => {
  // A slug of "" would be an invalid Firestore document id, so this has to be
  // null rather than an empty string.
  assert.equal(slugify(''), null);
  assert.equal(slugify('   '), null);
  assert.equal(slugify('!!!'), null);
  assert.equal(slugify(null), null);
  assert.equal(slugify(undefined), null);
});

test('turns a slug back into something readable', () => {
  assert.equal(labelFromSlug('largemouth-bass'), 'Largemouth Bass');
  assert.equal(labelFromSlug('ned-rig'), 'Ned Rig');
  assert.equal(labelFromSlug('jig'), 'Jig');
});

test('round-trips a simple name through slug and back', () => {
  const slug = slugify('Ned Rig');
  assert.ok(slug);
  assert.equal(labelFromSlug(slug), 'Ned Rig');
});
