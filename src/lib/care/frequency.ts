/**
 * Indian prescription frequency notation → schedule hints.
 *
 * Understands dose grids ("1-0-1", "½-0-½", "1-0-0-1", "5ml-0-5ml"), Latin codes (OD, BD, TDS, QID, HS,
 * SOS, PRN, STAT, AC, PC, Q8H), plain English ("twice a day", "every 8 hours", "morning and night",
 * "after food", "at bedtime"), Hinglish ("din mein do baar", "khane ke baad", "khali pet", "raat ko"),
 * durations ("x 5 days", "x5d", "5/7", "for 1 week", "x 1 month", "continue") and repeat rules
 * ("alternate days", "once a week", "Mon, Wed, Fri").
 *
 * Pure and dependency-light (only the shared schedule engine) so it also runs in the browser —
 * the prescription review table re-parses as the user types.
 */
import { DEFAULT_SLOT_TIMES, normalizeTimes, timesForPattern } from "@/lib/care/schedule";
import type { DoseTiming } from "@/lib/types";

export interface ParsedFrequency {
  /** Local "HH:MM" times, sorted. Empty when no frequency was found (and for pure SOS / STAT). */
  times: string[];
  /** SOS / PRN / "when required" — no alarms. */
  as_needed: boolean;
  /** Course length in days (1–365). Absent when not written or when the text says "continue". */
  duration_days?: number;
  /** Food / sleep relation when written (AC, PC, "khane ke baad", "empty stomach", HS …). */
  timing?: DoseTiming;
  /** Canonical notation that was recognised, e.g. "1-0-1", "BD", "Q8H", "SOS". */
  pattern?: string;
  /** Repeat every N days (2 = alternate days, 7 = weekly). */
  every_n_days?: number;
  /** Specific weekdays (0 = Sunday … 6 = Saturday), e.g. "twice a week" → Mon + Thu. */
  days?: number[];
  /** "continue" / "long term" — explicitly no end date. */
  ongoing?: boolean;
  /** "STAT" — one immediate dose. */
  stat?: boolean;
  /** True when a dosing frequency (not only timing or duration) was recognised. */
  recognized: boolean;
}

const MAX_TIMES = 12;
const S = DEFAULT_SLOT_TIMES;

const NUM_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, ek: 1, single: 1,
  two: 2, do: 2, "2nd": 2,
  three: 3, teen: 3, tin: 3,
  four: 4, char: 4, chaar: 4,
  five: 5, paanch: 5, panch: 5,
  six: 6, chhe: 6, seven: 7, saat: 7, eight: 8, aath: 8, nine: 9, nau: 9, ten: 10, das: 10,
  eleven: 11, twelve: 12, fourteen: 14, fifteen: 15, pandrah: 15, twenty: 20, bees: 20, thirty: 30, tees: 30,
};
const NUM = "(\\d{1,3}|a|an|one|ek|two|do|three|teen|four|char|chaar|five|paanch|panch|six|seven|eight|nine|ten|das|eleven|twelve|fourteen|fifteen|pandrah|twenty|bees|thirty|tees)";

function toNum(s: string | undefined): number | undefined {
  if (!s) return undefined;
  if (/^\d+$/.test(s)) return Number(s);
  return NUM_WORDS[s];
}

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (minutes: number) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

/** Lower-case, unify dashes/fractions/"×", and collapse dotted abbreviations ("b.i.d." → "bid", "a.c." → "ac"). */
function prep(input: string): string {
  let s = ` ${String(input || "").toLowerCase()} `;
  s = s.replace(/[‐-―−]/g, "-").replace(/×/g, " x ");
  s = s.replace(/(?<![\d/])1\s*\/\s*2(?![\d/])/g, "½").replace(/(?<![\d/])1\s*\/\s*4(?![\d/])/g, "¼").replace(/(?<![\d/])3\s*\/\s*4(?![\d/])/g, "¾");
  s = s.replace(/\b(?:[a-z]\.\s?){1,3}[a-z]\b\.?/g, (m) => m.replace(/[.\s]/g, ""));
  s = s.replace(/[,;()[\]]/g, " ").replace(/\s+/g, " ");
  return s;
}

