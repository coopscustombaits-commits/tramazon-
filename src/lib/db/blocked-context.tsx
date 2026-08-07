import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/lib/auth/auth-context';
import { blockUser, subscribeToBlockedUsers, unblockUser } from '@/lib/db/safety';
import type { BlockedUser } from '@/types/models';

/**
 * Who this user has blocked, held in one place.
 *
 * Firestore can't express "every post except these authors" as a query — there
 * is no server-side `not-in` that scales — so the block list is loaded once and
 * applied when rendering. That's fine for a community this size, and it means
 * blocking takes effect instantly across every screen rather than after a
 * refetch.
 */

type BlockedContextValue = {
  blocked: BlockedUser[];
  blockedIds: Set<string>;
  isBlocked: (uid: string) => boolean;
  /** Filter any list of things that have an author. */
  filterBlocked: <T extends { authorId: string }>(items: T[]) => T[];
  block: (user: { uid: string; username: string }) => Promise<void>;
  unblock: (uid: string) => Promise<void>;
};

const BlockedContext = createContext<BlockedContextValue | null>(null);

export function BlockedProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeToBlockedUsers(user.uid, setBlocked, (error) =>
      console.warn('[blocked] subscription failed', error),
    );
  }, [user]);

  const blockedIds = useMemo(
    () => new Set(blocked.map((entry) => entry.uid)),
    [blocked],
  );

  const isBlocked = useCallback((uid: string) => blockedIds.has(uid), [blockedIds]);

  const filterBlocked = useCallback(
    <T extends { authorId: string }>(items: T[]) =>
      blockedIds.size === 0 ? items : items.filter((item) => !blockedIds.has(item.authorId)),
    [blockedIds],
  );

  const block = useCallback(
    async (target: { uid: string; username: string }) => {
      if (!user) return;
      await blockUser(user.uid, target);
    },
    [user],
  );

  const unblock = useCallback(
    async (uid: string) => {
      if (!user) return;
      await unblockUser(user.uid, uid);
    },
    [user],
  );

  const value = useMemo<BlockedContextValue>(
    () => ({ blocked, blockedIds, isBlocked, filterBlocked, block, unblock }),
    [blocked, blockedIds, isBlocked, filterBlocked, block, unblock],
  );

  return <BlockedContext.Provider value={value}>{children}</BlockedContext.Provider>;
}

export function useBlocked(): BlockedContextValue {
  const context = useContext(BlockedContext);
  if (!context) {
    throw new Error('useBlocked must be used inside <BlockedProvider>.');
  }
  return context;
}
