# Setup — things only you can do

Everything in here needs your accounts and your credit card, so I can't do it
for you. Work top to bottom; each section says what you get at the end of it.

Nothing in the app runs until **section 2** is done. Google and Apple sign-in
stay hidden until sections 4 and 5 are done, so you can start testing with
email straight away.

---

## 1. Tools on your machine

```bash
node --version   # need 20 or newer
npm install      # from the project folder
npm install -g eas-cli firebase-tools
```

You'll also want:

- An **Expo account** — free, at https://expo.dev. Run `eas login`.
- **Xcode** (Mac only) if you want the iOS simulator.
- **Android Studio** if you want the Android emulator.

Neither is required to start — you can run on your own phone.

---

## 2. Firebase project

This is the backend: accounts, database, photo storage.

1. Go to https://console.firebase.google.com → **Create a project**.
   - Name it `coops-custom-baits`.
   - Google Analytics is optional; skip it if unsure.

2. **Add a Web app** (the `</>` icon on the project overview). Call it
   "Coop's Custom Baits Mobile". Don't add Firebase Hosting.
   Firebase shows you a config block that looks like this:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "coops-custom-baits.firebaseapp.com",
     projectId: "coops-custom-baits",
     storageBucket: "coops-custom-baits.firebasestorage.app",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abc123"
   };
   ```

   > Use the **Web** app config even though this is a mobile app. The app uses
   > the Firebase JS SDK, which reads the web config on every platform.

3. Copy `.env.example` to `.env` and paste those six values in.

   ```bash
   cp .env.example .env
   ```

   `.env` is gitignored. These values are safe to have in the app bundle —
   Firebase is designed that way, and access is controlled by the security
   rules in `firestore.rules`.

4. **Authentication** → Get started → **Sign-in method** tab:
   - Enable **Email/Password**. Leave "Email link" off.
   - Leave Google and Apple for sections 4 and 5.

5. **Firestore Database** → Create database:
   - Start in **production mode** (we ship real rules in a moment).
   - Location: pick the one nearest you (`us-central` or `us-east1` for most of
     the US). **This cannot be changed later.**

6. **Storage** → Get started. Same location as Firestore.
   - Storage now requires the **Blaze (pay-as-you-go)** plan. There's a
     generous free tier underneath it; for an app this size expect to pay
     roughly nothing. You'll need Blaze anyway for the push notification
     functions in a later step, so this is the moment to add a card.

7. Deploy the rules and indexes from this repo:

   ```bash
   firebase login
   firebase use --add          # pick the project, alias it "default"
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

   **Do this before anyone signs up.** Until it runs, the default rules block
   everything and the app will look broken.

**You can now run the app.**

```bash
npx expo start
```

Press `i` for the iOS simulator, `a` for Android, or scan the QR code with the
Expo Go app to run on your phone. Email sign-up works; the Google and Apple
buttons stay hidden until you finish the next sections.

---

## 3. Make yourself the admin

Admin is granted by a document in Firestore, not by a flag in the app, so
nobody can grant it to themselves.

1. Sign up in the app with the email you want to use as your owner account.
2. Firebase console → **Authentication** → **Users** → copy the **User UID**
   for that account (a long string like `k3Jd8sLp...`).
3. Firestore → **Start collection** → collection ID `admins`.
4. Document ID: paste your UID. Add one field:
   - `grantedAt` — type `timestamp` — today's date.
5. Add the same UID to `.env` as `EXPO_PUBLIC_ADMIN_UID` and restart the dev
   server (`npx expo start -c`).

Reopen the app. Your profile now shows an **Admin** badge and a **Review
pending posts** button.

---

## 4. Google Sign-In

Google Sign-In is a native module, so **it does not work in Expo Go** — you
need a development build (section 6). Set the credentials up first.

1. Firebase console → **Authentication** → **Sign-in method** → **Google** →
   Enable. Set the support email to your address. Save.

2. That created OAuth clients for you. Go to
   https://console.cloud.google.com/apis/credentials, make sure the project
   selector at the top says `coops-custom-baits`, and look at **OAuth 2.0
   Client IDs**.

3. Copy the **Web client** ID into `.env` as
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. This one is required on both platforms —
   it's what Firebase checks the sign-in token against.

