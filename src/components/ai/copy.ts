/**
 * Every string the website's AI consent shows: the dialog before the first AI request, the Not now lines and
 * Settings → Preferences → AI features. They are the phone app's (its src/lib/aiConsent.ts, the plan's §4), adapted
 * for the website (§12.3 of docs/notes/ai-consent.md in the mobile repo); the user reviews them.
 * Pure data — bundled into the browser.
 */

/** Where a member starts an AI request (one per AI route). */
export type AiFeature = "chat" | "meal_text" | "snap" | "recipe" | "rebalance" | "rx";

/** What the consent copy is for: an AI feature's first use, or Settings → Preferences → AI features. */
export type ConsentContext = AiFeature | "settings";

export type ConsentPointIcon = "meals" | "chat" | "recipes" | "rx" | "never";

/** The privacy policy's AI section. */
export const AI_PRIVACY_PATH = "/privacy#ai-processing";

const FIRST: Record<AiFeature, string> = {
  chat: "Ask ÖRZA answers with AI.",
  meal_text: "ÖRZA reads typed and spoken meals with AI.",
  snap: "Snap & Know reads your meal photo with AI.",
  recipe: "ÖRZA writes new recipes with AI.",
  rebalance: "ÖRZA personalises rebalance plans with AI.",
  rx: "ÖRZA reads prescription photos with AI.",
};

const WHO = "These features are run by OpenAI, our AI provider. When you use one, ÖRZA sends OpenAI only what that request needs:";

/** The account's step and weight sources (any phone the member uses), as the coach's prompt can carry them. */
const HEALTH_SOURCES =
  "Steps can come from Apple Health, Health Connect or your phone’s motion sensor, and weight from Apple Health or Health Connect.";

const EVERYWHERE = "Your choice applies on the website and in the ÖRZA app.";

export const CONSENT_COPY = {
  eyebrow: "AI features",
  title: "Allow ÖRZA’s AI features?",
  points: [
    { icon: "meals", text: "Meals — your meal photo, or the words you type or say, with your diet, region and language." },
    {
      icon: "chat",
      text: `Ask ÖRZA — your message and the chat so far, your first name and everything in your profile (including age, sex, weight, diet, allergies and health notes), your targets, what ÖRZA remembers, and today’s meals, water and steps. ${HEALTH_SOURCES}`,
    },
    { icon: "recipes", text: "Recipes and rebalance plans — what you ask for, with your first name, diet, allergies, region, goal and targets." },
    { icon: "rx", text: "Prescription scans — the prescription photo and the allergies you listed." },
    // The account's and the saved ones: a photo or a message can show anything (a prescription shows its medicines).
    { icon: "never", text: "Never your account’s email, password or phone number, your saved medicines and alarms, or your sleep and heart rate." },
  ] as { icon: ConsentPointIcon; text: string }[],
  link: "How ÖRZA uses AI",
  allow: "Allow",
  notNow: "Not now",
} as const;

/** The dialog's lead: the feature's first sentence (none from Settings), then who runs it and what is sent. */
export function consentLead(context: ConsentContext): string {
  return context === "settings" ? WHO : `${FIRST[context]} ${WHO}`;
}

/** The lines under the points. */
export function consentAfter(context: ConsentContext): string[] {
  return [
    "ÖRZA shares this only to answer you — never for ads, and it’s never sold.",
    "Everything else works without AI: the food list, medicines and alarms, steps, water and weight.",
    context === "settings" ? EVERYWHERE : `${EVERYWHERE} Turn AI features off any time in Settings → Preferences.`,
  ];
}

const DECLINED: Record<AiFeature, string> = {
  chat: "Ask ÖRZA needs AI features. Your earlier chats are still here.",
  meal_text: "Typing or speaking a meal needs AI features. You can still add foods from the food list.",
  snap: "Snap & Know needs AI features. You can still log your meal from the food list.",
  recipe: "New recipes need AI features. Your saved recipes are still here.",
  rebalance: "New rebalance plans need AI features. Your earlier plans are still here.",
  rx: "Reading a prescription needs AI features. You can type the medicines instead.",
};

/** After Not now: why the feature waits, and what still works (next to an "Allow AI features" button). */
export function declinedLine(feature: AiFeature): string {
  return DECLINED[feature];
}

/** The button that asks again. */
export const ALLOW_AI_LABEL = "Allow AI features";

/** Allow answered 409: the server's consent version is newer than this page's dialog. */
export const AI_OUTDATED_LINE = "This version of ÖRZA can’t turn on AI features. Please reload the page.";

/** Allow or Turn off failed with an answer (offline uses the API client's own line). */
export const AI_SAVE_FAILED_LINE = "Couldn’t save your choice. Please try again.";

/** Settings → Preferences → AI features. */
export const AI_SETTINGS = {
  title: "AI features",
  eyebrow: "Preferences",
  subtitle: (allowed: boolean) => (allowed ? "On · run by OpenAI" : "Off · ÖRZA asks before the first use"),
  manage: "Manage",
  allow: "Allow AI features",
  turnOff: "Turn off AI features",
  confirmTitle: "Turn off AI features?",
  confirmBody:
    "Ask ÖRZA, Snap & Know, typed and spoken meals, recipes, rebalance plans and prescription scans stop on the website and in the app until you allow them again. Your meals, chats and plans stay.",
  confirm: "Turn off",
  cancel: "Keep on",
  offToast: "AI features are off. ÖRZA will ask before using them again.",
  onToast: "AI features are on.",
} as const;
