import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as queryLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { paths } from '@/lib/db/paths';
import { db } from '@/lib/firebase';
import { SCHEMA_VERSION, type CalendarEvent } from '@/types/models';

export const EVENT_TITLE_MAX = 100;
export const EVENT_TEXT_MAX = 2000;

function toEvent(id: string, data: CalendarEvent): CalendarEvent {
  return { ...data, id };
}

/**
 * Published events from a given moment onwards, soonest first.
 *
 * The cutoff is a parameter rather than `new Date()` inside, so "what's coming
 * up" and "what happened recently" are the same query with a different bound —
 * and so the boundary is testable.
 */
export async function fetchEvents(from: Date = new Date()): Promise<CalendarEvent[]> {
  const snapshot = await getDocs(
    query(
      collection(db, paths.events),
      where('published', '==', true),
      where('startsAt', '>=', from),
      orderBy('startsAt', 'asc'),
      queryLimit(50),
    ),
  );
  return snapshot.docs.map((entry) => toEvent(entry.id, entry.data() as CalendarEvent));
}

/** Everything, drafts and past dates included. Admin only. */
export function subscribeToAllEvents(
  onChange: (events: CalendarEvent[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, paths.events), orderBy('startsAt', 'desc'), queryLimit(100)),
    (snapshot) =>
      onChange(snapshot.docs.map((entry) => toEvent(entry.id, entry.data() as CalendarEvent))),
    (error) => onError?.(error),
  );
}

export async function getEvent(id: string): Promise<CalendarEvent | null> {
  const snapshot = await getDoc(doc(db, paths.event(id)));
  return snapshot.exists() ? toEvent(snapshot.id, snapshot.data() as CalendarEvent) : null;
}

export type EventDraft = {
  title: string;
  description: string;
  location: string;
  startsAt: Date | null;
  endsAt: Date | null;
  allDay: boolean;
  href: string;
  published: boolean;
};

function shape(draft: EventDraft) {
  if (!draft.title.trim()) throw new Error('Give it a title.');
  if (!draft.startsAt) throw new Error('Pick a date.');
  if (draft.endsAt && draft.endsAt < draft.startsAt) {
    throw new Error('It has to end after it starts.');
  }
  return {
    title: draft.title.trim().slice(0, EVENT_TITLE_MAX),
    description: draft.description.trim().slice(0, EVENT_TEXT_MAX),
    location: draft.location.trim().slice(0, 200),
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    allDay: draft.allDay,
    href: draft.href.trim() || null,
    published: draft.published,
  };
}

export async function createEvent(
  adminUid: string,
  draft: EventDraft,
): Promise<string> {
  const reference = await addDoc(collection(db, paths.events), {
    schemaVersion: SCHEMA_VERSION,
    ...shape(draft),
    createdBy: adminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return reference.id;
}

export async function updateEvent(id: string, draft: EventDraft): Promise<void> {
  await updateDoc(doc(db, paths.event(id)), {
    ...shape(draft),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, paths.event(id)));
}

export function emptyEventDraft(): EventDraft {
  return {
    title: '',
    description: '',
    location: '',
    startsAt: null,
    endsAt: null,
    allDay: true,
    href: '',
    published: false,
  };
}

export function draftFromEvent(event: CalendarEvent): EventDraft {
  return {
    title: event.title,
    description: event.description,
    location: event.location,
    startsAt: event.startsAt?.toDate() ?? null,
    endsAt: event.endsAt?.toDate() ?? null,
    allDay: event.allDay,
    href: event.href ?? '',
    published: event.published,
  };
}
