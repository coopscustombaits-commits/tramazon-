import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUTO_APPROVE_AT,
  AUTO_REJECT_AT,
  DEFAULT_BLOCKED_WORDS,
  decide,
  labelReason,
  screenText,
} from '../../src/lib/moderation.ts';

test('an ordinary catch caption comes back clean', () => {
  const verdict = screenText('Nice smallmouth off the rocks this morning, took a ned rig.');
  assert.deepEqual(verdict.labels, []);
  assert.equal(verdict.score, 1);
});

test('links are caught in every shape someone would post one', () => {
  for (const caption of [
    'Check https://example.com for more',
    'go to www.spam.net',
    'best deals at cheapbaits.shop',
  ]) {
    assert.ok(screenText(caption).labels.includes('link'), caption);
  }
});

test('phone numbers and emails are caught', () => {
  assert.ok(screenText('text me on 555 123 4567').labels.includes('contact_info'));
  assert.ok(screenText('email me at guy@example.com').labels.includes('contact_info'));
});

test('a fish measurement is not mistaken for a phone number', () => {
  // The phone pattern needs eight-plus digits; "24 inches, 6.5 lb" has to pass.
  const verdict = screenText('24 inches, 6.5 lb, caught at 6:30am');
  assert.ok(!verdict.labels.includes('contact_info'), JSON.stringify(verdict));
});

test('shouting is caught, but a short excited caption is not', () => {
  assert.ok(screenText('THIS IS THE BIGGEST BASS EVER').labels.includes('shouting'));
  // "PB!!" and similar are how people actually write about a personal best.
  assert.ok(!screenText('PB!!').labels.includes('shouting'));
  assert.ok(!screenText('New PB today').labels.includes('shouting'));
});

test('blocked words match whole words only', () => {
  assert.ok(screenText('this is a scam').labels.includes('blocked_word'));
  // The Scunthorpe problem: substring matching makes innocent words unpostable.
  assert.ok(!screenText('scampi for lunch after').labels.includes('blocked_word'));
});

test('the blocked list is a parameter, so it can be tuned without a deploy', () => {
  assert.ok(!screenText('caught a musky').labels.includes('blocked_word'));
  assert.ok(screenText('caught a musky', ['musky']).labels.includes('blocked_word'));
  // An empty list disables the check rather than blocking everything.
  assert.ok(!screenText('this is a scam', []).labels.includes('blocked_word'));
});

test('a blocked word containing regex characters does not break the screen', () => {
  // A list is edited by hand, so it will eventually contain a "." or a "*".
  assert.doesNotThrow(() => screenText('anything at all', ['c++', 'a.b', '*']));
  assert.ok(screenText('I love c++', ['c++']).labels.includes('blocked_word'));
});

test('an empty caption is clean but labelled, because there is nothing to judge', () => {
  const verdict = screenText('');
  assert.equal(verdict.score, 1);
  assert.deepEqual(verdict.labels, ['empty']);
  assert.deepEqual(screenText(null).labels, ['empty']);
  assert.deepEqual(screenText('   ').labels, ['empty']);
});

test('scores stay inside 0 and 1 no matter how much is wrong', () => {
  const awful = screenText('SCAM CRYPTO www.bad.xyz call 555 123 4567 nowwwww');
  assert.ok(awful.score >= 0 && awful.score <= 1);
  assert.ok(awful.score < AUTO_REJECT_AT, `expected a rejectable score, got ${awful.score}`);
});

test('the two ends are off unless switched on', () => {
  const clean = screenText('Nice bass');
  const awful = screenText('SCAM CRYPTO www.bad.xyz call 555 123 4567');

  // Shipping as a sorter, not a gatekeeper: with both off, everything is
  // exactly where it would have been without any of this.
  assert.equal(decide(clean, { autoApprove: false, autoReject: false }), 'review');
  assert.equal(decide(awful, { autoApprove: false, autoReject: false }), 'review');

  assert.equal(decide(clean, { autoApprove: true, autoReject: false }), 'approve');
  assert.equal(decide(awful, { autoApprove: false, autoReject: true }), 'reject');
});

test('a middling caption is left for a human even with both ends on', () => {
  // One soft flag shouldn't be enough to decide either way — that's the whole
  // point of having a band in the middle.
  const middling = screenText('CAUGHT A GIANT ONE TODAY BOYS');
  const action = decide(middling, { autoApprove: true, autoReject: true });
  assert.equal(action, 'review');
  assert.ok(middling.score < AUTO_APPROVE_AT && middling.score > AUTO_REJECT_AT);
});

test('an empty caption is never auto-approved into the feed', () => {
  // It scores clean, but the photo is the whole post and nothing has looked
  // at that. A human still decides.
  const verdict = screenText('');
  assert.equal(verdict.score, 1);
  assert.ok(verdict.labels.includes('empty'));
});

test('every label has a reason that reads as a sentence', () => {
  const labels = [
    'link',
    'contact_info',
    'shouting',
    'blocked_word',
    'repetition',
    'empty',
  ] as const;
  for (const label of labels) {
    const reason = labelReason(label);
    assert.ok(reason.length > 0);
    assert.ok(!reason.includes('_'), `"${reason}" looks like a raw key`);
  }
});

test('the default blocked list is lowercase and free of duplicates', () => {
  const seen = new Set<string>();
  for (const word of DEFAULT_BLOCKED_WORDS) {
    assert.equal(word, word.toLowerCase(), `${word} should be lowercase`);
    assert.ok(!seen.has(word), `duplicate: ${word}`);
    seen.add(word);
  }
});
