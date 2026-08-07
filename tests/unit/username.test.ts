import assert from 'node:assert/strict';
import test from 'node:test';

import { suggestUsername, validateUsername } from '../../src/lib/username.ts';

test('accepts ordinary usernames', () => {
  for (const name of ['riverrat', 'Bass_Master99', 'abc', 'a'.repeat(20)]) {
    assert.equal(validateUsername(name), null, `expected "${name}" to be valid`);
  }
});

test('rejects names that are too short or too long', () => {
  assert.ok(validateUsername('ab'));
  assert.ok(validateUsername('a'.repeat(21)));
});

test('rejects characters that would break the lowercase mirror', () => {
  // `usernameLower` has to be a pure lowercase of `username` for the security
  // rules to accept the profile, so anything exotic is refused up front.
  for (const name of ['river rat', 'river-rat', 'river.rat', 'rivér', 'river@rat', '🎣🎣🎣']) {
    assert.ok(validateUsername(name), `expected "${name}" to be rejected`);
  }
});

test('trims before measuring, so padding does not sneak past the length check', () => {
  assert.equal(validateUsername('  bassguy  '), null);
  assert.ok(validateUsername('  ab  '));
});

test('reserves names that would impersonate the shop or its staff', () => {
  for (const name of ['admin', 'Coop', 'COOPS', 'support', 'staff']) {
    assert.ok(validateUsername(name), `expected "${name}" to be reserved`);
  }
});

test('suggests a username from an email address', () => {
  assert.equal(suggestUsername('bassguy@example.com'), 'bassguy');
});

test('suggests a username from a display name', () => {
  assert.equal(suggestUsername('Coop Anderson'), 'coopanderson');
});

test('never suggests something the form would then reject', () => {
  // Google and Apple hand us a name or email we don't control. Anything that
  // comes back must survive validateUsername, or the user lands on the setup
  // screen with a prefilled value that refuses to submit.
  const awkward = [
    'coopscustombaits@gmail.com', // reserved
    'admin@example.com', // reserved
    'ab@example.com', // too short
    'a-very-long-name-that-goes-well-past-twenty@example.com', // too long
    '🎣@example.com', // nothing usable left
    '',
    null,
    undefined,
  ];

  for (const source of awkward) {
    const suggestion = suggestUsername(source);
    assert.equal(
      validateUsername(suggestion),
      null,
      `suggestion "${suggestion}" from ${JSON.stringify(source)} is not valid`,
    );
  }
});
