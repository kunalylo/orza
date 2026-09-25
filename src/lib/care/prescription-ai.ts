/**
 * Prescription photo → structured medicines (AI vision), plus the normaliser that turns whatever
 * the model (or the user, in the review table) sends into clean `ExtractedMedicine`s with real
 * "HH:MM" alarm times.
 *
 * Times are resolved in this order: valid times from the AI (when they agree with the written
 * frequency), then `parseFrequency` on the written notation, then `timesForPattern` on the
 * normalised pattern, then a single 08:00 default flagged with low confidence.
 */
import { aiJSON } from "@/lib/ai";
import { parseFrequency, type ParsedFrequency } from "@/lib/care/frequency";
import { normalizeTimes, timesForPattern } from "@/lib/care/schedule";
import type { DoseTiming, ExtractedMedicine, MedForm, Profile } from "@/lib/types";

export const MAX_PRESCRIPTION_MEDICINES = 20;

export const MED_FORMS: readonly MedForm[] = ["tablet", "capsule", "syrup", "drops", "injection", "inhaler", "cream", "powder", "other"];
export const DOSE_TIMINGS: readonly DoseTiming[] = ["before_food", "after_food", "with_food", "empty_stomach", "bedtime", "any"];

export interface PrescriptionScan {
  doctor?: string;
  issued_on?: string;
  patient_name?: string;
  notes?: string;
  medicines: ExtractedMedicine[];
}

/* ───────────────────────────── Small cleaners ───────────────────────────── */

/** Trim, collapse whitespace, cap length; empty → undefined. */
export function clampText(v: unknown, max: number): string | undefined {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max).trim() : undefined;
}

const isRealDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** "2026-09-12", "12/09/2026", "12-9-26", "12.09.2026" (Indian day-first) → "YYYY-MM-DD". */
export function parseIssuedOn(v: unknown): string | undefined {
  const s = clampText(v, 30);
  if (!s) return undefined;
  let out: string | undefined;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const dmy = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/);
  if (iso) out = `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  else if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    out = `${year}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  if (!out || !isRealDate(out)) return undefined;
  const y = Number(out.slice(0, 4));
  return y >= 1990 && y <= 2100 ? out : undefined;
}

/** "8:00" → "08:00"; anything that isn't a 24-hour clock time → null. */
function toHHMM(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

const FORM_ALIASES: [RegExp, MedForm][] = [
  [/^(tab|tabs|tablet|tablets|t)$/, "tablet"],
  [/^(cap|caps|capsule|capsules|softgel|softgels)$/, "capsule"],
  [/^(syp|syr|syrup|susp|suspension|liquid|solution|sol|elixir|oral solution|oral suspension|linctus|tonic)$/, "syrup"],
  [/^(drop|drops|gtt|gtts|eye drops?|ear drops?|nasal drops?|oral drops?)$/, "drops"],
  [/^(inj|injection|vial|amp|ampoule|pen|insulin pen)$/, "injection"],
  [/^(inh|inhaler|puff|puffs|rotacap|rotacaps|mdi|dpi|respules?|nebuliser|nebulizer|neb|nasal spray|spray)$/, "inhaler"],
  [/^(cream|oint|ointment|gel|lotion|topical|paste)$/, "cream"],
  [/^(powder|sachet|sachets|granules|pwd)$/, "powder"],
];

export function toMedForm(v: unknown): MedForm | undefined {
  const s = clampText(v, 30)?.toLowerCase().replace(/\.$/, "");
  if (!s) return undefined;
  if ((MED_FORMS as string[]).includes(s)) return s as MedForm;
  return FORM_ALIASES.find(([re]) => re.test(s))?.[1];
}

const NAME_PREFIX = /^(tab|tabs|tablet|cap|caps|capsule|syp|syr|syrup|susp|inj|oint|gel|drops?|gtt|inh|sachet|cream|lotion|rotacap|respules?)\.?\s+(.+)$/i;

function toTiming(v: unknown): DoseTiming | undefined {
  const s = clampText(v, 30)?.toLowerCase().replace(/[\s-]+/g, "_");
  return s && (DOSE_TIMINGS as string[]).includes(s) ? (s as DoseTiming) : undefined;
}

function toConfidence(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
  const c = n > 1 ? n / 100 : n;
  return Math.round(Math.min(1, Math.max(0, c)) * 100) / 100;
}

function toDays(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 1) return undefined;
  return Math.min(365, Math.round(n));
}

