/**
 * CSV import for health data (Health Connect / Google Fit / Samsung Health / Fitbit / spreadsheet
 * exports). Pure module: robust CSV parsing, header auto-mapping with units, date detection and
 * per-day aggregation. The dialog shows the mapping + a preview before anything is uploaded.
 */
import { DayAggregator, localDateOf, localDater, parseHealthTimestamp, shiftDate, isRealDate } from "./aggregate";
import { MAX_IMPORT_DAYS, toKcal, toKg, toKm, toMinutes, toMl, toNumber, type HealthDayInput, type HealthMetric } from "./metrics";

/* ───────────────────────────── CSV parsing ───────────────────────────── */

/** Picks the delimiter used most on the header line (outside quotes): comma, semicolon or tab. */
export function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') inQuote = !inQuote;
    else if (!inQuote && (c === "\n" || c === "\r")) break;
    else if (!inQuote && c in counts) counts[c]++;
  }
  let best = ",";
  for (const d of [";", "\t"]) if (counts[d] > counts[best]) best = d;
  return best;
}

/**
 * RFC 4180-style parser: quoted fields may contain delimiters, newlines and doubled quotes (""),
 * CRLF / LF / CR line endings, a leading UTF-8 BOM is dropped, blank lines are skipped.
 */
export function parseCsv(input: string, delimiter?: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const delim = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuote = false;
  let fieldStarted = false;
  const endField = () => {
    row.push(field);
    field = "";
    fieldStarted = false;
  };
  const endRow = () => {
    endField();
    if (row.some((f) => f.trim() !== "")) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuote = false;
      } else field += c;
      continue;
    }
    if (c === '"' && !fieldStarted) {
      inQuote = true;
      fieldStarted = true;
    } else if (c === delim) endField();
    else if (c === "\n") endRow();
    else if (c === "\r") {
      endRow();
      if (text[i + 1] === "\n") i++;
    } else {
      field += c;
      if (c !== " " && c !== "\t") fieldStarted = true;
    }
  }
  if (field !== "" || row.length) endRow();
  return rows;
}

/* ───────────────────────────── column mapping ───────────────────────────── */

export type CsvField = "ignore" | "date" | HealthMetric;

export const CSV_UNITS = {
  steps: ["count"],
  active_kcal: ["kcal", "kJ"],
  distance_km: ["km", "mi", "m"],
  sleep_minutes: ["hours", "minutes"],
  resting_hr: ["bpm"],
  avg_hr: ["bpm"],
  weight_kg: ["kg", "lb", "st"],
  water_ml: ["ml", "l", "fl oz"],
} as const satisfies Record<HealthMetric, readonly string[]>;

export type CsvUnit = (typeof CSV_UNITS)[HealthMetric][number];

export interface ColumnMapping {
  index: number;
  header: string;
  field: CsvField;
  unit?: CsvUnit;
}

export const CSV_FIELD_LABELS: Record<CsvField, string> = {
  ignore: "Don't import",
  date: "Date",
  steps: "Steps",
  active_kcal: "Active energy",
  distance_km: "Distance",
  sleep_minutes: "Sleep",
  resting_hr: "Resting heart rate",
  avg_hr: "Heart rate (average)",
  weight_kg: "Weight",
  water_ml: "Water",
};

