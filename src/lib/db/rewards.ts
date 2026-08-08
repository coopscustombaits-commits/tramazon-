import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit as queryLimit,
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
import type { BadgeDraft } from '@/lib/rewards';
import {
  SCHEMA_VERSION,
  type Badge,
  type BadgeAward,
  type PointsEntry,
  type UserProfile,
} from '@/types/models';

// The scoring table, the labels, and the starter badge set are pure — no
// Firebase — so they live next door and can be unit tested directly.
export {
  POINT_VALUES,
  STARTER_BADGES,
  badgeMetricLabel,
  pointsReasonLabel,
  type BadgeDraft,
} from '@/lib/rewards';

/** How many anglers the all-time leaderboard shows. */
export const LEADERBOARD_SIZE = 50;

// ---------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------

/** Your points history, newest first. Private to you. */
export function subscribeToPointsLedger(
  uid: string,
  onChange: (entries: PointsEntry[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, paths.userPointsLedger(uid)),
      orderBy('createdAt', 'desc'),
      queryLimit(100),
    ),
    (snapshot) =>
      onChange(
        snapshot.docs.map((entry) => ({
          ...(entry.data() as PointsEntry),
          id: entry.id,
        })),
      ),
    (error) => onError?.(error),
  );
}

/**
 * The all-time angler leaderboard.
 *
 * Ranks on `points`, which is server-written and denied to clients by the
 * security rules — that denial is the entire reason the ranking is worth
 * showing.
 */
export async function fetchTopAnglers(): Promise<UserProfile[]> {
  const snapshot = await getDocs(
    query(
      collection(db, paths.users),
      where('accountStatus', '==', 'active'),
      orderBy('points', 'desc'),
      queryLimit(LEADERBOARD_SIZE),
    ),
  );
  return snapshot.docs.map((entry) => entry.data() as UserProfile);
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

/** Every published badge definition, in display order. */
export async function fetchBadges(includeUnpublished = false): Promise<Badge[]> {
  const snapshot = await getDocs(
    includeUnpublished
      ? query(collection(db, paths.badges), orderBy('order', 'asc'))
      : query(
          collection(db, paths.badges),
          where('published', '==', true),
          orderBy('order', 'asc'),
        ),
  );
  return snapshot.docs.map((entry) => ({
    ...(entry.data() as Badge),
    id: entry.id,
  }));
}

/** What one angler has earned. Public — badges are meant to be seen. */
export function subscribeToBadgeAwards(
  uid: string,
  onChange: (awards: BadgeAward[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, paths.userBadges(uid)), orderBy('awardedAt', 'desc')),
    (snapshot) =>
      onChange(
        snapshot.docs.map((entry) => ({
          ...(entry.data() as BadgeAward),
          id: entry.id,
        })),
      ),
    (error) => onError?.(error),
  );
}

export async function fetchBadgeAwards(uid: string): Promise<BadgeAward[]> {
  const snapshot = await getDocs(
    query(collection(db, paths.userBadges(uid)), orderBy('awardedAt', 'desc')),
  );
  return snapshot.docs.map((entry) => ({
    ...(entry.data() as BadgeAward),
    id: entry.id,
  }));
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/**
 * Create or replace a badge definition.
 *
 * The document id is chosen by Coop rather than generated, because it's also
 * the id of every award of that badge — a generated id would mean a badge
 * renamed in the editor loses its history.
 */
export async function saveBadge(draft: BadgeDraft): Promise<void> {
  if (!draft.id.trim()) throw new Error('Give the badge an id.');
  if (!draft.title.trim()) throw new Error('Give the badge a name.');
  if (!Number.isFinite(draft.threshold) || draft.threshold < 1) {
    throw new Error('The threshold has to be at least 1.');
  }

  await setDoc(
    doc(db, paths.badge(draft.id.trim())),
    {
      schemaVersion: SCHEMA_VERSION,
      title: draft.title.trim(),
      description: draft.description.trim(),
      icon: draft.icon.trim() || 'ribbon',
      metric: draft.metric,
      threshold: Math.round(draft.threshold),
      order: Math.round(draft.order),
      published: draft.published,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    // Merge so re-saving an existing badge keeps its original createdAt.
    { merge: true },
  );
}

export async function deleteBadge(id: string): Promise<void> {
  await deleteDoc(doc(db, paths.badge(id)));
}

/**
 * Hand-adjust someone's points.
 *
 * Written as a ledger entry rather than by editing the total — the rules deny
 * `points` to every client including an admin, and a Cloud Function sums the
 * ledger. That keeps the total explainable even when Coop intervenes.
 */
export async function adjustPoints(
  uid: string,
  amount: number,
  note: string,
): Promise<void> {
  await addDoc(collection(db, paths.userPointsLedger(uid)), {
    schemaVersion: SCHEMA_VERSION,
    amount: Math.round(amount),
    reason: 'admin_adjustment',
    sourceId: null,
    note: note.trim() || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

