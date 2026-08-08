import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger, setGlobalOptions } from 'firebase-functions';
import {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentUpdated,
} from 'firebase-functions/v2/firestore';

import { adminUids, notifyUser, sendPush, tokensForUser, wantsNotification } from './push';

/**
 * Cloud Functions for Coop's Custom Baits.
 *
 * Two jobs:
 *
 *   1. Push notifications — Coop when a catch needs review, the angler when
 *      theirs is approved, and authors when someone likes or comments.
 *   2. Counters. `likeCount`, `commentCount`, and `postCount` are written
 *      here, using the Admin SDK, which bypasses security rules. Clients are
 *      denied those fields entirely, so the numbers can't be faked.
 *
 * Deploy with `npm --prefix functions run deploy`.
 */

initializeApp();

setGlobalOptions({
  // Keep this in the same region as Firestore (chosen when the database was
  // created) so triggers don't cross regions on every write.
  region: 'us-central1',
  maxInstances: 10,
});

const db = () => getFirestore();

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

/** A new catch was submitted — tell the admins it needs review. */
export const onPostSubmitted = onDocumentCreated('posts/{postId}', async (event) => {
  const post = event.data?.data();
  if (!post || post.status !== 'pending') return;

  // Before the admin check below — a competition entry still counts even if
  // nobody is configured to be notified about it.
  await bumpEntryCounts(post, 1);
  await awardEntryPoints(post);
  await bumpStats({ postCount: 1, pendingPostCount: 1 });

  const admins = await adminUids();
  if (admins.length === 0) {
    logger.warn('A post needs review but no admins are configured', {
      postId: event.params.postId,
      hint: 'Create an admins/{uid} document — see docs/SETUP.md §3.',
    });
    return;
  }

  const username = post.author?.username ?? 'Someone';
  const caption = typeof post.caption === 'string' ? post.caption.trim() : '';

  await Promise.all(
    admins.map((uid) =>
      notifyUser(uid, {
        type: 'post_needs_review',
        title: 'New catch to review',
        body: caption
          ? `${username}: ${caption.slice(0, 120)}`
          : `${username} posted a catch.`,
        href: '/admin/review',
        data: { postId: event.params.postId },
      }),
    ),
  );
});

/**
 * A post was reviewed. On approval, tell the author and bump their catch
 * count. Rejections are silent by design — the post just leaves the queue.
 */
export const onPostReviewed = onDocumentUpdated('posts/{postId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  if (before.status === after.status) return;

  const { postId } = event.params;

  if (after.status === 'approved') {
    await db()
      .doc(`users/${after.authorId}`)
      .update({ postCount: FieldValue.increment(1), updatedAt: new Date() })
      .catch((error) => logger.warn('Could not bump postCount', { error }));

    await notifyUser(after.authorId, {
      type: 'post_approved',
      title: 'Your catch is live',
      body: 'Coop approved your catch — it’s in the feed now.',
      href: `/post/${postId}`,
      data: { postId },
      preference: 'postApproved',
    });

    await awardPoints(after.authorId, 'post_approved', POINT_VALUES.post_approved, postId);
    await bumpStats({
      approvedPostCount: 1,
      // Whatever it was before, it has left the queue now.
      pendingPostCount: before.status === 'pending' ? -1 : 0,
    });
    return;
  }

  // An approved post that was later rejected or taken down: undo the count,
  // and take the points back with it. Points that survive their reason are
  // how a leaderboard stops meaning anything.
  if (before.status === 'approved' && after.status !== 'approved') {
    await db()
      .doc(`users/${after.authorId}`)
      .update({ postCount: FieldValue.increment(-1), updatedAt: new Date() })
      .catch((error) => logger.warn('Could not lower postCount', { error }));

    await revokePoints(after.authorId, 'post_approved', postId);
    await bumpStats({ approvedPostCount: -1 });
  } else if (before.status === 'pending') {
    // pending -> rejected: out of the queue, never counted as approved.
    await bumpStats({ pendingPostCount: -1 });
  }
});