const norm = (h: string) =>
  h
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Score how well a header matches each field (0 = no match). Higher wins when several columns compete. */
function scoreHeader(h: string): Partial<Record<CsvField, number>> {
  const s: Partial<Record<CsvField, number>> = {};
  // "Heart Rate [Min] (count/min)", "Max weight (kg)" — units in parentheses don't count as min/max.
  const isMinMax = /\b(min|max|minimum|maximum)\b/.test(h.replace(/\([^)]*\)/g, " "));
  if (/^(date|day|datum|fecha|data|date time|datetime|timestamp|start|start date|start time|date\/time)$/.test(h)) s.date = 10;
  else if (/\b(date|day|timestamp)\b/.test(h) && !/\b(steps?|sleep|weight|water|heart|distance|energy|calories)\b/.test(h)) s.date = 6;
  if (/\bsteps?\b|step count|stepcount/.test(h)) s.steps = 10;
  if (/active (energy|calories|cal|kcal)|calories burned|energy burned|active kcal|move (calories|kcal)|exercise calories/.test(h)) s.active_kcal = 10;
  if (/\bdistance\b|walking (\+|and|&)? ?running/.test(h)) s.distance_km = /walking|running|walk/.test(h) ? 10 : 8;
  if (/\bsleep|asleep/.test(h) && !/in bed|inbed|awake|start|end|time to|score|efficiency|latency/.test(h)) {
    s.sleep_minutes = /total|asleep/.test(h) ? 10 : /\[(core|deep|rem|light)\]|\b(core|deep|rem|light)\b/.test(h) ? 2 : 8;
  }
  if (/resting/.test(h) && /heart|\bhr\b|pulse|bpm/.test(h)) s.resting_hr = 10;
  else if (/\brhr\b/.test(h)) s.resting_hr = 9;
  else if (/heart ?rate|\bhr\b|pulse|\bbpm\b/.test(h) && !/variability|hrv|recovery|walking/.test(h) && !isMinMax) {
    s.avg_hr = /avg|average|mean/.test(h) ? 10 : 7;
  }
  if (/\b(body )?weight\b|body ?mass|bodyweight/.test(h) && !/lean|fat|goal|target/.test(h) && !isMinMax) s.weight_kg = /avg|average/.test(h) ? 10 : 9;
  if (/\bwater\b|hydration/.test(h)) s.water_ml = 10;
  return s;
}

function unitFor(field: HealthMetric, header: string, values: number[], opts: { imperial?: boolean }): CsvUnit | undefined {
  const h = header;
  switch (field) {
    case "steps":
      return "count";
    case "active_kcal":
      return /\bkj\b|kilojoule/.test(h) ? "kJ" : "kcal";
    case "distance_km":
      if (/\(mi\)|\bmi\b|miles?/.test(h)) return "mi";
      if (/\(m\)|\bmeters?\b|\bmetres?\b/.test(h)) return "m";
      if (/\(km\)|\bkm\b|kilomet/.test(h)) return "km";
      return opts.imperial ? "mi" : "km";
    case "sleep_minutes": {
      if (/\(h\)|\(hr\)|\(hrs\)|\bhours?\b|\bhrs?\b/.test(h)) return "hours";
      if (/\(min\)|\bmins?\b|minutes?/.test(h)) return "minutes";
      const m = median(values);
      return m != null && m <= 24 ? "hours" : "minutes";
    }
    case "resting_hr":
    case "avg_hr":
      return "bpm";
    case "weight_kg":
      if (/\blbs?\b|pounds?/.test(h)) return "lb";
      if (/\bst\b|stone/.test(h)) return "st";
      if (/\bkgs?\b|kilograms?/.test(h)) return "kg";
      return opts.imperial ? "lb" : "kg";
    case "water_ml":
      if (/fl ?oz|\boz\b|ounces?/.test(h)) return "fl oz";
      if (/\(l\)|\blit(re|er)s?\b/.test(h)) return "l";
      if (/\bml\b|millilit/.test(h)) return "ml";
      return "ml";
  }
}

/**
 * Suggests a mapping for every column: at most one column per field (the best-scoring one), with a
 * unit read from the header ("Weight (lb)", "Distance (mi)", "Sleep (hours)") or inferred from values.
 * `imperial` (the user's unit preference) is the fallback for unlabelled weight and distance.
 */
