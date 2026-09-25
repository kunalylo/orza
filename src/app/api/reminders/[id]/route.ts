import { col, nowISO } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { json, notFound, parseBody, route } from "@/lib/http";
import type { Dispatch, Reminder } from "@/lib/types";
import { buildSchedule, patchInput, toView } from "../_lib";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/reminders/[id] (partial: kind, title, body, schedule, channels, active) → {reminder} */
export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const reminders = col<Reminder>("reminders");
  const existing = await reminders.findOne({ id, user_id: user.id });
  if (!existing) throw notFound("Reminder not found");
  const input = await parseBody(req, patchInput);

  const $set: Record<string, unknown> = { updated_at: nowISO() };
  const $unset: Record<string, 1> = {};
  if (input.kind) $set.kind = input.kind;
  if (input.title !== undefined) $set.title = input.title;
  if (input.body !== undefined) {
    if (input.body) $set.body = input.body;
    else $unset.body = 1;
  }
  if (input.schedule) $set.schedule = buildSchedule(input.schedule, user, existing.schedule);
  if (input.channels) {
    $set.channels = {
      ...existing.channels,
      ...Object.fromEntries(Object.entries(input.channels).filter(([, v]) => v !== undefined)),
    };
  }
  if (input.active !== undefined) $set.active = input.active;

  const updated = await reminders.findOneAndUpdate(
    { id, user_id: user.id },
    Object.keys($unset).length ? { $set, $unset } : { $set }
  );
  if (!updated) throw notFound("Reminder not found");
  return json({ reminder: toView(updated, user) });
});

/** DELETE /api/reminders/[id] → {ok} */
export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const n = await col<Reminder>("reminders").deleteOne({ id, user_id: user.id });
  if (!n) throw notFound("Reminder not found");
  // Its delivery records are no longer useful.
  await col<Dispatch>("dispatches").deleteMany({ user_id: user.id, source: "reminder", source_id: id }).catch(() => 0);
  return json({ ok: true });
});
