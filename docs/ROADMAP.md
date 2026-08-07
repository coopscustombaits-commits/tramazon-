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
2. A mechanism for users to **report** offensive content — ✅ built.
3. The ability for users to **block** abusive users — ✅ built.
4. Published contact information — ✅ the Contact & support page.

Google Play's User Generated Content policy asks for much the same.

All four are met. Reporting and blocking were pulled forward out of Phase 4
because a missing one of these is a rejection, not a feature gap.

---

## Phase 2 — Community

| Feature | What it needs | Status |
| --- | --- | --- |
| Follow / unfollow | New `follows` collection | **Built** |
| Search users | Prefix query on `usernameLower` | **Built** |
| Search posts | `posts.keywords` + `array-contains` | **Built** — see the note below |
| Species communities | `posts.speciesSlug` ★ + index | **Built** |
| Private messaging | New `conversations` collection | **Built** |
| Product reviews | New `productReviews` collection | **Built** |
| Bait reviews | New `baitReviews` collection | **Built** |
| Photo and video posts | — | **Done in Phase 1** |
| YouTube integration | New `articles` collection | Ready |

**Follow / unfollow.** Add `follows/{followerId}_{followingId}` carrying both
ids as fields. `followerCount` and `followingCount` already exist on the
profile and are already server-written, so the counters work the day the
feature lands. A "following" feed is
`posts where authorId in [...] and status == 'approved'` — the same collection
and the same index the public feed already uses.

**Private messaging.** `conversations/{id}` holds a `participantIds` array and
a `messages` subcollection. Three decisions worth knowing:

*The thread id is derived, not random* — both uids sorted and joined with `_`.
If it were random, two people opening a DM with each other at the same moment
would each create a thread and neither would see the other's messages. The
rules enforce both the sort and the match, so a thread whose id disagrees with
its participants can't be created at all.

*The preview, the sort key, and unread counts are server-written.* A
participant may do exactly one thing to the thread document: set their own
unread count to zero. Everything else is the `onMessageCreated` function's, for
the same reason like counts are — otherwise a modified client could forge
somebody else's unread badge or rewrite what a thread appears to say.

*You cannot message someone who blocked you*, and the check runs on every
message rather than only when the thread is opened. This works because
`exists()` inside a security rule is not subject to read rules: the block list
stays completely private to its owner, and the sender just sees the send fail.
That property is what makes blocking meaningful once DMs exist.

Group threads are a data change, not a schema change — the participant array
already generalizes; the rules pin it to two.

**Species communities.** Posts carry free-text `species` plus ★`speciesSlug`,
a normalized form written at post time ("Largemouth Bass", "largemouth bass",
and "LARGEMOUTH  BASS" all become `largemouth-bass`). A species hub is an
exact-match query on the slug. Without it this would have meant rewriting every
post later.

The hub list in `src/constants/species-hubs.ts` is curated, not derived from
what's been posted — an empty hub reads as "nobody's caught one yet", which
invites a post, whereas showing only species that already have catches hides
exactly the ones worth filling. Adding a species is one line in that file.

**Searching posts — and its one real limit.** **Firestore has no full-text
search.** It can prefix-match a single field, which is enough for usernames but
not for "show me posts mentioning chartreuse".

What's built is the keyword-array approach: every post carries
`keywords: string[]`, computed at post time from the caption, the species, and
the author's username (lowercased, punctuation stripped, stop words and
two-letter words dropped, capped at 40 entries). Search runs
`where('keywords', 'array-contains', term)`.

The limit worth knowing: **it matches whole words only.** "pike" finds posts,
"pik" doesn't, and there's no typo tolerance or relevance ranking. That's an
acceptable trade for a community this size, and it costs nothing extra.

If it stops being enough, the upgrade is the Algolia or Typesense Firebase
extension, which mirrors the `posts` collection into a real search index.
It's additive — nothing about how posts are stored has to change, and the
`keywords` field can stay or go.

One thing to know operationally: keywords are written when a post is created,
so posts written before this feature existed have no `keywords` field and won't
turn up in a search. Since nothing has shipped yet, that set is empty. If it
ever isn't, a one-off backfill script over `posts` fixes it.

**Product and bait reviews.** Two collections, because the brief separates
them and so does the meaning: `productReviews/{handle}` for things Coop sells,
`baitReviews/{slug}` for the community reviewing any bait at all. The documents
are the same shape, so one data module and one set of components serve both.

Three things worth knowing:

*The review's document id is the author's uid.* That's what enforces one review
per person per thing — there is no write that stacks five, and editing yours
overwrites rather than appends.

*The average is server-written.* Each subject has a summary document holding
`reviewCount`, `ratingSum` and `ratingAverage`; the client may create it (it's
the only side that knows the display title) but every counted field must start
at zero and can never be updated from the app. An average a client can set is
not a rating. Keeping `ratingSum` alongside the count is what makes a new
review two increments rather than a re-read of every review.

*The verified-purchase badge is server-set.* Clients are required to write
`verifiedPurchase: false`; a Cloud Function then checks the author's paid
orders for the product handle and flips it. Order lines now record
`productHandle` for exactly this — matching on a title would break the first
time a product was renamed.

Product reviews key on the Shopify **handle**, not the product id: it's what
the app already routes on, and it survives a product being recreated in
Shopify. Bait names are slugged (`lib/slug.ts`) so "Chatterbait", "chatterbait"
and "CHATTERBAIT" are one bait with three reviews rather than three baits with
one each.

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
