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
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

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
    followerCount: 0,
    followingCount: 0,
    providers: ['password'],
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
    image: { url: 'https://x/y.jpg', storagePath: 'posts/a/b.jpg', width: 100, height: 100 },
    status: 'pending',
    publishedAt: null,
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: null,
    likeCount: 0,
    commentCount: 0,
    species: null,
    tournamentId: null,
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
