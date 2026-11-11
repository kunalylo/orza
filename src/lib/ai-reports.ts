/**
 * In-app reports of ÖRZA's AI output (Google Play's AI-Generated Content policy: members can flag offensive AI output
 * without leaving the app, and the reports feed moderation). Members send them with POST /api/ai/reports; the team reads
 * them on the admin console's AI reports page. Contract: docs/notes/ai-report.md in the mobile repo.
 *
 * - Only the member's own item can be reported (`loadReported`, else 404). A report sends nothing to the AI, so it needs
 *   no AI consent.
 * - One report per member per item: reporting again replaces the reason, note and snapshot and sends it back to review.
 * - The report keeps a plain-text snapshot of what the member was shown (`text`), never their message, profile or other
 *   data; the member's email is read from `users` when an admin lists reports.
 */
import { col, isDuplicateKey, newId, nowISO } from "@/lib/db";
import type { StoredCompensationPlan } from "@/lib/compensation";
import type { StoredRecipe } from "@/lib/recipes-library";
import type { AiReport, ChatMessage, Meal, MealItem, Scan, User } from "@/lib/types";
import { formatNumber, round } from "@/lib/utils";
import type { AiReportKind, AiReportReason } from "@/lib/ai-report-shared";

export const aiReports = () => col<AiReport>("ai_reports");

/** Reports (new or changed) a member may send in a minute, per server instance (`reserve` in src/lib/rate-limit.ts). */
export const AI_REPORTS_PER_MINUTE = 10;
/** Different items a member may report in a rolling 24 hours (counted in the database). */
export const AI_REPORTED_ITEMS_PER_DAY = 30;

/** The snapshot's cap: a long recipe is about 10,000 characters. */
const TEXT_MAX = 12_000;

/** Meals whose items or note ÖRZA wrote: typed and spoken meals and saved Snap results (chat meals are reported through their reply). */
const REPORTABLE_MEAL_SOURCES = ["text", "voice", "photo"] as const;

/** What a report keeps of the reported item. */
export type ReportedItem = { text: string; ai: boolean; made_at: string };

const kcal = (n: number) => `${formatNumber(n)} kcal`;
const itemLine = (i: MealItem) => `- ${i.name}: ${round(i.quantity, 2)} ${i.unit} · ${kcal(i.calories)}`;
/** Joins lines, leaving out null / undefined ones ("" is a blank line). */
const lines = (parts: (string | null | undefined)[]) => parts.filter((p) => typeof p === "string").join("\n");
const signed = (n: number) => (n > 0 ? `+${formatNumber(n)}` : n < 0 ? `−${formatNumber(-n)}` : "0");

function foodText(items: MealItem[], total: number, notes?: string) {
  return lines([...items.map(itemLine), `Total: ${kcal(total)}`, ...(notes ? ["", notes] : [])]);
}

function recipeText(r: StoredRecipe) {
  return lines([
    r.title,
    r.description || null,
    "",
    "Ingredients",
    ...r.ingredients.map((i) => `- ${i}`),
    "",
    "Method",
    ...r.steps.map((s, i) => `${i + 1}. ${s}`),
  ]);
}

function planText(p: StoredCompensationPlan) {
  return lines([
    p.message,
    ...p.days.flatMap((d, i) => [
      "",
      `Day ${i + 1} · ${d.date} · ${kcal(d.calorie_target)} (${signed(d.adjustment)})`,
      d.focus ? `Focus: ${d.focus}` : null,
      d.activity ? `Activity: ${d.activity}` : null,
      d.meals?.length ? `Meals: ${d.meals.join("; ")}` : null,
    ]),
  ]);
}

/**
 * The member's own reportable item as plain text, or null when it doesn't exist, isn't theirs or isn't something ÖRZA
 * wrote (a member's own chat message, a manual or chat meal) — the route answers 404 for all of them alike.
 */
export async function loadReported(userId: string, kind: AiReportKind, refId: string): Promise<ReportedItem | null> {
  const own = { id: refId, user_id: userId };
  let item: ReportedItem | null = null;
  switch (kind) {
    case "chat": {
      const m = await col<ChatMessage>("chat_messages").findOne({ ...own, role: "assistant" });
      if (m) item = { text: m.content, ai: m.meta?.ai === true, made_at: m.created_at };
      break;
    }
    case "recipe": {
      const r = await col<StoredRecipe>("recipes").findOne(own);
      if (r) item = { text: recipeText(r), ai: r.source === "ai", made_at: r.created_at };
      break;
    }
    case "rebalance": {
      const p = await col<StoredCompensationPlan>("compensation_plans").findOne(own);
      if (p) item = { text: planText(p), ai: p.ai === true, made_at: p.created_at };
      break;
    }
    case "scan": {
      const s = await col<Scan>("scans").findOne(own);
      if (s) item = { text: lines([s.dish_name || null, foodText(s.items, s.totals.calories, s.notes)]), ai: true, made_at: s.created_at };
      break;
    }
    case "meal": {
      const m = await col<Meal>("meals").findOne({ ...own, source: { $in: [...REPORTABLE_MEAL_SOURCES] } });
      if (m) item = { text: foodText(m.items, m.totals.calories, m.notes), ai: !!m.notes || m.source === "photo", made_at: m.created_at };
      break;
    }
  }
  if (!item) return null;
  return { ...item, text: (item.text.trim() || "(no text)").slice(0, TEXT_MAX) };
}

/**
 * Records the member's report of an item, or replaces their earlier one (reason, note, snapshot), which goes back to
 * review. `created` tells a first report from a replacement.
 */
export async function saveReport(input: {
  userId: string;
  kind: AiReportKind;
  refId: string;
  reason: AiReportReason;
  note: string | null;
  client: AiReport["client"];
  item: ReportedItem;
}): Promise<{ report: AiReport; created: boolean }> {
  const now = nowISO();
  const id = newId();
  const filter = { user_id: input.userId, kind: input.kind, ref_id: input.refId };
  const update = {
    $set: {
      reason: input.reason,
      note: input.note,
      text: input.item.text,
      ai: input.item.ai,
      made_at: input.item.made_at,
      client: input.client,
      reviewed: false,
      updated_at: now,
    },
    $unset: { reviewed_at: "", reviewed_by: "" },
    $setOnInsert: { id, created_at: now },
  };
  try {
    const report = (await aiReports().findOneAndUpdate(filter, update, { upsert: true })) as AiReport;
    return { report, created: report.id === id };
  } catch (e) {
    // Two first reports of the same item at once: the other one inserted it (unique index), so this one updates it.
    if (!isDuplicateKey(e)) throw e;
    const report = (await aiReports().findOneAndUpdate(filter, update)) as AiReport;
    return { report, created: false };
  }
}

/** What the member is answered: no snapshot, review state or staff ids. */
export function toOwnView(r: AiReport) {
  return {
    id: r.id,
    kind: r.kind,
    ref_id: r.ref_id,
    reason: r.reason,
    note: r.note ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/** The member's data export: their report and the snapshot it keeps. */
export function toExportView(r: AiReport) {
  return { ...toOwnView(r), text: r.text };
}

/** A row of the admin list, with the member read from `users` (an explicit allow-list, never the stored user). */
export function toAdminRow(r: AiReport, member: User | null | undefined) {
  return {
    ...toOwnView(r),
    text: r.text,
    ai: !!r.ai,
    client: r.client,
    made_at: r.made_at,
    reviewed: !!r.reviewed,
    reviewed_at: r.reviewed_at ?? null,
    member: member ? { id: member.id, name: member.name, email: member.email } : null,
  };
}
