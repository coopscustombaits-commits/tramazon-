# Firestore data model

The shapes live in [`src/types/models.ts`](../src/types/models.ts) and the
enforcement lives in [`firestore.rules`](../firestore.rules). This document
explains *why* it's laid out this way, and where the later phases plug in.

## Collections

```
users/{uid}                              public profile
  private/profile                        email, notification prefs (owner only)
  pushTokens/{expoPushToken}             one per device
  notifications/{notificationId}         in-app notification history

usernames/{usernameLower}                { uid } — uniqueness reservation
admins/{uid}                             presence = admin

posts/{postId}                           a catch post, any status
  likes/{uid}                            document id is the liker
  comments/{commentId}
```

## The decisions that matter

**Posts are top-level, not nested under users.** A feed of approved posts is
then one indexed query regardless of how many users exist. Nesting posts under
users would have forced a collection-group query with worse index behavior, and
would have made the review queue awkward.

**`status` drives everything.** A post is `pending` → `approved` | `rejected`.
The security rules only let a client create a post as `pending`, and only let
an admin move it out of that state. The feed queries
`where status == 'approved' order by publishedAt desc`, so a rejected or
pending post is invisible without any extra filtering in app code.

**`publishedAt` is separate from `createdAt`.** The feed is ordered by when a
post went live, not when it was submitted. Otherwise a post approved three days
late would appear buried in the middle of the feed where nobody sees it.

**Author details are copied onto each post** (`post.author`: uid, username,
photo). Rendering a 50-post feed reads 50 documents, not 100. The tradeoff is
that a username change has to fan out to existing posts — that's a Cloud
Function job, not something the client does.

**Counters are denormalized and server-written.** `likeCount`, `commentCount`,
and `postCount` live on the parent document and are updated by Cloud Functions
using the Admin SDK, which bypasses security rules. Clients can't write them at
all, so nobody can fake a like count.

**Usernames are reserved in a separate collection.** `usernames/{lower}` is
claimed in the same transaction that creates the profile, so two people signing
up at the same moment can't both get `bassmaster`. It also gives a cheap
availability check without exposing the user list.

**Admin is a document, not a field.** `admins/{uid}` existing is what grants
review powers. A user can read their own admin document and nothing else — so
the app can show or hide the review button, but a modified app still can't
approve anything. (If admin ever needs to be checked inside a Cloud Function
hot path, this can move to a custom auth claim without changing the rules'
shape.)

**Everything carries `schemaVersion`.** When a field changes meaning in a later
phase, a migration can find the old documents instead of guessing.

## How the later phases fit

None of these need the existing collections restructured.

**Following.** Add `follows/{followerId_followingId}` with both ids as fields.
`followerCount` / `followingCount` already exist on the profile and are already
server-written. A "following" feed reads the follow edges, then queries
`posts where authorId in [...] and status == 'approved'` — the same collection
and the same index as today.

**Private messaging.** Add `conversations/{conversationId}` with a
`participantIds` array, plus a `messages` subcollection. Nothing existing
changes; profiles already have everything a chat list needs to render.

**Tournaments.** `posts` already carries a nullable `tournamentId` and
`species`. Add `tournaments/{tournamentId}` and entries become a query on
posts. That field being reserved now is the reason this won't need a
backfill later.

**Badges.** Add `badges/{badgeId}` (definitions) and
`users/{uid}/badges/{badgeId}` (awards). Awarding hangs off the same Cloud
Functions that already maintain the counters.

**Notification types** are a union in `src/types/models.ts` that already
includes `new_follower`, `new_message`, and `badge_earned`, so the push
handling written for Phase 1 will route them without changes.

## What Cloud Functions own

`functions/src/index.ts` holds everything a client must not be trusted with:

| Trigger | Does |
| --- | --- |
| post created | pushes "new catch to review" to every admin |
| post status changed | pushes "your catch is live" to the author, `postCount` ±1 |
| post deleted | removes the photo, likes, and comments |
| like / comment created or deleted | `likeCount` / `commentCount` ±1, notifies the author |
| profile updated | fans the new username/photo out to that user's posts |
| `users/{uid}` deleted | cascades: posts, photos, push tokens, notifications |

Counters are only ever written here, with the Admin SDK, which bypasses
security rules. The rules deny those fields to clients outright, so the numbers
can't be inflated by a modified app.

## Indexes

Composite indexes are declared in
[`firestore.indexes.json`](../firestore.indexes.json) and deployed with
`firebase deploy --only firestore:indexes`. Four are defined: the public feed,
the review queue, your own posts, and someone else's approved posts.

If a query ever fails with a "requires an index" error, the error message
contains a link that builds it — but add it to that file too, or the next
deploy will drop it.
