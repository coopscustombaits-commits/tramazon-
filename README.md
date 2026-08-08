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
    admin/                the dashboard: queues, anglers, publishing, controls
    post/[id].tsx         a catch, its likes and comments
    wishlist.tsx          saved products
    orders.tsx            order history and status
    user/[uid].tsx        another angler's profile
    messages/             direct message inbox and threads
    baits/                community bait reviews
    learn/                tips and YouTube videos
    compete/              challenges, tournaments, leaderboards
    leaderboard.tsx       all-time angler ranking
    events/               the calendar
    search.tsx            search anglers and catches
    species/              per-species hubs
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

**Phases 1, 2, and 3 are complete. Phase 4 has its dashboard; three items
remain — appeals, AI moderation, and segmented push.**

Where a later phase isn't built it has at least been *designed for* —
[`docs/ROADMAP.md`](docs/ROADMAP.md) audits every remaining item against the
database schema, and a few fields were added early so nothing needs
restructuring. That is not the same as being built.

| Phase | Built |
| --- | --- |
| **1 — Core app** | Everything |
| **2 — Community** | Everything |
| **3 — Engagement** | Everything |
| **4 — Admin dashboard & moderation** | Dashboard done; 3 items left |

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
| Tests | 82 unit + 115 security rules, all in CI |

### Phase 2 — Community · complete

| Feature | State |
| --- | --- |
| Photo **and** video posts | **Done** (built in Phase 1) |
| Follow / unfollow | **Done** |
| Search for users | **Done** — username prefix search |
| Search for posts | **Done** — keyword search, whole words only ([why](docs/ROADMAP.md#phase-2--community)) |
| Species communities | **Done** — 12 curated hubs |
| Private messaging | **Done** — one-to-one, blocking enforced in the rules |
| Product reviews | **Done** — with a server-verified purchase badge |
| Bait reviews | **Done** — community reviews of any bait |
| YouTube integration | **Done** — inline player, id stored not a URL |

### Phase 3 — Engagement · complete

| Feature | State |
| --- | --- |
| New product / limited-edition notifications | **Done** (the announcement system) |
| Fishing challenges | **Done** — entered by posting a catch |
| Online tournaments | **Done** — same mechanism, dated |
| Leaderboards | **Done** — a query over posts, not a stored ranking |
| Badges and achievements | **Done** — data-driven, awarded automatically |
| Points / rewards | **Done** — with an auditable ledger |
| Event calendar | **Done** — admin-authored, links into the app |
| Fishing tips and articles | **Done** — shares the articles collection |
| Featured products on home | **Done** — a Shopify collection named `featured` |

### Phase 4 — Admin dashboard & moderation · 3 items left

The dashboard is at **Settings → Admin → Dashboard**, and it sits on top of the
server-side enforcement that was built first. Every screen there is a
convenience: the security rules are what actually stop anyone, and they run on
Google's servers where a modified app can't reach them.

| Feature | State |
| --- | --- |
| Review pending posts | **Done** — the Phase 1 queue, not a full dashboard |
| Send push to all users | **Done** — the announcement composer |
| Delete posts and comments | **Done** — from the post screen |
| Suspend / ban a user | **Done** — from the dashboard, with timed suspensions |
| Feature a post on home | **Done** — pin from the post screen, pinned first in the feed |
| User counts and totals | **Done** — dashboard tiles from `stats/global` |
| Deeper analytics | Not built — Firebase Analytics needs enabling |
| Manage users | **Done** — search, suspend, ban, reinstate, adjust points |
| Segmented push | Not built |
| Manage tournaments and challenges | **Done** — admin editor |
| Manage badges | **Done** — admin editor, no deploy needed |
| Add / edit articles | **Done** — admin editor with drafts |
| Remote config | **Done** — maintenance mode, pause posting/DMs, feed banner |
| **User reporting** | **Done** — report posts, comments, and anglers |
| **User blocking** | **Done** — block list, feed and comments filtered |
| Reports queue | **Done** — admin-only, with push alerts |
| Moderate reported messages | **Done** — read and remove from the reports queue |
| Flagged-post review | **Done** — open, take down, or pin from the report |
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
