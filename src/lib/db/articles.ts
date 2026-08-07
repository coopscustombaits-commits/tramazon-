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
import { youtubeId } from '@/lib/youtube';
import {
  SCHEMA_VERSION,
  type Article,
  type ArticleKind,
  type UserProfile,
} from '@/types/models';

export const ARTICLE_TITLE_MAX = 120;
export const ARTICLE_SUMMARY_MAX = 300;
export const ARTICLE_BODY_MAX = 20000;

function toArticle(id: string, data: Article): Article {
  return { ...data, id };
}

/** Published tips and videos, newest first. What everyone sees. */
export async function fetchPublishedArticles(): Promise<Article[]> {
  const snapshot = await getDocs(
    query(
      collection(db, paths.articles),
      where('published', '==', true),
      orderBy('publishedAt', 'desc'),
      queryLimit(50),
    ),
  );
  return snapshot.docs.map((entry) => toArticle(entry.id, entry.data() as Article));
}

/**
 * Everything, drafts included. Admin only — the security rules refuse this
 * query for anyone else, so the filter isn't cosmetic.
 */
export function subscribeToAllArticles(
  onChange: (articles: Article[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, paths.articles), orderBy('updatedAt', 'desc'), queryLimit(100)),
    (snapshot) =>
      onChange(snapshot.docs.map((entry) => toArticle(entry.id, entry.data() as Article))),
    (error) => onError?.(error),
  );
}

export async function getArticle(id: string): Promise<Article | null> {
  const snapshot = await getDoc(doc(db, paths.article(id)));
  return snapshot.exists() ? toArticle(snapshot.id, snapshot.data() as Article) : null;
}

export type ArticleDraft = {
  kind: ArticleKind;
  title: string;
  summary: string;
  body: string;
  /** Whatever Coop pasted — a URL or a bare id. Normalized on the way in. */
  youtubeUrl: string;
  tags: string[];
  published: boolean;
};

function shape(draft: ArticleDraft) {
  const videoId = draft.kind === 'video' ? youtubeId(draft.youtubeUrl) : null;
  if (draft.kind === 'video' && !videoId) {
    throw new Error("That doesn't look like a YouTube link.");
  }
  if (!draft.title.trim()) throw new Error('Give it a title.');

  return {
    kind: draft.kind,
    title: draft.title.trim().slice(0, ARTICLE_TITLE_MAX),
    summary: draft.summary.trim().slice(0, ARTICLE_SUMMARY_MAX),
    // A video's body stays empty rather than carrying whatever was typed
    // before the kind was switched.
    body: draft.kind === 'video' ? '' : draft.body.trim().slice(0, ARTICLE_BODY_MAX),
    youtubeId: videoId,
    tags: draft.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean).slice(0, 10),
    published: draft.published,
  };
}

export async function createArticle(
  author: UserProfile,
  draft: ArticleDraft,
): Promise<string> {
  const reference = await addDoc(collection(db, paths.articles), {
    schemaVersion: SCHEMA_VERSION,
    ...shape(draft),
    coverImageUrl: null,
    coverStoragePath: null,
    authorId: author.uid,
    author: { uid: author.uid, username: author.username, photoURL: author.photoURL },
    // Only stamped once it's actually public, since the list orders by it.
    publishedAt: draft.published ? serverTimestamp() : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return reference.id;
}

/**
 * Save an edit.
 *
 * `publishedAt` is stamped the first time an article goes public and never
 * moved after that — re-publishing a corrected article shouldn't jump it back
 * to the top of the list ahead of things written since.
 */
export async function updateArticle(
  id: string,
  draft: ArticleDraft,
  current: Article,
): Promise<void> {
  const becomingPublic = draft.published && current.publishedAt == null;
  await updateDoc(doc(db, paths.article(id)), {
    ...shape(draft),
    ...(becomingPublic ? { publishedAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteArticle(article: Article): Promise<void> {
  await deleteDoc(doc(db, paths.article(article.id)));
  if (article.coverStoragePath) {
    await deleteFile(article.coverStoragePath);
  }
}

/** Empty draft for the editor. */
export function emptyDraft(): ArticleDraft {
  return {
    kind: 'article',
    title: '',
    summary: '',
    body: '',
    youtubeUrl: '',
    tags: [],
    published: false,
  };
}

/** Load an existing article into the editor's shape. */
export function draftFrom(article: Article): ArticleDraft {
  return {
    kind: article.kind,
    title: article.title,
    summary: article.summary,
    body: article.body,
    youtubeUrl: article.youtubeId ?? '',
    tags: article.tags ?? [],
    published: article.published,
  };
}
