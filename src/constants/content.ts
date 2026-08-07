/**
 * Marketing and support copy lives here so it can be edited without touching
 * screen code. Replace the placeholders with Coop's real text.
 */

export const ABOUT_CONTENT = {
  headline: "Handmade baits, built to get bit.",
  // TODO(coop): replace with the real About text.
  paragraphs: [
    "Coop's Custom Baits is a small operation run by anglers, for anglers. Every bait is poured, painted, and tested by hand — no mass production, no shortcuts.",
    'We started making baits because we could not find what we wanted on the shelf. Word got around, orders followed, and here we are.',
    'This app is where the community lives: shop the current lineup, share your catches, and see what everyone else is landing.',
  ],
  foundedYear: 2019,
} as const;

export const CONTACT_CONTENT = {
  // TODO(coop): confirm these before launch — they are shown in the app.
  supportEmail: 'coopscustombaits@gmail.com',
  responseTime: 'We usually reply within a day or two.',
  /** Optional; leave a value empty to hide the row. */
  instagram: '',
  facebook: '',
  website: '',
} as const;

export const PRIVACY_CONTENT = {
  // TODO(coop): both stores require a publicly reachable privacy policy URL
  // before an app can be submitted. Put the real one here.
  policyUrl: '',
  /** Plain-language summary shown in the app. The URL above is the legal one. */
  collected: [
    'Your email address, so you can sign in and reset your password.',
    'Your username, bio, profile photo, and favorite species — whatever you choose to put on your profile.',
    'Photos and videos you post, along with their captions.',
    'A device token, so we can send you notifications. Turning notifications off removes it.',
  ],
  shared: [
    'Nothing is sold, ever.',
    'Orders go through Shopify, who handle payment and shipping under their own privacy policy.',
    'Notifications are delivered through Expo, Apple, and Google.',
  ],
} as const;
