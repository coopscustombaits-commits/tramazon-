import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { paths } from '@/lib/db/paths';
import { db } from '@/lib/firebase';
import type { Follow } from '@/types/models';

/**
 * Following.
 *
 * Edges live in a flat `follows` collection keyed `{follower}_{following}`, so
 * following twice is the same write and un-following is one delete. The
 * counters on each profile are maintained by Cloud Functions — a client that
 * could write its own follower count could claim any number it liked.
 */

/** Live "am I following this person" for a follow button. */
export function subscribeToIsFollowing(
  followerId: string,
  followingId: string,
  onChange: (following: boolean) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, paths.follow(followerId, followingId)),
    (snapshot) => onChange(snapshot.exists()),
    () => onChange(false),
  );
}

export async function followUser(followerId: string, followingId: string): Promise<void> {
  if (followerId === followingId) {
    throw new Error("You can't follow yourself.");
  }
  await setDoc(doc(db, paths.follow(followerId, followingId)), {
    followerId,
    followingId,
    createdAt: serverTimestamp(),
  });
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  await deleteDoc(doc(db, paths.follow(followerId, followingId)));
}

/** Everyone this user follows. */
export async function fetchFollowingIds(uid: string): Promise<string[]> {
  const snapshot = await getDocs(
    query(collection(db, paths.follows), where('followerId', '==', uid)),
  );
  return snapshot.docs.map((entry) => (entry.data() as Follow).followingId);
}

/** Everyone following this user. */
export async function fetchFollowerIds(uid: string): Promise<string[]> {
  const snapshot = await getDocs(
    query(
      collection(db, paths.follows),
      where('followingId', '==', uid),
      orderBy('createdAt', 'desc'),
    ),
  );
  return snapshot.docs.map((entry) => (entry.data() as Follow).followerId);
}
