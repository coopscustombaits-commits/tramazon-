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
  setDoc,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import { paths, storagePaths } from '@/lib/db/paths';
import { db } from '@/lib/firebase';
import { extractKeywords } from '@/lib/search';
import { speciesSlug } from '@/lib/species';
import { deleteFile, mediaFileName, uploadFile } from '@/lib/storage/media';
import {
  SCHEMA_VERSION,
  type AuthorSnapshot,
  type MediaKind,
  type Post,
  type PostComment,
  type UserProfile,
} from '@/types/models';

export const FEED_PAGE_SIZE = 10;
export const CAPTION_MAX = 2000;

/** A page of posts plus the cursor needed to ask for the next one. */
export type PostPage = {
  posts: Post[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  /** False once the last page has been read. */
  hasMore: boolean;
};

function toPost(snapshot: QueryDocumentSnapshot<DocumentData>): Post {
  return { ...(snapshot.data() as Post), id: snapshot.id };
}

function authorSnapshot(profile: UserProfile): AuthorSnapshot {
  return {
    uid: profile.uid,
    username: profile.username,
    photoURL: profile.photoURL,
  };
}

// ---------------------------------------------------------------------------
// Creating
// ---------------------------------------------------------------------------

export type CreatePostInput = {
  profile: UserProfile;
  /** Local file URI from expo-image-picker. */
  uri: string;
  kind: MediaKind;
  width: number;
  height: number;
  /** Videos only. */
  durationMs?: number | null;
  /** Videos only: local URI of a generated poster frame. */
  thumbnailUri?: string | null;
  caption: string;
  species?: string | null;
  /** Entering a challenge or tournament. Decided at post time — the security
   *  rules only accept an id for a competition that's open right now. */
  challengeId?: string | null;
  tournamentId?: string | null;
};

/**
 * Upload the media, then write the post as `pending`.
 *
 * The file goes up first because the security rules require the post document
 * to already carry a storage path — and because an upload that fails halfway
 * should not leave a post pointing at nothing. If the document write fails, we
 * clean the orphaned uploads back out.
 */
export async function createPost(input: CreatePostInput): Promise<string> {
  const { profile, uri, kind, caption } = input;

  const uploaded = await uploadFile(
    uri,
    storagePaths.postMedia(profile.uid, mediaFileName(uri, kind === 'video' ? 'clip' : 'catch')),
  );

  // Videos need a poster frame, or the feed shows a black rectangle until the
  // first frame decodes.
  let thumbnail: { url: string; storagePath: string } | null = null;
  if (kind === 'video' && input.thumbnailUri) {
    try {
      thumbnail = await uploadFile(
        input.thumbnailUri,
        storagePaths.postMedia(profile.uid, mediaFileName(input.thumbnailUri, 'poster')),
      );
    } catch (error) {
      // A missing poster is a cosmetic problem, not a reason to lose the post.
      console.warn('[posts] could not upload video poster', error);
    }
  }

  try {
    const reference = await addDoc(collection(db, paths.posts), {
      schemaVersion: SCHEMA_VERSION,
      authorId: profile.uid,
      author: authorSnapshot(profile),
      caption: caption.trim().slice(0, CAPTION_MAX),
      media: {
        kind,
        url: uploaded.url,
        storagePath: uploaded.storagePath,
        width: input.width,
        height: input.height,
        durationMs: input.durationMs ?? null,
        thumbnailUrl: thumbnail?.url ?? null,
        thumbnailStoragePath: thumbnail?.storagePath ?? null,
      },
      status: 'pending',
      publishedAt: null,
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: null,
      likeCount: 0,
      commentCount: 0,
      reportCount: 0,
      featured: false,
      moderation: null,
      keywords: extractKeywords(caption, input.species, profile.username),
      species: input.species?.trim() || null,
      speciesSlug: speciesSlug(input.species),
      tournamentId: input.tournamentId ?? null,
      challengeId: input.challengeId ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return reference.id;
  } catch (error) {
    await deleteFile(uploaded.storagePath);
    if (thumbnail) await deleteFile(thumbnail.storagePath);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** The public feed: approved posts, newest published first. */
export async function fetchFeedPage(
  cursor: QueryDocumentSnapshot<DocumentData> | null = null,
): Promise<PostPage> {
  const constraints = [
    where('status', '==', 'approved'),
    orderBy('publishedAt', 'desc'),
    ...(cursor ? [startAfter(cursor)] : []),
    queryLimit(FEED_PAGE_SIZE),
  ];

  const snapshot = await getDocs(query(collection(db, paths.posts), ...constraints));
  return {
    posts: snapshot.docs.map(toPost),
    cursor: snapshot.docs.at(-1) ?? null,
    hasMore: snapshot.docs.length === FEED_PAGE_SIZE,
  };
}

/** Every post by one user, any status. Used on your own profile. */
export async function fetchPostsByAuthor(authorId: string): Promise<Post[]> {
  const snapshot = await getDocs(
    query(
      collection(db, paths.posts),
      where('authorId', '==', authorId),
      orderBy('createdAt', 'desc'),
      queryLimit(60),
    ),
  );
  return snapshot.docs.map(toPost);
}

/**
 * Someone else's catches. Approved only — the security rules refuse a query
 * that could return another user's pending posts, so this filter isn't
 * cosmetic.
 */
export async function fetchApprovedPostsByAuthor(authorId: string): Promise<Post[]> {
  const snapshot = await getDocs(
    query(
      collection(db, paths.posts),
      where('authorId', '==', authorId),
      where('status', '==', 'approved'),
      orderBy('publishedAt', 'desc'),
      queryLimit(60),
    ),
  );
  return snapshot.docs.map(toPost);
}

/** Approved catches for one species — the Phase 2 species hubs. */
export async function fetchPostsBySpecies(
  slug: string,
  cursor: QueryDocumentSnapshot<DocumentData> | null = null,
): Promise<PostPage> {
  const snapshot = await getDocs(
    query(
      collection(db, paths.posts),
      where('speciesSlug', '==', slug),
      where('status', '==', 'approved'),
      orderBy('publishedAt', 'desc'),
      ...(cursor ? [startAfter(cursor)] : []),
      queryLimit(FEED_PAGE_SIZE),
    ),
  );
  return {
    posts: snapshot.docs.map(toPost),
    cursor: snapshot.docs.at(-1) ?? null,
    hasMore: snapshot.docs.length === FEED_PAGE_SIZE,
  };
}

/**
 * Search approved catches by keyword.
 *
 * `array-contains` matches one whole word, so this finds "pike" but not
 * "pik". That limitation is documented in docs/ROADMAP.md along with the
 * upgrade path.
 */
export async function searchPosts(term: string): Promise<Post[]> {
  const snapshot = await getDocs(
    query(
      collection(db, paths.posts),
      where('status', '==', 'approved'),
      where('keywords', 'array-contains', term),
      orderBy('publishedAt', 'desc'),
      queryLimit(30),
    ),
  );
  return snapshot.docs.map(toPost);
}

/**
 * The admin review queue, live. Oldest first — whoever posted first should be
 * reviewed first.
 */
export function subscribeToPendingPosts(
  onChange: (posts: Post[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, paths.posts),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'asc'),
      queryLimit(50),
    ),
    (snapshot) => onChange(snapshot.docs.map(toPost)),
    (error) => onError?.(error),
  );
}

export function subscribeToPost(
  postId: string,
  onChange: (post: Post | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, paths.post(postId)),
    (snapshot) =>
      onChange(snapshot.exists() ? { ...(snapshot.data() as Post), id: snapshot.id } : null),
    (error) => onError?.(error),
  );
}

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

/**
 * Approve a post: it becomes visible in the feed, ordered by `publishedAt`.
 *
 * A Cloud Function watches for this transition and sends the author a push
 * notification, so nothing else needs to happen here.
 */
export async function approvePost(postId: string, adminUid: string): Promise<void> {
  await updateDoc(doc(db, paths.post(postId)), {
    status: 'approved',
    publishedAt: serverTimestamp(),
    reviewedAt: serverTimestamp(),
    reviewedBy: adminUid,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Reject a post. It leaves the queue and never appears publicly; the author
 * can still see it on their own profile marked as rejected.
 */
export async function rejectPost(
  postId: string,
  adminUid: string,
  note?: string,
): Promise<void> {
  await updateDoc(doc(db, paths.post(postId)), {
    status: 'rejected',
    reviewedAt: serverTimestamp(),
    reviewedBy: adminUid,
    reviewNote: note?.trim() || null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Pin a catch to the top of the feed, or unpin it.
 *
 * Separate from the review workflow deliberately: featuring is a presentation
 * decision, not a fresh moderation decision, and the security rules keep the
 * two apart so featuring can't be used to smuggle a status change past review.
 */
export async function setFeatured(postId: string, featured: boolean): Promise<void> {
  await updateDoc(doc(db, paths.post(postId)), {
    featured,
    updatedAt: serverTimestamp(),
  });
}

/** Featured catches, for the pinned row at the top of the feed. */
export async function fetchFeaturedPosts(): Promise<Post[]> {
  const snapshot = await getDocs(
    query(
      collection(db, paths.posts),
      where('status', '==', 'approved'),
      where('featured', '==', true),
      orderBy('publishedAt', 'desc'),
      queryLimit(5),
    ),
  );
  return snapshot.docs.map(toPost);
}

/**
 * Delete a post and its photo. Available to the author and to admins.
 * Likes and comments underneath it are cleaned up by a Cloud Function —
 * subcollections can't be deleted in one client operation.
 */
export async function deletePost(post: Pick<Post, 'id' | 'media'>): Promise<void> {
  await deleteDoc(doc(db, paths.post(post.id)));
  await deleteFile(post.media.storagePath);
  if (post.media.thumbnailStoragePath) {
    await deleteFile(post.media.thumbnailStoragePath);
  }
}

// ---------------------------------------------------------------------------
// Likes
// ---------------------------------------------------------------------------

/** Whether the signed-in user has liked a post. */
export function subscribeToLike(
  postId: string,
  uid: string,
  onChange: (liked: boolean) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, paths.postLike(postId, uid)),
    (snapshot) => onChange(snapshot.exists()),
    () => onChange(false),
  );
}

export async function setLike(
  postId: string,
  uid: string,
  liked: boolean,
): Promise<void> {
  const reference = doc(db, paths.postLike(postId, uid));
  if (liked) {
    // `likeCount` is incremented by a Cloud Function, not from here — clients
    // can't be trusted with counters.
    await setDoc(reference, { uid, createdAt: serverTimestamp() });
  } else {
    await deleteDoc(reference);
  }
}

export async function hasLiked(postId: string, uid: string): Promise<boolean> {
  const snapshot = await getDoc(doc(db, paths.postLike(postId, uid)));
  return snapshot.exists();
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export const COMMENT_MAX = 1000;

export function subscribeToComments(
  postId: string,
  onChange: (comments: PostComment[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, paths.postComments(postId)), orderBy('createdAt', 'asc')),
    (snapshot) =>
      onChange(
        snapshot.docs.map((entry) => ({
          ...(entry.data() as PostComment),
          id: entry.id,
        })),
      ),
    (error) => onError?.(error),
  );
}

export async function addComment(
  postId: string,
  profile: UserProfile,
  text: string,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Write something first.');

  await addDoc(collection(db, paths.postComments(postId)), {
    schemaVersion: SCHEMA_VERSION,
    postId,
    authorId: profile.uid,
    author: authorSnapshot(profile),
    text: trimmed.slice(0, COMMENT_MAX),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteComment(postId: string, commentId: string): Promise<void> {
  await deleteDoc(doc(db, paths.postComment(postId, commentId)));
}