/** Clean up after a deleted post: its photo, likes, and comments. */
export const onPostDeleted = onDocumentDeleted('posts/{postId}', async (event) => {
  const post = event.data?.data();
  if (!post) return;

  const { postId } = event.params;

  await bumpEntryCounts(post, -1);
  await bumpStats({
    postCount: -1,
    approvedPostCount: post.status === 'approved' ? -1 : 0,
    pendingPostCount: post.status === 'pending' ? -1 : 0,
  });

  if (post.status === 'approved' && post.authorId) {
    await db()
      .doc(`users/${post.authorId}`)
      .update({ postCount: FieldValue.increment(-1), updatedAt: new Date() })
      .catch(() => undefined);
  }

  // A video post has two files: the clip and its poster frame.
  const storagePaths: string[] = [
    post.media?.storagePath,
    post.media?.thumbnailStoragePath,
  ].filter((path): path is string => typeof path === 'string');

  await Promise.all([
    deleteCollection(`posts/${postId}/likes`),
    deleteCollection(`posts/${postId}/comments`),
    ...storagePaths.map((path) =>
      getStorage().bucket().file(path).delete().catch(() => undefined),
    ),
  ]);
});

/**
 * Keep `entryCount` on a challenge or tournament in step with the posts that
 * reference it.
 *
 * Counted at submission rather than at approval, so the number reads as "how
 * many people entered" — which is what an angler deciding whether to bother
 * wants to know, and doesn't stall behind Coop's review queue.
 */
async function bumpEntryCounts(
  post: FirebaseFirestore.DocumentData,
  delta: number,
): Promise<void> {
  const targets: [string, unknown][] = [
    ['challenges', post.challengeId],
    ['tournaments', post.tournamentId],
  ];

  await Promise.all(
    targets
      .filter(([, id]) => typeof id === 'string' && id.length > 0)
      .map(([root, id]) =>
        db()
          .doc(`${root}/${id as string}`)
          .update({ entryCount: FieldValue.increment(delta), updatedAt: new Date() })
          // A deleted competition is not a reason to fail the post.
          .catch((error) => logger.warn('Could not update entryCount', { error, root })),
      ),
  );
}

/**
 * Points for entering a competition.
 *
 * Awarded per competition, not per post: the key is the competition id, so
 * posting ten catches into one challenge pays the entry bonus once. Turning up
 * is what's being rewarded, not volume — volume already earns per-post points.
 */
async function awardEntryPoints(post: FirebaseFirestore.DocumentData): Promise<void> {
  if (!post.authorId) return;

  for (const id of [post.challengeId, post.tournamentId]) {
    if (typeof id === 'string' && id.length > 0) {
      await awardPoints(
        post.authorId,
        'competition_entered',
        POINT_VALUES.competition_entered,
        id,
      );
    }
  }
}

/**
 * A winner was declared: pay out, and take it back if the pick changes.
 *
 * Watching for the change rather than trusting the client is the point —
 * `winnerUid` is admin-only in the rules, and this is what turns that decision
 * into points nobody could have awarded themselves.
 *
 * Registered once per collection rather than as a `{root}/{id}` wildcard: that
 * pattern matches every top-level document in the database, so it would wake
 * on every post, user, and message write to discover it had nothing to do.
 */
function winnerTrigger(root: 'challenges' | 'tournaments') {
  const kind = root === 'challenges' ? 'challenge' : 'tournament';

  return onDocumentUpdated(`${root}/{competitionId}`, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.winnerUid === after.winnerUid) return;

    const { competitionId } = event.params;

    if (before.winnerUid) {
      await revokePoints(before.winnerUid, 'competition_won', competitionId);
    }
    if (after.winnerUid) {
      await awardPoints(
        after.winnerUid,
        'competition_won',
        POINT_VALUES.competition_won,
        competitionId,
      );
      await notifyUser(after.winnerUid, {
        type: 'badge_earned',
        title: 'You won!',
        body: `Coop picked your catch to win “${after.title ?? 'the challenge'}”.`,
        href: `/compete/${competitionId}?kind=${kind}`,
        data: { competitionId, kind },
      });
    }
  });
}

