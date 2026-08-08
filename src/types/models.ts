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

  // Denormalized counters, maintained server-side. Clients are denied these
  // fields outright, so none of them can be inflated from a modified app.
  postCount: number;
  /** Phase 3 points/rewards. Server-written, zero until that lands. */
  points: number;
  /**
   * Catches logged. Distinct from `postCount` — a later phase adds a catch log
   * where an angler records a fish without posting it publicly. Server-written
   * and zero for now, so the stat is real the day that lands.
   */
  fishLoggedCount: number;
  /** Reserved for the follow feature in a later phase. Always 0 for now. */
  followerCount: number;
  followingCount: number;

  /** Which providers this account has linked: 'password' | 'google.com' | 'apple.com'. */
  providers: string[];

  /**
   * Moderation state. Only an admin can change this — the security rules deny
   * the field to its own owner, so nobody can un-ban themselves.
   *
   * Enforced today: a non-active account cannot post, comment, or like. The
   * Phase 4 dashboard is the UI for it; until then it's editable from the
   * Firebase console, which means the ability to ban somebody exists from day
   * one rather than waiting on a dashboard.
   */
  accountStatus: AccountStatus;
  /** For a temporary suspension. Null for active and permanent bans. */
  suspendedUntil: Timestamp | null;
};

export type AccountStatus = 'active' | 'suspended' | 'banned';

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
    newFollower: boolean;
    messages: boolean;
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

export type MediaKind = 'photo' | 'video';

export type PostMedia = {
  kind: MediaKind;
  /** Public download URL. */
  url: string;
  /** Storage path, kept so the file can be deleted with the post. */
  storagePath: string;
  width: number;
  height: number;
  /** Videos only: length in milliseconds, and a poster frame. */
  durationMs: number | null;
  thumbnailUrl: string | null;
  thumbnailStoragePath: string | null;
};

