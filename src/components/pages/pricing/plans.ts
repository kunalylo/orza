import { Heart, Shield, Sparkles, User, Users, type LucideIcon } from "lucide-react";
import type { FaqItem } from "@/components/pages/FaqAccordion";

/**
 * Pricing content (source of truth: the ÖRZA wellness app's PricingPage). Prices in INR.
 * The Free plan and the pricing FAQ describe the web app as it works today (sign-up credits, per-action costs),
 * so they're built from the live credit table passed in from the server. Premium plans and top-ups are a
 * preview: payments aren't live yet, so their CTAs join a waitlist instead of starting a checkout.
 */

export type PlanFeature = { text: string; included: boolean };

/** Live credit facts from `@/lib/credits` (passed in by a server component, because that module is server-only). */
export type CreditFacts = { signupCredits: number; scanCost: number; voiceCost: number };

const credits = (n: number) => `${n} ${n === 1 ? "credit" : "credits"}`;

export type Plan = {
  id: "free" | "individual" | "couple" | "caregiver" | "family";
  name: string;
  desc: string;
  cta: string;
  /** False while the plan can't be bought yet: the card shows "Launching soon" and its CTA joins the waitlist. */
  available: boolean;
  icon: LucideIcon;
  /** Monthly price in ₹ (0 for the free plan). */
  monthly: number;
  /** Annual billing: yearly total and the effective monthly price as published. */
  annual?: { total: number; perMonth: number };
  /** Label used instead of "/month" for plans without billing (the free plan). */
  periodLabel?: string;
  features: PlanFeature[];
  highlight?: boolean;
  group: "core" | "household";
};

export function buildPlans(c: CreditFacts): Plan[] {
  return [
    {
      id: "free",
      name: "Free Forever",
      desc: "Perfect for trying ÖRZA and basic tracking",
      cta: "Start Free",
      available: true,
      icon: Sparkles,
      monthly: 0,
      periodLabel: "Always free",
      group: "core",
      features: [
        { text: "Manual meal, step, water, weight logging", included: true },
        { text: "Basic dashboard & charts", included: true },
        { text: "Goal setting & calorie targets", included: true },
        { text: `${c.signupCredits} AI credits when you sign up`, included: true },
        { text: `Camera food scanning (${credits(c.scanCost)} per scan)`, included: true },
        { text: `Voice & text meal logging (${credits(c.voiceCost)} per log)`, included: true },
        { text: "Medicine reminders with photo alarms", included: true },
        { text: `Prescription scan to reminders (${credits(c.scanCost)} per scan)`, included: true },
        { text: "Health data import & sync (Apple Health, CSV)", included: true },
        { text: "Individual mode only", included: true },
        { text: "Household modes", included: false },
      ],
    },
    {
      id: "individual",
      name: "Premium Individual",
      desc: "Solo users serious about health",
      cta: "Join the waitlist",
      available: false,
      icon: User,
      monthly: 299,
      annual: { total: 2499, perMonth: 208 },
      highlight: true,
      group: "core",
      features: [
        { text: "Everything in Free, plus:", included: true },
        { text: "Unlimited AI actions", included: true },
        { text: "Voice meal logging (3 languages)", included: true },
        { text: "Camera food scanning", included: true },
        { text: "Advanced AI chat", included: true },
        { text: "Recipe generation", included: true },
        { text: "Wearable sync (Apple/Google)", included: true },
        { text: "Health report interpretation", included: true },
        { text: "Lifetime history", included: true },
        { text: "Priority support", included: true },
      ],
    },
    {
      id: "couple",
      name: "Premium Couple",
      desc: "Couples managing health together",
      cta: "Join the waitlist",
      available: false,
      icon: Heart,
      monthly: 499,
      annual: { total: 4199, perMonth: 350 },
      group: "household",
      features: [
        { text: "All Individual features × 2 users", included: true },
        { text: "Shared meal logging", included: true },
        { text: "Partner notifications", included: true },
        { text: "Household meal planning", included: true },
        { text: "Coordinated goals", included: true },
      ],
    },
    {
      id: "caregiver",
      name: "Premium Caregiver",
      desc: "Caregivers supporting dependents",
      cta: "Join the waitlist",
      available: false,
      icon: Shield,
      monthly: 399,
      annual: { total: 3499, perMonth: 291 },
      group: "household",
      features: [
        { text: "All Individual features", included: true },
        { text: "Log for 1 dependent", included: true },
        { text: "Medication reminders", included: true },
        { text: "Health report tracking", included: true },
        { text: "Support routing", included: true },
      ],
    },
    {
      id: "family",
      name: "Premium Family",
      desc: "Families of 3-6 people",
      cta: "Join the waitlist",
      available: false,
      icon: Users,
      monthly: 699,
      annual: { total: 5999, perMonth: 500 },
      group: "household",
      features: [
        { text: "All Premium features", included: true },
        { text: "Up to 5 family members", included: true },
        { text: "Separate profiles", included: true },
        { text: "Family dashboard", included: true },
        { text: "Shared pantry", included: true },
        { text: "Family reports", included: true },
        { text: "Parental controls", included: true },
      ],
    },
  ];
}

export const TOP_UPS = [
  { name: "Starter Pack", price: 99, actions: 100, validity: "90 days" },
  { name: "Power Pack", price: 249, actions: 300, validity: "90 days" },
  { name: "Pro Pack", price: 499, actions: 750, validity: "90 days" },
];

export function pricingFaq(c: CreditFacts): FaqItem[] {
  return [
    {
      q: "What are AI actions?",
      a: "Food scans, AI meal logging by text or voice, AI chat messages, recipe generation, rebalance plans and report insights. Manual logging is always free.",
    },
    {
      q: "What stays free forever?",
      a: `Manual tracking, the dashboard, goal setting and calorie targets. Every new account also gets ${c.signupCredits} AI credits, and features that don't use AI never cost credits.`,
    },
    {
      q: "Can I upgrade later?",
      a: "Yes. Premium plans are launching soon — join the waitlist on any plan and we'll email you when it opens. Nothing is charged today.",
    },
    {
      q: "Do unused AI credits roll over?",
      a: "Your sign-up credits don't expire. Premium plans will include unlimited monthly AI, and top-up packs will be valid for 90 days.",
    },
    {
      q: "Is wearable sync included?",
      a: "Health data import and sync are free on every account today: import your Apple Health export or a CSV, or let an automation app send steps, sleep, heart rate and weight from Apple Health or Health Connect to ÖRZA. Direct wearable sync is part of the upcoming Premium plans.",
    },
    {
      q: "Can I switch between plans?",
      a: "Once Premium launches, you'll be able to upgrade or downgrade anytime, and any price difference will be prorated.",
    },
  ];
}

/** "₹2,499" — Indian digit grouping. */
export function inr(n: number) {
  return `₹${new Intl.NumberFormat("en-IN").format(n)}`;
}

/** Whole-percent saving of annual billing vs. 12 × monthly. */
export function annualSaving(plan: Plan) {
  if (!plan.annual || plan.monthly <= 0) return 0;
  return Math.round((1 - plan.annual.total / (plan.monthly * 12)) * 100);
}

export function maxAnnualSaving(plans: Plan[]) {
  return Math.max(0, ...plans.map(annualSaving));
}
