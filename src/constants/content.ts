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
