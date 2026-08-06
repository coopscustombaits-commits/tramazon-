import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { ComingSoon } from '@/components/coming-soon';
import { Screen, ScreenLoader } from '@/components/ui/screen';
import { useAuth } from '@/lib/auth/auth-context';

/**
 * Admin-only review queue. Built in Phase 1, step 4.
 *
 * This screen hides itself from non-admins, but that is only a courtesy —
 * the actual guarantee is in firestore.rules, which is the only thing an
 * attacker can't bypass.
 */
export default function AdminReviewScreen() {
  const router = useRouter();
  const { isAdmin, status } = useAuth();

  useEffect(() => {
    if (status === 'signed-in' && !isAdmin) {
      router.replace('/(tabs)');
    }
  }, [isAdmin, status, router]);

  if (!isAdmin) {
    return <ScreenLoader />;
  }

  return (
    <Screen>
      <ComingSoon
        title="Review queue"
        icon="shield-checkmark-outline"
        summary="Pending posts will queue up here for you to approve or reject."
        items={[
          'Photo, caption, and who posted it',
          'Approve — the post goes live and the angler gets a push',
          'Reject — the post is removed from the queue',
        ]}
      />
    </Screen>
  );
}
