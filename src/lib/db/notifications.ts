import {
  collection,
  doc,
  getDocs,
  limit as queryLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';

import { paths } from '@/lib/db/paths';
import { db } from '@/lib/firebase';
import type { AppNotification, UserPrivate } from '@/types/models';

/**
 * In-app notification history.
 *
 * Cloud Functions write these documents at the same moment they send the push,
 * so the list is the record of what was sent — including anything that arrived
 * while notifications were switched off at the OS level.
 */

const HISTORY_LIMIT = 50;

export function subscribeToNotifications(
  uid: string,
  onChange: (notifications: AppNotification[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, paths.userNotifications(uid)),
      orderBy('createdAt', 'desc'),
      queryLimit(HISTORY_LIMIT),
    ),
    (snapshot) =>
      onChange(
        snapshot.docs.map((entry) => ({
          ...(entry.data() as AppNotification),
          id: entry.id,
        })),
      ),
    (error) => onError?.(error),
  );
}

export function unreadCount(notifications: AppNotification[]): number {
  return notifications.filter((notification) => notification.readAt === null).length;
}

export async function markNotificationRead(
  uid: string,
  notificationId: string,
): Promise<void> {
  // `readAt` is the only field the rules let a client touch here.
  await updateDoc(doc(db, `${paths.userNotifications(uid)}/${notificationId}`), {
    readAt: serverTimestamp(),
  });
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  const snapshot = await getDocs(
    query(
      collection(db, paths.userNotifications(uid)),
      orderBy('createdAt', 'desc'),
      queryLimit(HISTORY_LIMIT),
    ),
  );

  const unread = snapshot.docs.filter((entry) => entry.get('readAt') === null);
  if (unread.length === 0) return;

  const batch = writeBatch(db);
  unread.forEach((entry) => batch.update(entry.ref, { readAt: serverTimestamp() }));
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export type NotificationPrefs = UserPrivate['notificationPrefs'];

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  postApproved: true,
  postLiked: true,
  postCommented: true,
  newFollower: true,
  messages: true,
  announcements: true,
};

/**
 * Preferences live under `users/{uid}/private/profile`, which only the owner
 * can read. Cloud Functions check them before sending.
 */
export function subscribeToNotificationPrefs(
  uid: string,
  onChange: (prefs: NotificationPrefs) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, paths.userPrivate(uid)),
    (snapshot) => {
      const stored = snapshot.get('notificationPrefs') as Partial<NotificationPrefs> | undefined;
      // Anything missing defaults to on, so a category added later isn't
      // silently off for existing accounts.
      onChange({ ...DEFAULT_NOTIFICATION_PREFS, ...stored });
    },
    (error) => onError?.(error),
  );
}

export async function setNotificationPref(
  uid: string,
  key: keyof NotificationPrefs,
  enabled: boolean,
): Promise<void> {
  await updateDoc(doc(db, paths.userPrivate(uid)), {
    [`notificationPrefs.${key}`]: enabled,
    updatedAt: serverTimestamp(),
  });
}
