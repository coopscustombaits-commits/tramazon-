/**
 * Automated pre-screening for catch captions.
 *
 * What this is, precisely: a rules-based text screen. It is **not** a model,
 * and it does not look at the photo. It exists to take the obvious cases off
 * Coop's queue — link spam, phone numbers, shouting, a short list of words he
 * doesn't want on the feed — so that human review is spent on the judgement
 * calls rather than on the traffic.
 *
 * Everything here is pure and dependency-free: the same function runs in the
 * Cloud Function that decides, and in the unit tests that check it. See
 * docs/ROADMAP.md for the upgrade path to a real vision/text model, which
 * slots in at the same point without changing any of the plumbing.
 */

/** What the screen thought was wrong. Stored on the post for an appeal. */
export type ModerationLabel =
  | 'link'
  | 'contact_info'
  | 'shouting'
  | 'blocked_word'
  | 'repetition'
  | 'empty';

export type ModerationVerdict = {
  /**
   * Confidence the text is fine, 0 to 1. Not a probability from a model — a
   * score built by subtracting from 1 as problems are found, which is enough
   * to sort "obviously fine" from "obviously not" from "look at this".
   */
  score: number;
  labels: ModerationLabel[];
};

/**
 * How the verdict is acted on.
 *
 *   >= AUTO_APPROVE  clean enough to publish without a human
 *   <= AUTO_REJECT   bad enough to refuse without a human
 *   between          left pending, which is where it would have been anyway
 *
 * Both ends are off by default in remote config. A wrong auto-reject is worse
 * than a slow queue, so this ships as a sorter, not a gatekeeper, and Coop can
 * turn each end on once he's watched it agree with him for a while.
 */
export const AUTO_APPROVE_AT = 0.95;
export const AUTO_REJECT_AT = 0.3;

/** Words that get a caption held back. Tunable from `config/moderation`. */
export const DEFAULT_BLOCKED_WORDS = [
  'scam',
  'onlyfans',
  'crypto',
  'bitcoin',
  'viagra',
  'casino',
  'porn',
];

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|shop|xyz|link)\b)/i;
/** Loose on purpose: a false positive here only means a human looks at it. */
const PHONE = /(\+?\d[\d\s().-]{7,}\d)/;
const EMAIL = /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/i;
/** The same character four or more times: "niiiiice", "!!!!!". */
const REPEATED_CHARS = /(.)\1{3,}/;

/**
 * Screen one caption.
 *
 * `blockedWords` is a parameter rather than a constant so the list can live in
 * Firestore and be tuned without a deploy — the same reasoning as badges.
 */
export function screenText(
  input: string | null | undefined,
  blockedWords: string[] = DEFAULT_BLOCKED_WORDS,
): ModerationVerdict {
  const text = (input ?? '').trim();
  const labels: ModerationLabel[] = [];
  let score = 1;

  // An empty caption isn't a problem — plenty of good catches have none — so
  // it scores clean but is labelled, because it also means there's nothing
  // here to judge. The photo still needs a human.
  if (!text) {
    return { score: 1, labels: ['empty'] };
  }

  const lower = text.toLowerCase();

  if (LINK.test(text)) {
    labels.push('link');
    score -= 0.5;
  }

  if (PHONE.test(text) || EMAIL.test(text)) {
    labels.push('contact_info');
    score -= 0.4;
  }

  // Shouting: mostly capitals, and long enough that it isn't just "PB!!".
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 12) {
    const capitals = text.replace(/[^A-Z]/g, '').length;
    if (capitals / letters.length > 0.7) {
      labels.push('shouting');
      score -= 0.15;
    }
  }

  const hit = blockedWords.find((word) => {
    const clean = word.trim().toLowerCase();
    return clean.length > 0 && blockedWordPattern(clean).test(lower);
  });
  if (hit) {
    labels.push('blocked_word');
    score -= 0.6;
  }

  if (REPEATED_CHARS.test(text)) {
    labels.push('repetition');
    score -= 0.05;
  }

  return { score: clamp(score), labels };
}

/** What to do with a verdict, given which ends Coop has switched on. */
export type ModerationAction = 'approve' | 'reject' | 'review';

export function decide(
  verdict: ModerationVerdict,
  options: { autoApprove: boolean; autoReject: boolean },
): ModerationAction {
  if (options.autoReject && verdict.score <= AUTO_REJECT_AT) return 'reject';
  if (options.autoApprove && verdict.score >= AUTO_APPROVE_AT) return 'approve';
  return 'review';
}

/** Plain-English reason, for the note on an auto-rejected post. */
export function labelReason(label: ModerationLabel): string {
  switch (label) {
    case 'link':
      return 'it contained a link';
    case 'contact_info':
      return 'it contained a phone number or email address';
    case 'shouting':
      return 'it was written in capitals';
    case 'blocked_word':
      return 'it used a word Coop has blocked';
    case 'repetition':
      return 'it had repeated characters';
    case 'empty':
      return 'it had no caption';
    default:
      return 'it was flagged automatically';
  }
}

function clamp(value: number): number {
  // Rounded so the stored score is the one the dashboard shows.
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

/**
 * Match a blocked word as a whole word — but only anchor where anchoring can
 * work.
 *
 * `\b` marks a transition between a word character and a non-word one, so
 * `\bc\+\+\b` can never match: `+` isn't a word character, and there's nothing
 * on the far side of it to transition from. Anchoring only the ends that
 * actually start or finish with a letter keeps the Scunthorpe protection for
 * ordinary words ("scam" won't match "scampi") while still letting a term with
 * punctuation in it work at all.
 */
function blockedWordPattern(word: string): RegExp {
  const left = /^\w/.test(word) ? '\\b' : '';
  const right = /\w$/.test(word) ? '\\b' : '';
  return new RegExp(`${left}${escapeRegExp(word)}${right}`, 'i');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
