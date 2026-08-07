import assert from 'node:assert/strict';
import test from 'node:test';

import {
  youtubeEmbedUrl,
  youtubeId,
  youtubeThumbnail,
  youtubeWatchUrl,
} from '../../src/lib/youtube.ts';

const ID = 'dQw4w9WgXcQ';

test('reads the id out of every link shape someone might paste', () => {
  const links = [
    `https://www.youtube.com/watch?v=${ID}`,
    `http://youtube.com/watch?v=${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `youtu.be/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `https://www.youtube.com/v/${ID}`,
  ];
  for (const link of links) {
    assert.equal(youtubeId(link), ID, `failed on ${link}`);
  }
});

test('survives the tracking junk on a Share link', () => {
  // This is what the YouTube app actually puts on the clipboard.
  assert.equal(youtubeId(`https://youtu.be/${ID}?si=abc123XYZ&t=42`), ID);
  assert.equal(youtubeId(`https://www.youtube.com/watch?v=${ID}&t=90s&ab_channel=Coop`), ID);
  assert.equal(youtubeId(`https://www.youtube.com/watch?app=desktop&v=${ID}`), ID);
});

test('accepts a bare id, since that is also a reasonable thing to paste', () => {
  assert.equal(youtubeId(ID), ID);
  assert.equal(youtubeId(`  ${ID}  `), ID);
});

test('rejects anything that is not a youtube video', () => {
  for (const input of [
    '',
    '   ',
    null,
    undefined,
    'https://example.com/watch?v=notreal',
    'https://vimeo.com/123456',
    'just some words',
    // 10 characters — a real id is exactly 11.
    'https://youtu.be/dQw4w9WgXc',
  ]) {
    assert.equal(youtubeId(input), null, `expected null for ${String(input)}`);
  }
});

test('a watch URL round-trips back to its id', () => {
  assert.equal(youtubeId(youtubeWatchUrl(ID)), ID);
  assert.equal(youtubeId(youtubeEmbedUrl(ID)), ID);
});

test('the embed uses the no-cookie domain and plays inline', () => {
  const url = youtubeEmbedUrl(ID);
  // The privacy page says we don't hand browsing to anyone; nocookie is what
  // makes that true for an embedded player that hasn't been started.
  assert.ok(url.startsWith('https://www.youtube-nocookie.com/embed/'));
  assert.ok(url.includes('playsinline=1'));
});

test('the thumbnail uses the size that exists for every video', () => {
  // maxresdefault 404s on older uploads; hqdefault never does.
  assert.equal(youtubeThumbnail(ID), `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
});