export function detectMapping(headers: string[], rows: string[][], opts: { imperial?: boolean } = {}): ColumnMapping[] {
  const normalised = headers.map(norm);
  const best = new Map<CsvField, { index: number; score: number }>();
  normalised.forEach((h, index) => {
    for (const [field, score] of Object.entries(scoreHeader(h)) as Array<[CsvField, number]>) {
      const cur = best.get(field);
      if (!cur || score > cur.score) best.set(field, { index, score });
    }
  });
  // A column claimed by several fields goes to the field it matches best.
  const claimed = new Map<number, { field: CsvField; score: number }>();
  for (const [field, { index, score }] of best) {
    const cur = claimed.get(index);
    if (!cur || score > cur.score) claimed.set(index, { field, score });
  }
  return headers.map((header, index) => {
    const field = claimed.get(index)?.field ?? "ignore";
    if (field === "ignore" || field === "date") return { index, header, field };
    const values = rows
      .slice(0, 200)
      .map((r) => toNumber(r[index]))
      .filter((v): v is number => v != null);
    return { index, header, field, unit: unitFor(field, normalised[index], values, opts) };
  });
}

/* ───────────────────────────── dates ───────────────────────────── */

export type DateOrder = "ymd" | "dmy" | "mdy";

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const NUMERIC_DATE_RE = /^(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})(?:[ T,]+.*)?$/;

/** For slash/dot dates like 03/04/2026, decides day-first vs month-first from the values (day-first when ambiguous, as in India). */
export function detectDateOrder(values: string[]): DateOrder {
  let dayFirst = false;
  let monthFirst = false;
  for (const v of values.slice(0, 500)) {
    const m = NUMERIC_DATE_RE.exec(v.trim());
    if (!m || m[1].length === 4) continue;
    if (Number(m[1]) > 12) dayFirst = true;
    if (Number(m[2]) > 12) monthFirst = true;
  }
  if (monthFirst && !dayFirst) return "mdy";
  return "dmy";
}

const pad = (n: number) => String(n).padStart(2, "0");
const fullYear = (y: number) => (y < 100 ? 2000 + y : y);
const ymd = (y: number, m: number, d: number) => {
  const s = `${fullYear(y)}-${pad(m)}-${pad(d)}`;
  return isRealDate(s) ? s : null;
};

/**
 * One CSV cell → local YYYY-MM-DD. Handles ISO dates and timestamps (with an offset they're converted
 * to the user's timezone), 24/09/2026 · 09/24/2026 · 2026/09/24 · 24.09.2026 (optionally with a time),
 * and month names (24 Sep 2026, Sep 24, 2026, 24-Sep-26).
 */
export function parseCsvDate(value: string, order: DateOrder, dater: (epoch: number) => string): string | null {
  const v = value.trim();
  if (!v) return null;
  const iso = parseHealthTimestamp(v);
  if (iso) return localDateOf(iso, dater);
  const isoLoose = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (isoLoose) return ymd(Number(isoLoose[1]), Number(isoLoose[2]), Number(isoLoose[3]));
  const n = NUMERIC_DATE_RE.exec(v);
  if (n) {
    const [a, b, c] = [Number(n[1]), Number(n[2]), Number(n[3])];
    if (n[1].length === 4) return ymd(a, b, c);
    return order === "mdy" ? ymd(c, a, b) : ymd(c, b, a);
  }
  const words = v.toLowerCase().replace(/,/g, " ").replace(/[-/]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length >= 3) {
    // "24 sep 2026" | "sep 24 2026" | "tuesday 24 sep 2026"
    const w = words.filter((x) => !/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*$/.test(x));
    const monthIdx = w.findIndex((x) => MONTHS[x.slice(0, 4)] || MONTHS[x.slice(0, 3)]);
    if (monthIdx !== -1) {
      const month = MONTHS[w[monthIdx].slice(0, 4)] || MONTHS[w[monthIdx].slice(0, 3)];
      const nums = w.filter((_, i) => i !== monthIdx).map((x) => Number(x.replace(/(st|nd|rd|th)$/, ""))).filter((x) => Number.isInteger(x));
      if (nums.length >= 2) {
        const [p, q] = nums;
        return p > 31 ? ymd(p, month, q) : ymd(q, month, p);
      }
    }
  }
  return null;
}

/* ───────────────────────────── values → days ───────────────────────────── */

