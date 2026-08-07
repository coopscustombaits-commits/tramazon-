import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';

import { paths } from '@/lib/db/paths';
import { db } from '@/lib/firebase';

/**
 * Expo push notifications.
 *
 * The sending side lives in Cloud Functions (`functions/src/index.ts`); this
 * file only handles the device end: asking permission, registering the token,
 * and deciding how a notification behaves while the app is open.
 *
 * Push does not work in Expo Go on either platform any more — a development
 * build is required. Registration fails softly so the rest of the app keeps
 * working.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Android needs an explicit channel or notifications arrive silently. */
async function configureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2E4A3D',
  });
}

function projectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  );
}

export type PushRegistrationResult =
  | { status: 'registered'; token: string }
  | { status: 'denied' }
  | { status: 'unavailable'; reason: string };

/**
 * Ask for permission and store this device's Expo push token under the user.
 *
 * Tokens are stored one per document keyed by the token itself, so the same
 * account on a phone and a tablet gets both.
 */
export async function registerForPushNotifications(
  uid: string,
): Promise<PushRegistrationResult> {
  if (!Device.isDevice) {
    return { status: 'unavailable', reason: 'Push notifications need a physical device.' };
  }

  await configureAndroidChannel();

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted && existing.canAskAgain) {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.granted;
  }
  if (!granted) {
    return { status: 'denied' };
  }

  const id = projectId();
  if (!id) {
    return {
      status: 'unavailable',
      reason:
        'No EAS project ID. Run `eas init` and set EAS_PROJECT_ID in .env (see docs/SETUP.md §6).',
    };
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await setDoc(
      doc(db, paths.userPushToken(uid, token)),
      {
        token,
        platform: Platform.OS,
        deviceName: Device.deviceName ?? null,
        lastSeenAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return { status: 'registered', token };
  } catch (error) {
    return {
      status: 'unavailable',
      reason: error instanceof Error ? error.message : 'Could not get a push token.',
    };
  }
}

/**
 * Drop this device's token on log out, so the next person to use the phone
 * doesn't receive the previous user's notifications.
 */
export async function unregisterPushToken(uid: string): Promise<void> {
  try {
    const id = projectId();
    if (!id) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await deleteDoc(doc(db, paths.userPushToken(uid, token)));
  } catch {
    // No token on this device, or no permission — nothing to remove.
  }
}

/** Deep link carried by a notification, e.g. `/post/abc123`. */
export function hrefFromNotification(
  notification: Notifications.NotificationResponse,
): string | null {
  const data = notification.notification.request.content.data as
    | { href?: unknown }
    | undefined;
  return typeof data?.href === 'string' ? data.href : null;
}
