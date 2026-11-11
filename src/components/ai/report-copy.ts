/**
 * Every string of the website's "Report" action on AI output (Ask ÖRZA replies, AI recipes) and the reason labels the
 * admin console's AI reports page shows. The phone app shows the same (docs/notes/ai-report.md §5 in the mobile repo);
 * the user reviews them. Pure data — bundled into the browser.
 */
import type { AiReportKind, AiReportReason } from "@/lib/ai-report-shared";

/** In the order the form lists them. */
export const REPORT_REASONS: { value: AiReportReason; label: string }[] = [
  { value: "offensive", label: "Offensive or hurtful" },
  { value: "unsafe", label: "Unsafe advice" },
  { value: "wrong", label: "Wrong or misleading" },
  { value: "other", label: "Something else" },
];

export const REASON_LABEL = Object.fromEntries(REPORT_REASONS.map((r) => [r.value, r.label])) as Record<AiReportReason, string>;

/** What the member reports, as the form names it ("this reply"). */
const THING: Record<AiReportKind, string> = {
  chat: "reply",
  recipe: "recipe",
  rebalance: "plan",
  scan: "result",
  meal: "result",
};

/** The kinds as the admin console lists them. */
export const KIND_LABEL: Record<AiReportKind, string> = {
  chat: "Ask ÖRZA reply",
  recipe: "Recipe",
  rebalance: "Rebalance plan",
  scan: "Snap & Know result",
  meal: "Meal log",
};

/** Offline and server errors show the api client's and the server's own text. */
export const REPORT_COPY = {
  trigger: "Report",
  reported: "Reported",
  /** The trigger's screen-reader name once this visit sent a report. */
  reportedLabel: "Reported. Change your report",
  lead: "Tell the ÖRZA team what’s wrong. We use reports to make ÖRZA’s AI safer.",
  question: "What’s wrong?",
  noteLabel: "Anything to add? (optional)",
  send: "Send report",
  cancel: "Cancel",
  sentTitle: "Report sent",
  sentBody: "Thanks. The ÖRZA team will review it.",
} as const;

/** "Report this reply" — the form's title and the trigger's screen-reader name. */
export const reportTitle = (kind: AiReportKind) => `Report this ${THING[kind]}`;

/** Under the note: what the team will see. */
export const reportHint = (kind: AiReportKind) => `The team sees this ${THING[kind]} with your report.`;
