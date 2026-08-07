/**
 * Security rules tests.
 *
 * These cover the moderation workflow, which is the part of the app that has
 * to hold up against a modified client. Run them against the emulator:
 *
 *   npm run test:rules
 *
 * The emulator must be running (`npm run emulators`) in another terminal.
 */
import { readFileSync } from 'node:fs';
import test, { after, before } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  endAt,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAt,
  updateDoc,
  where,
} from 'firebase/firestore';

let env;

const OWNER = 'owner-uid';
const ANGLER = 'angler-uid';
const OTHER = 'other-uid';

function profile(uid, username) {
  return {
    schemaVersion: 1,
    uid,
    username,
    usernameLower: username.toLowerCase(),
    bio: '',
    photoURL: null,
    favoriteSpecies: null,
    postCount: 0,
    fishLoggedCount: 0,
    points: 0,
    followerCount: 0,
    followingCount: 0,
    providers: ['password'],
    accountStatus: 'active',
    suspendedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function post(authorId, overrides = {}) {
  return {
    schemaVersion: 1,
    authorId,
    author: { uid: authorId, username: 'angler', photoURL: null },
    caption: 'Nice one',
    media: {
      kind: 'photo',
      url: 'https://x/y.jpg',
      storagePath: 'posts/a/b.jpg',
      width: 100,
      height: 100,
      durationMs: null,
      thumbnailUrl: null,
      thumbnailStoragePath: null,
    },
    status: 'pending',
    publishedAt: null,
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: null,
    likeCount: 0,
    commentCount: 0,
    reportCount: 0,
    featured: false,
    moderation: null,
    keywords: ['nice'],
    species: null,
    speciesSlug: null,
    tournamentId: null,
    challengeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-coops',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  });

  // Start from a clean slate so tests don't depend on a previous run.
  await env.clearFirestore();

  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins', OWNER), { grantedAt: new Date(), note: null });
    await setDoc(doc(db, 'users', OWNER), profile(OWNER, 'Coop'));
    await setDoc(doc(db, 'users', ANGLER), profile(ANGLER, 'RiverRat'));
    await setDoc(doc(db, 'usernames', 'riverrat'), { uid: ANGLER, createdAt: new Date() });
    await setDoc(doc(db, 'posts', 'pending1'), post(ANGLER));
    await setDoc(doc(db, 'posts', 'pending2'), post(ANGLER));
    await setDoc(doc(db, 'posts', 'approved1'), post(ANGLER, { status: 'approved', publishedAt: new Date() }));
  });
});

after(async () => {
  await env?.cleanup();
});

const asAngler = () => env.authenticatedContext(ANGLER).firestore();
const asOther = () => env.authenticatedContext(OTHER).firestore();
const asOwner = () => env.authenticatedContext(OWNER).firestore();
const asGuest = () => env.unauthenticatedContext().firestore();

test('a new post must be pending', async () => {
  await assertSucceeds(setDoc(doc(asAngler(), 'posts', 'new-pending'), post(ANGLER)));
  await assertFails(
    setDoc(doc(asAngler(), 'posts', 'sneaky'), post(ANGLER, { status: 'approved' })),
  );
});

test('you cannot post as someone else', async () => {
  await assertFails(setDoc(doc(asOther(), 'posts', 'spoofed'), post(ANGLER)));
});

test('pending posts are hidden from other users but visible to author and admin', async () => {
  await assertFails(getDoc(doc(asOther(), 'posts', 'pending1')));
  await assertSucceeds(getDoc(doc(asAngler(), 'posts', 'pending1')));
  await assertSucceeds(getDoc(doc(asOwner(), 'posts', 'pending1')));
});

test('approved posts are readable by any signed-in user, not by guests', async () => {
  await assertSucceeds(getDoc(doc(asOther(), 'posts', 'approved1')));
  await assertFails(getDoc(doc(asGuest(), 'posts', 'approved1')));
});

