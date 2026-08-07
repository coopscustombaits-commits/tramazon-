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
    return;
  }

  // An approved post that was later rejected or taken down: undo the count.
  if (before.status === 'approved' && after.status !== 'approved') {
    await db()
      .doc(`users/${after.authorId}`)
      .update({ postCount: FieldValue.increment(-1), updatedAt: new Date() })
      .catch((error) => logger.warn('Could not lower postCount', { error }));
  }
});

/** Clean up after a deleted post: its photo, likes, and comments. */
export const onPostDeleted = onDocumentDeleted('posts/{postId}', async (event) => {
  const post = event.data?.data();
  if (!post) return;

  const { postId } = event.params;

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
  },
);

export const onLikeDeleted = onDocumentDeleted(
  'posts/{postId}/likes/{likerId}',
  async (event) => {
    await db()
      .doc(`posts/${event.params.postId}`)
      .update({ likeCount: FieldValue.increment(-1) })
      .catch(() => undefined);
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
