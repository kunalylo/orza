/** Site-wide constants. Override the contact email with NEXT_PUBLIC_SUPPORT_EMAIL. */
export const SITE = {
  name: "ÖRZA",
  tagline: "Your health, reimagined by AI that evolves with you",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@orza.app",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100",
};