const DEFAULT_DOSE: Partial<Record<MedForm, string>> = {
  tablet: "1 tablet",
  capsule: "1 capsule",
  powder: "1 sachet",
};

/** Dose from a written grid: "½-0-½" → "½ tablet", "5ml-0-5ml" → "5 ml", "1-0-½" → "1 morning, ½ night". */
function doseFromGrid(pattern: string | undefined, form: MedForm): string | undefined {
  if (!pattern) return undefined;
  const toks = pattern.split("-").map((t) => t.trim().toLowerCase());
  if (toks.length < 3 || toks.length > 4) return undefined;
  const slots = toks.length === 4 ? ["morning", "afternoon", "evening", "night"] : ["morning", "afternoon", "night"];
  const on = toks.map((t, i) => ({ t, slot: slots[i] })).filter(({ t }) => !/^0+(?:\.0+)?(?:\s?ml)?$/.test(t));
  if (!on.length) return undefined;
  const ml = on.every(({ t }) => /ml$/.test(t));
  const unit = ml ? "ml" : form === "tablet" ? "tablet" : form === "capsule" ? "capsule" : "";
  const fmt = (t: string) => (ml ? `${t.replace(/\s?ml$/, "")} ml` : t);
  if (on.every(({ t }) => t === on[0].t)) {
    const q = fmt(on[0].t);
    if (ml) return q;
    if (!unit) return undefined;
    const plural = /^[2-9]/.test(q) ? "s" : "";
    return `${q} ${unit}${plural}`;
  }
  const parts = on.map(({ t, slot }) => `${fmt(t)} ${slot}`).join(", ");
  return (unit && !ml ? `${unit[0].toUpperCase()}${unit.slice(1)}: ${parts}` : parts).slice(0, 40);
}

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * AI times are kept only when they match the written frequency slot by slot (within 3 h),
 * e.g. "9 pm" for a night dose. "1-0-0" (morning) with an AI time of 14:00 falls back to 08:00.
 */
function timesAgree(given: string[], written: string[]): boolean {
  if (given.length !== written.length) return false;
  const a = [...given].sort();
  const b = [...written].sort();
  return a.every((t, i) => {
    const d = Math.abs(minutesOf(t) - minutesOf(b[i]));
    return Math.min(d, 1440 - d) <= 180;
  });
}

/** True for dose text that is really a frequency: "0-0-1", "1-0-1", "once a week", "BD", "SOS", "x 5 days". */
function looksLikeFrequency(dose: string): boolean {
  const d = dose.trim().toLowerCase();
  if (/^[\d½¼¾.]+\s*(?:ml)?\s*-\s*[\d½¼¾.]+/.test(d)) return true;
  if (/\b(?:once|twice|thrice|daily|weekly|a week|per week|alternate|every|times a day|x\s*\d+|days?)\b/.test(d)) return true;
  return /^(?:od|qd|bd|bid|tds|tid|qid|qds|hs|sos|prn|stat|ac|pc)$/.test(d);
}

/* ───────────────────────────── Medicine normaliser ───────────────────────────── */

export interface NormaliseOptions {
  /**
   * The row comes from the user's edited review table: keep their times, SOS flag, food timing and
   * course length as they set them (the written frequency is only a fallback when times are missing).
   */
  fromUser?: boolean;
}

/**
 * Clean one medicine from the AI (or from the user's edited review table). Returns null when
 * there is no usable name. Always returns alarm times for non-SOS medicines.
 */
