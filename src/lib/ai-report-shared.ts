/**
 * What a member can report about ÖRZA's AI output (Google Play's AI-Generated Content policy: report it inside the app),
 * shared by the server (src/lib/ai-reports.ts, POST /api/ai/reports) and the website (src/components/ai). No server-only
 * imports here — this file is bundled into the browser too. Contract: docs/notes/ai-report.md in the mobile repo.
 */

/**
 * The reportable outputs, each a stored document with a stable id: an Ask ÖRZA reply (`chat_messages`, assistant), a
 * recipe (`recipes`), a rebalance plan (`compensation_plans`), a Snap & Know result (`scans`) and a typed, spoken or
 * photo meal log (`meals`). Prescription reads are left out: they copy the member's own prescription into fields the
 * member checks before anything is used, and a snapshot would copy their medicines and diagnosis to the team.
 */
export const AI_REPORT_KINDS = ["chat", "recipe", "rebalance", "scan", "meal"] as const;
export type AiReportKind = (typeof AI_REPORT_KINDS)[number];

export const AI_REPORT_REASONS = ["offensive", "unsafe", "wrong", "other"] as const;
export type AiReportReason = (typeof AI_REPORT_REASONS)[number];

/** The member's optional note, in characters after trimming. */
export const AI_REPORT_NOTE_MAX = 500;