/** "7.5", "7:30" (h:mm), "7h 30m", "450" → a number in the column's unit (hours for "7:30"-style values). */
function parseCell(raw: string | undefined, field: HealthMetric, unit: CsvUnit | undefined): number | null {
  if (raw == null) return null;
  const v = raw.trim();
  if (!v) return null;
  if (field === "sleep_minutes") {
    const hm = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(v);
    if (hm) {
      const hours = Number(hm[1]) + Number(hm[2]) / 60;
      return unit === "minutes" ? hours * 60 : hours;
    }
    const words = /^(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?$/i.exec(v);
    if (words && (words[1] || words[2])) {
      const hours = Number(words[1] || 0) + Number(words[2] || 0) / 60;
      return unit === "minutes" ? hours * 60 : hours;
    }
  }
  return toNumber(v.replace(/\s*(kg|lbs?|km|mi|kcal|kj|ml|bpm|steps?)$/i, ""));
}

function toCanonical(field: HealthMetric, value: number, unit: CsvUnit | undefined): number | null {
  switch (field) {
    case "active_kcal":
      return toKcal(value, unit ?? "kcal");
    case "distance_km":
      return toKm(value, unit ?? "km");
    case "sleep_minutes":
      return toMinutes(value, unit === "minutes" ? "min" : "hr");
    case "weight_kg":
      return toKg(value, unit ?? "kg");
    case "water_ml":
      return toMl(value, unit === "fl oz" ? "fl_oz_us" : (unit ?? "ml"));
    default:
      return value;
  }
}

export interface CsvBuildResult {
  days: HealthDayInput[];
  /** Rows with a readable date. */
  rowsUsed: number;
  /** Rows skipped for an unreadable or future date. */
  rowsSkipped: number;
  /** Older days left out because one import holds at most 400 days. */
  truncated: number;
}

/** Aggregates data rows into days (several rows per day are summed / averaged like any other source). */
export function buildCsvDays(rows: string[][], mapping: ColumnMapping[], opts: { tz: string; today?: string; dateOrder?: DateOrder }): CsvBuildResult {
  const dateCol = mapping.find((m) => m.field === "date");
  const metricCols = mapping.filter((m): m is ColumnMapping & { field: HealthMetric } => m.field !== "ignore" && m.field !== "date");
  if (!dateCol || !metricCols.length) return { days: [], rowsUsed: 0, rowsSkipped: rows.length, truncated: 0 };
  const dater = localDater(opts.tz);
  const today = opts.today ?? dater(Date.now());
  const latest = shiftDate(today, 1);
  const order = opts.dateOrder ?? detectDateOrder(rows.map((r) => r[dateCol.index] ?? ""));
  const agg = new DayAggregator();
  let used = 0;
  let skipped = 0;
  rows.forEach((row, i) => {
    const date = parseCsvDate(row[dateCol.index] ?? "", order, dater);
    if (!date || date > latest) {
      skipped++;
      return;
    }
    used++;
    for (const col of metricCols) {
      const raw = parseCell(row[col.index], col.field, col.unit);
      if (raw == null) continue;
      const v = toCanonical(col.field, raw, col.unit);
      if (v == null) continue;
      switch (col.field) {
        case "steps":
        case "active_kcal":
        case "distance_km":
        case "water_ml":
          agg.addSum(col.field, date, "csv", v);
          break;
        case "resting_hr":
        case "avg_hr":
          agg.addAverage(col.field, date, v);
          break;
        case "weight_kg":
          agg.setWeight(date, i, v);
          break;
        case "sleep_minutes":
          agg.addSleepMinutes(date, "csv", v);
          break;
      }
    }
  });
  const all = agg.toDays({ until: latest });
  const days = all.slice(-MAX_IMPORT_DAYS);
  return { days, rowsUsed: used, rowsSkipped: skipped, truncated: all.length - days.length };
}

/** Largest CSV the importer reads (it's read whole, unlike the streamed Apple Health export). */
export const MAX_CSV_BYTES = 25 * 1024 * 1024;