export function normaliseMedicine(raw: unknown, opts: NormaliseOptions = {}): ExtractedMedicine | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  let name = clampText(r.name, 80);
  let form = toMedForm(r.form);
  if (name) {
    const pre = name.match(NAME_PREFIX);
    if (pre && pre[2].trim()) {
      form ||= toMedForm(pre[1]);
      name = pre[2].trim();
    }
  }
  if (!name || !/[a-z0-9ऀ-ॿ]/i.test(name)) return null;
  form ||= "other";

  const frequencyText = clampText(r.frequency_text, 80);
  const pattern = clampText(r.pattern, 30);
  const parsed: ParsedFrequency = parseFrequency([frequencyText, pattern].filter(Boolean).join(" "));

  const asNeeded = r.as_needed === true || (!opts.fromUser && parsed.as_needed);
  let confidence = toConfidence(r.confidence);

  // Times: AI / user → written frequency → pattern → default.
  const given = normalizeTimes((Array.isArray(r.times) ? r.times : []).map(toHHMM).filter((t): t is string => !!t)).slice(0, 12);
  let times: string[];
  if (asNeeded) {
    // SOS medicines never ring — they're taken only when needed.
    times = [];
  } else if (given.length && (opts.fromUser || !parsed.times.length || timesAgree(given, parsed.times))) {
    times = given;
  } else if (parsed.times.length) {
    times = parsed.times;
  } else {
    const fromPattern = pattern ? timesForPattern(pattern) : null;
    if (fromPattern?.length) times = normalizeTimes(fromPattern);
    else {
      times = ["08:00"];
      // Nothing told us when to take it — make the review table flag it.
      confidence = Math.min(confidence ?? 0.4, 0.4);
    }
  }

  const aiTiming = toTiming(r.timing);
  const timing: DoseTiming = opts.fromUser ? aiTiming || "any" : aiTiming && aiTiming !== "any" ? aiTiming : parsed.timing || aiTiming || "any";

  const strengthText = clampText(r.strength, 40);
  // The AI sometimes puts the frequency ("0-0-1", "once a week", "SOS") in the dose field — never show that as a dose.
  const aiDose = clampText(r.dose, 40);
  const liquidAmount = (form === "syrup" || form === "drops") && strengthText && /^\d+(?:\.\d+)?\s?ml$/i.test(strengthText) ? strengthText.replace(/\s?ml$/i, " ml") : undefined;
  const dose =
    (aiDose && !looksLikeFrequency(aiDose) ? aiDose : undefined) ||
    doseFromGrid(parsed.pattern && /^[\d½¼¾.]/.test(parsed.pattern) ? parsed.pattern : pattern, form) ||
    liquidAmount ||
    DEFAULT_DOSE[form] ||
    "As prescribed";

  const duration = opts.fromUser ? toDays(r.duration_days) : (toDays(r.duration_days) ?? (parsed.ongoing ? undefined : parsed.duration_days));

  const med: ExtractedMedicine = {
    name,
    form,
    dose,
    timing,
    times,
    frequency_text: frequencyText || parsed.pattern || pattern || (asNeeded ? "SOS" : times.length === 1 ? "Once a day" : `${times.length} times a day`),
    as_needed: asNeeded,
  };
  if (strengthText) med.strength = strengthText;
  if (duration) med.duration_days = duration;
  const instructions = clampText(r.instructions, 200);
  if (instructions) med.instructions = instructions;
  med.confidence = confidence ?? 0.6;
  return med;
}

export function normaliseMedicines(list: unknown, opts?: NormaliseOptions): ExtractedMedicine[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((m) => normaliseMedicine(m, opts))
    .filter((m): m is ExtractedMedicine => !!m)
    .slice(0, MAX_PRESCRIPTION_MEDICINES);
}

/** Clean the whole AI answer. */
export function normaliseScan(raw: unknown): PrescriptionScan {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: PrescriptionScan = { medicines: normaliseMedicines(r.medicines) };
  const doctor = clampText(r.doctor, 80);
  if (doctor) out.doctor = doctor;
  const issued = parseIssuedOn(r.issued_on);
  if (issued) out.issued_on = issued;
  const patient = clampText(r.patient_name, 60);
  if (patient) out.patient_name = patient;
  const notes = clampText(r.notes, 300);
  if (notes) out.notes = notes;
  return out;
}

/* ───────────────────────────── AI call ───────────────────────────── */

