import { z } from "zod";
import { requireUser, toPublicUser } from "@/lib/auth";
import { col, newId, nowISO } from "@/lib/db";
import { dateInTz } from "@/lib/dates";
import { setTracking } from "@/lib/domain/tracking";
import { badRequest, json, parseBody, route } from "@/lib/http";
import type { Goal, Profile, User } from "@/lib/types";
import { round } from "@/lib/utils";
import { goalInputError, planGoal, signedRate } from "@/components/goals/goal-math";

export const dynamic = "force-dynamic";

/** Optional numeric field: null / "" are treated as "not provided". */
const optional = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((v) => (v === null || v === "" ? undefined : v), schema.optional());

const Body = z.object({
  goal: z.enum(["lose", "maintain", "gain"]),
  current_weight_kg: z.coerce.number().min(25, "Weight must be at least 25 kg").max(350, "Weight must be at most 350 kg"),
  // Required for lose/gain; a maintain goal holds the current weight.
  target_weight_kg: optional(z.coerce.number().min(25, "Target must be at least 25 kg").max(350, "Target must be at most 350 kg")),
  weekly_rate_kg: optional(z.coerce.number().min(-1, "Weight loss is capped at 1 kg a week").max(0.5, "Weight gain is capped at 0.5 kg a week")),
  height_cm: optional(z.coerce.number().min(100, "Height must be at least 100 cm").max(250, "Height must be at most 250 cm")),
  age: optional(z.coerce.number().int("Age must be a whole number").min(13, "ÖRZA goal planning is for ages 13 and up").max(100, "Age must be 100 or below")),
  sex: optional(z.enum(["male", "female", "other"])),
  activity_level: optional(z.enum(["sedentary", "light", "moderate", "active", "very_active"])),
});

/**
 * Set a new weight goal: validates direction + safe pace, recomputes daily targets,
 * deactivates earlier goals, stores the Goal and updates the user's profile/targets.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, Body);
  const today = dateInTz(user.profile?.timezone);

  const current = round(body.current_weight_kg, 1);
  if (body.goal !== "maintain" && body.target_weight_kg == null) throw badRequest("Enter your target weight.");
  const target = body.goal === "maintain" ? current : round(body.target_weight_kg as number, 1);
  const rate = signedRate(body.goal, body.weekly_rate_kg);

  const profile: Profile = {
    ...(user.profile || {}),
    ...(body.height_cm != null ? { height_cm: round(body.height_cm, 1) } : {}),
    ...(body.age != null ? { age: body.age } : {}),
    ...(body.sex ? { sex: body.sex } : {}),
    ...(body.activity_level ? { activity_level: body.activity_level } : {}),
    weight_kg: current,
    target_weight_kg: target,
    goal: body.goal,
  };
  if (!profile.height_cm || !profile.age) {
    throw badRequest("Add your height and age so ÖRZA can personalise your plan.");
  }

  const problem = goalInputError({ goal: body.goal, current, target, rate, heightCm: profile.height_cm });
  if (problem) throw badRequest(problem);

  const plan = planGoal({ profile, goal: body.goal, current, target, rate, today });
  if (plan.blocker) throw badRequest(plan.blocker);
  if (plan.bmr == null || plan.tdee == null) throw badRequest("Add your height and age so ÖRZA can personalise your plan.");

  // Only one active goal at a time.
  const goals = col<Goal>("goals");
  const previous = await goals.find({ user_id: user.id, active: true });
  for (const g of previous) {
    await goals.updateOne({ id: g.id, user_id: user.id }, { $set: { active: false } });
  }

  const goal: Goal = {
    id: newId(),
    user_id: user.id,
    active: true,
    goal: body.goal,
    current_weight_kg: current,
    target_weight_kg: target,
    weekly_rate_kg: plan.weeklyRate,
    ...(plan.targetDate ? { target_date: plan.targetDate } : {}),
    bmr: plan.bmr,
    tdee: plan.tdee,
    targets: plan.targets,
    created_at: nowISO(),
  };
  await goals.insertOne(goal);

  const updated = await col<User>("users").findOneAndUpdate(
    { id: user.id },
    { $set: { targets: plan.targets, profile, updated_at: nowISO() } }
  );
  await setTracking(user.id, today, { weight_kg: current });

  const notice = plan.paceAdjusted
    ? `To keep your daily calories at a safe level, ÖRZA set a gentler pace of ${Math.abs(plan.weeklyRate)} kg a week.`
    : undefined;

  return json({ goal, user: toPublicUser(updated || { ...user, targets: plan.targets, profile }), ...(notice ? { notice } : {}) });
});
