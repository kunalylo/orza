import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { badRequest, json, parseBody, route } from "@/lib/http";
import { isHHMM } from "@/lib/dates";
import { integrationsView, siteOrigin, updateIntegrations } from "@/lib/care/integrations";

export const dynamic = "force-dynamic";

const hhmm = z.string().refine(isHHMM, "Times must look like 22:00 (24-hour)");

/** `{start, end}` sets quiet hours; `null`, `{}` or `{start: null, end: null}` turns them off. */
const body = z
  .object({ start: hhmm.nullable().optional(), end: hhmm.nullable().optional() })
  .nullable();

/** PUT /api/integrations/quiet-hours {start, end} | null → same shape as GET /api/integrations */
export const PUT = route(async (req: Request) => {
  const user = await requireUser();
  const input = await parseBody(req, body);
  const start = input?.start || null;
  const end = input?.end || null;

  if (!start && !end) {
    const updated = await updateIntegrations(user.id, {}, ["quiet_hours"]);
    return json(await integrationsView(updated, siteOrigin(req)));
  }
  if (!start || !end) throw badRequest("Choose both a start and an end time for quiet hours.");
  if (start === end) throw badRequest("Quiet hours need different start and end times.");
  const updated = await updateIntegrations(user.id, { quiet_hours: { start, end } });
  return json(await integrationsView(updated, siteOrigin(req)));
});
