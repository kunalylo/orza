import { col, newId, nowISO } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError, json, parseBody, route } from "@/lib/http";
import { DEFAULT_CHANNELS, MAX_REMINDERS } from "@/components/care/reminders/shared";
import type { Reminder } from "@/lib/types";
import { buildSchedule, createInput, toView } from "./_lib";

export const dynamic = "force-dynamic";

/** GET /api/reminders → {reminders} (active first, then by first time of day). */
export const GET = route(async () => {
  const user = await requireUser();
  const list = await col<Reminder>("reminders").find({ user_id: user.id }, { sort: { created_at: 1 } });
  const now = new Date();
  const reminders = list
    .map((r) => toView(r, user, now))
    .sort((a, b) => Number(b.active) - Number(a.active) || (a.schedule.times[0] || "").localeCompare(b.schedule.times[0] || "") || a.title.localeCompare(b.title));
  return json({ reminders });
});

/** POST /api/reminders {kind, title, body?, schedule, channels?, active?} → {reminder} */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const input = await parseBody(req, createInput);
  const reminders = col<Reminder>("reminders");
  if ((await reminders.countDocuments({ user_id: user.id })) >= MAX_REMINDERS) {
    throw new HttpError(409, `You can keep up to ${MAX_REMINDERS} reminders. Delete one you no longer need first.`, "limit");
  }
  const now = nowISO();
  const doc: Reminder = {
    id: newId(),
    user_id: user.id,
    kind: input.kind,
    title: input.title,
    ...(input.body ? { body: input.body } : {}),
    schedule: buildSchedule(input.schedule, user),
    channels: { ...DEFAULT_CHANNELS, ...Object.fromEntries(Object.entries(input.channels || {}).filter(([, v]) => v !== undefined)) },
    active: input.active ?? true,
    created_at: now,
    updated_at: now,
  };
  await reminders.insertOne(doc);
  return json({ reminder: toView(doc, user) }, 201);
});