export const onChallengeWinnerSet = winnerTrigger('challenges');
export const onTournamentWinnerSet = winnerTrigger('tournaments');

// ---------------------------------------------------------------------------
// Likes and comments
// ---------------------------------------------------------------------------

export const onLikeCreated = onDocumentCreated(
  'posts/{postId}/likes/{likerId}',
  async (event) => {
    const { postId, likerId } = event.params;

    await db()
      .doc(`posts/${postId}`)
      .update({ likeCount: FieldValue.increment(1) })
      .catch((error) => logger.warn('Could not bump likeCount', { error }));

    const post = await db().doc(`posts/${postId}`).get();
    const authorId = post.get('authorId') as string | undefined;
    // Nobody needs a notification about liking their own catch.
    if (!authorId || authorId === likerId) return;

    const liker = await db().doc(`users/${likerId}`).get();
    await notifyUser(authorId, {
      type: 'post_liked',
      title: 'Someone liked your catch',
      body: `${liker.get('username') ?? 'An angler'} liked your catch.`,
      href: `/post/${postId}`,
      data: { postId },
      preference: 'postLiked',
    });

    // Keyed on the liker, so unliking and re-liking can't farm points.
    await awardPoints(authorId, 'like_received', POINT_VALUES.like_received, `${postId}_${likerId}`);
  },
);

export const onLikeDeleted = onDocumentDeleted(
  'posts/{postId}/likes/{likerId}',
  async (event) => {
    const { postId, likerId } = event.params;

    await db()
      .doc(`posts/${postId}`)
      .update({ likeCount: FieldValue.increment(-1) })
      .catch(() => undefined);

    const post = await db().doc(`posts/${postId}`).get();
    const authorId = post.get('authorId') as string | undefined;
    if (authorId) {
      await revokePoints(authorId, 'like_received', `${postId}_${likerId}`);
    }
  },
);

export const onCommentCreated = onDocumentCreated(
  'posts/{postId}/comments/{commentId}',
  async (event) => {
    const comment = event.data?.data();
    if (!comment) return;

    const { postId } = event.params;

    await db()
      .doc(`posts/${postId}`)
      .update({ commentCount: FieldValue.increment(1) })
      .catch((error) => logger.warn('Could not bump commentCount', { error }));

    const post = await db().doc(`posts/${postId}`).get();
    const authorId = post.get('authorId') as string | undefined;
    if (!authorId || authorId === comment.authorId) return;

    const text = typeof comment.text === 'string' ? comment.text : '';
    await notifyUser(authorId, {
      type: 'post_commented',
      title: 'New comment on your catch',
      body: `${comment.author?.username ?? 'An angler'}: ${text.slice(0, 120)}`,
      href: `/post/${postId}`,
      data: { postId },
      preference: 'postCommented',
    });
  },
);

export const onCommentDeleted = onDocumentDeleted(
  'posts/{postId}/comments/{commentId}',
  async (event) => {
    await db()
      .doc(`posts/${event.params.postId}`)
      .update({ commentCount: FieldValue.increment(-1) })
      .catch(() => undefined);
  },
);

// ---------------------------------------------------------------------------
// Following
// ---------------------------------------------------------------------------

export const onFollowCreated = onDocumentCreated('follows/{edgeId}', async (event) => {
  const edge = event.data?.data();
  if (!edge?.followerId || !edge?.followingId) return;

  await Promise.all([
    db()
      .doc(`users/${edge.followerId}`)
      .update({ followingCount: FieldValue.increment(1), updatedAt: new Date() })
      .catch((error) => logger.warn('Could not bump followingCount', { error })),
    db()
      .doc(`users/${edge.followingId}`)
      .update({ followerCount: FieldValue.increment(1), updatedAt: new Date() })
      .catch((error) => logger.warn('Could not bump followerCount', { error })),
  ]);

  const follower = await db().doc(`users/${edge.followerId}`).get();
  await notifyUser(edge.followingId, {
    type: 'new_follower',
    title: 'New follower',
    body: `${follower.get('username') ?? 'An angler'} started following you.`,
    href: `/user/${edge.followerId}`,
    data: { followerId: edge.followerId },
    preference: 'newFollower',
  });
});