/* ───────────────────────────── Timing ───────────────────────────── */

const FOOD = "(?:food|meals?|breakfast|lunch|dinner|eating|khana|khane|khaana|khaane|bhojan|nashta|nashte)";

function detectTiming(s: string): DoseTiming | undefined {
  if (/\b(empty stomach|on an empty stomach|khali pet|khaali pet|khali pait|khaali pait|fasting)\b/.test(s)) return "empty_stomach";
  if (
    new RegExp(`\\bac\\b|\\bb/f\\b|\\bbefore\\s+(?:the\\s+|your\\s+)?${FOOD}|\\b${FOOD}\\s+(?:se|ke|ki|kay)\\s+(?:pehle|pahle|pehele|phele|pehla)\\b|\\bkhane\\s+se\\s+pehle\\b`).test(s)
  )
    return "before_food";
  if (
    new RegExp(`\\bpc\\b|\\ba/f\\b|\\bafter\\s+(?:the\\s+|your\\s+)?${FOOD}|\\b${FOOD}\\s+(?:ke|ki|kay)\\s+(?:baad|bad|baadh)\\b`).test(s)
  )
    return "after_food";
  if (new RegExp(`\\bwith\\s+(?:the\\s+|your\\s+)?${FOOD}|\\b${FOOD}\\s+(?:ke|ki)\\s+(?:saath|sath|saat)\\b`).test(s)) return "with_food";
  if (/\b(hs|bedtime|bed time|before sleep|before sleeping|at sleep|sone se pehle|sone se pahle|sote samay|sone ke samay)\b/.test(s)) return "bedtime";
  return undefined;
}

/* ───────────────────────────── Duration ───────────────────────────── */

function clampDays(n: number | undefined): number | undefined {
  if (n == null || !Number.isFinite(n) || n < 1) return undefined;
  return Math.min(365, Math.round(n));
}

function detectDuration(s: string): number | undefined {
  let m: RegExpMatchArray | null;
  // UK / Indian clinical shorthand: 5/7 = 5 days, 2/52 = 2 weeks, 3/12 = 3 months.
  if ((m = s.match(/(?<![\d/])(\d{1,2})\s*\/\s*(7|52|12)(?![\d/])/))) {
    const n = Number(m[1]);
    return clampDays(m[2] === "7" ? n : m[2] === "52" ? n * 7 : n * 30);
  }
  if (/\bfortnight\b/.test(s)) return 14;
  if ((m = s.match(new RegExp(`\\b${NUM}\\s*(?:-\\s*)?(?:months?|mths?|mnths?|mahine|mahina|mahino)\\b`)))) return clampDays((toNum(m[1]) ?? 0) * 30);
  if ((m = s.match(new RegExp(`\\b${NUM}\\s*(?:-\\s*)?(?:weeks?|wks?|hafte|hafta|hafton)\\b`)))) return clampDays((toNum(m[1]) ?? 0) * 7);
  if ((m = s.match(new RegExp(`\\b${NUM}\\s*(?:-\\s*)?(?:days?|dys?|din|dino|dinon)\\b`)))) return clampDays(toNum(m[1]));
  if ((m = s.match(/(?:\bx|\bfor)\s*(\d{1,3})\s*d\b/))) return clampDays(Number(m[1]));
  if ((m = s.match(/(?<![\d½¼¾.])(\d{1,3})d\b/))) return clampDays(Number(m[1]));
  // "BD x 5" — a bare number after "x" means days on Indian prescriptions.
  if ((m = s.match(/\bx\s*(\d{1,2})(?!\s*(?:times?|mg|mcg|ml|g|tabs?|tablets?|caps?|capsules?|drops?|puffs?|units?|iu|x|\/|\d|\.\d))\b/))) return clampDays(Number(m[1]));
  return undefined;
}

const ONGOING = /\b(continue|cont|contd|to continue|long term|longterm|lifelong|life long|ongoing|regular|regularly|till further advice|until further notice|ufn|daily for life|lagatar|chalu rakhe|chalu rakhein|band na kare)\b/;

/* ───────────────────────────── Repeat rules ───────────────────────────── */

