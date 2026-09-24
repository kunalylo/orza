import type { FaqItem } from "@/components/pages/FaqAccordion";
import { INITIAL_CREDITS } from "@/lib/credits";

/**
 * FAQ content from the ÖRZA wellness app's FAQ page, grouped by category. Answers about pricing, credits,
 * devices and offline use describe this web app as it works today. Server-only: it reads the live credit grant.
 */
export type FaqCategory = { id: string; title: string; items: FaqItem[] };

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: "product-basics",
    title: "Product Basics",
    items: [
      {
        q: "What is ÖRZA?",
        a: "An AI-powered wellbeing platform that combines food tracking, health data sync, AI coaching, and household health coordination in one app.",
      },
      {
        q: "Does it work for Indian foods?",
        a: "Yes! ÖRZA is built India-first with deep knowledge of regional cuisines, home recipes, and state-wise dishes.",
      },
      {
        q: "Can I use it outside India?",
        a: "Absolutely. While optimized for Indian cuisines, ÖRZA supports global foods (pasta, pizza, sushi, etc.).",
      },
    ],
  },
  {
    id: "food-intelligence",
    title: "Food Intelligence",
    items: [
      {
        q: "How accurate is food photo scanning?",
        a: "High confidence on clear photos. For mixed plates or unclear images, ÖRZA asks follow-up questions. User corrections improve accuracy over time.",
      },
      {
        q: "Does it understand home-cooked meals?",
        a: "Yes. ÖRZA knows home recipes and adjusts calories based on cooking method (home vs. restaurant).",
      },
      {
        q: "What if it doesn't recognize a dish?",
        a: "You can correct it — edit any logged item, or search ÖRZA's food database and add the dish yourself.",
      },
    ],
  },
  {
    id: "voice-language",
    title: "Voice & Language",
    items: [
      {
        q: "Can I log meals in Hindi?",
        a: "Yes! English, Hindi, and Hinglish are all supported.",
      },
      {
        q: "Example of voice logging?",
        a: "“Aaj maine breakfast mein do paratha aur dahi khaya” → ÖRZA logs 2 parathas + curd automatically.",
      },
    ],
  },
  {
    id: "health-data",
    title: "Health Data",
    items: [
      {
        q: "Does ÖRZA sync with Apple Watch?",
        a: "Yes, via Apple Health integration (steps, sleep, workouts).",
      },
      {
        q: "What about Android wearables?",
        a: "Yes, via Health Connect / Google Fit.",
      },
      {
        q: "Can I upload blood test reports?",
        a: "Yes. ÖRZA provides wellness guidance but always recommends consulting your doctor.",
      },
      {
        q: "Does ÖRZA diagnose diseases?",
        a: "No. ÖRZA gives wellness suggestions only, not medical diagnosis.",
      },
    ],
  },
  {
    id: "household-modes",
    title: "Household Modes",
    items: [
      {
        q: "How does Couple mode work?",
        a: "Two linked accounts can log shared meals, see each other's progress (with permission), and coordinate household planning.",
      },
      {
        q: "Can caregivers log for elderly parents?",
        a: "Yes, in Caregiver mode. The caregiver can log meals, track meds, and manage health reports for the dependent.",
      },
      {
        q: "Is Family mode worth it?",
        a: "If you're managing 3+ people's nutrition (kids, parents), yes. Separate profiles + shared planning.",
      },
    ],
  },
  {
    id: "pricing-credits",
    title: "Pricing & Credits",
    items: [
      {
        q: "Is there a free plan?",
        a: `Yes! Manual tracking and the basic dashboard are free forever, and every new account gets ${INITIAL_CREDITS} AI credits.`,
      },
      {
        q: "What are AI actions?",
        a: "Food scans, AI meal logging by text or voice, AI chat, recipe generation and rebalance plans. Manual logging doesn't use credits.",
      },
      {
        q: "Can I try Premium before paying?",
        a: "Premium plans are launching soon, so there's nothing to pay for yet. Join a plan's waitlist on the Pricing page and we'll email you when it opens.",
      },
      {
        q: "Do credits expire?",
        a: "Your sign-up credits don't expire. Premium plans will include unlimited monthly AI, and top-up packs will be valid for 90 days.",
      },
    ],
  },
  {
    id: "privacy-safety",
    title: "Privacy & Safety",
    items: [
      {
        q: "Is my health data private?",
        a: "Yes. Encrypted, not sold, you control sharing.",
      },
      {
        q: "Can family members see my data?",
        a: "Only if you explicitly grant permission.",
      },
      {
        q: "Can I delete my account?",
        a: "Yes, anytime. All data is permanently deleted.",
      },
    ],
  },
  {
    id: "technical",
    title: "Technical",
    items: [
      {
        q: "Does it work offline?",
        a: "ÖRZA saves everything to your account, so logging needs an internet connection. AI features require internet too.",
      },
      {
        q: "Which devices are supported?",
        a: "ÖRZA runs in any modern browser — Chrome, Safari, Edge or Firefox — on your phone, tablet or computer. On your phone, add it to your home screen to open it like an app. Native iOS and Android apps are coming soon.",
      },
    ],
  },
];

export const FAQ_TOTAL = FAQ_CATEGORIES.reduce((n, c) => n + c.items.length, 0);
