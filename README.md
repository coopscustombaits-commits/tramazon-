# Coop's Custom Baits — mobile app

React Native / Expo app for iOS and Android. Firebase for accounts, database,
and photos; Shopify Storefront API for the store.

## Quick start

```bash
npm install
cp .env.example .env     # then fill it in — see docs/SETUP.md
npm start                # or `npm run start:tunnel` from a Chromebook or Codespace
```

No Mac or PC? A Chromebook works — either through ChromeOS's Linux environment
or through GitHub Codespaces entirely in the browser. This repo ships a
devcontainer so a Codespace sets itself up. See `docs/SETUP.md` §1.

Google sign-in, Apple sign-in, and push notifications are native modules, so
they need a development build rather than Expo Go:

```bash
eas build --profile development --platform ios
npx expo start --dev-client
```

**Read [`docs/SETUP.md`](docs/SETUP.md) first** — it walks through creating the
Firebase project, enabling the sign-in providers, and the Apple/Google
developer account steps.

## Where things live

```
src/
  app/                    screens — the file tree is the navigation tree
    (auth)/               welcome, log in, sign up, password reset
    (tabs)/               feed, shop, post, profile
    settings/             settings, edit profile, about, contact
    admin/                admin-only review queue
    post/[id].tsx         a catch, its likes and comments
    wishlist.tsx          saved products
    orders.tsx            order history and status
    user/[uid].tsx        another angler's profile
    notifications.tsx     in-app activity history
    product/[handle].tsx  a product
    cart.tsx              cart and checkout
    complete-profile.tsx  username setup after Google/Apple sign-up
  components/ui/          buttons, inputs, cards — the design system
  constants/theme.ts      light and dark palettes, spacing, type scale
  constants/theme-context.tsx  the live theme, and makeStyles()
  constants/content.ts    About and Contact copy
  lib/
    firebase.ts           Firebase init
    username.ts           username rules (pure, unit tested)
    auth/                 auth context, Google, Apple, error messages
    db/                   Firestore paths and queries
    storage/              image upload
    shopify/              Storefront API client, cart state
    notifications.ts      push registration and deep links
  hooks/                  push notification wiring
  types/models.ts         Firestore document shapes

functions/                Cloud Functions — push notifications and counters
firestore.rules           who can read and write what — the real enforcement
storage.rules             photo upload limits
firestore.indexes.json    composite indexes
docs/DATA-MODEL.md        why the database is shaped this way
docs/ROADMAP.md           how Phases 2-4 fit the existing schema, and what
                          the app stores require before the first submission
```

## Build status

**Phase 1 is complete. Phases 2, 3, and 4 are not built.**

The later phases have been *designed for* — [`docs/ROADMAP.md`](docs/ROADMAP.md)
audits every item against the database schema, and a few fields were added early
so nothing needs restructuring. That is not the same as being built. Nothing in
Phase 2 or 3 exists as a screen, and the Phase 4 dashboard doesn't exist at all.

| Phase | Built |
| --- | --- |
| **1 — Core app** | Everything |
| **2 — Community** | 2 of 8 items |
| **3 — Engagement** | 1 of 9 items |
| **4 — Admin dashboard & moderation** | Enforcement only, no dashboard |

---

### Phase 1 — Core app · complete

| Feature | State |
| --- | --- |
| Project setup, theme, navigation | Done |
| Email sign up / log in / password reset | Done |
| Sign in with Google | Done — needs credentials, `docs/SETUP.md` §4 |
| Sign in with Apple | Done — needs credentials, `docs/SETUP.md` §5 |
| Profiles: photo, username, bio, favorite species | Done |
| Edit profile | Done |
| Basic stats (posts, fish logged) | Done — fish logged is a placeholder |
| Shopify: products, categories, search, detail pages | Done — needs credentials, §8 |
| Shopify: cart and checkout | Done |
| Wishlist | Done |
| Order history | Screen done — **live status needs a webhook that isn't written yet**, §9 |
| Home feed: photo/video posts, caption, species tag | Done |
| Pending → approve/reject workflow | Done |
| Admin review queue | Done |
| Like, comment, share | Done |
| Push: review alert, approval alert, announcements | Done — deploy functions, §7 |
| In-app activity feed + notification preferences | Done |
| Public angler profiles | Done |
| Settings, About, Contact, Privacy | Done — **awaiting Coop's real copy** |
| Dark mode toggle | Done |
| Log out / delete account | Done |
| Firestore schema + security rules | Done, covers all four phases |
| Tests | 42 unit + 43 security rules, all in CI |

