/**
 * "Help improve ÖRZA's AI" (`preferences.ai_training_opt_out`): opt-in since 13 November 2026, off until the member turns
 * it on. Shared by the server (`toPublicUser`, the preferences route) and the website; no server-only imports here.
 *
 * On only when the stored value is `false`. Only the member's own switch writes it (PUT /api/settings/preferences, on the
 * website or in the phone app; both send `false` only when turning the switch on from off), so a stored `false` is always
 * the member's explicit choice, before this change too, and is kept. Absent (every account that never chose: the old
 * on-by-default was never stored) or `true` is off. New accounts store `true`. Each choice also stores
 * `ai_training_chosen_at` (when it was made). SPEC "AI improvement".
 */
import type { Preferences } from "@/lib/types";

/** Whether the member turned "Help improve ÖRZA's AI" on. Anything that ever uses data to improve the AI must check this. */
export function aiImprovementAllowed(prefs: Pick<Preferences, "ai_training_opt_out"> | null | undefined): boolean {
  return prefs?.ai_training_opt_out === false;
}

/** Preferences as clients get them: `ai_training_opt_out` always a boolean, `true` unless the member turned it on. */
export function publicPreferences(prefs: Preferences | null | undefined): Preferences {
  return { ...(prefs as Preferences), ai_training_opt_out: !aiImprovementAllowed(prefs) };
}