test('only an admin can approve a post', async () => {
  const approval = {
    status: 'approved',
    publishedAt: new Date(),
    reviewedAt: new Date(),
    reviewedBy: OWNER,
    updatedAt: new Date(),
  };
  await assertFails(
    updateDoc(doc(asAngler(), 'posts', 'pending1'), { ...approval, reviewedBy: ANGLER }),
  );
  await assertFails(updateDoc(doc(asOther(), 'posts', 'pending1'), approval));
  await assertSucceeds(updateDoc(doc(asOwner(), 'posts', 'pending1'), approval));
});

test('an admin can reject a post', async () => {
  await assertSucceeds(
    updateDoc(doc(asOwner(), 'posts', 'pending2'), {
      status: 'rejected',
      reviewedAt: new Date(),
      reviewedBy: OWNER,
      reviewNote: 'Not a fish',
      updatedAt: new Date(),
    }),
  );
});

test('an author may fix a caption while pending, but not once approved', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'posts', 'editable'), post(ANGLER));
  });
  await assertSucceeds(
    updateDoc(doc(asAngler(), 'posts', 'editable'), { caption: 'Fixed', updatedAt: new Date() }),
  );
  await assertFails(
    updateDoc(doc(asAngler(), 'posts', 'approved1'), { caption: 'Sneaky', updatedAt: new Date() }),
  );
});

test('nobody can inflate their own counters', async () => {
  await assertFails(updateDoc(doc(asAngler(), 'users', ANGLER), { postCount: 99 }));
  await assertFails(updateDoc(doc(asAngler(), 'users', ANGLER), { followerCount: 500 }));
  await assertSucceeds(
    updateDoc(doc(asAngler(), 'users', ANGLER), { bio: 'Bass guy', updatedAt: new Date() }),
  );
});

test('a profile cannot be created with non-zero counters or a mismatched lowercase name', async () => {
  await assertFails(
    setDoc(doc(asOther(), 'users', OTHER), { ...profile(OTHER, 'Newbie'), postCount: 10 }),
  );
  await assertFails(
    setDoc(doc(asOther(), 'users', OTHER), { ...profile(OTHER, 'Newbie'), usernameLower: 'other' }),
  );
  await assertSucceeds(setDoc(doc(asOther(), 'users', OTHER), profile(OTHER, 'Newbie')));
});

test('you cannot edit or steal another user profile', async () => {
  await assertFails(updateDoc(doc(asOther(), 'users', ANGLER), { bio: 'hacked' }));
});

test('a username reservation cannot be taken over', async () => {
  await assertFails(
    setDoc(doc(asOther(), 'usernames', 'riverrat'), { uid: OTHER, createdAt: new Date() }),
  );
  await assertFails(
    setDoc(doc(asOther(), 'usernames', 'freshname'), { uid: ANGLER, createdAt: new Date() }),
  );
  await assertSucceeds(
    setDoc(doc(asOther(), 'usernames', 'freshname'), { uid: OTHER, createdAt: new Date() }),
  );
});

test('you can release your own username but not someone else’s', async () => {
  await assertFails(deleteDoc(doc(asOther(), 'usernames', 'riverrat')));
  await assertSucceeds(deleteDoc(doc(asOther(), 'usernames', 'freshname')));
});

test('admin status cannot be granted or read by others', async () => {
  await assertFails(setDoc(doc(asOther(), 'admins', OTHER), { grantedAt: new Date() }));
  await assertFails(getDoc(doc(asOther(), 'admins', OWNER)));
  await assertSucceeds(getDoc(doc(asOwner(), 'admins', OWNER)));
});

test('private profile data is owner-only', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', ANGLER, 'private', 'profile'), {
      email: 'a@b.c',
    });
  });
  await assertFails(getDoc(doc(asOther(), 'users', ANGLER, 'private', 'profile')));
  await assertSucceeds(getDoc(doc(asAngler(), 'users', ANGLER, 'private', 'profile')));
});

