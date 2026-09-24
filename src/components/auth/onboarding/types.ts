import type { ChatLine, OnboardingAnswers, PlanSummary, StepId, StepPrompt } from "@/lib/onboarding";
import type { PublicUser } from "@/lib/types";

export interface OnboardingProgress {
  index: number;
  total: number;
  value: number;
}

/** GET /api/onboarding and POST /api/onboarding/restart. */
export interface OnboardingStatePayload {
  step: StepId;
  answers: OnboardingAnswers;
  done: boolean;
  prompt: StepPrompt | null;
  history: ChatLine[];
  progress: OnboardingProgress;
}

/** POST /api/onboarding/step. */
export interface OnboardingStepResult {
  reply: string;
  step: StepId;
  input: StepPrompt["input"];
  options?: StepPrompt["options"];
  done: boolean;
  prompt?: StepPrompt;
  progress?: OnboardingProgress;
  answers?: OnboardingAnswers;
  valid?: boolean;
  error?: string;
  history?: ChatLine[];
  resync?: boolean;
  restarted?: boolean;
  user?: PublicUser;
}

export type Answer = string | number | string[];

/** One rendered line in the conversation. */
export interface ChatItem {
  id: string;
  role: "assistant" | "user";
  content: string;
  /** A friendly validation nudge (answer not accepted). */
  tone?: "hint";
  /** Summary step: render the plan card under the (optional) acknowledgement. */
  summary?: PlanSummary;
  /** Restored from history — appear without animation. */
  instant?: boolean;
}
