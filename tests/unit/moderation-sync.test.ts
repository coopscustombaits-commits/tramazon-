import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * The moderation screen exists twice: once in `src/lib` for the app, once in
 * `functions/src` for the Cloud Function that actually decides. The two
 * directories are separate npm packages with separate builds, so neither can
 * import from the other.
 *
 * This test is what stops them drifting. It compares everything from the first
 * export onward — the header comments differ on purpose, the logic must not.
 */
function logicOf(path: string): string {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const start = source.indexOf('export type ModerationLabel');
  assert.notEqual(start, -1, `could not find the first export in ${path}`);
  return source.slice(start);
}

test('the app and the Cloud Function run the same moderation screen', () => {
  assert.equal(
    logicOf('../../functions/src/moderation.ts'),
    logicOf('../../src/lib/moderation.ts'),
    'functions/src/moderation.ts has drifted from src/lib/moderation.ts — copy one over the other',
  );
});
