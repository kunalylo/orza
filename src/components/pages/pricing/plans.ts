import { Heart, Shield, Sparkles, User, Users, type LucideIcon } from "lucide-react";
import type { FaqItem } from "@/components/pages/FaqAccordion";

/** Pricing content (source of truth: the ÖRZA wellness app's PricingPage). Prices in INR. */

export type PlanFeature = { text: string; included: boolean };

export type Plan = {
  id: "free" | "individual" | "couple" | "caregiver" | "family";
  name: string;
  desc: string;
  cta: string;
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

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free Forever",
    desc: "Perfect for trying ÖRZA and basic tracking",
    cta: "Start Free",
    icon: Sparkles,
    monthly: 0,
    periodLabel: "Always free",
    group: "core",
    features: [
      { text: "Manual meal, step, water, weight logging", included: true },
      { text: "Basic dashboard & charts", included: true },
      { text: "Goal setting & calorie targets", included: true },
      { text: "50 AI actions/month", included: true },
      { text: "7-day history", included: true },
      { text: "Individual mode only", included: true },
      { text: "Camera food scanning", included: false },
      { text: "Voice logging", included: false },
      { text: "Wearable sync", included: false },
      { text: "Household modes", included: false },
    ],
  },
  {
    id: "individual",
    name: "Premium Individual",
    desc: "Solo users serious about health",
    cta: "Start 7-Day Trial",
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
    cta: "Start 7-Day Trial",
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
    cta: "Start 7-Day Trial",
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
    cta: "Start 7-Day Trial",
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

export const TOP_UPS = [
  { name: "Starter Pack", price: 99, actions: 100, validity: "90 days" },
  { name: "Power Pack", price: 249, actions: 300, validity: "90 days" },
  { name: "Pro Pack", price: 499, actions: 750, validity: "90 days" },
];

export const PRICING_FAQ: FaqItem[] = [
  {
    q: "What are AI actions?",
    a: "Food scans, AI chat messages, recipe generation, and report analysis. Manual logging is always free.",
  },
  {
    q: "What stays free forever?",
    a: "Manual tracking, basic dashboard, goal setting, and limited AI (50 actions/month).",
  },
  {
    q: "Can I upgrade later?",
    a: "Yes, anytime. Billing is prorated for upgrades.",
  },
  {
    q: "Do unused AI credits roll over?",
    a: "Premium plans have unlimited monthly AI. Top-ups are valid for 90 days.",
  },
  {
    q: "Is wearable sync included?",
    a: "Yes, in all Premium plans (Apple Health & Google Fit).",
  },
  {
    q: "Can I switch between plans?",
    a: "Yes, upgrade or downgrade anytime in Settings. Price difference is prorated.",
  },
];

/** "₹2,499" — Indian digit grouping. */
export function inr(n: number) {
  return `₹${new Intl.NumberFormat("en-IN").format(n)}`;
}

/** Whole-percent saving of annual billing vs. 12 × monthly. */
export function annualSaving(plan: Plan) {
  if (!plan.annual || plan.monthly <= 0) return 0;
  return Math.round((1 - plan.annual.total / (plan.monthly * 12)) * 100);
}

export const MAX_ANNUAL_SAVING = Math.max(...PLANS.map(annualSaving));
