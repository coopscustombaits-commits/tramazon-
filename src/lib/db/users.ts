import type { User } from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { paths } from '@/lib/db/paths';
import { validateUsername } from '@/lib/username';
import { SCHEMA_VERSION, type UserPrivate, type UserProfile } from '@/types/models';

// Pure username rules live in `lib/username.ts` so they can be unit tested
// without pulling Firebase in. Re-exported here so callers have one import.
export {
  USERNAME_MAX,
  USERNAME_MIN,
  suggestUsername,
  validateUsername,
} from '@/lib/username';

/** True if nobody has claimed the username yet. */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const snapshot = await getDoc(doc(db, paths.username(username.toLowerCase())));
  return !snapshot.exists();
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(doc(db, paths.user(uid)));
  return snapshot.exists() ? (snapshot.data() as UserProfile) : null;
}

/** Live subscription to a profile document. */
export function subscribeToUserProfile(
  uid: string,
  onChange: (profile: UserProfile | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, paths.user(uid)),
    (snapshot) => onChange(snapshot.exists() ? (snapshot.data() as UserProfile) : null),
    (error) => onError?.(error),
  );
}

/**
 * Claim a username and create the profile in one transaction, so two people
 * racing for the same name can't both win.
 *
 * Writes three documents:
 *   usernames/{lower}            -> reservation
 *   users/{uid}                  -> public profile
 *   users/{uid}/private/profile  -> email + notification prefs
 */
export async function createUserProfile(
  user: User,
  input: { username: string; favoriteSpecies?: string | null; bio?: string },
): Promise<UserProfile> {
  const username = input.username.trim();
  const usernameLower = username.toLowerCase();

  const validationError = validateUsername(username);
  if (validationError) throw new Error(validationError);

  const profile: UserProfile = {
    schemaVersion: SCHEMA_VERSION,
    uid: user.uid,
    username,
    usernameLower,
    bio: input.bio?.trim() ?? '',
    photoURL: user.photoURL ?? null,
    favoriteSpecies: input.favoriteSpecies?.trim() || null,
    postCount: 0,
    fishLoggedCount: 0,
    points: 0,
    followerCount: 0,
    followingCount: 0,
    providers: user.providerData.map((p) => p.providerId),
    createdAt: null,
    updatedAt: null,
  };

  const privateData: UserPrivate = {
    schemaVersion: SCHEMA_VERSION,
    email: user.email,
    notificationPrefs: {
      postApproved: true,
      postLiked: true,
      postCommented: true,
      announcements: true,
    },
    createdAt: null,
    updatedAt: null,
  };

  await runTransaction(db, async (tx) => {
    const usernameRef = doc(db, paths.username(usernameLower));
    const existing = await tx.get(usernameRef);
    if (existing.exists() && existing.get('uid') !== user.uid) {
      throw new Error('That username is already taken.');
    }

    tx.set(usernameRef, { uid: user.uid, createdAt: serverTimestamp() });
    tx.set(doc(db, paths.user(user.uid)), {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.set(doc(db, paths.userPrivate(user.uid)), {
      ...privateData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return profile;
}

export type ProfileUpdate = Partial<
  Pick<UserProfile, 'bio' | 'photoURL' | 'favoriteSpecies'>
>;

/** Update the fields a user is allowed to change directly. */
export async function updateUserProfile(
  uid: string,
  update: ProfileUpdate,
): Promise<void> {
  await updateDoc(doc(db, paths.user(uid)), {
    ...update,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Change a username: release the old reservation and claim the new one
 * atomically. Kept separate from `updateUserProfile` because it touches the
 * `usernames` collection too.
 */
export async function changeUsername(uid: string, nextUsername: string): Promise<void> {
  const username = nextUsername.trim();
  const validationError = validateUsername(username);
  if (validationError) throw new Error(validationError);

  const usernameLower = username.toLowerCase();

  await runTransaction(db, async (tx) => {
    const profileRef = doc(db, paths.user(uid));
    const profileSnapshot = await tx.get(profileRef);
    if (!profileSnapshot.exists()) throw new Error('Profile not found.');

    const currentLower = profileSnapshot.get('usernameLower') as string;
    if (currentLower === usernameLower) {
      // Same name, different capitalization — just update the display form.
      tx.update(profileRef, { username, updatedAt: serverTimestamp() });
      return;
    }

    const nextRef = doc(db, paths.username(usernameLower));
    const taken = await tx.get(nextRef);
    if (taken.exists()) throw new Error('That username is already taken.');

    tx.delete(doc(db, paths.username(currentLower)));
    tx.set(nextRef, { uid, createdAt: serverTimestamp() });
    tx.update(profileRef, {
      username,
      usernameLower,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Delete the documents a user owns, ahead of deleting their auth account.
 *
 * Releasing the username reservation is the important part — otherwise the
 * name stays claimed by an account that no longer exists and nobody, including
 * the original owner, can ever use it again.
 *
 * This runs as the user, so it can only reach what the rules allow. Deep
 * cleanup (their posts, uploaded photos, push tokens, notification history)
 * lands with the Cloud Functions in the notifications step, where an
 * `onUserDeleted` trigger can cascade properly.
 */
export async function deleteOwnUserData(uid: string): Promise<void> {
  const profileSnapshot = await getDoc(doc(db, paths.user(uid)));
  const usernameLower = profileSnapshot.exists()
    ? (profileSnapshot.get('usernameLower') as string | undefined)
    : undefined;

  const batch = writeBatch(db);
  if (usernameLower) {
    batch.delete(doc(db, paths.username(usernameLower)));
  }
  batch.delete(doc(db, paths.userPrivate(uid)));
  batch.delete(doc(db, paths.user(uid)));
  await batch.commit();
}

/** Presence of `admins/{uid}` is what grants review powers. */
export async function isAdmin(uid: string): Promise<boolean> {
  try {
    const snapshot = await getDoc(doc(db, paths.admin(uid)));
    return snapshot.exists();
  } catch {
    // Rules deny reading other people's admin docs; treat any failure as "no".
    return false;
  }
}