const WEEKDAYS: [RegExp, number][] = [
  [/\b(sun|sunday|sundays|ravivar|itwar)\b/, 0],
  [/\b(mon|monday|mondays|somvar|somwar)\b/, 1],
  [/\b(tue|tues|tuesday|tuesdays|mangalvar|mangalwar)\b/, 2],
  [/\b(wed|wednesday|wednesdays|budhvar|budhwar)\b/, 3],
  [/\b(thu|thur|thurs|thursday|thursdays|guruvar|guruwar)\b/, 4],
  [/\b(fri|friday|fridays|shukravar|shukrawar)\b/, 5],
  [/\b(sat|saturday|saturdays|shanivar|shaniwar)\b/, 6],
];

interface Repeat {
  every_n_days?: number;
  days?: number[];
  rest: string;
}

/** Pulls repeat rules out of the text (so "once a week" isn't later read as a 7-day course). */
function extractRepeat(s: string): Repeat {
  let rest = s;
  let every: number | undefined;
  let days: number[] | undefined;
  const cut = (re: RegExp) => {
    rest = rest.replace(re, " ");
  };
  let m: RegExpMatchArray | null;

  const altRe = /\b(alternate days?|alternate day|alt days?|alt day|every other day|every alternate day|every 2nd day|every second day|on alternate days|eod|qod|qad|a\/d|ek din chhod(?:ke| ke| kar)?|ek din chod(?:ke| ke| kar)?|din chhod ke)\b/;
  if (altRe.test(rest)) {
    every = 2;
    cut(new RegExp(altRe.source, "g"));
  }
  const weeklyRe = /\b(once a week|once weekly|once in a week|once every week|weekly once|every week|weekly|hafte mein ek baar|hafte me ek baar|hafte mein ek bar|hafte me ek bar|haftay mein ek baar|1\s*\/\s*week|per week once|ow|q1w|qw|qwk)\b/;
  const twiceWeekRe = /\b(twice a week|twice weekly|2 times a week|two times a week|2 days a week|hafte mein do baar|hafte me do baar|biweekly)\b/;
  const thriceWeekRe = /\b(thrice a week|thrice weekly|3 times a week|three times a week|3 days a week|hafte mein teen baar|hafte me teen baar)\b/;
  if (thriceWeekRe.test(rest)) {
    days = [1, 3, 5];
    cut(new RegExp(thriceWeekRe.source, "g"));
  } else if (twiceWeekRe.test(rest)) {
    days = [1, 4];
    cut(new RegExp(twiceWeekRe.source, "g"));
  } else if (weeklyRe.test(rest)) {
    every = 7;
    cut(new RegExp(weeklyRe.source, "g"));
  }
  if (/\b(once a month|once monthly|monthly once|every month|monthly|mahine mein ek baar|mahine me ek baar)\b/.test(rest)) {
    every = 30;
    cut(/\b(once a month|once monthly|monthly once|every month|monthly|mahine mein ek baar|mahine me ek baar)\b/g);
  }
  if ((m = rest.match(/\b(?:every|once in|once every|har)\s+(\d{1,2})\s*(?:days?|din)\b/))) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 90) every = n;
    cut(/\b(?:every|once in|once every|har)\s+\d{1,2}\s*(?:days?|din)\b/g);
  }
  if ((m = rest.match(/\b(?:every|q)\s*(48|72)\s*(?:hours?|hrs?|h)\b/))) {
    every = Number(m[1]) / 24;
    cut(/\b(?:every|q)\s*(?:48|72)\s*(?:hours?|hrs?|h)\b/g);
  }
  if (!days) {
    const found = WEEKDAYS.filter(([re]) => re.test(rest)).map(([, d]) => d);
    // A single stray "sat"/"sun" is too ambiguous unless phrased as a rule ("every Sunday", "on Mondays").
    if (found.length >= 2 || (found.length === 1 && /\b(every|on|each|har)\s+(sun|mon|tue|wed|thu|fri|sat|ravi|som|mangal|budh|guru|shukra|shani)/.test(rest))) {
      days = [...new Set(found)].sort((a, b) => a - b);
      for (const [re] of WEEKDAYS) cut(new RegExp(re.source, "g"));
    }
  }
  return { every_n_days: every, days, rest };
}

