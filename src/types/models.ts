import type { Timestamp } from 'firebase/firestore';

/**
 * Firestore document shapes.
 *
 * Design notes (these matter for the later phases — following, DMs,
 * tournaments, badges):
 *
 * - Every document carries `schemaVersion` so a migration can find and fix
 *   old documents without guessing.
 * - Posts live in a single top-level `posts` collection rather than under each
 *   user, so the public feed is one indexed query no matter how many users
 *   there are, and so a future "following" feed is a `where authorId in [...]`
 *   or fan-out read against the same collection.
 * - Counters (`likeCount`, `commentCount`, `postCount`, `followerCount`) are
 *   denormalized onto the parent document. They are maintained by Cloud
 *   Functions. Adding follower counts later needs no restructuring.
 * - Posts embed an `author` snapshot (username + photo at post time) so the
 *   feed renders from a single read. `lib/db/users.ts` refreshes these when a
 *   profile changes.
 */

export const SCHEMA_VERSION = 1;

/** Firestore timestamps read back as `Timestamp`; writes may use serverTimestamp(). */
export type Timestamps = {
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** `users/{uid}` — publicly readable profile. No email or tokens here. */
export type UserProfile = Timestamps & {
  schemaVersion: number;
  uid: string;
  /** Display form, e.g. "CoopHooks". Unique, case-insensitively. */
  username: string;
  /** Lowercased mirror used for uniqueness checks and search. */
  usernameLower: string;
  bio: string;
  /** Download URL of the profile photo in Cloud Storage, or null. */
  photoURL: string | null;
  /** Free text for now, e.g. "Largemouth Bass". */
  favoriteSpecies: string | null;

  // Denormalized counters, maintained server-side.
  postCount: number;
  /** Reserved for the follow feature in a later phase. Always 0 for now. */
  followerCount: number;
  followingCount: number;

  /** Which providers this account has linked: 'password' | 'google.com' | 'apple.com'. */
  providers: string[];
};

/**
 * `users/{uid}/private/profile` — only readable/writable by the owner.
 * Anything that must not be public goes here, not on the profile document.
 */
export type UserPrivate = Timestamps & {
  schemaVersion: number;
  email: string | null;
  /** Notification opt-outs. Extend freely; unknown keys default to enabled. */
  notificationPrefs: {
    postApproved: boolean;
    postLiked: boolean;
    postCommented: boolean;
    announcements: boolean;
  };
};

/** `users/{uid}/pushTokens/{token}` — one document per device. */
export type PushToken = Timestamps & {
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceName: string | null;
  lastSeenAt: Timestamp | null;
};

/** `usernames/{usernameLower}` — reservation doc that enforces uniqueness. */
export type UsernameReservation = {
  uid: string;
  createdAt: Timestamp | null;
};

/** `admins/{uid}` — presence of the document grants admin. Body is metadata. */
export type AdminRecord = {
  grantedAt: Timestamp | null;
  note: string | null;
};

// ---------------------------------------------------------------------------
// Posts (home feed)
// ---------------------------------------------------------------------------

export type PostStatus = 'pending' | 'approved' | 'rejected';

/** Snapshot of the author at write time, so the feed needs one read per post. */
export type AuthorSnapshot = {
  uid: string;
  username: string;
  photoURL: string | null;
};

export type PostImage = {
  /** Public download URL. */
  url: string;
  /** Storage path, kept so the file can be deleted with the post. */
  storagePath: string;
  width: number;
  height: number;
};

/** `posts/{postId}` */
export type Post = Timestamps & {
  schemaVersion: number;
  id: string;
  authorId: string;
  author: AuthorSnapshot;
  caption: string;
  image: PostImage;

  status: PostStatus;
  /** Set when an admin approves. Feed orders by this. Null until approved. */
  publishedAt: Timestamp | null;
  reviewedAt: Timestamp | null;
  reviewedBy: string | null;
  /** Optional note the admin leaves when rejecting. */
  reviewNote: string | null;

  likeCount: number;
  commentCount: number;

  /**
   * Reserved for later phases so posts don't need restructuring:
   * tournament entries and species tagging.
   */
  species: string | null;
  tournamentId: string | null;
};

/** `posts/{postId}/likes/{uid}` — document id is the liker's uid. */
export type PostLike = {
  uid: string;
  createdAt: Timestamp | null;
};

/** `posts/{postId}/comments/{commentId}` */
export type PostComment = Timestamps & {
  schemaVersion: number;
  id: string;
  postId: string;
  authorId: string;
  author: AuthorSnapshot;
  text: string;
};

// ---------------------------------------------------------------------------
// Notifications (in-app history; the push itself is sent by Cloud Functions)
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'post_approved'
  | 'post_rejected'
  | 'post_needs_review'
  | 'post_liked'
  | 'post_commented'
  // Reserved for later phases.
  | 'new_follower'
  | 'new_message'
  | 'badge_earned'
  | 'announcement';

/** `users/{uid}/notifications/{id}` */
export type AppNotification = Timestamps & {
  schemaVersion: number;
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Deep link path, e.g. `/post/abc123`. */
  href: string | null;
  readAt: Timestamp | null;
  /** Loose bag for type-specific fields (postId, actorId, ...). */
  data: Record<string, string>;
};
