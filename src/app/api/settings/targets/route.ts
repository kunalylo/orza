import { z } from "zod";
import { requireUser, toPublicUser } from "@/lib/auth";
import { col, nowISO } from "@/lib/db";
import { json, parseBody, route } from "@/lib/http";
import type { Targets, User } from "@/lib/types";
import { TARGET_FIELDS } from "@/components/account/options";

export const dynamic = "force-dynamic";

// One validator per target, with the ranges shared with the Settings form.
const shape = Object.fromEntries(
  TARGET_FIELDS.map((f) => [
    f.key,
    z.coerce
      .number({ invalid_type_error: `${f.label} must be a number` })
      .int(`${f.label} must be a whole number`)
      .min(f.min, `${f.label} must be at least ${f.min.toLocaleString("en-IN")} ${f.unit}`)
      .max(f.max, `${f.label} must be at most ${f.max.toLocaleString("en-IN")} ${f.unit}`),
  ])
) as Record<keyof Targets, z.ZodNumber>;

const Body = z
  .object(shape)
  .partial()
  .refine((t) => Object.values(t).some((v) => v !== undefined), "Nothing to update");

/** PUT /api/settings/targets {calories?, protein_g?, carbs_g?, fat_g?, fiber_g?, water_glasses?, steps?} → {user} */
export const PUT = route(async (req: Request) => {
  const user = await requireUser();
  const targets = await parseBody(req, Body);

  const $set: Record<string, unknown> = { updated_at: nowISO() };
  for (const [k, v] of Object.entries(targets)) if (v !== undefined) $set[`targets.${k}`] = v;

  const updated = await col<User>("users").findOneAndUpdate({ id: user.id }, { $set });
  return json({ user: toPublicUser(updated ?? { ...user, targets: { ...user.targets, ...targets } }) });
});