export const onFollowDeleted = onDocumentDeleted('follows/{edgeId}', async (event) => {
  const edge = event.data?.data();
  if (!edge?.followerId || !edge?.followingId) return;

  await Promise.all([
    db()
      .doc(`users/${edge.followerId}`)
      .update({ followingCount: FieldValue.increment(-1), updatedAt: new Date() })
      .catch(() => undefined),
    db()
      .doc(`users/${edge.followingId}`)
      .update({ followerCount: FieldValue.increment(-1), updatedAt: new Date() })
      .catch(() => undefined),
  ]);
});

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------

/**
 * Move one or more running totals on `stats/global`.
 *
 * Counting on demand would cost a document read per user and per post every
 * time the dashboard opens. An incremented total costs one read, and these
 * numbers are only ever approximate-by-a-moment anyway.
 *
 * `set` with merge rather than `update`, because the document doesn't exist
 * until the first thing is counted, and a brand-new project shouldn't need a
 * seeding step.
 */
async function bumpStats(deltas: Record<string, number>): Promise<void> {
  const payload: Record<string, FieldValue | Date | number> = { updatedAt: new Date() };
  for (const [field, delta] of Object.entries(deltas)) {
    if (delta !== 0) payload[field] = FieldValue.increment(delta);
  }

  await db()
    .doc('stats/global')
    .set({ schemaVersion: 1, ...payload }, { merge: true })
    .catch((error) => logger.warn('Could not update stats', { error }));
}

export const onUserCreatedStats = onDocumentCreated('users/{uid}', async () => {
  await bumpStats({ userCount: 1 });
});

// ---------------------------------------------------------------------------
// Points and badges
// ---------------------------------------------------------------------------

/**
 * What each action is worth.
 *
 * Mirrored in `src/lib/db/rewards.ts` so the app can explain the scoring. This
 * copy is the one that pays out; a unit test asserts the two agree.
 */
const POINT_VALUES = {
  post_approved: 10,
  like_received: 1,
  review_written: 5,
  competition_entered: 5,
  competition_won: 100,
} as const;

type PointsReason = keyof typeof POINT_VALUES | 'admin_adjustment';

/**
 * Award (or claw back) points.
 *
 * Two writes in a transaction: a ledger entry, and the running total on the
 * profile. The ledger is what makes a total explainable — "where did my 240
 * points come from" has an answer, and a bad rule can be reversed with a
 * negative entry rather than by editing a number nobody can check.
 *
 * `sourceId` doubles as an idempotency key. Firestore triggers are
 * at-least-once, so without it a retried delivery would pay out twice; the
 * deterministic document id makes a repeat a no-op instead.
 */