test('likes and comments only work on approved posts', async () => {
  await assertFails(setDoc(doc(asOther(), 'posts', 'editable', 'likes', OTHER), { uid: OTHER, createdAt: new Date() }));
  await assertSucceeds(setDoc(doc(asOther(), 'posts', 'approved1', 'likes', OTHER), { uid: OTHER, createdAt: new Date() }));
  await assertFails(setDoc(doc(asOther(), 'posts', 'approved1', 'likes', ANGLER), { uid: ANGLER, createdAt: new Date() }));

  const comment = {
    schemaVersion: 1,
    postId: 'approved1',
    authorId: OTHER,
    author: { uid: OTHER, username: 'other', photoURL: null },
    text: 'Great catch',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await assertSucceeds(setDoc(doc(asOther(), 'posts', 'approved1', 'comments', 'c1'), comment));
  await assertFails(setDoc(doc(asOther(), 'posts', 'editable', 'comments', 'c2'), comment));
});

test('a user can delete their own profile but not another', async () => {
  await assertFails(deleteDoc(doc(asOther(), 'users', ANGLER)));
  await assertSucceeds(deleteDoc(doc(asOther(), 'users', OTHER)));
});

// ---------------------------------------------------------------------------
// Queries
//
// Firestore evaluates read rules against every document a query returns, so a
// query that isn't narrow enough fails outright rather than filtering. These
// cover the exact queries the app issues.
// ---------------------------------------------------------------------------

test('the feed query (approved, by publishedAt) is allowed', async () => {
  const feed = query(
    collection(asOther(), 'posts'),
    where('status', '==', 'approved'),
    orderBy('publishedAt', 'desc'),
    limit(10),
  );
  await assertSucceeds(getDocs(feed));
});

test('a query for all posts, unfiltered, is refused', async () => {
  await assertFails(getDocs(query(collection(asOther(), 'posts'), limit(10))));
});

test('a query for someone else’s pending posts is refused', async () => {
  const snoop = query(
    collection(asOther(), 'posts'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'asc'),
    limit(10),
  );
  await assertFails(getDocs(snoop));
  // The same query is what the admin review queue runs.
  await assertSucceeds(getDocs(query(
    collection(asOwner(), 'posts'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'asc'),
    limit(10),
  )));
});

test('search keywords are capped, so a post cannot be bloated into the index', async () => {
  const tooMany = Array.from({ length: 41 }, (_, index) => `word${index}`);
  await assertFails(
    setDoc(doc(asAngler(), 'posts', 'keyword-bomb'), post(ANGLER, { keywords: tooMany })),
  );
  await assertFails(
    setDoc(doc(asAngler(), 'posts', 'keyword-string'), post(ANGLER, { keywords: 'pike' })),
  );
  await assertSucceeds(
    setDoc(doc(asAngler(), 'posts', 'keyword-ok'), post(ANGLER, { keywords: tooMany.slice(0, 40) })),
  );
});

test('editing a caption may resync its keywords, but not past the cap', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'posts', 'recaption'), post(ANGLER));
  });
  await assertSucceeds(
    updateDoc(doc(asAngler(), 'posts', 'recaption'), {
      caption: 'Chartreuse jig',
      keywords: ['chartreuse', 'jig'],
      updatedAt: new Date(),
    }),
  );
  await assertFails(
    updateDoc(doc(asAngler(), 'posts', 'recaption'), {
      caption: 'Chartreuse jig',
      keywords: Array.from({ length: 41 }, (_, index) => `word${index}`),
      updatedAt: new Date(),
    }),
  );
});

test('the species hub query is allowed, and only for approved posts', async () => {
  await assertSucceeds(getDocs(query(
    collection(asOther(), 'posts'),
    where('speciesSlug', '==', 'largemouth-bass'),
    where('status', '==', 'approved'),
    orderBy('publishedAt', 'desc'),
    limit(10),
  )));
  // Dropping the status filter would let a hub surface pending posts.
  await assertFails(getDocs(query(
    collection(asOther(), 'posts'),
    where('speciesSlug', '==', 'largemouth-bass'),
    orderBy('publishedAt', 'desc'),
    limit(10),
  )));
});