/* ───────────────────────────── Times ───────────────────────────── */

type Slot = keyof typeof DEFAULT_SLOT_TIMES;

function detectSlots(s: string): Slot[] {
  const out: Slot[] = [];
  if (/\b(morning|mornings|subah|subha|savere|sawere|breakfast|nashta|nashte)\b/.test(s)) out.push("morning");
  if (/\b(afternoon|noon|midday|mid-day|dopahar|dopehar|dophar|lunch)\b/.test(s)) out.push("afternoon");
  if (/\b(evening|evenings|shaam|sham|sandhya)\b/.test(s)) out.push("evening");
  if (/\b(night|nights|nightly|raat|rat ko|dinner)\b/.test(s)) out.push("night");
  if (/\b(hs|bedtime|bed time|before sleep|before sleeping|sone se pehle|sone se pahle|sote samay|sone ke samay)\b/.test(s)) out.push("bedtime");
  return out;
}

/** Explicit clock times: "8 am", "9:30 pm", "20:00", "8.30 am". */
function detectClockTimes(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a m|p m)\b/g)) {
    let h = Number(m[1]);
    const min = Number(m[2] || 0);
    if (h < 1 || h > 12 || min > 59) continue;
    const pm = m[3].replace(/\s/g, "") === "pm";
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
    out.push(hhmm(h * 60 + min));
  }
  for (const m of s.matchAll(/(?<![\d/.-])([01]?\d|2[0-3]):([0-5]\d)(?!\s*(?:am|pm|a m|p m))(?![\d])/g)) {
    out.push(hhmm(Number(m[1]) * 60 + Number(m[2])));
  }
  return normalizeTimes(out);
}

/** Evenly spread `n` doses across waking hours (06:00–22:00). */
function spreadTimes(n: number): string[] {
  if (n <= 1) return [S.morning];
  const step = (16 * 60) / (n - 1);
  return normalizeTimes(Array.from({ length: n }, (_, i) => hhmm(6 * 60 + Math.round((i * step) / 30) * 30)));
}

function timesForCount(n: number, slots: Slot[], timing: DoseTiming | undefined): string[] {
  const uniq = [...new Set(slots)];
  if (uniq.length === n) {
    // "night" + "bedtime" together read as one bedtime dose.
    return normalizeTimes(uniq.map((s) => S[s]));
  }
  if (n === 1) {
    if (uniq.includes("bedtime")) return [S.bedtime];
    if (uniq.length === 1) return [S[uniq[0]]];
    if (timing === "empty_stomach") return ["07:00"];
    if (timing === "bedtime") return [S.bedtime];
    return [S.morning];
  }
  if (n === 2) return timesForPattern("BD") || [S.morning, "20:00"];
  if (n === 3) return timesForPattern("TDS") || [S.morning, S.afternoon, S.night];
  if (n === 4) return timesForPattern("QID") || spreadTimes(4);
  return spreadTimes(Math.min(n, MAX_TIMES));
}

/** Round-the-clock doses every `h` hours, anchored at 06:00 (engine defaults for 6 / 8 / 12). */
function timesForInterval(h: number): string[] | null {
  if (h === 24) return [S.morning];
  if (h === 6 || h === 8 || h === 12) return timesForPattern(`Q${h}H`);
  if (h < 2 || h > 24 || 24 % h !== 0) return null;
  const n = 24 / h;
  if (n > MAX_TIMES) return null;
  return normalizeTimes(Array.from({ length: n }, (_, i) => hhmm(6 * 60 + i * h * 60)));
}

/* ───────────────────────────── Main ───────────────────────────── */

const GRID_TOKEN = "(?:\\d{1,2}(?:\\.\\d)?\\s?ml|[0-4](?:\\.\\d{1,2})?|½|¼|¾|1½)";
const GRID = new RegExp(
  `(?<![\\d./])(${GRID_TOKEN})\\s*-\\s*(${GRID_TOKEN})\\s*-\\s*(${GRID_TOKEN})(?:\\s*-\\s*(${GRID_TOKEN}))?(?![\\d./])`
);

