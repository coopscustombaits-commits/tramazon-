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
import { deleteImage, imageFileName, uploadImage } from '@/lib/storage/images';
import {
  SCHEMA_VERSION,
  type AuthorSnapshot,
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
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  caption: string;
  species?: string | null;
};

/**
 * Upload the photo, then write the post as `pending`.
 *
 * The photo goes up first because the security rules require the post document
 * to already carry a storage path — and because an upload that fails halfway
 * should not leave a post with a broken image. If the document write fails, we
 * clean the orphaned upload back out.
 */
export async function createPost(input: CreatePostInput): Promise<string> {
  const { profile, imageUri, caption } = input;

  const uploaded = await uploadImage(
    imageUri,
    storagePaths.postImage(profile.uid, imageFileName(imageUri, 'catch')),
  );

  try {
    const reference = await addDoc(collection(db, paths.posts), {
      schemaVersion: SCHEMA_VERSION,
      authorId: profile.uid,
      author: authorSnapshot(profile),
      caption: caption.trim().slice(0, CAPTION_MAX),
      image: {
        url: uploaded.url,
        storagePath: uploaded.storagePath,
        width: input.imageWidth,
        height: input.imageHeight,
      },
      status: 'pending',
      publishedAt: null,
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: null,
      likeCount: 0,
      commentCount: 0,
      species: input.species?.trim() || null,
      tournamentId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return reference.id;
  } catch (error) {
    await deleteImage(uploaded.storagePath);
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
 * Delete a post and its photo. Available to the author and to admins.
 * Likes and comments underneath it are cleaned up by a Cloud Function —
 * subcollections can't be deleted in one client operation.
 */
export async function deletePost(post: Pick<Post, 'id' | 'image'>): Promise<void> {
  await deleteDoc(doc(db, paths.post(post.id)));
  await deleteImage(post.image.storagePath);
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
