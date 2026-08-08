import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit as queryLimit,
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
  type AuthorSnapshot,
  type Conversation,
  type DirectMessage,
  type UserProfile,
} from '@/types/models';

export const MESSAGE_MAX = 2000;
/** How far back a thread loads. Older messages are a "load more" away. */
export const MESSAGE_PAGE_SIZE = 100;

/**
 * The id for a one-to-one thread: both uids, sorted, joined with `_`.
 *
 * Deterministic on purpose. If the id were random, two people opening a DM
 * with each other at the same moment would end up in two different threads
 * and neither would see the other's messages. Sorting is what makes it the
 * same id from both sides.
 */
export function conversationId(a: string, b: string): string {
  return [a, b].sort().join('_');
}

function snapshotOf(profile: UserProfile): AuthorSnapshot {
  return { uid: profile.uid, username: profile.username, photoURL: profile.photoURL };
}

/**
 * Get the thread between two people, creating it if it's their first message.
 *
 * `setDoc` with the deterministic id rather than `addDoc`, so a race creates
 * one document twice instead of two documents. Returns the id either way.
 */
export async function openConversation(
  me: UserProfile,
  them: UserProfile,
): Promise<string> {
  const id = conversationId(me.uid, them.uid);
  const reference = doc(db, paths.conversation(id));

  const existing = await getDoc(reference);
  if (existing.exists()) return id;

  await setDoc(reference, {
    schemaVersion: SCHEMA_VERSION,
    participantIds: [me.uid, them.uid].sort(),
    participants: {
      [me.uid]: snapshotOf(me),
      [them.uid]: snapshotOf(them),
    },
    lastMessage: null,
    lastMessageAt: null,
    // Counters start at zero for both sides; only a Cloud Function raises them.
    unread: { [me.uid]: 0, [them.uid]: 0 },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return id;
}

/** The inbox: every thread you're in, most recent activity first. */
export function subscribeToConversations(
  uid: string,
  onChange: (conversations: Conversation[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, paths.conversations),
      where('participantIds', 'array-contains', uid),
      orderBy('lastMessageAt', 'desc'),
      queryLimit(50),
    ),
    (snapshot) =>
      onChange(
        snapshot.docs.map((entry) => ({
          ...(entry.data() as Conversation),
          id: entry.id,
        })),
      ),
    (error) => onError?.(error),
  );
}

/**
 * One thread's messages, oldest first so the list reads top to bottom.
 *
 * The query takes the newest `MESSAGE_PAGE_SIZE` and reverses them in memory —
 * ordering ascending in Firestore would give the *oldest* hundred, which is
 * the wrong end of a long conversation.
 */
export function subscribeToMessages(
  id: string,
  onChange: (messages: DirectMessage[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, paths.conversationMessages(id)),
      orderBy('createdAt', 'desc'),
      queryLimit(MESSAGE_PAGE_SIZE),
    ),
    (snapshot) =>
      onChange(
        snapshot.docs
          .map((entry) => ({ ...(entry.data() as DirectMessage), id: entry.id }))
          .reverse(),
      ),
    (error) => onError?.(error),
  );
}

export function subscribeToConversation(
  id: string,
  onChange: (conversation: Conversation | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, paths.conversation(id)),
    (snapshot) =>
      onChange(
        snapshot.exists()
          ? { ...(snapshot.data() as Conversation), id: snapshot.id }
          : null,
      ),
    (error) => onError?.(error),
  );
}

/**
 * Send a message.
 *
 * Only the message document is written here. The thread's `lastMessage`,
 * `lastMessageAt` and the recipient's unread count are set by a Cloud
 * Function, for the same reason like counts are — a modified client must not
 * be able to forge someone else's unread badge or rewrite a thread preview.
 */
export async function sendMessage(
  id: string,
  senderId: string,
  text: string,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Write something first.');

  await addDoc(collection(db, paths.conversationMessages(id)), {
    schemaVersion: SCHEMA_VERSION,
    conversationId: id,
    senderId,
    text: trimmed.slice(0, MESSAGE_MAX),
    removedAt: null,
    removedBy: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Clear your own unread badge on a thread.
 *
 * The dotted path updates one key of the `unread` map and leaves the other
 * participant's count alone — which is exactly what the security rules
 * require, since zeroing someone else's badge would hide their messages
 * from them.
 */
export async function markConversationRead(id: string, uid: string): Promise<void> {
  await updateDoc(doc(db, paths.conversation(id)), { [`unread.${uid}`]: 0 });
}

/** Delete your own message. Admins delete through the moderation screen. */
export async function deleteMessage(id: string, messageId: string): Promise<void> {
  await deleteDoc(doc(db, paths.conversationMessage(id, messageId)));
}

/**
 * Admin: read one message, to review a report about it.
 *
 * The rules let an admin read a thread precisely so a reported message can be
 * looked at. Reading is all they get — an admin cannot send as somebody else.
 */
export async function fetchMessageForReview(
  conversationId: string,
  messageId: string,
): Promise<DirectMessage | null> {
  const snapshot = await getDoc(doc(db, paths.conversationMessage(conversationId, messageId)));
  return snapshot.exists()
    ? { ...(snapshot.data() as DirectMessage), id: snapshot.id }
    : null;
}

/**
 * Admin: replace a message with a tombstone.
 *
 * Deliberately not a delete. The document stays so the thread doesn't
 * renumber and so the report it came from stays auditable — "this message was
 * removed" is a better answer for both people than a message that silently
 * never existed.
 */
export async function removeMessage(
  conversationId: string,
  messageId: string,
  adminUid: string,
): Promise<void> {
  await updateDoc(doc(db, paths.conversationMessage(conversationId, messageId)), {
    text: '',
    removedAt: serverTimestamp(),
    removedBy: adminUid,
    updatedAt: serverTimestamp(),
  });
}

/** The other person in a one-to-one thread. */
export function otherParticipant(
  conversation: Conversation,
  uid: string,
): AuthorSnapshot | null {
  const otherId = conversation.participantIds.find((id) => id !== uid);
  return otherId ? (conversation.participants[otherId] ?? null) : null;
}