async function awardPoints(
  uid: string,
  reason: PointsReason,
  amount: number,
  sourceId: string | null,
): Promise<void> {
  if (!uid || amount === 0) return;

  // `${reason}_${sourceId}` rather than a random id: the same source paying
  // out twice is the failure mode this prevents.
  const entryId = sourceId ? `${reason}__${sourceId}` : null;
  const ledger = db().collection(`users/${uid}/pointsLedger`);
  const entryRef = entryId ? ledger.doc(entryId) : ledger.doc();

  await db()
    .runTransaction(async (tx) => {
      const existing = await tx.get(entryRef);
      if (existing.exists) return;

      tx.set(entryRef, {
        schemaVersion: 1,
        amount,
        reason,
        sourceId,
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      tx.update(db().doc(`users/${uid}`), {
        points: FieldValue.increment(amount),
        updatedAt: new Date(),
      });
    })
    .catch((error) => logger.warn('Could not award points', { error, uid, reason }));
}

/**
 * Reverse an award, by source. Used when the thing that earned it goes away —
 * a post that gets taken down shouldn't leave its points behind.
 */
async function revokePoints(
  uid: string,
  reason: PointsReason,
  sourceId: string,
): Promise<void> {
  if (!uid || !sourceId) return;
  const entryRef = db().doc(`users/${uid}/pointsLedger/${reason}__${sourceId}`);

  await db()
    .runTransaction(async (tx) => {
      const entry = await tx.get(entryRef);
      if (!entry.exists) return;

      const amount = (entry.get('amount') as number | undefined) ?? 0;
      tx.delete(entryRef);
      tx.update(db().doc(`users/${uid}`), {
        points: FieldValue.increment(-amount),
        updatedAt: new Date(),
      });
    })
    .catch((error) => logger.warn('Could not revoke points', { error, uid, reason }));
}

/**
 * An admin filed a manual adjustment: fold it into the running total.
 *
 * The rules let an admin write a ledger entry but deny everyone the `points`
 * field, so this is what makes a hand adjustment actually land — and it goes
 * through the same ledger as everything else.
 */
export const onPointsEntryCreated = onDocumentCreated(
  'users/{uid}/pointsLedger/{entryId}',
  async (event) => {
    const entry = event.data?.data();
    // Everything except an admin adjustment was written by `awardPoints`,
    // which already moved the total inside its transaction.
    if (!entry || entry.reason !== 'admin_adjustment') return;

    const amount = typeof entry.amount === 'number' ? entry.amount : 0;
    if (amount === 0) return;

    await db()
      .doc(`users/${event.params.uid}`)
      .update({ points: FieldValue.increment(amount), updatedAt: new Date() })
      .catch((error) => logger.warn('Could not apply adjustment', { error }));
  },
);

/**
 * Award any badge whose threshold this profile has just crossed.
 *
 * Runs on every profile update, which is also every time a counter moves — so
 * badges land without a scheduled job. The award document id is the badge id,
 * so awarding twice is a no-op rather than a duplicate.
 */
async function checkBadges(
  uid: string,
  profile: FirebaseFirestore.DocumentData,
): Promise<void> {
  const badges = await db()
    .collection('badges')
    .where('published', '==', true)
    .get()
    .catch(() => null);
  if (!badges || badges.empty) return;

  const earned = badges.docs.filter((badge) => {
    const metric = badge.get('metric') as string | undefined;
    const threshold = badge.get('threshold') as number | undefined;
    if (!metric || typeof threshold !== 'number') return false;
    const value = profile[metric];
    return typeof value === 'number' && value >= threshold;
  });

  for (const badge of earned) {
    const awardRef = db().doc(`users/${uid}/badges/${badge.id}`);
    const existing = await awardRef.get();
    if (existing.exists) continue;

    await awardRef.set({
      schemaVersion: 1,
      title: badge.get('title') ?? badge.id,
      description: badge.get('description') ?? '',
      icon: badge.get('icon') ?? 'ribbon',
      awardedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await notifyUser(uid, {
      type: 'badge_earned',
      title: 'Badge earned',
      body: `You earned “${badge.get('title') ?? badge.id}”.`,
      href: '/(tabs)/profile',
      data: { badgeId: badge.id },
    });
  }
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

/**
 * Recalculate a review summary from a single review's change.
 *
 * `ratingSum` is kept alongside the count so the average is two increments
 * rather than a re-read of every review — which matters on a product with a
 * few hundred of them.
 *
 * `delta` is the change in review count (+1, 0 or -1); `ratingDelta` is the
 * change in the summed rating.
 */
async function applyReviewDelta(
  root: string,
  subjectId: string,
  delta: number,
  ratingDelta: number,
): Promise<void> {
  const summaryRef = db().doc(`${root}/${subjectId}`);
  await db()
    .runTransaction(async (tx) => {
      const summary = await tx.get(summaryRef);
      if (!summary.exists) return;

      const reviewCount = Math.max(0, (summary.get('reviewCount') ?? 0) + delta);
      const ratingSum = Math.max(0, (summary.get('ratingSum') ?? 0) + ratingDelta);
      tx.update(summaryRef, {
        reviewCount,
        ratingSum,
        // One decimal, so the number the app shows is the number stored.
        ratingAverage:
          reviewCount === 0 ? 0 : Math.round((ratingSum / reviewCount) * 10) / 10,
        updatedAt: new Date(),
      });
    })
    .catch((error) => logger.warn('Could not update review summary', { error, root }));
}

/**
 * Has this angler actually bought this product?
 *
 * Matched on the Shopify product handle recorded on each order line. Nothing
 * about the badge is client-assertable — the rules force `verifiedPurchase`
 * to false on write, and only this function ever sets it true.
 */
async function hasPurchased(uid: string, handle: string): Promise<boolean> {
  const orders = await db()
    .collection(`users/${uid}/orders`)
    .where('status', 'in', ['paid', 'partially_fulfilled', 'fulfilled'])
    .limit(50)
    .get();

  return orders.docs.some((order) => {
    const lines = (order.get('lines') as { productHandle?: string }[] | undefined) ?? [];
    return lines.some((line) => line.productHandle === handle);
  });
}

function reviewTrigger(root: string) {
  return {
    created: onDocumentCreated(`${root}/{subjectId}/reviews/{authorUid}`, async (event) => {
      const review = event.data?.data();
      if (!review) return;

      const { subjectId, authorUid } = event.params;
      await applyReviewDelta(root, subjectId, 1, review.rating ?? 0);

      // Keyed on the subject, so deleting and rewriting a review of the same
      // thing doesn't pay out again.
      await awardPoints(
        authorUid,
        'review_written',
        POINT_VALUES.review_written,
        `${root}_${subjectId}`,
      );

      // Only shop products can be verified — a community bait review has no
      // order to match against.
      if (root === 'productReviews' && (await hasPurchased(authorUid, subjectId))) {
        await event.data?.ref
          .update({ verifiedPurchase: true })
          .catch((error) => logger.warn('Could not mark verified purchase', { error }));
      }
    }),

    updated: onDocumentUpdated(`${root}/{subjectId}/reviews/{authorUid}`, async (event) => {
      const before = event.data?.before.data();
      const after = event.data?.after.data();
      if (!before || !after || before.rating === after.rating) return;
      // The count is unchanged — only the sum moves.
      await applyReviewDelta(root, event.params.subjectId, 0, after.rating - before.rating);
    }),

    deleted: onDocumentDeleted(`${root}/{subjectId}/reviews/{authorUid}`, async (event) => {
      const review = event.data?.data();
      if (!review) return;
      await applyReviewDelta(root, event.params.subjectId, -1, -(review.rating ?? 0));
      await revokePoints(
        event.params.authorUid,
        'review_written',
        `${root}_${event.params.subjectId}`,
      );
    }),
  };
}

const productReviewTriggers = reviewTrigger('productReviews');
const baitReviewTriggers = reviewTrigger('baitReviews');

export const onProductReviewCreated = productReviewTriggers.created;
export const onProductReviewUpdated = productReviewTriggers.updated;
export const onProductReviewDeleted = productReviewTriggers.deleted;
export const onBaitReviewCreated = baitReviewTriggers.created;
export const onBaitReviewUpdated = baitReviewTriggers.updated;
export const onBaitReviewDeleted = baitReviewTriggers.deleted;

// ---------------------------------------------------------------------------
// Direct messages
// ---------------------------------------------------------------------------

/**
 * A message was sent: update the thread preview, raise the recipient's unread
 * count, and push it to them.
 *
 * All three live here rather than in the client because the security rules
 * deny a participant those fields outright — otherwise a modified app could
 * rewrite a thread preview or forge somebody else's unread badge.
 */
export const onMessageCreated = onDocumentCreated(
  'conversations/{conversationId}/messages/{messageId}',
  async (event) => {
    const message = event.data?.data();
    if (!message?.senderId) return;

    const { conversationId } = event.params;
    const threadRef = db().doc(`conversations/${conversationId}`);
    const thread = await threadRef.get();
    if (!thread.exists) return;

    const participantIds = (thread.get('participantIds') as string[] | undefined) ?? [];
    const recipients = participantIds.filter((uid) => uid !== message.senderId);
    const text = typeof message.text === 'string' ? message.text : '';

    // One update: the preview, the sort key, and every recipient's counter.
    const unreadBumps: Record<string, FieldValue> = {};
    for (const uid of recipients) {
      unreadBumps[`unread.${uid}`] = FieldValue.increment(1);
    }

    await threadRef
      .update({
        lastMessage: { text: text.slice(0, 200), senderId: message.senderId },
        lastMessageAt: event.data?.createTime ?? new Date(),
        updatedAt: new Date(),
        ...unreadBumps,
      })
      .catch((error) => logger.warn('Could not update conversation', { error }));

    const senderName =
      (thread.get(`participants.${message.senderId}.username`) as string | undefined) ??
      'An angler';

    await Promise.all(
      recipients.map((uid) =>
        notifyUser(uid, {
          type: 'new_message',
          title: senderName,
          body: text.slice(0, 120),
          href: `/messages/${conversationId}`,
          data: { conversationId, senderId: message.senderId },
          preference: 'messages',
        }),
      ),
    );
  },
);

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/**
 * Somebody flagged something. Tell the admins and, for a post, bump the
 * counter the dashboard sorts by.
 *
 * The push deliberately doesn't name the reporter. Admins can see that in the
 * queue; a notification is read over shoulders.
 */
export const onReportCreated = onDocumentCreated('reports/{reportId}', async (event) => {
  await bumpStats({ openReportCount: 1 });
  const report = event.data?.data();
  if (!report) return;

  if (report.targetType === 'post' && typeof report.targetId === 'string') {
    await db()
      .doc(`posts/${report.targetId}`)
      .update({ reportCount: FieldValue.increment(1), updatedAt: new Date() })
      .catch((error) => logger.warn('Could not bump reportCount', { error }));
  }

  const admins = await adminUids();
  const label: Record<string, string> = {
    post: 'a catch',
    comment: 'a comment',
    user: 'an angler',
    message: 'a message',
  };

  await Promise.all(
    admins.map((uid) =>
      notifyUser(uid, {
        type: 'post_needs_review',
        title: 'Something was reported',
        body: `Someone reported ${label[report.targetType] ?? 'content'}: ${
          String(report.reason ?? '').replace(/_/g, ' ')
        }.`,
        href: '/admin/reports',
        data: { reportId: event.params.reportId },
      }),
    ),
  );
});

/** A report was resolved or reopened — keep the dashboard's open count honest. */
export const onReportResolved = onDocumentUpdated('reports/{reportId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.status === after.status) return;

  const wasOpen = before.status === 'open';
  const isOpen = after.status === 'open';
  if (wasOpen === isOpen) return;

  await bumpStats({ openReportCount: isOpen ? 1 : -1 });
});

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

/**
 * An admin published an announcement — push it to everyone who hasn't opted
 * out, and record it in each person's activity list.
 *
 * This walks every user, which is fine at this scale (a few thousand at most).
 * If the crew ever outgrows that, the loop becomes a paginated task queue
 * without changing anything the app sees.
 */
export const onAnnouncementCreated = onDocumentCreated(
  'announcements/{announcementId}',
  async (event) => {
    const announcement = event.data?.data();
    if (!announcement || announcement.sentAt) return;

    const { announcementId } = event.params;
    const users = await db().collection('users').select().get();

    let recipients = 0;

    // Batched so one enormous Promise.all doesn't exhaust the instance.
    for (let index = 0; index < users.docs.length; index += 50) {
      const batch = users.docs.slice(index, index + 50);
      const results = await Promise.all(
        batch.map(async (user): Promise<number> => {
          if (!(await wantsNotification(user.id, 'announcements'))) return 0;
          const tokens = await tokensForUser(user.id);

          await db().collection(`users/${user.id}/notifications`).add({
            schemaVersion: 1,
            type: 'announcement',
            title: announcement.title,
            body: announcement.body,
            href: announcement.href ?? null,
            readAt: null,
            data: { announcementId },
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          if (tokens.length === 0) return 0;
          await sendPush(tokens, {
            title: announcement.title,
            body: announcement.body,
            data: {
              announcementId,
              ...(announcement.href ? { href: announcement.href } : {}),
            },
          });
          return 1;
        }),
      );
      recipients += results.reduce((total, sent) => total + sent, 0);
    }

    await db()
      .doc(`announcements/${announcementId}`)
      .update({ sentAt: new Date(), recipientCount: recipients, updatedAt: new Date() });

    logger.info('Announcement sent', { announcementId, recipients });
  },
);

// ---------------------------------------------------------------------------
// Profile changes and account deletion
// ---------------------------------------------------------------------------

/**
 * Posts carry a snapshot of their author's name and photo so the feed renders
 * from one read. When the profile changes, fan the new values out.
 */
export const onProfileUpdated = onDocumentUpdated('users/{uid}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  // Every counter move lands here, so badges are checked without a scheduled
  // job. Before the early return below, which is only about name changes.
  await checkBadges(event.params.uid, after);

  if (before.username === after.username && before.photoURL === after.photoURL) return;

  const { uid } = event.params;
  const snapshot = {
    username: after.username,
    photoURL: after.photoURL ?? null,
  };

  const [posts, threads] = await Promise.all([
    db().collection('posts').where('authorId', '==', uid).get(),
    // The inbox renders from the denormalized participant snapshot, so a name
    // change has to reach threads too or old threads show the old name.
    db().collection('conversations').where('participantIds', 'array-contains', uid).get(),
  ]);

  await Promise.all([
    updateEach(posts.docs, (batch, post) =>
      batch.update(post.ref, {
        'author.username': snapshot.username,
        'author.photoURL': snapshot.photoURL,
      }),
    ),
    updateEach(threads.docs, (batch, thread) =>
      batch.update(thread.ref, {
        [`participants.${uid}.username`]: snapshot.username,
        [`participants.${uid}.photoURL`]: snapshot.photoURL,
      }),
    ),
  ]);

  logger.info('Refreshed author snapshots', {
    uid,
    posts: posts.size,
    conversations: threads.size,
  });
});

/**
 * Apply an update to every document, in batches. Firestore caps a batch at
 * 500 writes, so anything that touches "all of a user's X" has to chunk.
 */
async function updateEach(
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
  apply: (
    batch: FirebaseFirestore.WriteBatch,
    doc: FirebaseFirestore.QueryDocumentSnapshot,
  ) => void,
): Promise<void> {
  for (let index = 0; index < docs.length; index += 400) {
    const batch = db().batch();
    for (const document of docs.slice(index, index + 400)) {
      apply(batch, document);
    }
    await batch.commit();
  }
}

/**
 * Account deletion. The app deletes `users/{uid}` and the username
 * reservation itself; this cascades everything a client can't reach — their
 * posts and photos, push tokens, and notification history.
 */
export const onUserDeleted = onDocumentDeleted('users/{uid}', async (event) => {
  await bumpStats({ userCount: -1 });
  const { uid } = event.params;

  const posts = await db().collection('posts').where('authorId', '==', uid).get();
  // Deleting each post document fires onPostDeleted, which removes that post's
  // photo, likes, and comments — no need to repeat that work here.
  await Promise.all(posts.docs.map((post) => post.ref.delete()));

  // Follow edges point both ways, so both queries have to run.
  for (const field of ['followerId', 'followingId']) {
    const edges = await db().collection('follows').where(field, '==', uid).get();
    await Promise.all(edges.docs.map((edge) => edge.ref.delete()));
  }

  await Promise.all([
    deleteCollection(`users/${uid}/pushTokens`),
    deleteCollection(`users/${uid}/notifications`),
    deleteCollection(`users/${uid}/private`),
    deleteCollection(`users/${uid}/wishlist`),
    deleteCollection(`users/${uid}/blocked`),
    // Orders are kept deliberately — Shopify holds the real records for tax
    // and dispute purposes, and deleting our copy wouldn't remove those.
  ]);

  logger.info('Cleaned up deleted account', { uid, posts: posts.size });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Delete every document in a collection, in batches. */
async function deleteCollection(path: string, batchSize = 300): Promise<void> {
  const collection = db().collection(path);

  for (;;) {
    const snapshot = await collection.limit(batchSize).get();
    if (snapshot.empty) return;

    const batch = db().batch();
    snapshot.docs.forEach((entry) => batch.delete(entry.ref));
    await batch.commit();

    if (snapshot.size < batchSize) return;
  }
}
