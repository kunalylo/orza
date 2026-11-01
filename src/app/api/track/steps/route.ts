import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { STEPS_MODES, raiseSteps, reconcileSteps, setStepsManual, type StepsWrite } from "@/lib/domain/tracking";
import { json, parseBody, route } from "@/lib/http";
import { boundedNumber, optionalDay, resolveTrackDate } from "../_shared";

export const dynamic = "force-dynamic";

const Body = z
  .object({
    steps: boundedNumber(0, 100000),
    date: optionalDay,
    /** Omitted (today's website form, older app builds) = `manual`. */
    mode: z.enum(STEPS_MODES, { errorMap: () => ({ message: 'must be "manual", "auto" or "reconcile"' }) }).nullish(),
    /** The day's `steps_edited_at` the caller has already taken into account; null / "" / omitted = none. */
    edit_ref: z.string({ invalid_type_error: "must be a string or null" }).max(64, "is too long").nullish(),
    /** `reconcile` only: the count the day must still hold (the caller's own last automatic save). */
    expect: boundedNumber(0, 100000).nullish(),
  })
  .superRefine((b, ctx) => {
    if (b.mode === "reconcile" && b.expect == null) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expect"], message: "is required for reconcile" });
  });

/**
 * POST /api/track/steps { steps, date?, mode?, edit_ref?, expect? } → { tracking, applied, reason? }
 * - `manual` (default): sets the day's steps and its edit marker (`tracking.steps_edited_at`). Always applied.
 * - `auto`: raises the day to `steps` only when that is higher and the day's edit marker equals `edit_ref`
 *   (null = no edit) → else `reason: "edited"` (the marker differs) or `"not_higher"`.
 * - `reconcile`: sets `steps` only while the day still holds `expect` and its marker equals `edit_ref`
 *   → else `"edited"` or `"changed"`.
 * `tracking` is always the day's row as it is after the call. See SPEC "Today" and the phone's steps sync.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, Body);
  const date = resolveTrackDate(user, body.date);
  const editRef = body.edit_ref || null;
  let out: StepsWrite;
  if (body.mode === "auto") out = await raiseSteps(user.id, date, body.steps, editRef);
  else if (body.mode === "reconcile") out = await reconcileSteps(user.id, date, body.steps, body.expect as number, editRef);
  else out = await setStepsManual(user.id, date, body.steps);
  return json(out);
});
