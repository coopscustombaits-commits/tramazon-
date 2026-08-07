import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { hrefFromNotification, registerForPushNotifications } from '@/lib/notifications';

/**
 * Registers this device for push once the user is signed in, and routes
 * notification taps to the right screen.
 *
 * Call it once, from the root navigator. Registration failures are logged and
 * otherwise ignored — a missing push token should never stop someone using the
 * app (and it always fails in Expo Go, where push isn't supported).
 */
export function usePushNotifications(uid: string | null): void {
  const router = useRouter();
  /** Guards against re-registering on every render for the same account. */
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!uid || registeredFor.current === uid) return;
    registeredFor.current = uid;

    void registerForPushNotifications(uid).then((result) => {
      if (result.status === 'unavailable') {
        console.warn('[push] not registered:', result.reason);
      }
    });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;

    // A tap while the app is running or backgrounded.
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const href = hrefFromNotification(response);
        if (href) router.push(href as never);
      },
    );

    // A tap that launched the app from cold.
    let cancelled = false;
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (cancelled || !response) return;
      const href = hrefFromNotification(response);
      if (href) router.push(href as never);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [uid, router]);
}