test('the keyword search query is allowed, and only for approved posts', async () => {
  await assertSucceeds(getDocs(query(
    collection(asOther(), 'posts'),
    where('status', '==', 'approved'),
    where('keywords', 'array-contains', 'pike'),
    orderBy('publishedAt', 'desc'),
    limit(30),
  )));
  await assertFails(getDocs(query(
    collection(asOther(), 'posts'),
    where('keywords', 'array-contains', 'pike'),
    orderBy('publishedAt', 'desc'),
    limit(30),
  )));
});

test('the angler search query (username prefix) is allowed', async () => {
  await assertSucceeds(getDocs(query(
    collection(asOther(), 'users'),
    orderBy('usernameLower'),
    startAt('riv'),
    endAt(`riv`),
    limit(25),
  )));
});

test('you can list your own posts in any status', async () => {
  const mine = query(
    collection(asAngler(), 'posts'),
    where('authorId', '==', ANGLER),
    orderBy('createdAt', 'desc'),
    limit(60),
  );
  await assertSucceeds(getDocs(mine));
  // ...but not someone else's, since that would expose their pending posts.
  await assertFails(getDocs(query(
    collection(asOther(), 'posts'),
    where('authorId', '==', ANGLER),
    orderBy('createdAt', 'desc'),
    limit(60),
  )));
});

// ---------------------------------------------------------------------------
// Push tokens and notifications
// ---------------------------------------------------------------------------

test('push tokens are writable only by their owner', async () => {
  const token = 'ExponentPushToken[abc123]';
  await assertSucceeds(
    setDoc(doc(asAngler(), 'users', ANGLER, 'pushTokens', token), {
      token,
      platform: 'ios',
      deviceName: 'iPhone',
      lastSeenAt: new Date(),
    }),
  );
  await assertFails(
    setDoc(doc(asOther(), 'users', ANGLER, 'pushTokens', token), { token, platform: 'ios' }),
  );
  await assertSucceeds(deleteDoc(doc(asAngler(), 'users', ANGLER, 'pushTokens', token)));
});

test('notifications are readable by their owner, who may only mark them read', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', ANGLER, 'notifications', 'n1'), {
      schemaVersion: 1,
      type: 'post_approved',
      title: 'Your catch is live',
      body: 'Approved',
      href: '/post/approved1',
      readAt: null,
      data: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  await assertFails(getDoc(doc(asOther(), 'users', ANGLER, 'notifications', 'n1')));
  await assertSucceeds(getDoc(doc(asAngler(), 'users', ANGLER, 'notifications', 'n1')));
  await assertSucceeds(
    updateDoc(doc(asAngler(), 'users', ANGLER, 'notifications', 'n1'), { readAt: new Date() }),
  );
  // Clients must not be able to fabricate a notification.
  await assertFails(
    setDoc(doc(asAngler(), 'users', ANGLER, 'notifications', 'fake'), { type: 'announcement' }),
  );
  await assertFails(
    updateDoc(doc(asAngler(), 'users', ANGLER, 'notifications', 'n1'), { title: 'Changed' }),
  );
});

test('a post owner can remove a comment left on their catch', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'posts', 'approved1', 'comments', 'rude'), {
      schemaVersion: 1,
      postId: 'approved1',
      authorId: OTHER,
      author: { uid: OTHER, username: 'other', photoURL: null },
      text: 'rude thing',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });
  // approved1 belongs to ANGLER, the comment to OTHER.
  await assertSucceeds(deleteDoc(doc(asAngler(), 'posts', 'approved1', 'comments', 'rude')));
});

test('another angler’s public profile query is allowed', async () => {
  // Exactly what app/user/[uid].tsx runs. It must ask for approved posts:
  // without that filter the rules refuse the whole query (see above).
  const publicProfile = query(
    collection(asOther(), 'posts'),
    where('authorId', '==', ANGLER),
    where('status', '==', 'approved'),
    orderBy('publishedAt', 'desc'),
    limit(60),
  );
  await assertSucceeds(getDocs(publicProfile));
});

