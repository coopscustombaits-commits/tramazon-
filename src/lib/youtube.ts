/**
 * YouTube links.
 *
 * We store the video id, never a URL. A URL comes in a dozen shapes
 * (`youtu.be/ID`, `youtube.com/watch?v=ID&t=30`, `/shorts/ID`, `/embed/ID`,
 * a Share link with tracking parameters) and every one of them has to become
 * the same eleven characters before it's useful — so that conversion happens
 * once, at the point where Coop pastes it, rather than on every render.
 *
 * Pure and dependency-free so it can be unit tested directly.
 */

/** YouTube ids are exactly 11 characters of base64url. */
const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * Pull the video id out of anything someone might paste — a full URL, a share
 * link, or the bare id itself. Null if there isn't one in there.
 */
export function youtubeId(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Already an id.
  if (ID_PATTERN.test(trimmed)) return trimmed;

  // Any of the URL shapes: the id is the last path segment, or the `v` query
  // parameter. Matching on the surrounding markers rather than parsing the URL
  // keeps this working for the forms that aren't valid URLs (a bare
  // `youtu.be/ID` with no scheme, which is what a copied link often is).
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(trimmed);
    if (match) return match[1];
  }

  return null;
}

/**
 * Poster frame for a video. `hqdefault` exists for every video; the higher
 * resolutions don't, and a missing one serves a grey placeholder rather than
 * a 404, which is worse than just using the size that always works.
 */
export function youtubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/**
 * Embed URL for in-app playback.
 *
 * `youtube-nocookie.com` is YouTube's no-tracking-until-play domain — the
 * right default when the app's privacy page says we don't hand your browsing
 * to anyone. `playsinline=1` stops iOS from hijacking the whole screen.
 */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0&modestbranding=1`;
}

/** Where to send someone who'd rather watch it in the YouTube app. */
export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}
