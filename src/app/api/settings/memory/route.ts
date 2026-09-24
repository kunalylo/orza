import { z } from "zod";
import { requireUser, toPublicUser } from "@/lib/auth";
import { col, nowISO } from "@/lib/db";
import { json, parseBody, route } from "@/lib/http";
import type { User } from "@/lib/types";
import { MEMORY_MAX_ITEMS, MEMORY_MAX_LENGTH } from "@/components/account/options";

export const dynamic = "force-dynamic";

const Body = z.object({
  memory: z
    .array(
      z
        .string({ invalid_type_error: "Each memory must be text" })
        .transform((s) => s.replace(/\s+/g, " ").trim())
        .pipe(
          z
            .string()
            .min(1, "Memories can't be empty")
            .max(MEMORY_MAX_LENGTH, `Keep each memory under ${MEMORY_MAX_LENGTH} characters`)
        ),
      { required_error: "memory is required", invalid_type_error: "memory must be a list" }
    )
    .max(MEMORY_MAX_ITEMS, `ÖRZA can remember up to ${MEMORY_MAX_ITEMS} things`),
});

/** PUT /api/settings/memory {memory: string[]} → {user}. Replaces the whole list (deduped, order kept). */
export const PUT = route(async (req: Request) => {
  const user = await requireUser();
  const { memory } = await parseBody(req, Body);

  const seen = new Set<string>();
  const clean = memory.filter((m) => {
    const k = m.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const updated = await col<User>("users").findOneAndUpdate({ id: user.id }, { $set: { memory: clean, updated_at: nowISO() } });
  return json({ user: toPublicUser(updated ?? { ...user, memory: clean }) });
});
