# Coop's Custom Baits — mobile app

React Native / Expo app for iOS and Android. Firebase for accounts, database,
and photos; Shopify Storefront API for the store.

## Quick start

```bash
npm install
cp .env.example .env     # then fill it in — see docs/SETUP.md
npx expo start
```

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
    user/[uid].tsx        another angler's profile
    notifications.tsx     in-app activity history
    product/[handle].tsx  a product
    cart.tsx              cart and checkout
    complete-profile.tsx  username setup after Google/Apple sign-up
  components/ui/          buttons, inputs, cards — the design system
  constants/theme.ts      colors, spacing, type scale
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
```

## Phase 1 status

Everything Coop asked for in Phase 1 is built. Three items need credentials
that only he can create — the app degrades cleanly without them (social
sign-in buttons hide themselves, the Shop tab says "coming soon").


| Feature | State |
| --- | --- |
| Project setup, theme, navigation | Done |
| Email sign up / log in / password reset | Done |
| Sign in with Google | Done — needs credentials from `docs/SETUP.md` §4 |
| Sign in with Apple | Done — needs credentials from `docs/SETUP.md` §5 |
| User profiles (photo, username, bio, favorite species) | Done |
| Edit profile | Done |
| Settings, About, Contact | Done — awaiting real copy |
| Log out / delete account | Done |
| Firestore schema + security rules | Done (covers all of Phase 1), 26 rules tests |
| Tests | 26 unit + 26 security rules, all in CI |
| Home feed (photo + caption posts, likes, comments) | Done |
| Pending → approve/reject review workflow | Done |
| Admin review queue | Done |
| Push notifications (review alerts, approval alerts) | Done — deploy functions, `docs/SETUP.md` §7 |
| Shopify store (products, cart, checkout) | Done — needs credentials from `docs/SETUP.md` §8 |
| In-app activity feed + notification preferences | Done |
| Public angler profiles | Done |

Every push runs typecheck, lint, unit tests, an iOS/Android/web bundle, the
Cloud Functions build, and the security rules tests — see
[`.github/workflows/ci.yml`](.github/workflows/ci.yml). None of it needs
credentials.

## Commands

```bash
npm start            # dev server
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
