import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { paths } from '@/lib/db/paths';
import { db } from '@/lib/firebase';
import {
  SCHEMA_VERSION,
  type AccountStatus,
  type GlobalStats,
  type RemoteConfig,
} from '@/types/models';

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------

/**
 * Live totals for the dashboard.
 *
 * The document may not exist until the first Cloud Function increments it —
 * a brand-new project has nothing to count — so `null` means "nothing yet",
 * not "failed".
 */
export function subscribeToGlobalStats(
  onChange: (stats: GlobalStats | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, paths.globalStats),
    (snapshot) => onChange(snapshot.exists() ? (snapshot.data() as GlobalStats) : null),
    (error) => onError?.(error),
  );
}

// ---------------------------------------------------------------------------
// Remote config
// ---------------------------------------------------------------------------

/** What the app assumes when nothing has been configured: everything on. */
export const DEFAULT_CONFIG: RemoteConfig = {
  schemaVersion: SCHEMA_VERSION,
  maintenanceMode: false,
  maintenanceMessage: '',
  announcementBanner: '',
  postingEnabled: true,
  messagingEnabled: true,
  updatedBy: null,
  createdAt: null,
  updatedAt: null,
};

/**
 * Live remote config.
 *
 * Falls back to `DEFAULT_CONFIG` on a missing document *or* on a read failure.
 * That direction matters: a config read that fails should never be able to
 * take the app down, so the failure mode is "everything works" rather than
 * "everything is in maintenance mode".
 */
export function subscribeToRemoteConfig(
  onChange: (config: RemoteConfig) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, paths.remoteConfig),
    (snapshot) =>
      onChange(
        snapshot.exists()
          ? { ...DEFAULT_CONFIG, ...(snapshot.data() as Partial<RemoteConfig>) }
          : DEFAULT_CONFIG,
      ),
    (error) => {
      console.warn('[config] could not read remote config', error);
      onChange(DEFAULT_CONFIG);
    },
  );
}

export async function saveRemoteConfig(
  adminUid: string,
  config: Partial<RemoteConfig>,
): Promise<void> {
  await setDoc(
    doc(db, paths.remoteConfig),
    {
      schemaVersion: SCHEMA_VERSION,
      ...config,
      updatedBy: adminUid,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

// ---------------------------------------------------------------------------
// Managing users
// ---------------------------------------------------------------------------

/**
 * Suspend, ban, or reinstate an account.
 *
 * The security rules let an admin change these two fields and nothing else on
 * somebody's profile — not their bio, not their username, and not their
 * points. A moderation tool that can also rewrite someone's profile is a
 * bigger blast radius than the job needs.
 *
 * A suspension with no `until` is indefinite; the app treats both the same
 * way, and `until` exists so a temporary one can be explained and lifted.
 */
export async function setAccountStatus(
  uid: string,
  status: AccountStatus,
  until: Date | null = null,
): Promise<void> {
  await updateDoc(doc(db, paths.user(uid)), {
    accountStatus: status,
    suspendedUntil: status === 'suspended' ? until : null,
    updatedAt: serverTimestamp(),
  });
}

/** Read one profile, for the manage-users detail sheet. */
export async function fetchProfileForAdmin(uid: string) {
  const snapshot = await getDoc(doc(db, paths.user(uid)));
  return snapshot.exists() ? snapshot.data() : null;
}

/** Plain-language label for an account state. */
export function accountStatusLabel(status: AccountStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'suspended':
      return 'Suspended';
    case 'banned':
      return 'Banned';
    default:
      return status;
  }
}
