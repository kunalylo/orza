import type { Goal, Profile, PublicUser, Targets } from "@/lib/types";
import type { StoredCompensationPlan } from "@/lib/compensation";

export type WeightPoint = { date: string; weight_kg: number };

/** GET /api/goals/active */
export type GoalsActiveResponse = {
  goal: Goal | null;
  weights: WeightPoint[];
  targets: Targets;
  profile: Profile;
  today?: string;
};

/** POST /api/goals/calculate */
export type GoalCalculateResponse = { goal: Goal; user: PublicUser; notice?: string };

export type RebalancePlan = StoredCompensationPlan;

/** GET /api/compensation */
export type RebalanceListResponse = { plans: RebalancePlan[]; ai_enabled?: boolean; cost?: number };

/** POST /api/compensation/plan */
export type RebalanceCreateResponse = {
  plan: RebalancePlan;
  credits?: number;
  estimate?: { calories: number; matched: string[]; source: "parsed" | "default" };
  notice?: string;
};