const isOn = (tok: string) => !/^0+(?:\.0+)?(?:\s?ml)?$/.test(tok.trim());

export function parseFrequency(text: string): ParsedFrequency {
  const raw = prep(text);
  const out: ParsedFrequency = { times: [], as_needed: false, recognized: false };
  if (!raw.trim()) return out;

  const timing = detectTiming(raw);
  if (timing) out.timing = timing;

  if (ONGOING.test(raw)) out.ongoing = true;

  const rep = extractRepeat(raw);
  let s = rep.rest;
  if (rep.every_n_days && rep.every_n_days > 1) out.every_n_days = rep.every_n_days;
  if (rep.days?.length) out.days = rep.days;

  if (!out.ongoing) {
    const d = detectDuration(s);
    if (d) out.duration_days = d;
  }

  if (/\b(sos|prn|as needed|as and when needed|as required|when needed|when required|if needed|if required|if necessary|when necessary|as directed if needed|if pain|in pain|for pain|if fever|in case of|zarurat|zaroorat|jarurat|jaroorat|zarurat pade|zaroorat pade|dard ho to|bukhar ho to)\b/.test(s)) {
    out.as_needed = true;
    out.pattern = "SOS";
    out.recognized = true;
  }
  if (/\bstat\b/.test(s)) {
    out.stat = true;
    if (!out.pattern) out.pattern = "STAT";
    out.recognized = true;
  }

  const slots = detectSlots(s);
  let times: string[] | null = null;
  let pattern: string | undefined;

  // 1. Dose grid: 1-0-1, ½-0-½, 1-0-0-1, 5ml-0-5ml
  const g = s.match(GRID);
  if (g) {
    const toks = [g[1], g[2], g[3], g[4]].filter((t): t is string => t !== undefined);
    const onOff = toks.map((t) => (isOn(t) ? "1" : "0")).join("-");
    const t = timesForPattern(onOff);
    if (t && t.length) {
      times = t;
      pattern = toks.map((x) => x.replace(/\s+/g, "")).join("-");
    } else if (t && !t.length) {
      // "0-0-0" — a grid with no doses; nothing to schedule.
      pattern = toks.join("-");
    }
  }

  // 2. Explicit clock times: "8 am and 8 pm", "at 21:00"
  if (!times) {
    const clock = detectClockTimes(s);
    if (clock.length) {
      times = clock;
      pattern = clock.join(", ");
    }
  }

  // 3. Hourly intervals: q8h, every 8 hours, 8 hourly, har 8 ghante
  if (!times) {
    const m =
      s.match(/\bq\s*(\d{1,2})\s*(?:h|hr|hrs|hours?|hourly)\b/) ||
      s.match(/\bevery\s+(\d{1,2})\s*(?:-\s*)?(?:h|hr|hrs|hours?)\b/) ||
      s.match(/\b(\d{1,2})\s*(?:-\s*)?(?:th\s+)?(?:hourly|hrly|hr?ly)\b/) ||
      s.match(/\bhar\s+(\d{1,2})\s*(?:ghante|ghanta|ghanton|hours?|hrs?)\b/);
    if (m) {
      const h = Number(m[1]);
      const t = timesForInterval(h);
      if (t) {
        times = t;
        pattern = h === 24 ? "OD" : `Q${h}H`;
      }
    }
  }

  // 4. Latin codes and counts
  if (!times) {
    let count: number | undefined;
    let code: string | undefined;
    let m: RegExpMatchArray | null;
    if (/\b(qid|qds|qd s|q i d)\b/.test(s)) (count = 4), (code = "QID");
    else if (/\b(tds|tid|td s)\b/.test(s)) (count = 3), (code = "TDS");
    else if (/\b(bd|bid|b d|bds)\b/.test(s)) (count = 2), (code = "BD");
    else if (/\b(od|qd|qam|qpm|oad|once daily|daily once|once a day|once in a day|once per day)\b/.test(s)) (count = 1), (code = "OD");
    else if (/\b(hs|qhs)\b/.test(s)) (count = 1), (code = "HS");
    else if ((m = s.match(/\b(\d{1,2}|one|two|three|four|five|six|ek|do|teen|char|chaar|paanch)\s*(?:times?|x)\s*(?:a\s+|per\s+|in\s+a\s+|\/\s*)?(?:day|daily|d|din)\b/)))
      count = toNum(m[1]);
    else if ((m = s.match(/\b(?:din\s+(?:mein|me|main)\s+)?(\d{1,2}|ek|do|teen|char|chaar|paanch)\s*(?:baar|bar|dafa|dafaa|times?)\b/))) count = toNum(m[1]);
    else if (/\b(thrice|three times)\b/.test(s)) count = 3;
    else if (/\b(twice|two times)\b/.test(s)) count = 2;
    else if (/\bonce\b/.test(s)) count = 1;
    else if (/^\s*(om|o m)\s*$/.test(s)) (count = 1), (code = "OM");
    else if (/^\s*(on)\s*$/.test(s)) (count = 1), (code = "ON");

    if (code === "OM") times = [S.morning];
    else if (code === "ON") times = [S.night];
    else if (code === "HS") times = [S.bedtime];
    else if (count && count >= 1 && count <= MAX_TIMES) {
      times = timesForCount(count, slots, timing);
      code ||= count === 1 ? "OD" : count === 2 ? "BD" : count === 3 ? "TDS" : count === 4 ? "QID" : `${count}x/day`;
    }
    if (times) pattern = code;
  }

  // 5. Slot words alone: "morning and night", "raat ko", "after breakfast and dinner"
  if (!times && slots.length) {
    const uniq = [...new Set(slots)];
    const set = uniq.includes("bedtime") && uniq.includes("night") ? uniq.filter((x) => x !== "night") : uniq;
    times = normalizeTimes(set.map((x) => S[x]));
    pattern = set.join("+");
  }

  // 6. "daily" / "every day" / "roz" with nothing else → once a day.
  if (!times && (out.every_n_days || out.days?.length || /\b(daily|every day|everyday|each day|per day|a day|roz|rozana|roj|har din|pratidin)\b/.test(s))) {
    times = timesForCount(1, slots, timing);
    pattern = out.every_n_days === 2 ? "Alternate days" : out.every_n_days === 7 ? "Weekly" : "OD";
  }

  if (times && times.length) {
    out.times = normalizeTimes(times).slice(0, MAX_TIMES);
    out.recognized = true;
    if (!out.pattern || out.pattern === "STAT" || (out.pattern === "SOS" && pattern)) out.pattern = pattern || out.pattern;
    if (out.as_needed) out.pattern = `${pattern ? `${pattern} ` : ""}SOS`.trim();
  } else if (pattern && !out.pattern) {
    out.pattern = pattern;
  }
  if (!out.timing && out.pattern === "HS") out.timing = "bedtime";
  return out;
}

/** Human summary of the parsed frequency, e.g. "2× a day · 5 days · after food". Useful for hints in forms. */
export function describeFrequency(p: ParsedFrequency): string {
  const parts: string[] = [];
  if (p.as_needed) parts.push("As needed (SOS)");
  else if (p.stat) parts.push("One dose now (STAT)");
  if (!p.as_needed && p.times.length) parts.push(p.times.length === 1 ? "Once a day" : `${p.times.length}× a day`);
  if (p.every_n_days === 2) parts.push("alternate days");
  else if (p.every_n_days === 7) parts.push("once a week");
  else if (p.every_n_days && p.every_n_days > 1) parts.push(`every ${p.every_n_days} days`);
  if (p.days?.length) parts.push(p.days.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", "));
  if (p.duration_days) parts.push(`${p.duration_days} day${p.duration_days === 1 ? "" : "s"}`);
  if (p.ongoing) parts.push("ongoing");
  const timing: Partial<Record<DoseTiming, string>> = {
    before_food: "before food",
    after_food: "after food",
    with_food: "with food",
    empty_stomach: "empty stomach",
    bedtime: "at bedtime",
  };
  if (p.timing && timing[p.timing]) parts.push(timing[p.timing]!);
  return parts.join(" · ");
}
