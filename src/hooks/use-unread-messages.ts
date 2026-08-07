import { useEffect, useState } from 'react';

import { subscribeToConversations } from '@/lib/db/messages';

/**
 * Live count of unread direct messages, for the inbox badge.
 *
 * Summed from the per-thread `unread` map on the same query the inbox screen
 * runs, so this costs no extra reads beyond the subscription itself.
 */
export function useUnreadMessages(uid: string | null): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!uid) return;
    return subscribeToConversations(
      uid,
      (conversations) =>
        setCount(
          conversations.reduce((total, thread) => total + (thread.unread?.[uid] ?? 0), 0),
        ),
      () => setCount(0),
    );
  }, [uid]);

  return uid ? count : 0;
}