const SYSTEM = `You transcribe doctors' prescriptions from photos for ÖRZA, an India-first wellness app, so the patient can set medicine reminders.
You only copy what the doctor wrote — you never add, remove, substitute or change medicines, doses or frequencies, and you never give medical advice.
Return a single JSON object.

How to read Indian prescriptions (handwritten or printed, English, Hindi or mixed):
- Medicines usually follow "Rx" and start with a form prefix: Tab. / Cap. / Syp. or Syr. / Susp. / Inj. / Oint. / Gel / Drops / Inh. / Rotacap / Sachet. Put the form in "form" and write the name WITHOUT the prefix.
- Keep the name as written — brand names (Dolo, Pan 40, Augmentin, Glycomet, Telma, Thyronorm, Shelcal) and generics (paracetamol, pantoprazole). If both brand and generic are written, use "Brand (generic)".
- strength: as written, e.g. "650 mg", "40 mg", "500 mg", "5 mg/5 ml", "60000 IU".
- dose: the amount per intake, e.g. "1 tablet", "½ tablet", "2 tablets", "5 ml", "10 ml", "2 puffs", "1 drop in each eye", "apply thin layer".
- frequency_text: the dosing instruction exactly as written, e.g. "1-0-1", "1-1-1 x 5d", "0-0-1 HS", "BD x 5 days", "TDS", "OD before breakfast", "SOS".
- pattern: the normalised notation. Dose grids are morning-afternoon-night ("1-0-1" = morning and night; "½-0-½"; "0-0-1" = night); a 4-position grid is morning-afternoon-evening-night ("1-0-0-1"). Codes: OD/QD = once daily, BD/BID = twice, TDS/TID = three times, QID/QDS = four times, HS = at bedtime, SOS/PRN = only when needed, STAT = one dose immediately, Q8H = every 8 hours. Use "" when unclear.
- times: 24-hour "HH:MM" local alarm times. Use exact times if written (e.g. "9 pm" → "21:00"); otherwise use these defaults: morning 08:00, afternoon 14:00, evening 18:00, night 21:00, bedtime 22:00; OD 08:00; BD 08:00 and 20:00; TDS 08:00, 14:00, 21:00; QID 08:00, 12:00, 16:00, 21:00; Q8H 06:00, 14:00, 22:00. Use [] for SOS/PRN.
- timing: "before_food" (AC, before food/meals, khane se pehle), "after_food" (PC, after food/meals, khane ke baad), "with_food", "empty_stomach" (khali pet, empty stomach, early morning before breakfast), "bedtime" (HS, at bedtime, sone se pehle) or "any" when not written.
- duration_days: course length as a number of days: "x 5 days", "x5d", "5/7" → 5; "for 1 week", "1/52" → 7; "x 1 month", "1/12" → 30. Leave it out for "continue", "long term" or when not written.
- as_needed: true only for SOS / PRN / "when required" / "if pain" / "if fever".
- instructions: other short directions for that medicine only (e.g. "Dissolve in water", "Apply on affected area", "Taper as advised", "Shake well").
- confidence: 0 to 1 for how sure you are of that medicine's name and dosing. Use below 0.5 when the handwriting is hard to read — give your best reading, never a made-up one.

Rules:
- Never invent medicines. Only include lines that are clearly medicines. Skip crossed-out lines, lab tests and investigations (CBC, LFT, X-ray, USG), diet/exercise advice and the doctor's letterhead.
- Put the follow-up date, diagnosis, tests advised and general advice in "notes" (short, plain English).
- doctor: doctor's name (and clinic if printed). issued_on: prescription date as "YYYY-MM-DD" if written (dates are usually day-first, e.g. 12/09/2026 = 12 September 2026). patient_name: if written.
- If the image is not a prescription or nothing is readable, return "medicines": [] and explain briefly in "notes".`;

const SHAPE = `{
  "doctor": string | null,
  "issued_on": "YYYY-MM-DD" | null,
  "patient_name": string | null,
  "notes": string | null,
  "medicines": [
    {
      "name": string,
      "strength": string | null,
      "form": "tablet" | "capsule" | "syrup" | "drops" | "injection" | "inhaler" | "cream" | "powder" | "other",
      "dose": string,
      "frequency_text": string,
      "pattern": string,
      "times": ["HH:MM"],
      "timing": "before_food" | "after_food" | "with_food" | "empty_stomach" | "bedtime" | "any",
      "duration_days": number | null,
      "as_needed": boolean,
      "instructions": string | null,
      "confidence": number
    }
  ]
}`;

/**
 * Read a prescription photo (data URL) with AI vision. Throws the HttpErrors from `aiJSON`
 * (503 when AI is off or busy, 502/504 on failures) — callers wrap it in `withCredits`.
 */
export async function aiScanPrescription(dataUrl: string, profile?: Profile): Promise<PrescriptionScan> {
  const allergies = (profile?.allergies || []).map((a) => clampText(a, 40)).filter(Boolean).slice(0, 12);
  const context = [
    profile?.language === "hi" || profile?.language === "hinglish" ? "The person reads Hindi/Hinglish; directions may be written in Hindi." : "",
    allergies.length
      ? `The person has listed these allergies: ${allergies.join(", ")}. Only if a medicine clearly contains one of them, add "Listed allergy: <name> — check with your doctor or pharmacist before taking." to that medicine's instructions. Do not change anything else.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await aiJSON<unknown>({
    system: SYSTEM,
    prompt: `Read this prescription photo and list every medicine with its dosing.${context ? `\n${context}` : ""}`,
    shape: SHAPE,
    imageUrl: dataUrl,
    temperature: 0.1,
    maxTokens: 3000,
  });
  return normaliseScan(raw);
}
