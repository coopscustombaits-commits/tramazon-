import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as queryLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { paths } from '@/lib/db/paths';
import { db } from '@/lib/firebase';
import { slugify } from '@/lib/slug';
import {
  SCHEMA_VERSION,
  type Review,
  type ReviewKind,
  type ReviewSummary,
  type UserProfile,
} from '@/types/models';

export const REVIEW_MAX = 1500;
export const RATING_MIN = 1;
export const RATING_MAX = 5;

/**
 * The id a bait's reviews live under.
 *
 * People type "Chatterbait", "chatter bait", "CHATTERBAIT" — without a slug
 * those are three different baits with one review each instead of one bait
 * with three.
 */
export function baitId(name: string): string | null {
  return slugify(name);
}

function toReview(id: string, data: Review): Review {
  return { ...data, id };
}

/** The aggregate: how many reviews and what they average. */
export function subscribeToReviewSummary(
  kind: ReviewKind,
  subjectId: string,
  onChange: (summary: ReviewSummary | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, paths.reviewSummary(kind, subjectId)),
    (snapshot) =>
      onChange(
        snapshot.exists()
          ? { ...(snapshot.data() as ReviewSummary), id: snapshot.id }
          : null,
      ),
    (error) => onError?.(error),
  );
}

export function subscribeToReviews(
  kind: ReviewKind,
  subjectId: string,
  onChange: (reviews: Review[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, paths.reviews(kind, subjectId)),
      orderBy('createdAt', 'desc'),
      queryLimit(50),
    ),
    (snapshot) =>
      onChange(snapshot.docs.map((entry) => toReview(entry.id, entry.data() as Review))),
    (error) => onError?.(error),
  );
}

/** Your own review of this thing, if you've written one. */
export async function fetchMyReview(
  kind: ReviewKind,
  subjectId: string,
  uid: string,
): Promise<Review | null> {
  const snapshot = await getDoc(doc(db, paths.review(kind, subjectId, uid)));
  return snapshot.exists() ? toReview(snapshot.id, snapshot.data() as Review) : null;
}

/**
 * Write (or rewrite) your review.
 *
 * The document id is your uid, so this is a `setDoc` rather than an `addDoc`:
 * one review per person per thing, and editing yours replaces it instead of
 * adding a second. The summary above it is recalculated by a Cloud Function.
 *
 * The summary document is created here if it's missing, because the client is
 * the only side that knows the display title — but every counted field on it
 * starts at zero and stays server-owned from then on.
 */
export async function submitReview(input: {
  kind: ReviewKind;
  subjectId: string;
  /** Product title or bait name, for the summary document. */
  title: string;
  profile: UserProfile;
  rating: number;
  text: string;
}): Promise<void> {
  const { kind, subjectId, profile } = input;
  const rating = Math.round(input.rating);
  if (rating < RATING_MIN || rating > RATING_MAX) {
    throw new Error('Pick a rating from 1 to 5 stars.');
  }

  const summaryRef = doc(db, paths.reviewSummary(kind, subjectId));
  const summary = await getDoc(summaryRef);
  if (!summary.exists()) {
    await setDoc(summaryRef, {
      schemaVersion: SCHEMA_VERSION,
      title: input.title.trim(),
      reviewCount: 0,
      ratingSum: 0,
      ratingAverage: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await setDoc(doc(db, paths.review(kind, subjectId, profile.uid)), {
    schemaVersion: SCHEMA_VERSION,
    kind,
    subjectId,
    authorId: profile.uid,
    author: {
      uid: profile.uid,
      username: profile.username,
      photoURL: profile.photoURL,
    },
    rating,
    text: input.text.trim().slice(0, REVIEW_MAX),
    // Never asserted by the client. A Cloud Function checks the order history
    // and flips it, which is the only reason the badge is worth anything.
    verifiedPurchase: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteReview(
  kind: ReviewKind,
  subjectId: string,
  uid: string,
): Promise<void> {
  await deleteDoc(doc(db, paths.review(kind, subjectId, uid)));
}

/**
 * Baits the community has reviewed, best rated first.
 *
 * Only baits with a review exist as documents, so this is the whole list —
 * there's no catalogue of baits to reconcile against.
 */
export async function fetchReviewedBaits(): Promise<ReviewSummary[]> {
  const snapshot = await getDocs(
    query(
      collection(db, paths.reviewRoot('bait')),
      orderBy('ratingAverage', 'desc'),
      queryLimit(50),
    ),
  );
  return snapshot.docs.map((entry) => ({
    ...(entry.data() as ReviewSummary),
    id: entry.id,
  }));
}

/** "4.5" — one decimal, or null when nothing has been rated yet. */
export function formatRating(summary: ReviewSummary | null): string | null {
  if (!summary || summary.reviewCount === 0) return null;
  return summary.ratingAverage.toFixed(1);
}