4. **iOS client**: if there isn't one, create it —
   **Create credentials** → OAuth client ID → Application type **iOS** →
   Bundle ID `com.coopscustombaits.app`.
   Copy it into `.env` as `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.

5. **Android client**: Android OAuth clients are tied to the signing
   certificate of the build, so you need the fingerprint EAS uses.

   ```bash
   eas credentials -p android
   ```

   Pick your profile, then **Keystore: Manage everything** → it prints a
   **SHA-1 fingerprint**. Then in Google Cloud console:
   **Create credentials** → OAuth client ID → **Android** →
   package name `com.coopscustombaits.app`, paste the SHA-1.

   You don't put the Android client ID in `.env` — Android matches on the
   package name plus fingerprint. But the client must exist or sign-in fails
   with a `DEVELOPER_ERROR`.

   > Do this again for the production build if EAS generates a separate
   > upload key, and add the **Play App Signing** SHA-1 from Play Console once
   > the app is live. Missing that one is the single most common reason Google
   > sign-in works in testing and fails in production.

---

## 5. Sign in with Apple

Apple requires this whenever an app offers any other social sign-in, so it is
not optional for App Store review. It also **needs a paid Apple Developer
account** ($99/year, https://developer.apple.com/programs) and only runs on a
real device or simulator build — not Expo Go.

1. Enroll in the Apple Developer Program. Approval can take a day or two.

2. https://developer.apple.com/account → **Certificates, Identifiers &
   Profiles** → **Identifiers** → register an App ID:
   - Bundle ID: `com.coopscustombaits.app` (explicit, not wildcard)
   - Capabilities: check **Sign In with Apple**

3. **Identifiers** → **Services IDs** → create one:
   - Identifier: `com.coopscustombaits.app.signin`
   - Enable **Sign In with Apple** → Configure:
     - Primary App ID: the App ID from step 2
     - Domain: `coops-custom-baits.firebaseapp.com`
     - Return URL: `https://coops-custom-baits.firebaseapp.com/__/auth/handler`

     (Use your real `authDomain` from `.env` if the project ID differs.)

4. **Keys** → create a key, enable **Sign In with Apple**, configure it against
   the App ID, and download the `.p8` file. **You can only download it once.**
   Note the **Key ID** and your **Team ID** (top right of the developer portal).

5. Firebase console → **Authentication** → **Sign-in method** → **Apple** →
   Enable, and fill in:
   - Services ID: `com.coopscustombaits.app.signin`
   - Apple Team ID
   - Key ID
   - Private key: paste the contents of the `.p8` file

6. In the app's Apple Developer settings, keep **Sign In with Apple** enabled
   on the App ID — `app.config.ts` already sets `usesAppleSignIn: true`, so the
   entitlement is added automatically at build time.

---

## 6. Development build

Google sign-in, Apple sign-in, and push notifications are native code. Expo Go
can't load them, so you need your own build of the app. You only rebuild when
native dependencies change — day-to-day JS changes still hot-reload.

```bash
eas login
eas init                      # links the project, writes the EAS project ID
eas build --profile development --platform ios       # or android, or all
```

Copy the project ID it prints into `.env` as `EAS_PROJECT_ID`.

The build runs on Expo's servers (~15 min) and gives you a link to install on
your device. For a Mac simulator build use
`--profile development` (it's already set to `simulator: true`); for a physical
iPhone use `--profile development-device`, which requires registering the
device:

```bash
eas device:create
```

Then run the dev server and open it from the installed app:

```bash
npx expo start --dev-client
```

> **EAS builds do not read your local `.env`.** Before your first cloud build,
> push the values as EAS environment variables:
>
> ```bash
> eas env:create --name EXPO_PUBLIC_FIREBASE_API_KEY --value "AIza..." --environment development,preview,production
> ```
>
> ...and so on for each `EXPO_PUBLIC_*` value. `eas env:list` shows what's set.

---

## 7. Store accounts (do these before you're in a hurry)

Neither is needed until you actually publish, but both have waiting periods.

- **Apple Developer Program** — $99/year. Covers Sign in with Apple, TestFlight,
  and the App Store. Enrollment can take a couple of days; business enrollment
  with a D-U-N-S number takes longer.
- **Google Play Console** — $25 one time. Newer developer accounts also require
  a **closed test with 12 testers for 14 days** before you can go to production,
  so start that clock early.

---

## What I still need from you

- [ ] The **About Coop's Custom Baits** text — drop it in and I'll put it in
      `src/constants/content.ts` (there's placeholder copy in there now).
- [ ] Confirm the **support email** shown on the Contact page (currently
      `coopscustombaits@gmail.com`).
- [ ] Shopify **store domain** and a **Storefront API access token**
      (Shopify admin → Settings → Apps and sales channels → Develop apps →
      create an app → Storefront API access token). The Storefront token is
      safe in the app; the **Admin API token is not** — don't send me that one.
- [ ] A logo / app icon if you have one. Right now the icon and splash are
      Expo's placeholder graphics.
