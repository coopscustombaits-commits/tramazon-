import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

/**
 * Sending Expo push notifications.
 *
 * Expo's push service takes a batch of messages addressed by Expo push token
 * and hands them to APNs / FCM. No Apple or Google server keys are needed here
 * — Expo holds those, configured through EAS credentials.
 *
 * https://docs.expo.dev/push-notifications/sending-notifications/
 */

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
/** Expo accepts at most 100 messages per request. */
const BATCH_SIZE = 100;

export type PushMessage = {
  title: string;
  body: string;
  /** Arbitrary payload; `href` is read by the app to deep link on tap. */
  data?: Record<string, string>;
};

type ExpoPushTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

/** Notification categories a user can turn off. Keys match `notificationPrefs`. */
export type NotificationPreference =
  | 'postApproved'
  | 'postLiked'
  | 'postCommented'
  | 'newFollower'
  | 'messages'
  | 'announcements';

/**
 * Every push token registered to a user. Returns an empty list rather than
 * throwing — a user with no devices is normal, not an error.
 */
export async function tokensForUser(uid: string): Promise<string[]> {
  const snapshot = await getFirestore()
    .collection(`users/${uid}/pushTokens`)
    .get();
  return snapshot.docs.map((entry) => entry.id).filter(Boolean);
}

/** Everyone with an `admins/{uid}` document. */
export async function adminUids(): Promise<string[]> {
  const snapshot = await getFirestore().collection('admins').get();
  return snapshot.docs.map((entry) => entry.id);
}

/**
 * Whether a user wants this kind of notification. Missing preferences mean
 * "yes" — a new category shouldn't be silently off for existing users.
 */
export async function wantsNotification(
  uid: string,
  preference: NotificationPreference,
): Promise<boolean> {
  const snapshot = await getFirestore().doc(`users/${uid}/private/profile`).get();
  const prefs = snapshot.get('notificationPrefs') as
    | Record<string, boolean | undefined>
    | undefined;
  return prefs?.[preference] !== false;
}

/**
 * Send one message to a set of tokens, and drop tokens Expo tells us are dead
 * (the app was uninstalled, or the token was rotated). Leaving those around
 * makes every later send slower and noisier.
 */
export async function sendPush(tokens: string[], message: PushMessage): Promise<void> {
  const valid = tokens.filter((token) => token.startsWith('ExponentPushToken'));
  if (valid.length === 0) return;

  const dead: string[] = [];

  for (let index = 0; index < valid.length; index += BATCH_SIZE) {
    const batch = valid.slice(index, index + BATCH_SIZE);
    const payload = batch.map((to) => ({
      to,
      sound: 'default' as const,
      title: message.title,
      body: message.body,
      data: message.data ?? {},
      channelId: 'default',
    }));

    try {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        logger.error('Expo push request failed', {
          status: response.status,
          body: await response.text(),
        });
        continue;
      }

      const result = (await response.json()) as { data?: ExpoPushTicket[] };
      result.data?.forEach((ticket, position) => {
        if (ticket.status === 'error') {
          logger.warn('Expo push ticket error', {
            error: ticket.details?.error,
            message: ticket.message,
          });
          if (ticket.details?.error === 'DeviceNotRegistered') {
            dead.push(batch[position]);
          }
        }
      });
    } catch (error) {
      logger.error('Expo push request threw', { error });
    }
  }

  if (dead.length > 0) {
    await removeDeadTokens(dead);
  }
}

/** Delete a token wherever it's registered. */
async function removeDeadTokens(tokens: string[]): Promise<void> {
  const db = getFirestore();
  await Promise.all(
    tokens.map(async (token) => {
      const matches = await db
        .collectionGroup('pushTokens')
        .where('token', '==', token)
        .get();
      await Promise.all(matches.docs.map((entry) => entry.ref.delete()));
    }),
  );
}

/**
 * Record a notification in the user's in-app history and push it to their
 * devices. Both, or the history and the banner drift apart.
 */
export async function notifyUser(
  uid: string,
  notification: {
    type: string;
    title: string;
    body: string;
    href?: string | null;
    data?: Record<string, string>;
    preference?: NotificationPreference;
  },
): Promise<void> {
  if (notification.preference && !(await wantsNotification(uid, notification.preference))) {
    return;
  }

  const db = getFirestore();
  await db.collection(`users/${uid}/notifications`).add({
    schemaVersion: 1,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    href: notification.href ?? null,
    readAt: null,
    data: notification.data ?? {},
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await sendPush(await tokensForUser(uid), {
    title: notification.title,
    body: notification.body,
    data: {
      ...notification.data,
      ...(notification.href ? { href: notification.href } : {}),
    },
  });
}

/**
 * Send one message to many users at once. Not wired to anything yet — this is
 * the plumbing the "announcement" notification type will use.
 */
export async function broadcast(
  uids: string[],
  message: { title: string; body: string; href?: string },
): Promise<void> {
  const tokens = (await Promise.all(uids.map(tokensForUser))).flat();
  await sendPush(tokens, {
    title: message.title,
    body: message.body,
    data: message.href ? { href: message.href } : {},
  });
}
