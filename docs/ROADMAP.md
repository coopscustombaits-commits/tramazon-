# Phases 2–4 — what the current schema already supports

Coop's Phase 1 brief asked that Firestore be shaped so later phases could be
added *without restructuring existing data*. This is the audit of that promise
against the actual Phase 2, 3, and 4 lists.

Verdict: everything fits. A handful of small fields were added during Phase 1
as insurance — free to write now, a backfill of every document later. They're
marked ★ below. Two of them (`accountStatus`, `featured`) are already enforced
by the security rules, so suspending an account or featuring a post works from
the Firebase console today.

## Before launch: what the app stores require

Worth flagging here because it lands earlier than Phase 4 does. **Apple's
App Review Guideline 1.2 requires any app with user-generated content to have
all four of:**

1. A method for filtering objectionable material — ✅ every post is reviewed
   before it is public.
2. A mechanism for users to **report** offensive content — ❌ not built.
3. The ability for users to **block** abusive users — ❌ not built.
4. Published contact information — ✅ the Contact & support page.

Google Play's User Generated Content policy asks for much the same.

Reporting and blocking are on the Phase 4 list, but they are a **submission
blocker, not a nice-to-have** — apps get rejected for missing them. They're
also small: a `reports` collection, a `users/{uid}/blocked` subcollection, a
report button on posts and profiles, and a filter on the feed. Worth pulling
forward ahead of the first submission rather than discovering it in review.

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

## Phase 4 — Admin dashboard and moderation

### Who can see it

Only Coop. That is enforced in three places, and the important one is not the app:

1. `admins/{uid}` — a document that exists only for accounts granted admin.
2. `firestore.rules` — `allow list, write: if false` on that collection. **No
   account can create an admin document, including an existing admin.** The
   only way in is the Firebase console or the Admin SDK, neither of which a
   phone can reach.
3. `allow get: if isSelf(uid)` — you can check whether *you* are an admin and
   nothing else. Nobody can enumerate who the admins are.

The app hiding admin screens from non-admins is a courtesy. Someone running a
modified build sees the screens and still can't approve a post, feature one,
ban anybody, or send an announcement, because every one of those is an
admin-only rule on the server.

Adding a second admin later means creating one document. Removing one means
deleting it. Neither needs an app release.

### Dashboard features

| Feature | What it needs | Status |
| --- | --- | --- |
| Total / active / new users | Aggregate counters + Analytics | Ready |
| Manage users: edit, suspend, ban, delete | `users.accountStatus` ★ | **Enforced today** |
| Review flagged posts | New `reports` collection + `posts.reportCount` ★ | Ready |
| Review pending posts | — | **Done in Phase 1** |
| Delete / edit posts and comments | — | **Done in Phase 1** |
| Send push (all users) | — | **Done in Phase 1** |
| Send push (segments) | Query users, reuse the same fan-out | Ready |
| Manage tournaments, challenges, badges | Phase 3 collections | Ready |
| Feature posts on home page | `posts.featured` ★ | **Enforced today** |
| Add / edit articles | New `articles` collection | Ready |
| App analytics | Firebase Analytics | Needs enabling |
| User-submitted reports | New `reports` collection | Ready |
| Moderate reported messages | Phase 2 `conversations` + admin read | Ready |
| Remote config | Firebase Remote Config, or a `config/app` document | Ready |

**Suspend and ban work now.** `accountStatus` is `active`, `suspended`, or
`banned`, and the security rules refuse post, comment, and like creation from
anything but `active`. Crucially the field is excluded from the fields a user
may edit on their own profile, so nobody can lift their own ban — there are
tests for exactly that, including the smuggle-it-alongside-a-bio-edit case.

Reading stays allowed for a banned account. A ban is meant to stop someone
contributing, not to lock them out of an app they may have orders in.

Because it's a plain field, **Coop can ban somebody from the Firebase console
on launch day**, years before the dashboard exists. That was the point of doing
it now.

**Analytics.** Firebase Analytics has to be enabled on the project and
`@react-native-firebase/analytics` (or the Expo equivalent) added — the current
app uses the Firebase JS SDK, which doesn't collect analytics on native.
Downloads come from App Store Connect and Play Console, not from the app.

**Remote config** needs no schema. Either Firebase Remote Config, or a single
`config/app` document readable by everyone and writable by admins — the latter
is simpler and reuses machinery that already exists.

### Safety and moderation

| Feature | Notes |
| --- | --- |
| AI review before publishing | A Cloud Function between submission and the queue |
| Auto-filter harassment, spam, scams | Same function; writes `posts.moderation` ★ |
| Auto-approve clearly safe content | Sets `status: 'approved'` directly |
| Route questionable content to the dashboard | Leaves `status: 'pending'` |
| User reporting | New `reports` collection |
| Remove / mute / suspend / ban | `accountStatus` ★ + existing delete rules |
| Appeals | New `appeals` collection |

The `moderation` object reserved on every post — `{ decidedBy, score, labels }`
— is what makes this swappable later. `decidedBy` records whether a human or a
model made the call, which is the difference between an appeal you can review
and a decision nobody can explain.

The architecture holds without change: an AI check is a Cloud Function on post
creation that either flips `status` to `approved` or leaves it `pending`. The
review queue, the notifications, and the feed all already key off `status`, so
none of them need to know a model was involved.

Two things worth deciding before that gets built rather than after:

- **False positives cost more than false negatives here.** Auto-rejecting a
  real catch photo because a model disliked something is worse for a small
  community than a borderline post waiting an hour for Coop. Recommendation:
  auto-*approve* on high confidence, never auto-*reject* — send anything
  uncertain to the queue, which is exactly what happens today.
- **Cost and latency.** Every post and comment through a vision or text model
  is a per-item charge and a second or two of delay. Worth turning on when the
  queue is genuinely too big to read, not before.

---

## Fields added as insurance

| Field | On | Why it had to be now |
| --- | --- | --- |
| `speciesSlug` | posts | Species hubs need exact-match; deriving it later means rewriting every post |
| `challengeId` | posts | Same reason `tournamentId` was reserved — cheap now, a migration later |
| `points` | users | Server-written counters must start at zero under the rules; adding one later needs every profile touched |
| `fishLoggedCount` | users | Same, and the profile already displays it |
| `accountStatus` | users | Suspension has to be a rules check, and rules can only check fields that exist |
| `suspendedUntil` | users | Pairs with the above for temporary suspensions |
| `featured` | posts | Featuring is an admin-only rule; the field had to exist to be denied to clients |
| `reportCount` | posts | Server counter; adding one to a live collection means touching every post |
| `moderation` | posts | Records whether a human or a model decided, which is what an appeal reviews |

Most are written today and read by nothing. That's deliberate: the cost of
carrying an unused field is a few bytes, and the cost of adding one to a live
collection is a migration plus a rules change plus a redeploy.

`accountStatus` and `featured` are the exceptions — both are already enforced
by the security rules, so suspending someone or pinning a post works from the
Firebase console right now.

---

## What is *not* pre-built

No collections exist for follows, messages, reviews, challenges, tournaments,
badges, events, articles, reports, or appeals. That's the right call — an empty collection with
guessed-at fields is worse than none, because the guesses get baked into
security rules and indexes before anyone knows what the feature actually needs.

Adding a collection is cheap. Changing the shape of one that already holds data
is not, which is why the effort went into the documents that *do* have data:
users and posts.
