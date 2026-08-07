import { useEffect, useState } from 'react';

import { subscribeToNotifications, unreadCount } from '@/lib/db/notifications';

/**
 * Live count of unread notifications, for the bell badge.
 *
 * Counting client-side from the same subscription the Activity screen uses
 * avoids a second query and a composite index on `readAt` + `createdAt`. It
 * only sees the most recent 50, which is well past the point where a badge
 * says "50+" anyway.
 */
export function useUnreadNotifications(uid: string | null): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!uid) return;
    return subscribeToNotifications(
      uid,
      (notifications) => setCount(unreadCount(notifications)),
      () => setCount(0),
    );
  }, [uid]);

  return uid ? count : 0;
}
