/**
 * Points and badges — the parts with no Firebase in them.
 *
 * Kept separate from `lib/db/rewards.ts` so the scoring table can be unit
 * tested directly, and so the awarding Cloud Function's copy of it can be
 * checked against this one.
 */

/** Which profile number a badge is earned against. */
export type BadgeMetric = 'postCount' | 'points' | 'followerCount' | 'fishLoggedCount';

/**
 * Why points were awarded. Stored on each ledger entry so a total can always
 * be explained rather than guessed at.
 */
export type PointsReason =
  | 'post_approved'
  | 'like_received'
  | 'review_written'
  | 'competition_entered'
  | 'competition_won'
  | 'admin_adjustment';

/**
 * What each action is worth.
 *
 * Duplicated in `functions/src/index.ts`, which is the side that actually
 * awards them — the app never writes points, so this copy exists only so the
 * "how points work" screen can explain the same numbers. If you change one,
 * change both; the values are asserted against each other in the unit tests.
 */
export const POINT_VALUES = {
  post_approved: 10,
  like_received: 1,
  review_written: 5,
  competition_entered: 5,
  competition_won: 100,
} as const;

/** Plain-English label for a ledger row. */
export function pointsReasonLabel(reason: PointsReason): string {
  switch (reason) {
    case 'post_approved':
      return 'Catch approved';
    case 'like_received':
      return 'Someone liked your catch';
    case 'review_written':
      return 'Wrote a review';
    case 'competition_entered':
      return 'Entered a challenge';
    case 'competition_won':
      return 'Won a challenge';
    case 'admin_adjustment':
      return 'Adjustment by Coop';
    default:
      return 'Points';
  }
}

export function badgeMetricLabel(metric: BadgeMetric): string {
  switch (metric) {
    case 'postCount':
      return 'catches posted';
    case 'points':
      return 'points';
    case 'followerCount':
      return 'followers';
    case 'fishLoggedCount':
      return 'fish logged';
    default:
      return metric;
  }
}

export type BadgeDraft = {
  id: string;
  title: string;
  description: string;
  icon: string;
  metric: BadgeMetric;
  threshold: number;
  order: number;
  published: boolean;
};

/**
 * A sensible starting set, offered as a one-tap seed in the admin screen.
 *
 * Not written on install: an empty badge list is a legitimate choice, and a
 * migration that invents content is the kind of thing that's hard to undo
 * once people have started earning them.
 */
export const STARTER_BADGES: BadgeDraft[] = [
  {
    id: 'first-catch',
    title: 'First Catch',
    description: 'Posted your first approved catch.',
    icon: 'fish',
    metric: 'postCount',
    threshold: 1,
    order: 10,
    published: true,
  },
  {
    id: 'ten-catches',
    title: 'Regular',
    description: 'Ten approved catches.',
    icon: 'fish',
    metric: 'postCount',
    threshold: 10,
    order: 20,
    published: true,
  },
  {
    id: 'fifty-catches',
    title: 'Serious Angler',
    description: 'Fifty approved catches.',
    icon: 'trophy',
    metric: 'postCount',
    threshold: 50,
    order: 30,
    published: true,
  },
  {
    id: 'hundred-points',
    title: 'On the Board',
    description: 'Earned 100 points.',
    icon: 'star',
    metric: 'points',
    threshold: 100,
    order: 40,
    published: true,
  },
  {
    id: 'thousand-points',
    title: 'Tackle Box Legend',
    description: 'Earned 1,000 points.',
    icon: 'star',
    metric: 'points',
    threshold: 1000,
    order: 50,
    published: true,
  },
  {
    id: 'ten-followers',
    title: 'Known Around Here',
    description: 'Ten anglers follow you.',
    icon: 'people',
    metric: 'followerCount',
    threshold: 10,
    order: 60,
    published: true,
  },
];
