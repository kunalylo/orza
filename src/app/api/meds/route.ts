import { requireUser } from "@/lib/auth";
import { col, newId, nowISO } from "@/lib/db";
import { badRequest, BODY_LIMIT_UPLOAD, json, parseBody, route } from "@/lib/http";
import { deleteMedia, saveImage } from "@/lib/media";
import type { Medication } from "@/lib/types";
import { blankToUndef, buildSchedule, compact, MAX_MEDICATIONS, medicationCreateSchema, medicationsToClient, sortMedications, stockFrom } from "./_shared";

/** GET /api/meds → { medications } (active first, then A–Z). Each carries `photo_urls`. */
export const GET = route(async () => {
  const user = await requireUser();
  const list = await col<Medication>("medications").find({ user_id: user.id }, { sort: { created_at: 1 }, limit: 500 });
  return json({ medications: await medicationsToClient(user.id, sortMedications(list)) });
});

/** POST /api/meds → { medication }. Up to 4 photos (data URLs) are stored as media kind "medicine". */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, medicationCreateSchema, { maxBytes: BODY_LIMIT_UPLOAD });

  const meds = col<Medication>("medications");
  if ((await meds.countDocuments({ user_id: user.id })) >= MAX_MEDICATIONS) {
    throw badRequest(`You can keep up to ${MAX_MEDICATIONS} medicines. Delete ones you no longer take to add more.`);
  }
  const schedule = buildSchedule(body.schedule, body.as_needed);

  const photo_ids: string[] = [];
  try {
    for (const p of body.photos || []) photo_ids.push(await saveImage(user.id, p, "medicine"));
  } catch (e) {
    await deleteMedia(user.id, photo_ids).catch(() => {});
    throw e;
  }

  const now = nowISO();
  const med: Medication = compact({
    id: newId(),
    user_id: user.id,
    name: body.name,
    strength: blankToUndef(body.strength),
    form: body.form,
    dose: body.dose,
    timing: body.timing,
    instructions: blankToUndef(body.instructions),
    photo_ids,
    schedule,
    as_needed: body.as_needed,
    active: true,
    stock: stockFrom(body.stock),
    for_person: blankToUndef(body.for_person),
    created_at: now,
    updated_at: now,
  });
  try {
    await meds.insertOne(med);
  } catch (e) {
    await deleteMedia(user.id, photo_ids).catch(() => {});
    throw e;
  }
  return json({ medication: (await medicationsToClient(user.id, [med]))[0] }, 201);
});
