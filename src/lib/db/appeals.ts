import {
  collection,
  getDocs,
  limit as queryLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  doc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { paths } from '@/lib/db/paths';
import { db } from '@/lib/firebase';
import {
  SCHEMA_VERSION,
  type Appeal,
  type AppealKind,
  type AppealStatus,
  type UserProfile,
} from '@/types/models';

export const APPEAL_MAX = 1000;

function toAppeal(id: string, data: Appeal): Appeal {
  return { ...data, id };
}

/**
 * The id for an appeal: the kind, the appellant, and what it's about.
 *
 * Deterministic so appealing the same decision twice overwrites rather than
 * floods the queue — someone who's just had a post rejected will tap it more
 * than once, and a queue full of the same complaint helps nobody.
 */
export function appealId(kind: AppealKind, uid: string, targetId: string): string {
  return `${kind}__${uid}__${targetId}`;
}

/** File an appeal, or replace your earlier one about the same thing. */
export async function submitAppeal(input: {
  profile: UserProfile;
  kind: AppealKind;
  targetId: string;
  message: string;
}): Promise<void> {
  const text = input.message.trim();
  if (!text) throw new Error('Say what you want Coop to look at.');

  const id = appealId(input.kind, input.profile.uid, input.targetId);
  await setDoc(doc(db, paths.appeal(id)), {
    schemaVersion: SCHEMA_VERSION,
    uid: input.profile.uid,
    username: input.profile.username,
    kind: input.kind,
    targetId: input.targetId,
    message: text.slice(0, APPEAL_MAX),
    status: 'open',
    decisionNote: null,
    reviewedAt: null,
    reviewedBy: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Your own appeals, so you can see what came of them. */
export async function fetchMyAppeals(uid: string): Promise<Appeal[]> {
  const snapshot = await getDocs(
    query(
      collection(db, paths.appeals),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      queryLimit(25),
    ),
  );
  return snapshot.docs.map((entry) => toAppeal(entry.id, entry.data() as Appeal));
}

/** The admin queue: open appeals, oldest first. */
export function subscribeToOpenAppeals(
  onChange: (appeals: Appeal[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, paths.appeals),
      where('status', '==', 'open'),
      orderBy('createdAt', 'asc'),
      queryLimit(50),
    ),
    (snapshot) =>
      onChange(snapshot.docs.map((entry) => toAppeal(entry.id, entry.data() as Appeal))),
    (error) => onError?.(error),
  );
}

/**
 * Decide an appeal.
 *
 * Deciding it doesn't undo anything by itself — granting an appeal about a
 * post still leaves re-approving the post as a separate, deliberate act. An
 * appeal that silently reversed a moderation decision would make the two
 * impossible to tell apart afterwards.
 */
export async function decideAppeal(
  id: string,
  adminUid: string,
  status: Exclude<AppealStatus, 'open'>,
  note: string,
): Promise<void> {
  await updateDoc(doc(db, paths.appeal(id)), {
    status,
    decisionNote: note.trim() || null,
    reviewedAt: serverTimestamp(),
    reviewedBy: adminUid,
    updatedAt: serverTimestamp(),
  });
}

export function appealStatusLabel(status: AppealStatus): string {
  switch (status) {
    case 'open':
      return 'Waiting on Coop';
    case 'granted':
      return 'Overturned';
    case 'denied':
      return 'Upheld';
    default:
      return status;
  }
}
