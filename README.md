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
    complete-profile.tsx  username setup after Google/Apple sign-up
  components/ui/          buttons, inputs, cards — the design system
  constants/theme.ts      colors, spacing, type scale
  constants/content.ts    About and Contact copy
  lib/
    firebase.ts           Firebase init
    auth/                 auth context, Google, Apple, error messages
    db/                   Firestore paths and queries
    storage/              image upload
  types/models.ts         Firestore document shapes

firestore.rules           who can read and write what — the real enforcement
storage.rules             photo upload limits
firestore.indexes.json    composite indexes
docs/DATA-MODEL.md        why the database is shaped this way
```

## Phase 1 status

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
| Firestore schema + security rules | Done (covers all of Phase 1), 16 rules tests |
| Shopify store | Not started |
| Home feed + post review workflow | Not started |
| Push notifications | Not started |

## Commands

```bash
npm start            # dev server
npm run ios          # dev server + iOS simulator
npm run android      # dev server + Android emulator
npm run typecheck    # tsc --noEmit
npm run lint
npx expo start -c    # clear the Metro cache (do this after editing .env)

npm run emulators    # local Firestore/Auth/Storage, in one terminal...
npm run test:rules   # ...then the security rules tests in another

firebase deploy --only firestore:rules,firestore:indexes,storage
```
