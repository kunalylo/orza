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
  })
  .partial()
  .refine((p) => Object.values(p).some((v) => v !== undefined), "Nothing to update");

/** PUT /api/settings/preferences {units?, reminders?, weekly_report?, tone?} → {user} */
export const PUT = route(async (req: Request) => {
  const user = await requireUser();
  const prefs = await parseBody(req, Body);

  const $set: Record<string, unknown> = { updated_at: nowISO() };
  for (const [k, v] of Object.entries(prefs)) if (v !== undefined) $set[`preferences.${k}`] = v;

  const updated = await col<User>("users").findOneAndUpdate({ id: user.id }, { $set });
  return json({ user: toPublicUser(updated ?? { ...user, preferences: { ...user.preferences, ...prefs } }) });
});