/** `posts/{postId}` */
export type Post = Timestamps & {
  schemaVersion: number;
  id: string;
  authorId: string;
  author: AuthorSnapshot;
  caption: string;
  media: PostMedia;

  status: PostStatus;
  /** Set when an admin approves. Feed orders by this. Null until approved. */
  publishedAt: Timestamp | null;
  reviewedAt: Timestamp | null;
  reviewedBy: string | null;
  /** Optional note the admin leaves when rejecting. */
  reviewNote: string | null;

  likeCount: number;
  commentCount: number;
  /** How many people have reported this post. Server-written. */
  reportCount: number;

  /** Pinned to the top of the home feed by an admin. */
  featured: boolean;

  /**
   * Reserved for Phase 4's automated review. `decidedBy` records whether a
   * human or a model made the call, which is what makes an appeal reviewable.
   */
  moderation: {
    decidedBy: 'human' | 'ai' | null;
    /** Model confidence that the content is safe, 0-1. Null if never scored. */
    score: number | null;
    /** e.g. ['profanity', 'spam']. Empty when nothing was flagged. */
    labels: string[];
  } | null;

  /**
   * Pre-computed search words from the caption, species, and author. Firestore
   * has no full-text search; this is what `array-contains` matches against.
   */
  keywords: string[];

  /** Free text as the angler typed it, e.g. "Largemouth Bass". */
  species: string | null;
  /**
   * Normalized form of `species`, e.g. "largemouth-bass". Written now, unused
   * until Phase 2's species hubs — a slug derived at write time costs nothing
   * today and saves backfilling every post later.
   */
  speciesSlug: string | null;

  /** Reserved for Phase 3 so posts don't need restructuring. */
  tournamentId: string | null;
  challengeId: string | null;
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
// Shop: wishlist and orders
// ---------------------------------------------------------------------------

/**
 * `users/{uid}/wishlist/{productId}` — document id is the Shopify product id
 * with the `gid://` prefix stripped, so saving twice is idempotent.
 *
 * A snapshot of title/price/image is stored so the wishlist renders instantly
 * and still shows something if a product is later unpublished. Live price and
 * availability are re-read from Shopify when the screen opens.
 */
export type WishlistItem = Timestamps & {
  schemaVersion: number;
  /** Shopify product id, full `gid://shopify/Product/123` form. */
  productId: string;
  handle: string;
  title: string;
  imageUrl: string | null;
  /** Price at the time it was saved, for display before Shopify responds. */
  priceAmount: string;
  priceCurrency: string;
};

export type OrderStatus =
  | 'placed'
  | 'paid'
  | 'fulfilled'
  | 'partially_fulfilled'
  | 'cancelled'
  | 'refunded'
  | 'unknown';

/**
 * `users/{uid}/orders/{orderId}` — the app's record of a checkout.
 *
 * Written by the client the moment checkout is opened, so there's a record
 * even if the customer never comes back to the app. Shopify is the source of
 * truth for status: a Cloud Function subscribed to Shopify's order webhooks
 * fills in `status`, `orderNumber`, and `statusUrl` once the order exists.
 * See docs/SETUP.md.
 */
export type Order = Timestamps & {
  schemaVersion: number;
  id: string;
  /** The Shopify cart this came from — how a webhook matches it back to us. */
  cartId: string;
  /** Shopify's order id, once the webhook has told us. */
  shopifyOrderId: string | null;
  /** Human-facing number, e.g. "#1042". */
  orderNumber: string | null;
  status: OrderStatus;
  /** Shopify's hosted order-status page. */
  statusUrl: string | null;
  totalAmount: string;
  totalCurrency: string;
  /** Enough to render the order without calling Shopify. */
  lines: {
    /**
     * Shopify product handle. Recorded so a review can be marked a verified
     * purchase — that check needs a stable key, and a title is not one.
     */
    productHandle: string;
    title: string;
    variantTitle: string | null;
    quantity: number;
    imageUrl: string | null;
  }[];
  /** Set when the webhook reports fulfillment, for a "shipped" line. */
  fulfilledAt: Timestamp | null;
  trackingNumbers: string[];
  trackingUrls: string[];
};

// ---------------------------------------------------------------------------
// Safety: blocking and reporting
// ---------------------------------------------------------------------------

/**
 * `users/{uid}/blocked/{blockedUid}` — people this user doesn't want to see.
 *
 * Blocking is one-directional and private: the blocked person is never told.
 * The feed and comment lists filter client-side against this list, because
 * Firestore can't express "everything except these authors" as a query.
 */
export type BlockedUser = {
  uid: string;
  /** Kept so the blocked-list screen renders without extra reads. */
  username: string;
  createdAt: Timestamp | null;
};

export type ReportTargetType = 'post' | 'comment' | 'user' | 'message';

export type ReportReason =
  | 'harassment'
  | 'hate'
  | 'nudity'
  | 'violence'
  | 'spam'
  | 'scam'
  | 'off_topic'
  | 'other';

export type ReportStatus = 'open' | 'actioned' | 'dismissed';

/**
 * `reports/{reportId}` — a user flagging something for Coop.
 *
 * Readable only by admins. A reporter can create one and nothing else: they
 * can't read the queue, edit their report, or see what was decided, because
 * that would leak who reported whom.
 */
export type Report = Timestamps & {
  schemaVersion: number;
  id: string;
  targetType: ReportTargetType;
  /** Post id, comment id, or uid depending on `targetType`. */
  targetId: string;
  /** For a comment, the post it lives on. Null otherwise. */
  parentId: string | null;
  /** Who owns the reported content, so an admin can act on them directly. */
  targetOwnerId: string;
  reporterId: string;
  reason: ReportReason;
  note: string;
  status: ReportStatus;
  reviewedAt: Timestamp | null;
  reviewedBy: string | null;
};

// ---------------------------------------------------------------------------
// Following
// ---------------------------------------------------------------------------

/**
 * `follows/{followerId}_{followingId}` — one document per edge.
 *
 * A flat collection rather than subcollections under each user, so a single
 * query answers both "who do I follow" and "who follows me". The counters on
 * each profile are maintained by a Cloud Function.
 */
export type Follow = {
  followerId: string;
  followingId: string;
  createdAt: Timestamp | null;
};

// ---------------------------------------------------------------------------
// Competitions — challenges and tournaments
//
// Two collections (`challenges`, `tournaments`) holding the same shape, which
// is why `Post` has carried both `challengeId` and `tournamentId` since day
// one. They're separate because they mean different things to an angler — a
// challenge is an open-ended prompt, a tournament has a start, an end, and a
// winner — but they're entered the same way and scored the same way, so one
// type and one set of screens serve both.
//
// An entry is a post with the id set. That's the whole mechanism: an entry is
// already moderated, already has likes and comments, and already appears in
// the feed. There is no second content type to build or police.
// ---------------------------------------------------------------------------

export type CompetitionKind = 'challenge' | 'tournament';

/**
 * How a leaderboard is ordered.
 *
 *   most_likes  — the community decides. One query, ordered by `likeCount`.
 *   admin_pick  — Coop picks. Ordered by `featured`, then likes.
 *
 * Both are derived from fields posts already carry, so a leaderboard needs no
 * aggregate documents and can't drift out of sync with the entries.
 */
export type CompetitionScoring = 'most_likes' | 'admin_pick';

/** `challenges/{id}` or `tournaments/{id}` */
export type Competition = Timestamps & {
  schemaVersion: number;
  id: string;
  kind: CompetitionKind;
  title: string;
  /** What to do to enter, in Coop's words. */
  description: string;
  /** What you win. Free text — "a pack of Deep Divers", "bragging rights". */
  prize: string;
  coverImageUrl: string | null;
  coverStoragePath: string | null;
  /**
   * Optional species restriction, as a slug. Null means anything counts.
   * Matches `Post.speciesSlug` so the check is an equality test.
   */
  speciesSlug: string | null;
  scoring: CompetitionScoring;
  startsAt: Timestamp | null;
  endsAt: Timestamp | null;
  /** Server-written, from the posts that reference it. */
  entryCount: number;
  /** Set by an admin when it's over. Null while it's still running. */
  winnerPostId: string | null;
  winnerUid: string | null;
  published: boolean;
  createdBy: string;
};

/**
 * Where a competition is in its life, worked out from the dates.
 *
 * Derived rather than stored: a stored status would need something to move it
 * from 'open' to 'closed' at the right minute, and anything that can fail to
 * run can leave a competition claiming to be open a week after it ended.
 */
export type CompetitionPhase = 'upcoming' | 'open' | 'ended';

// ---------------------------------------------------------------------------
// Articles — tips, how-tos, and YouTube videos
//
// One collection for both because they're the same thing to a reader: a piece
// of content Coop published, with a title, a cover, and a body. A video just
// has a `youtubeId` where an article has `body`. Splitting them would mean two
// queries and two screens to render one "Tips & Videos" list.
// ---------------------------------------------------------------------------

export type ArticleKind = 'article' | 'video';

/** `articles/{articleId}` — admin-authored. */
export type Article = Timestamps & {
  schemaVersion: number;
  id: string;
  kind: ArticleKind;
  title: string;
  /** One or two lines for the list row. */
  summary: string;
  /** Plain text with blank-line paragraphs. Empty for videos. */
  body: string;
  /**
   * The YouTube video id (`dQw4w9WgXcQ`), not a URL. Storing the id means the
   * app decides how to present it — thumbnail, embed, or hand-off to the
   * YouTube app — without re-parsing a link every time.
   */
  youtubeId: string | null;
  /** Optional cover image. Videos fall back to the YouTube thumbnail. */
  coverImageUrl: string | null;
  coverStoragePath: string | null;
  /** Free-text tags, e.g. ['bass', 'winter']. */
  tags: string[];
  authorId: string;
  author: AuthorSnapshot;
  /**
   * Drafts are invisible to everyone but admins — the security rules enforce
   * it, so an unpublished article can be written over several sittings without
   * leaking.
   */
  published: boolean;
  /** Set when first published. The list orders by it. */
  publishedAt: Timestamp | null;
};

// ---------------------------------------------------------------------------
// Reviews
//
// Two collections, because the brief separates them and so does the meaning:
//
//   productReviews/{handle}       reviews of something Coop sells. Keyed on the
//                                 Shopify product handle, and a review can be
//                                 marked a verified purchase.
//   baitReviews/{slug}            the community reviewing any bait at all,
//                                 including ones Coop doesn't sell. Keyed on a
//                                 slug of whatever name they typed.
//
// The documents are the same shape, so one data-access module and one set of
// components serve both. The summary document above each is server-written —
// an average rating a client could set is not a rating.
// ---------------------------------------------------------------------------

export type ReviewKind = 'product' | 'bait';

/** `productReviews/{handle}` or `baitReviews/{slug}` — the aggregate. */
export type ReviewSummary = Timestamps & {
  schemaVersion: number;
  id: string;
  /** Display name: the product title, or the bait name as first typed. */
  title: string;
  reviewCount: number;
  /** Kept alongside the average so a new review is one increment, not a scan. */
  ratingSum: number;
  /** `ratingSum / reviewCount`, one decimal. Server-written. */
  ratingAverage: number;
};

/**
 * `.../{id}/reviews/{uid}` — one review.
 *
 * The document id is the author's uid, which is what enforces one review per
 * person per thing. Editing yours overwrites it; there's no way to stack five.
 */
export type Review = Timestamps & {
  schemaVersion: number;
  id: string;
  kind: ReviewKind;
  /** The parent's id — the product handle or bait slug. */
  subjectId: string;
  authorId: string;
  author: AuthorSnapshot;
  /** 1 to 5. */
  rating: number;
  text: string;
  /**
   * Set by a Cloud Function that checks the author's order history. Clients
   * are required to write `false`, so the badge means what it says.
   */
  verifiedPurchase: boolean;
};

// ---------------------------------------------------------------------------
// Direct messages
// ---------------------------------------------------------------------------

/**
 * `conversations/{conversationId}` — one thread.
 *
 * The id is the two participant uids sorted and joined with `_`, so opening a
 * DM with the same person twice lands in the same thread instead of quietly
 * forking it. `lib/db/messages.ts` is the only place that builds it.
 *
 * `participantIds` is an array rather than two named fields so a group thread
 * is a data change and not a schema change. Today the rules require exactly
 * two — lifting that is a one-line edit when group DMs are wanted.
 */
export type Conversation = Timestamps & {
  schemaVersion: number;
  id: string;
  participantIds: string[];
  /**
   * Username and photo per participant, keyed by uid. Denormalized so the
   * inbox renders from one query instead of a profile read per row. Refreshed
   * by the same Cloud Function that refreshes post author snapshots.
   */
  participants: Record<string, AuthorSnapshot>;
  /** Preview for the inbox row. Server-written when a message is sent. */
  lastMessage: {
    text: string;
    senderId: string;
  } | null;
  /** Separate from `updatedAt` so the inbox sorts on message activity alone. */
  lastMessageAt: Timestamp | null;
  /**
   * Unread count per uid. Server-incremented on send; a participant may zero
   * out their own entry (and only their own) when they open the thread.
   */
  unread: Record<string, number>;
};

/** `conversations/{conversationId}/messages/{messageId}` */
export type DirectMessage = Timestamps & {
  schemaVersion: number;
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  /**
   * Set when an admin removes a message. The document stays so the thread
   * doesn't renumber and so a report stays auditable; the text is replaced
   * with a tombstone at render time.
   */
  removedAt: Timestamp | null;
  removedBy: string | null;
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

/**
 * `announcements/{announcementId}` — an admin-authored message pushed to
 * everyone. Creating one is what triggers the fan-out Cloud Function.
 */
export type Announcement = Timestamps & {
  schemaVersion: number;
  id: string;
  title: string;
  body: string;
  /** Optional deep link, e.g. `/product/deep-diver`. */
  href: string | null;
  createdBy: string;
  /** Set by the Cloud Function once the push has gone out. */
  sentAt: Timestamp | null;
  recipientCount: number;
};

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
