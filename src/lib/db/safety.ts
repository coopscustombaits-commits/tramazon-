import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { paths } from '@/lib/db/paths';
import { db } from '@/lib/firebase';
import {
  SCHEMA_VERSION,
  type BlockedUser,
  type Report,
  type ReportReason,
  type ReportTargetType,
} from '@/types/models';

/**
 * Blocking and reporting.
 *
 * Both are required by Apple before an app with user-generated content can be
 * submitted (App Review guideline 1.2), alongside the content filtering and
 * contact page that already exist.
 */

// ---------------------------------------------------------------------------
// Blocking
// ---------------------------------------------------------------------------

export function subscribeToBlockedUsers(
  uid: string,
  onChange: (blocked: BlockedUser[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, paths.userBlocked(uid)), orderBy('createdAt', 'desc')),
    (snapshot) => onChange(snapshot.docs.map((entry) => entry.data() as BlockedUser)),
    (error) => onError?.(error),
  );
}

export async function blockUser(
  uid: string,
  blocked: { uid: string; username: string },
): Promise<void> {
  await setDoc(doc(db, paths.userBlockedUser(uid, blocked.uid)), {
    uid: blocked.uid,
    username: blocked.username,
    createdAt: serverTimestamp(),
  });
}

export async function unblockUser(uid: string, blockedUid: string): Promise<void> {
  await deleteDoc(doc(db, paths.userBlockedUser(uid, blockedUid)));
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'nudity', label: 'Nudity or sexual content' },
  { value: 'violence', label: 'Violence or cruelty' },
  { value: 'spam', label: 'Spam' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'off_topic', label: 'Not about fishing' },
  { value: 'other', label: 'Something else' },
];

export const REPORT_NOTE_MAX = 500;

export type SubmitReportInput = {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  targetOwnerId: string;
  /** For a comment, the post it belongs to. */
  parentId?: string | null;
  reason: ReportReason;
  note?: string;
};

/**
 * File a report. The reporter can create this and nothing else — they can't
 * read the queue or see the outcome, because that would reveal who reported
 * whom.
 */
export async function submitReport(input: SubmitReportInput): Promise<void> {
  await addDoc(collection(db, paths.reports), {
    schemaVersion: SCHEMA_VERSION,
    targetType: input.targetType,
    targetId: input.targetId,
    parentId: input.parentId ?? null,
    targetOwnerId: input.targetOwnerId,
    reporterId: input.reporterId,
    reason: input.reason,
    note: (input.note ?? '').trim().slice(0, REPORT_NOTE_MAX),
    status: 'open',
    reviewedAt: null,
    reviewedBy: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** The admin queue: open reports, oldest first. */
export function subscribeToOpenReports(
  onChange: (reports: Report[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, paths.reports),
      where('status', '==', 'open'),
      orderBy('createdAt', 'asc'),
    ),
    (snapshot) =>
      onChange(snapshot.docs.map((entry) => ({ ...(entry.data() as Report), id: entry.id }))),
    (error) => onError?.(error),
  );
}

export async function resolveReport(
  reportId: string,
  adminUid: string,
  status: 'actioned' | 'dismissed',
): Promise<void> {
  await updateDoc(doc(db, paths.report(reportId)), {
    status,
    reviewedAt: serverTimestamp(),
    reviewedBy: adminUid,
    updatedAt: serverTimestamp(),
  });
}