### Phase 2 — Community · 5 of 9

| Feature | State |
| --- | --- |
| Photo **and** video posts | **Done** (built in Phase 1) |
| Follow / unfollow | **Done** |
| Search for users | **Done** — username prefix search |
| Search for posts | **Done** — keyword search, whole words only ([why](docs/ROADMAP.md#phase-2--community)) |
| Species communities | **Done** — 12 curated hubs |
| Private messaging | Not built |
| Product reviews | Not built |
| Bait reviews | Not built |
| YouTube integration | Not built |

### Phase 3 — Engagement · 1 of 9

| Feature | State |
| --- | --- |
| New product / limited-edition notifications | **Done** (the announcement system) |
| Fishing challenges | Not built — `posts.challengeId` is ready |
| Online tournaments | Not built — `posts.tournamentId` is ready |
| Leaderboards | Not built — the counters they rank on exist |
| Badges and achievements | Not built |
| Points / rewards | Not built — `users.points` is ready |
| Event calendar | Not built |
| Fishing tips and articles | Not built |
| Featured products on home | Not built |

### Phase 4 — Admin dashboard & moderation · enforcement only

There is **no dashboard**. What exists is the server-side enforcement it will
sit on top of, which is the part that has to be right first.

| Feature | State |
| --- | --- |
| Review pending posts | **Done** — the Phase 1 queue, not a full dashboard |
| Send push to all users | **Done** — the announcement composer |
| Delete posts and comments | **Done** — from the post screen |
| Suspend / ban a user | **Enforced** — no UI; works from the Firebase console |
| Feature a post on home | **Enforced** — no UI; works from the Firebase console |
| User counts, active users, analytics | Not built — Analytics needs enabling |
| Manage users (edit, delete) | Not built |
| Segmented push | Not built |
| Manage tournaments, challenges, badges | Not built |
| Add / edit articles | Not built |
| Remote config | Not built |
| **User reporting** | **Done** — report posts, comments, and anglers |
| **User blocking** | **Done** — block list, feed and comments filtered |
| Reports queue | **Done** — admin-only, with push alerts |
| Flagged-post review | Not built |
| Appeals | Not built |
| AI moderation | Not built |

> **App Store guideline 1.2 (user-generated content) — all four now met:**
> content filtering (every post is reviewed), user reporting, user blocking,
> and published contact info.

---

Every push runs typecheck, lint, unit tests, an iOS/Android/web bundle, the
Cloud Functions build, and the security rules tests — see
[`.github/workflows/ci.yml`](.github/workflows/ci.yml). None of it needs
credentials.

> **Nothing here has been run against a live Firebase project or a real
> Shopify store.** It typechecks, bundles for iOS/Android/web, and passes 65
> tests, but no screen has yet talked to a real backend. That's the next
> milestone, and it needs `docs/SETUP.md` §1–3.

## Commands

```bash
npm start            # dev server
npm run start:tunnel # dev server reachable from anywhere (Chromebook, Codespaces)
npm run ios          # dev server + iOS simulator
npm run android      # dev server + Android emulator
npm run typecheck    # tsc --noEmit
npm run lint
npx expo start -c    # clear the Metro cache (do this after editing .env)

npm run test:unit    # unit tests — fast, no emulator needed
npm run test         # unit tests + security rules tests
npm run ci           # everything CI runs, in one go

npm run emulators    # local Firestore/Auth/Storage, if you want it running
                     # while you work on the app

firebase deploy --only firestore:rules,firestore:indexes,storage
firebase deploy --only functions
```

## How a catch moves through the app

```
angler posts   ->   status: pending        (nobody else can see it)
                          |
                          |  Cloud Function: push to Coop, "new catch to review"
                          v
                 admin review queue
                    /             \
              approve             reject
                 |                   |
       status: approved       status: rejected
       publishedAt set        leaves the queue, never public
       push to the angler
       postCount +1
                 |
                 v
        public feed — likes and comments open
```

The client can't skip a step. `firestore.rules` refuses to create a post in any
status but `pending`, and refuses to change that status unless the caller has an
`admins/{uid}` document. Like and comment counts are written only by Cloud
Functions, so they can't be inflated from a modified app.
