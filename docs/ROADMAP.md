# Phase 2 and 3 — what the current schema already supports

Coop's Phase 1 brief asked that Firestore be shaped so later phases could be
added *without restructuring existing data*. This is the audit of that promise
against the actual Phase 2 and Phase 3 lists.

Verdict: everything fits. Four small fields were added during Phase 1 as
insurance — free to write now, a backfill of every document later. They're
marked ★ below.

---

## Phase 2 — Community

| Feature | What it needs | Status |
| --- | --- | --- |
| Follow / unfollow | New `follows` collection | Ready |
| Private messaging | New `conversations` collection | Ready |
| Search users | Prefix query on `usernameLower` | Ready |
| Search posts | See the note below | **Needs a decision** |
| Species communities | `posts.speciesSlug` ★ + index | Ready |
| Product reviews | New `productReviews` collection | Ready |
| Bait reviews | New `baitReviews` collection | Ready |
| Photo and video posts | — | **Done in Phase 1** |
| YouTube integration | New `articles` collection | Ready |

**Follow / unfollow.** Add `follows/{followerId}_{followingId}` carrying both
ids as fields. `followerCount` and `followingCount` already exist on the
profile and are already server-written, so the counters work the day the
feature lands. A "following" feed is
`posts where authorId in [...] and status == 'approved'` — the same collection
and the same index the public feed already uses.

**Private messaging.** Add `conversations/{id}` with a `participantIds` array
and a `messages` subcollection. Nothing existing changes. Profiles already
carry everything a chat list needs to render, and `NotificationType` already
includes `new_message`, so the push plumbing routes it without changes.

**Species communities.** Posts carry free-text `species` plus ★`speciesSlug`,
a normalized form written at post time ("Largemouth Bass", "largemouth bass",
and "LARGEMOUTH  BASS" all become `largemouth-bass`). A species hub is then an
exact-match query, and the composite index is already declared. Without the
slug this would have meant rewriting every post later.

**Searching posts.** This is the one item that doesn't fall out of the current
shape, and it's worth knowing before it's built rather than after: **Firestore
has no full-text search.** It can do prefix matching on a single field, which
is enough for usernames but not for "show me posts mentioning chartreuse".

Two honest options:

1. *Keyword array on each post.* Write a `keywords: string[]` field at post
   time (caption words, species, author) and query with `array-contains`.
   Free, no new service, but matches whole words only — no typo tolerance, no
   ranking.
2. *A real search index.* The Algolia or Typesense Firebase extension mirrors
   the `posts` collection and gives proper ranked, typo-tolerant search. Costs
   money and adds a moving part.

Recommendation: start with (1). It handles "find posts about pike" well enough
for a community this size, and (2) can be added later without changing how
posts are stored. The field wasn't added pre-emptively because unlike the slug,
it depends on which option gets chosen.

**Product and bait reviews.** Two separate collections, because the brief
correctly separates them: `productReviews/{shopifyProductId}/reviews/{uid}`
for reviews tied to a product in the shop, and a top-level `baitReviews` for
reviews of baits in general use. Both follow the same pattern as post comments
— server-written counters and averages, client-written text.

**YouTube.** Store the video id, not an embed URL, in an `articles` collection
alongside tips and sponsor content. Rendering is `expo-video` or a WebView; no
change to any existing collection.

---

## Phase 3 — Engagement

| Feature | What it needs | Status |
| --- | --- | --- |
| Challenges | New `challenges` collection + `posts.challengeId` ★ | Ready |
| Tournaments | New `tournaments` collection + `posts.tournamentId` | Ready |
| Leaderboards | Aggregate documents | Ready |
| Badges | New `badges` collection + `users/{uid}/badges` | Ready |
| Points / rewards | `users.points` ★ | Ready |
| Event calendar | New `events` collection | Ready |
| Tips and articles | New `articles` collection | Ready |
| Featured products | A Shopify collection named "Featured" | Ready, no schema |
| Product-drop notifications | — | **Done in Phase 1** |

**Challenges and tournaments.** Posts carry both ★`challengeId` and
`tournamentId`, nullable. An entry is a post with one of them set, which means
a challenge entry is already moderated, already has likes and comments, and
already appears in the feed — no second content type to build or moderate.

**Leaderboards.** Ranking needs per-user totals that already exist:
`postCount`, `fishLoggedCount`, and ★`points`. All three are server-written and
denied to clients by the security rules, which is what makes a leaderboard
trustworthy. A per-challenge leaderboard is an aggregate document the same
Cloud Function updates as entries come in.

**Badges.** `badges/{badgeId}` for definitions, `users/{uid}/badges/{badgeId}`
for awards. Awarding hangs off the Cloud Functions that already maintain the
counters — "first post" and "10 catches logged" are conditions on numbers those
functions already write. `NotificationType` already includes `badge_earned`.

**Product-drop notifications.** Already built. The announcement composer in
Settings → Admin pushes to everyone who hasn't opted out, and
`notificationPrefs.announcements` already gates it.

---

## The four fields added as insurance

| Field | On | Why it had to be now |
| --- | --- | --- |
| `speciesSlug` | posts | Species hubs need exact-match; deriving it later means rewriting every post |
| `challengeId` | posts | Same reason `tournamentId` was reserved — cheap now, a migration later |
| `points` | users | Server-written counters must start at zero under the rules; adding one later needs every profile touched |
| `fishLoggedCount` | users | Same, and the profile already displays it |

All four are written today and read by nothing. That's deliberate: the cost of
carrying an unused field is a few bytes, and the cost of adding one to a live
collection is a migration plus a rules change plus a redeploy.

---

## What is *not* pre-built

No collections exist for follows, messages, reviews, challenges, tournaments,
badges, events, or articles. That's the right call — an empty collection with
guessed-at fields is worse than none, because the guesses get baked into
security rules and indexes before anyone knows what the feature actually needs.

Adding a collection is cheap. Changing the shape of one that already holds data
is not, which is why the effort went into the documents that *do* have data:
users and posts.
