import { z } from "zod";
import { requireUser, toPublicUser } from "@/lib/auth";
import { col, nowISO } from "@/lib/db";
import { json, parseBody, route } from "@/lib/http";
import type { User } from "@/lib/types";
import { TONES, UNITS } from "@/components/account/options";

export const dynamic = "force-dynamic";

const Body = z
  .object({
    units: z.enum(UNITS, { errorMap: () => ({ message: "Units must be metric or imperial" }) }),
    reminders: z.boolean({ invalid_type_error: "Reminders must be on or off" }),
    weekly_report: z.boolean({ invalid_type_error: "Weekly report must be on or off" }),
    tone: z.enum(TONES, { errorMap: () => ({ message: "Coach tone must be gentle or direct" }) }),
    /**
     * "Help improve ÖRZA's AI": false = on, true = off (the default; src/lib/ai-improvement.ts). Only send it when the
     * member flips the switch: it records their choice and its time (`ai_training_chosen_at`).
     */
    ai_training_opt_out: z.boolean({ invalid_type_error: "AI improvement choice must be on or off" }),
  })
  .partial()
  .refine((p) => Object.values(p).some((v) => v !== undefined), "Nothing to update");

/** PUT /api/settings/preferences {units?, reminders?, weekly_report?, tone?, ai_training_opt_out?} → {user} */
export const PUT = route(async (req: Request) => {
  const user = await requireUser();
  const prefs = await parseBody(req, Body);

  const now = nowISO();
  const $set: Record<string, unknown> = { updated_at: now };
  for (const [k, v] of Object.entries(prefs)) if (v !== undefined) $set[`preferences.${k}`] = v;
  if (prefs.ai_training_opt_out !== undefined) $set["preferences.ai_training_chosen_at"] = now;

  const updated = await col<User>("users").findOneAndUpdate({ id: user.id }, { $set });
  const chosen = prefs.ai_training_opt_out !== undefined ? { ai_training_chosen_at: now } : {};
  return json({ user: toPublicUser(updated ?? { ...user, preferences: { ...user.preferences, ...prefs, ...chosen } }) });
});
