# Setup — things only you can do

Everything in here needs your accounts and your credit card, so I can't do it
for you. Work top to bottom; each section says what you get at the end of it.

Nothing in the app runs until **section 2** is done. Google and Apple sign-in
stay hidden until sections 4 and 5 are done, so you can start testing with
email straight away.

---

## 1. Get the code running on your computer

### First: most of this doesn't need a terminal

Sections **2, 3, 8 and 9** — the Firebase project, making yourself admin, the
Shopify token, the store accounts — are all done in a web browser. Any
computer works, Chromebook included. The security rules can be published by
pasting them into the Firebase console (section 2 shows both ways).

A terminal is only needed to **run the app** and to **deploy the Cloud
Functions**. Two ways to get one.

### On a Chromebook

**Path A — ChromeOS Linux.** Most Chromebooks from 2019 on can run a real
Linux terminal:

Settings → **About ChromeOS** → **Developers** → **Linux development
environment** → Turn on. Give it 10 GB of disk. A terminal window opens when
it finishes.

Then install Node (Debian's own version is too old):

```bash
sudo apt update && sudo apt install -y git curl
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

Close the terminal, open it again, then:

```bash
nvm install 22
node --version    # should say v22.x
```

If "Linux development environment" isn't in Settings, the Chromebook is either
too old or managed by a school or workplace that has disabled it. Use Path B.

**Path B — GitHub Codespaces, entirely in the browser.** This runs a real Linux
machine in the cloud and gives you a terminal in a browser tab. It works on any
Chromebook, including locked-down ones.

1. Go to the repo on github.com
2. Green **Code** button → **Codespaces** tab → **Create codespace on
   `claude/coops-baits-mobile-phase-1-h8fnwd`**
3. Wait a couple of minutes. It installs everything automatically —
   `.devcontainer/devcontainer.json` in this repo sets up Node 22, Java, and
   the Firebase and EAS tools for you.

Free accounts get about 60 hours a month, which is plenty. Skip to
**section 1c** — steps 1a and 1b are already done for you.

### On a Mac or Windows PC

- **Node.js** — https://nodejs.org, the **LTS** version, accept the defaults.
- **Git** — Mac: run `git --version` and macOS offers to install it.
  Windows: https://git-scm.com/download/win.

Open Terminal (Mac: Cmd+Space, type "Terminal") or PowerShell (Windows: Start
menu, type "PowerShell") and check:

```bash
node --version    # want v20 or higher
git --version
```

### 1b. Download the code

Skip this on Codespaces — the code is already there.

```bash
cd ~
git clone https://github.com/coopscustombaits-commits/tramazon-.git coops-app
cd coops-app
git checkout claude/coops-baits-mobile-phase-1-h8fnwd
npm install
```

`npm install` takes a few minutes and prints a wall of text. Warnings are
normal; only an **error** matters.

Every later command runs from inside that folder. If you close the terminal,
get back with `cd ~/coops-app`.

### 1c. Two more tools

Skip on Codespaces — already installed.

```bash
npm install -g eas-cli firebase-tools
```

On Mac this may need `sudo` in front, which asks for your computer password.

### 1d. How you'll run the app

On **your own phone**, using the free **Expo Go** app from the App Store or
Play Store. No Xcode, no Android Studio.

**On Chromebook Linux or Codespaces, use the tunnel:**

```bash
npm run start:tunnel
```

Not plain `npm start`. The normal mode expects your phone and the dev server to
be on the same network. Inside ChromeOS's Linux container — and obviously
inside a cloud Codespace — they aren't, and the QR code will just hang on
"Downloading". The tunnel routes through the internet instead and works from
anywhere, including on cellular data. It's a little slower to reload; that's
the whole downside.

On a Mac or PC, plain `npm start` is fine.

You'll also want a free **Expo account** at https://expo.dev, then `eas login`.

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

7. Publish the security rules from this repo. **Do this before anyone signs
   up** — until it happens, Firebase's default rules block everything and the
   app will look broken. Two ways; either is fine.

   **From a terminal:**

   ```bash
   firebase login
   firebase use --add
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

   `firebase login` opens a browser to sign in. `firebase use --add` asks two
   questions: pick `coops-custom-baits` from the list (arrow keys, Enter), then
   type `default` for the alias.

   **Or entirely in the browser**, no terminal at all:

   - Open [`firestore.rules`](../firestore.rules) on GitHub, click the copy
     button, then in the Firebase console go to **Firestore Database** →
     **Rules** tab → select everything in the editor → paste → **Publish**.
   - Same again with [`storage.rules`](../storage.rules) into **Storage** →
     **Rules** → **Publish**.
   - Indexes can wait. Firestore builds simple ones automatically, and the
     first time a query needs a composite index the app logs an error
     containing a link that creates it in one click. If you'd rather do it up
     front, [`firestore.indexes.json`](../firestore.indexes.json) lists the
     four, and **Firestore → Indexes → Add index** takes the same fields.

   Whichever route you take, re-do it whenever the rules change — they are the
   only thing stopping someone from publishing straight to the feed.

**You can now run the app.**

```bash
npm run start:tunnel     # on Chromebook Linux or Codespaces
npm start                # on a Mac or PC
```

A QR code appears (the tunnel takes an extra 20 seconds or so the first time). Open **Expo Go** on your phone and scan it (iPhone: use the
Camera app; Android: the "Scan QR code" button inside Expo Go). Your phone and
computer must be on the same Wi-Fi.

Sign up with an email and password. Google and Apple buttons stay hidden until
sections 4 and 5 — that's expected, not a bug.

If you get *"Missing EXPO_PUBLIC_FIREBASE_API_KEY"*, the `.env` file wasn't
found or is incomplete. Check it's named exactly `.env` (not `.env.txt`), sits
in the `coops-app` folder, then stop the server with Ctrl+C and restart with
`npx expo start -c` (add `--tunnel` if that's what you were using). The `-c`
clears a cache that otherwise holds the old values.

---

## 3. Make yourself the admin

Admin is granted by a document in Firestore, not by a flag in the app, so
nobody can grant it to themselves.

1. Sign up in the app with the email you want as your owner account (you did
   this at the end of section 2).

2. Firebase console → **Authentication** → **Users**. Your account is listed.
   Copy the **User UID** — a long string like `k3Jd8sLp9QeR...`. Hover the row
   and there's a copy button.

3. Firestore Database → **Start collection** (or **+ Start collection** if you
   already have data). Collection ID: `admins` — exactly that, lowercase. Next.

4. **Document ID**: paste your UID. Do *not* click "Auto-ID" — the document ID
   has to be your UID, that's the whole mechanism.

   Add one field:
   - Field: `grantedAt`
   - Type: `timestamp`
   - Value: today's date and time

   Save.

5. Pull down to refresh, or close and reopen the app. There's nothing to
   change in `.env` — the app asks Firestore whether your `admins` document
   exists, so creating it is the entire step.

Go to the Profile tab. You should see an **Admin** badge
under your username and a **Review pending posts** button.

If you don't: the usual cause is a typo in the document ID, or a stray space
when it was pasted. The document ID in Firestore must match the UID in
Authentication character for character.

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

## 7. Cloud Functions (push notifications)

The notifications — "a catch needs review" to you, "your catch is live" to the
angler — are sent by Cloud Functions, not by the app. Same for the like and
comment counts, which are written server-side so nobody can fake them.

```bash
npm --prefix functions install
firebase deploy --only functions
```

First deploy takes a few minutes and asks to enable some Google Cloud APIs —
say yes. Requires the Blaze plan (section 2, step 6).

Two things to know:

- **You only get the review notification if you've opened the app on your
  phone.** Push tokens are registered per device at sign-in. If you never sign
  in on a real phone, there's nothing to notify. Check
  `users/<your-uid>/pushTokens` in Firestore — there should be a document there.
- **Push doesn't work in Expo Go or on a simulator.** Real device, development
  build. If nothing arrives, `firebase functions:log` will say why.

To check the whole loop: post a catch from a second account, and you should get
a notification within a few seconds. Tapping it opens the review queue.

---

## 8. Shopify store

The Shop tab reads directly from your Shopify store, so products, prices, and
stock stay in one place — you keep managing everything in Shopify admin and the
app follows. Until this is configured, the Shop tab says "store coming soon"
and everything else works normally.

1. Shopify admin → **Settings** → **Apps and sales channels** →
   **Develop apps** → **Create an app**. Name it "Coop's Custom Baits Mobile".

2. **Configuration** → **Storefront API** → Configure. Tick at least:
   - `unauthenticated_read_product_listings`
   - `unauthenticated_read_products`
   - `unauthenticated_write_checkouts`
   - `unauthenticated_read_checkouts`

3. **API credentials** → **Install app** → copy the
   **Storefront API access token**.

4. Put it in `.env`:

   ```
   EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN=coops-custom-baits.myshopify.com
   EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN=the-token-you-just-copied
   ```

   Use the `.myshopify.com` domain, not a custom domain — the API lives on the
   former. Restart with `npx expo start -c` so the new values get picked up.

> **Storefront token, not Admin token.** The Storefront token is meant to ship
> inside apps: it can read published products and manage carts, and that's all.
> The **Admin API token** can read orders and customers and change your store —
> it must never go in the app, in `.env`, or in a message to me.

Checkout opens Shopify's own hosted checkout in an in-app browser. That means
payments, taxes, shipping rates, and discount codes all keep working exactly as
they do on your website, and the app never touches card details.

If products don't appear, the usual cause is that they aren't published to the
sales channel the app's token belongs to. In Shopify admin, open a product →
**Publishing** → make sure your new app is listed.

---

## 9. Order tracking (optional, needs the Admin API)

Order history works without this — an order shows as "Order placed" from the
moment checkout opens. To have it update to *paid*, *shipped*, and carry a
tracking link, Shopify needs to tell us when that happens.

The handler is built (`functions/src/shopify.ts`). Three steps to connect it:

1. **Store the signing secret in Firebase**, so the function can prove a
   request really came from Shopify:

   ```bash
   npx firebase functions:secrets:set SHOPIFY_WEBHOOK_SECRET
   ```

   Paste the secret when prompted. It goes into Google Secret Manager — not
   into `.env`, not into the repo, and never into the app.

   You'll get the secret itself in step 3; run this again afterwards if you
   need to set it a second time.

2. **Deploy**, and note the URL it prints for `shopifyOrderWebhook`:

   ```bash
   npm --prefix functions run deploy
   ```

3. **Point Shopify at it.** Shopify admin → **Settings** → **Notifications** →
   **Webhooks** → *Create webhook*, once for each of `orders/create`,
   `orders/paid`, `orders/fulfilled`, and `orders/cancelled`. Format JSON, URL
   the one from step 2. Shopify shows the signing secret on that page — that's
   the value for step 1.

**How to tell it's working.** Place a test order. Within a few seconds the
order screen should move off "Order placed", and marking it fulfilled in
Shopify should push "Your order shipped" to the phone that bought it.

**If nothing happens**, check the function logs
(`npx firebase functions:log --only shopifyOrderWebhook`). A `401 Bad
signature` means the secret in step 1 doesn't match the one Shopify shows.
"No matching order" is normal and not an error — it means somebody ordered
from the website rather than the app, and there's no app order to update.

> This is the one place an **Admin API** credential is involved, and it lives
> only in Secret Manager — never in the app, never in `.env`, never in the
> repo. Order history works without any of this; it just stays on "Order
> placed" until the webhook is connected.

---

## 10. Store accounts (do these before you're in a hurry)

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
- [ ] A second test account (any email) so you can post a catch and review it
      from your own account — the queue can't really be tested with one login.