test('you can list your own notification history and nobody else’s', async () => {
  const own = query(
    collection(asAngler(), 'users', ANGLER, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  await assertSucceeds(getDocs(own));

  const snoop = query(
    collection(asOther(), 'users', ANGLER, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  await assertFails(getDocs(snoop));
});

test('notification preferences are writable only by their owner', async () => {
  await assertSucceeds(
    updateDoc(doc(asAngler(), 'users', ANGLER, 'private', 'profile'), {
      'notificationPrefs.postLiked': false,
    }),
  );
  await assertFails(
    updateDoc(doc(asOther(), 'users', ANGLER, 'private', 'profile'), {
      'notificationPrefs.postLiked': false,
    }),
  );
});

// ---------------------------------------------------------------------------
// Wishlist, orders, announcements
// ---------------------------------------------------------------------------

test('a wishlist is private to its owner', async () => {
  const item = {
    schemaVersion: 1,
    productId: 'gid://shopify/Product/1',
    handle: 'jig',
    title: 'Skirted Jig',
    imageUrl: null,
    priceAmount: '10.00',
    priceCurrency: 'USD',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await assertSucceeds(setDoc(doc(asAngler(), 'users', ANGLER, 'wishlist', '1'), item));
  await assertFails(setDoc(doc(asOther(), 'users', ANGLER, 'wishlist', '2'), item));
  await assertFails(getDoc(doc(asOther(), 'users', ANGLER, 'wishlist', '1')));
  await assertSucceeds(deleteDoc(doc(asAngler(), 'users', ANGLER, 'wishlist', '1')));
});

test('an order can be recorded but never marked shipped by the client', async () => {
  const order = {
    schemaVersion: 1,
    cartId: 'gid://shopify/Cart/abc',
    shopifyOrderId: null,
    orderNumber: null,
    status: 'placed',
    statusUrl: null,
    totalAmount: '25.00',
    totalCurrency: 'USD',
    lines: [],
    fulfilledAt: null,
    trackingNumbers: [],
    trackingUrls: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await assertSucceeds(setDoc(doc(asAngler(), 'users', ANGLER, 'orders', 'o1'), order));

  // Claiming your order already shipped would make the whole screen a lie.
  await assertFails(
    setDoc(doc(asAngler(), 'users', ANGLER, 'orders', 'o2'), {
      ...order,
      status: 'fulfilled',
    }),
  );
  await assertFails(
    updateDoc(doc(asAngler(), 'users', ANGLER, 'orders', 'o1'), { status: 'fulfilled' }),
  );
  await assertFails(getDoc(doc(asOther(), 'users', ANGLER, 'orders', 'o1')));
});

test('only an admin can publish an announcement', async () => {
  const announcement = {
    schemaVersion: 1,
    title: 'New bait drop',
    body: 'Chartreuse Shad is back.',
    href: null,
    sentAt: null,
    recipientCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await assertFails(
    setDoc(doc(asAngler(), 'announcements', 'a1'), { ...announcement, createdBy: ANGLER }),
  );
  await assertSucceeds(
    setDoc(doc(asOwner(), 'announcements', 'a1'), { ...announcement, createdBy: OWNER }),
  );

  // Everyone can read them; nobody can edit one after it has gone out.
  await assertSucceeds(getDoc(doc(asAngler(), 'announcements', 'a1')));
  await assertFails(updateDoc(doc(asOwner(), 'announcements', 'a1'), { title: 'Edited' }));
});

test('an announcement cannot be created pre-marked as sent', async () => {
  // sentAt is the Cloud Function's signal that the fan-out is done; a client
  // setting it would stop the push from ever going out.
  await assertFails(
    setDoc(doc(asOwner(), 'announcements', 'a2'), {
      schemaVersion: 1,
      title: 'Sneaky',
      body: 'Should not send',
      href: null,
      createdBy: OWNER,
      sentAt: new Date(),
      recipientCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );
});

// ---------------------------------------------------------------------------
// Account suspension and banning (Phase 4 groundwork, enforced today)
// ---------------------------------------------------------------------------

const BANNED = 'banned-uid';

test('a banned account cannot post, comment, or like', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', BANNED), {
      ...profile(BANNED, 'Troublemaker'),
      accountStatus: 'banned',
    });
  });

  const banned = env.authenticatedContext(BANNED).firestore();

  await assertFails(setDoc(doc(banned, 'posts', 'banned-post'), post(BANNED)));
  await assertFails(
    setDoc(doc(banned, 'posts', 'approved1', 'comments', 'nope'), {
      schemaVersion: 1,
      postId: 'approved1',
      authorId: BANNED,
      author: { uid: BANNED, username: 'troublemaker', photoURL: null },
      text: 'still here',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );
  await assertFails(
    setDoc(doc(banned, 'posts', 'approved1', 'likes', BANNED), {
      uid: BANNED,
      createdAt: new Date(),
    }),
  );

  // Reading is still allowed — a ban stops someone contributing, it doesn't
  // lock them out of an app they may have orders in.
  await assertSucceeds(getDoc(doc(banned, 'posts', 'approved1')));
});

test('a banned account cannot lift its own ban', async () => {
  const banned = env.authenticatedContext(BANNED).firestore();
  await assertFails(
    updateDoc(doc(banned, 'users', BANNED), { accountStatus: 'active' }),
  );
  // Nor by smuggling it alongside a legitimate edit.
  await assertFails(
    updateDoc(doc(banned, 'users', BANNED), {
      bio: 'Reformed',
      accountStatus: 'active',
    }),
  );
});

test('a suspended account is blocked the same way', async () => {
  const SUSPENDED = 'suspended-uid';
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', SUSPENDED), {
      ...profile(SUSPENDED, 'Timeout'),
      accountStatus: 'suspended',
    });
  });
  const suspended = env.authenticatedContext(SUSPENDED).firestore();
  await assertFails(setDoc(doc(suspended, 'posts', 'suspended-post'), post(SUSPENDED)));
});

test('nobody can sign up already marked active-but-featured or pre-banned', async () => {
  const NEWCOMER = 'newcomer-uid';
  const newcomer = env.authenticatedContext(NEWCOMER).firestore();
  await assertFails(
    setDoc(doc(newcomer, 'users', NEWCOMER), {
      ...profile(NEWCOMER, 'Sneaky'),
      accountStatus: 'banned',
    }),
  );
  await assertSucceeds(
    setDoc(doc(newcomer, 'users', NEWCOMER), profile(NEWCOMER, 'Sneaky')),
  );
});

test('only an admin can feature a post on the home page', async () => {
  await assertFails(updateDoc(doc(asAngler(), 'posts', 'approved1'), { featured: true }));
  await assertSucceeds(
    updateDoc(doc(asOwner(), 'posts', 'approved1'), {
      featured: true,
      updatedAt: new Date(),
    }),
  );
  // And nobody creates a post already featured.
  await assertFails(
    setDoc(doc(asAngler(), 'posts', 'self-featured'), { ...post(ANGLER), featured: true }),
  );
});

// ---------------------------------------------------------------------------
// Blocking, reporting, following
// ---------------------------------------------------------------------------

// An earlier test deletes OTHER's profile. Restore it so these don't depend on
// the order the suite happens to run in.
test('restore fixtures for the safety tests', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', OTHER), profile(OTHER, 'Newbie'));
  });
});

