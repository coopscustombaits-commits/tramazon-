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
import { deleteFile } from '@/lib/storage/media';
import {
  SCHEMA_VERSION,
  type Competition,
  type CompetitionKind,
  type CompetitionScoring,
  type Post,
} from '@/types/models';

export const COMPETITION_TITLE_MAX = 100;
export const COMPETITION_TEXT_MAX = 2000;
/** How many entries a leaderboard shows. Past this, nobody scrolls. */
export const LEADERBOARD_SIZE = 25;

function toCompetition(id: string, data: Competition): Competition {
  return { ...data, id };
}

/**
 * Published competitions of one kind, soonest to end first.
 *
 * Ordered by `endsAt` rather than creation: what an angler wants to see first
 * is the thing about to close, not the thing most recently added.
 */
export async function fetchCompetitions(kind: CompetitionKind): Promise<Competition[]> {
  const snapshot = await getDocs(
    query(
      collection(db, paths.competitionRoot(kind)),
      where('published', '==', true),
      orderBy('endsAt', 'asc'),
      queryLimit(50),
    ),
  );
  return snapshot.docs.map((entry) =>
    toCompetition(entry.id, entry.data() as Competition),
  );
}

/** Everything including drafts. Admin only — the rules refuse it otherwise. */
export function subscribeToAllCompetitions(
  kind: CompetitionKind,
  onChange: (competitions: Competition[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, paths.competitionRoot(kind)),
      orderBy('createdAt', 'desc'),
      queryLimit(100),
    ),
    (snapshot) =>
      onChange(
        snapshot.docs.map((entry) => toCompetition(entry.id, entry.data() as Competition)),
      ),
    (error) => onError?.(error),
  );
}

export async function getCompetition(
  kind: CompetitionKind,
  id: string,
): Promise<Competition | null> {
  const snapshot = await getDoc(doc(db, paths.competition(kind, id)));
  return snapshot.exists()
    ? toCompetition(snapshot.id, snapshot.data() as Competition)
    : null;
}

export function subscribeToCompetition(
  kind: CompetitionKind,
  id: string,
  onChange: (competition: Competition | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, paths.competition(kind, id)),
    (snapshot) =>
      onChange(
        snapshot.exists()
          ? toCompetition(snapshot.id, snapshot.data() as Competition)
          : null,
      ),
    (error) => onError?.(error),
  );
}

/**
 * The leaderboard: approved entries, ranked.
 *
 * This is a plain query over `posts`, not an aggregate document, so it cannot
 * drift out of sync with the entries. `likeCount` is server-written and denied
 * to clients, which is the part that makes the ranking trustworthy.
 */
export async function fetchLeaderboard(
  kind: CompetitionKind,
  competitionId: string,
  scoring: CompetitionScoring,
): Promise<Post[]> {
  const field = kind === 'challenge' ? 'challengeId' : 'tournamentId';
  const snapshot = await getDocs(
    query(
      collection(db, paths.posts),
      where(field, '==', competitionId),
      where('status', '==', 'approved'),
      // 'admin_pick' puts Coop's featured entries on top, then the community's
      // favourites underneath — so a pick doesn't erase the popular vote.
      ...(scoring === 'admin_pick' ? [orderBy('featured', 'desc')] : []),
      orderBy('likeCount', 'desc'),
      queryLimit(LEADERBOARD_SIZE),
    ),
  );
  return snapshot.docs.map((entry) => ({
    ...(entry.data() as Post),
    id: entry.id,
  }));
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export type CompetitionDraft = {
  title: string;
  description: string;
  prize: string;
  speciesSlug: string | null;
  scoring: CompetitionScoring;
  startsAt: Date | null;
  endsAt: Date | null;
  published: boolean;
};

function shape(kind: CompetitionKind, draft: CompetitionDraft) {
  if (!draft.title.trim()) throw new Error('Give it a title.');
  if (draft.startsAt && draft.endsAt && draft.endsAt <= draft.startsAt) {
    throw new Error('It has to end after it starts.');
  }
  return {
    kind,
    title: draft.title.trim().slice(0, COMPETITION_TITLE_MAX),
    description: draft.description.trim().slice(0, COMPETITION_TEXT_MAX),
    prize: draft.prize.trim().slice(0, 200),
    speciesSlug: draft.speciesSlug,
    scoring: draft.scoring,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    published: draft.published,
  };
}

export async function createCompetition(
  kind: CompetitionKind,
  adminUid: string,
  draft: CompetitionDraft,
): Promise<string> {
  const reference = await addDoc(collection(db, paths.competitionRoot(kind)), {
    schemaVersion: SCHEMA_VERSION,
    ...shape(kind, draft),
    coverImageUrl: null,
    coverStoragePath: null,
    entryCount: 0,
    winnerPostId: null,
    winnerUid: null,
    createdBy: adminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return reference.id;
}

export async function updateCompetition(
  kind: CompetitionKind,
  id: string,
  draft: CompetitionDraft,
): Promise<void> {
  await updateDoc(doc(db, paths.competition(kind, id)), {
    ...shape(kind, draft),
    updatedAt: serverTimestamp(),
  });
}

/** Declare a winner. Separate from editing so it reads as its own decision. */
export async function setWinner(
  kind: CompetitionKind,
  id: string,
  post: Pick<Post, 'id' | 'authorId'> | null,
): Promise<void> {
  await updateDoc(doc(db, paths.competition(kind, id)), {
    winnerPostId: post?.id ?? null,
    winnerUid: post?.authorId ?? null,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCompetition(
  kind: CompetitionKind,
  competition: Competition,
): Promise<void> {
  await deleteDoc(doc(db, paths.competition(kind, competition.id)));
  if (competition.coverStoragePath) {
    await deleteFile(competition.coverStoragePath);
  }
}

export function emptyCompetitionDraft(): CompetitionDraft {
  return {
    title: '',
    description: '',
    prize: '',
    speciesSlug: null,
    scoring: 'most_likes',
    startsAt: null,
    endsAt: null,
    published: false,
  };
}

export function draftFromCompetition(competition: Competition): CompetitionDraft {
  return {
    title: competition.title,
    description: competition.description,
    prize: competition.prize,
    speciesSlug: competition.speciesSlug,
    scoring: competition.scoring,
    startsAt: competition.startsAt?.toDate() ?? null,
    endsAt: competition.endsAt?.toDate() ?? null,
    published: competition.published,
  };
}
