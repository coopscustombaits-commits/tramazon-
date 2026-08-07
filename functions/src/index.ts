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
  const posts = await db().collection('posts').where('authorId', '==', uid).get();
  if (posts.empty) return;

  // Firestore caps a batch at 500 writes.
  const chunks: FirebaseFirestore.QueryDocumentSnapshot[][] = [];
  for (let index = 0; index < posts.docs.length; index += 400) {
    chunks.push(posts.docs.slice(index, index + 400));
  }

  for (const chunk of chunks) {
    const batch = db().batch();
    for (const post of chunk) {
      batch.update(post.ref, {
        'author.username': after.username,
        'author.photoURL': after.photoURL ?? null,
      });
    }
    await batch.commit();
  }

  logger.info('Refreshed author snapshots', { uid, posts: posts.size });
});

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

  await Promise.all([
    deleteCollection(`users/${uid}/pushTokens`),
    deleteCollection(`users/${uid}/notifications`),
    deleteCollection(`users/${uid}/private`),
    deleteCollection(`users/${uid}/wishlist`),
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