test('a block list is private, and invisible to the person blocked', async () => {
  await assertSucceeds(
    setDoc(doc(asAngler(), 'users', ANGLER, 'blocked', OTHER), {
      uid: OTHER,
      username: 'other',
      createdAt: new Date(),
    }),
  );
  // The blocked person must not be able to discover that they were blocked.
  await assertFails(getDoc(doc(asOther(), 'users', ANGLER, 'blocked', OTHER)));
  await assertSucceeds(getDoc(doc(asAngler(), 'users', ANGLER, 'blocked', OTHER)));
  await assertFails(
    setDoc(doc(asOther(), 'users', ANGLER, 'blocked', 'someone'), { uid: 'someone' }),
  );
});

function report(reporterId, overrides = {}) {
  return {
    schemaVersion: 1,
    targetType: 'post',
    targetId: 'approved1',
    parentId: null,
    targetOwnerId: ANGLER,
    reporterId,
    reason: 'spam',
    note: 'Nothing to do with fishing',
    status: 'open',
    reviewedAt: null,
    reviewedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

test('anyone can file a report, but only an admin can read the queue', async () => {
  await assertSucceeds(setDoc(doc(asOther(), 'reports', 'r1'), report(OTHER)));

  // The whole point: a reporter must not be able to see reports, or the
  // system leaks who reported whom.
  await assertFails(getDoc(doc(asOther(), 'reports', 'r1')));
  await assertFails(getDocs(query(collection(asOther(), 'reports'), limit(10))));
  await assertSucceeds(getDoc(doc(asOwner(), 'reports', 'r1')));
});

test('a report cannot be filed on your own content or pre-resolved', async () => {
  await assertFails(
    setDoc(doc(asAngler(), 'reports', 'r-self'), report(ANGLER, {})),
  );
  await assertFails(
    setDoc(doc(asOther(), 'reports', 'r-resolved'), {
      ...report(OTHER),
      status: 'dismissed',
    }),
  );
  await assertFails(
    setDoc(doc(asOther(), 'reports', 'r-signed'), {
      ...report(OTHER),
      reviewedBy: OWNER,
    }),
  );
});

test('only an admin can resolve a report, and not edit its substance', async () => {
  await assertFails(
    updateDoc(doc(asOther(), 'reports', 'r1'), { status: 'dismissed' }),
  );
  await assertFails(
    updateDoc(doc(asOwner(), 'reports', 'r1'), { reason: 'hate', updatedAt: new Date() }),
  );
  await assertSucceeds(
    updateDoc(doc(asOwner(), 'reports', 'r1'), {
      status: 'actioned',
      reviewedAt: new Date(),
      reviewedBy: OWNER,
      updatedAt: new Date(),
    }),
  );
});

test('a follow edge can only be created by the follower, with a matching id', async () => {
  await assertSucceeds(
    setDoc(doc(asOther(), 'follows', `${OTHER}_${ANGLER}`), {
      followerId: OTHER,
      followingId: ANGLER,
      createdAt: new Date(),
    }),
  );

  // Claiming somebody else follows you would inflate their following count.
  await assertFails(
    setDoc(doc(asOther(), 'follows', `${ANGLER}_${OTHER}`), {
      followerId: ANGLER,
      followingId: OTHER,
      createdAt: new Date(),
    }),
  );

  // A document id that disagrees with its contents would let one edge be
  // written many times over under different keys.
  await assertFails(
    setDoc(doc(asOther(), 'follows', 'made-up-id'), {
      followerId: OTHER,
      followingId: ANGLER,
      createdAt: new Date(),
    }),
  );

  await assertFails(
    setDoc(doc(asOther(), 'follows', `${OTHER}_${OTHER}`), {
      followerId: OTHER,
      followingId: OTHER,
      createdAt: new Date(),
    }),
  );
});

test('both sides of a follow can remove it, and nobody can edit one', async () => {
  await assertFails(
    updateDoc(doc(asOther(), 'follows', `${OTHER}_${ANGLER}`), { followingId: OWNER }),
  );
  // The followed person removing a follower is a normal thing to want.
  await assertSucceeds(deleteDoc(doc(asAngler(), 'follows', `${OTHER}_${ANGLER}`)));
});

test('a banned account cannot follow or report', async () => {
  const banned = env.authenticatedContext(BANNED).firestore();
  await assertFails(
    setDoc(doc(banned, 'follows', `${BANNED}_${ANGLER}`), {
      followerId: BANNED,
      followingId: ANGLER,
      createdAt: new Date(),
    }),
  );
  await assertFails(setDoc(doc(banned, 'reports', 'r-banned'), report(BANNED)));
});
