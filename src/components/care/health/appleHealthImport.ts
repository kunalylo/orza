/**
 * Apple Health export importer — runs entirely in the browser.
 *
 * iPhone: Health → profile picture → Export All Health Data produces `export.zip`, which holds
 * `apple_health_export/export.xml` (often several GB uncompressed). We stream the file with
 * `File.stream()`, unzip with fflate's streaming `Unzip` (only the export XML is inflated; every
 * other entry is discarded without buffering), decode with a streaming TextDecoder and scan
 * `<Record …>` tags through a rolling buffer — the file is never held in memory. Only daily
 * aggregates for the last 365 days leave the device (POST /api/health/import).
 *
 * Per day, additive metrics (steps, active energy, distance, water) are summed per `sourceName` and
 * the largest source is kept — iPhone and Apple Watch both record steps, and Health itself
 * de-duplicates them the same way. Sleep uses asleep stages only, merged per source and credited to
 * the wake-up date. Heart rate is averaged; weight keeps the day's latest reading.
 */
import { Unzip, UnzipInflate, type AsyncFlateStreamHandler, type UnzipDecoder, type UnzipDecoderConstructor, type UnzipFile } from "fflate";
import { DayAggregator, localDateOf, localDater, parseHealthTimestamp, shiftDate } from "./aggregate";
import { APPLE_IMPORT_DAYS, toKcal, toKg, toKm, toMl, type HealthDayInput } from "./metrics";

/* ───────────────────────────── XML scanner (pure, testable) ───────────────────────────── */

type Kind = "steps" | "active_kcal" | "distance_km" | "resting_hr" | "avg_hr" | "weight_kg" | "water_ml" | "sleep";

const RECORD_KINDS: Record<string, Kind> = {
  HKQuantityTypeIdentifierStepCount: "steps",
  HKQuantityTypeIdentifierActiveEnergyBurned: "active_kcal",
  HKQuantityTypeIdentifierDistanceWalkingRunning: "distance_km",
  HKQuantityTypeIdentifierRestingHeartRate: "resting_hr",
  HKQuantityTypeIdentifierHeartRate: "avg_hr",
  HKQuantityTypeIdentifierBodyMass: "weight_kg",
  HKQuantityTypeIdentifierDietaryWater: "water_ml",
  HKCategoryTypeIdentifierSleepAnalysis: "sleep",
};

/** Sleep values that count as asleep ("InBed" and "Awake" don't). */
const ASLEEP_VALUES = new Set([
  "HKCategoryValueSleepAnalysisAsleep",
  "HKCategoryValueSleepAnalysisAsleepUnspecified",
  "HKCategoryValueSleepAnalysisAsleepCore",
  "HKCategoryValueSleepAnalysisAsleepDeep",
  "HKCategoryValueSleepAnalysisAsleepREM",
]);

/** Value of `name="…"` inside one tag (Apple writes double-quoted attributes separated by single spaces). */
function attr(tag: string, name: string): string | null {
  const key = ` ${name}="`;
  const i = tag.indexOf(key);
  if (i === -1) return null;
  const start = i + key.length;
  const end = tag.indexOf('"', start);
  return end === -1 ? null : tag.slice(start, end);
}

/** Index of the `>` closing the tag that starts at `start` (quote-aware), or -1 when the tag isn't complete yet. */
function tagEnd(s: string, start: number): number {
  let inQuote = false;
  for (let i = start; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 34) inQuote = !inQuote;
    else if (c === 62 && !inQuote) return i;
  }
  return -1;
}

const RECORD_OPEN = "<Record ";
const CORRELATION_OPEN = "<Correlation ";
const CORRELATION_CLOSE = "</Correlation>";
/** Enough trailing characters to complete any marker split across chunks. */
const KEEP_TAIL = 16;
/** Real Record tags are a few hundred characters. */
const MAX_TAG = 64 * 1024;

export interface AppleScanOptions {
  /** User's IANA timezone — samples are credited to local calendar days. */
  tz: string;
  /** First local day to keep (inclusive). */
  since: string;
  /** Last local day to keep (inclusive). */
  until: string;
}

/**
 * Incremental scanner over export.xml text. Feed decoded text in any chunking with `push`, then call
 * `finish` for daily values. Records nested inside `<Correlation>` (blood pressure, food) repeat
 * top-level records, so they're skipped.
 */
export class AppleHealthScanner {
  private buf = "";
  private inCorrelation = false;
  private readonly agg = new DayAggregator();
  private readonly dater: (epoch: number) => string;
  private readonly earliestStart: string;
  /** Matching records inside the date range. */
  records = 0;
  /** True once the `<HealthData` root has been seen (the file really is an Apple Health export). */
  sawHealthData = false;

  constructor(private readonly opts: AppleScanOptions) {
    this.dater = localDater(opts.tz);
    // Wall-clock prefilter with slack: sleep that starts late the day before still counts for its wake-up date.
    this.earliestStart = shiftDate(opts.since, -2);
  }

  push(text: string) {
    if (!text) return;
    this.buf += text;
    if (!this.sawHealthData && this.buf.includes("<HealthData")) this.sawHealthData = true;
    this.process();
  }

  finish(): HealthDayInput[] {
    this.process();
    this.buf = "";
    return this.agg.toDays({ since: this.opts.since, until: this.opts.until });
  }

  private process() {
    const buf = this.buf;
    let pos = 0;
    let partial = false; // stopped at a tag that continues in the next chunk
    let corr = -2; // next correlation marker; -1 = none left in this buffer, -2 = not searched yet
    for (;;) {
      const rec = buf.indexOf(RECORD_OPEN, pos);
      if (corr !== -1 && corr < pos) corr = buf.indexOf(this.inCorrelation ? CORRELATION_CLOSE : CORRELATION_OPEN, pos);
      if (corr !== -1 && (rec === -1 || corr < rec)) {
        if (this.inCorrelation) {
          this.inCorrelation = false;
          pos = corr + CORRELATION_CLOSE.length;
        } else {
          const end = tagEnd(buf, corr);
          if (end === -1) {
            pos = corr;
            partial = true;
            break;
          }
          this.inCorrelation = buf.charCodeAt(end - 1) !== 47; // "<Correlation … />" has no children
          pos = end + 1;
        }
        corr = -2;
        continue;
      }
      if (rec === -1) break;
      const end = tagEnd(buf, rec);
      if (end === -1) {
        pos = rec;
        partial = true;
        break;
      }
      if (!this.inCorrelation) this.record(buf.slice(rec, end + 1));
      pos = end + 1;
    }
    // Keep an unfinished tag whole; otherwise only a short tail in case a marker is split across chunks.
    // A "tag" that runs past MAX_TAG is malformed (unbalanced quote) — skip it instead of buffering forever.
    if (partial && buf.length - pos > MAX_TAG) this.buf = buf.slice(pos + 1);
    else this.buf = partial ? buf.slice(pos) : buf.slice(Math.max(pos, buf.length - KEEP_TAIL));
  }

  private record(tag: string) {
    const type = attr(tag, "type");
    const kind = type ? RECORD_KINDS[type] : undefined;
    if (!kind) return;
    const startRaw = attr(tag, "startDate");
    if (!startRaw || startRaw.slice(0, 10) < this.earliestStart) return;
    const start = parseHealthTimestamp(startRaw);
    if (!start) return;
    const source = attr(tag, "sourceName") || "Unknown source";
    const { since, until } = this.opts;

    if (kind === "sleep") {
      const value = attr(tag, "value");
      if (!value || !ASLEEP_VALUES.has(value) || start.epoch == null) return;
      const end = parseHealthTimestamp(attr(tag, "endDate"));
      if (!end || end.epoch == null) return;
      const date = this.dater(end.epoch);
      if (date < since || date > until) return;
      this.agg.addSleepInterval(date, source, start.epoch, end.epoch);
      this.records++;
      return;
    }

    const rawValue = attr(tag, "value");
    const value = rawValue ? Number(rawValue) : NaN;
    if (!Number.isFinite(value)) return;
    const date = localDateOf(start, this.dater);
    if (date < since || date > until) return;
    const unit = attr(tag, "unit");
    switch (kind) {
      case "steps":
        this.agg.addSum("steps", date, source, value);
        break;
      case "active_kcal":
        this.agg.addSum("active_kcal", date, source, toKcal(value, unit));
        break;
      case "distance_km":
        this.agg.addSum("distance_km", date, source, toKm(value, unit));
        break;
      case "water_ml":
        this.agg.addSum("water_ml", date, source, toMl(value, unit));
        break;
      case "resting_hr":
        this.agg.addAverage("resting_hr", date, value);
        break;
      case "avg_hr":
        this.agg.addAverage("avg_hr", date, value);
        break;
      case "weight_kg":
        this.agg.setWeight(date, start.epoch ?? 0, toKg(value, unit));
        break;
    }
    this.records++;
  }
}

/* ───────────────────────────── file driver (browser) ───────────────────────────── */

export type AppleImportErrorCode = "not_found" | "not_health_export" | "unsupported" | "damaged" | "read_failed" | "no_data";

export class AppleHealthImportError extends Error {
  constructor(public code: AppleImportErrorCode, message: string) {
    super(message);
    this.name = "AppleHealthImportError";
  }
}

export interface AppleImportProgress {
  bytesRead: number;
  totalBytes: number;
  /** Matching records found so far. */
  records: number;
}

export interface AppleImportResult {
  days: HealthDayInput[];
  records: number;
  since: string;
  until: string;
}

export interface AppleImportOptions {
  tz: string;
  signal?: AbortSignal;
  onProgress?: (p: AppleImportProgress) => void;
  /** How many days back to keep (default 365). */
  days?: number;
  /** Override "today" (YYYY-MM-DD, user's timezone) — for tests. */
  today?: string;
}

/**
 * Whether a zip entry could be the main export: `apple_health_export/export.xml`, a bare `export.xml`,
 * or a localized name ending in export.xml. The clinical-records file (export_cda.xml), macOS
 * metadata and sub-folders (workout routes, ECGs) are never candidates. Content is verified by
 * looking for the `<HealthData` root before anything is trusted.
 */
export function isExportXmlEntry(name: string): boolean {
  const n = name.replace(/\\/g, "/");
  if (n.startsWith("__MACOSX/")) return false;
  const parts = n.split("/").filter(Boolean);
  if (parts.length === 0 || parts.length > 2) return false;
  const base = parts[parts.length - 1].toLowerCase();
  return !base.startsWith("._") && base.endsWith(".xml") && !base.includes("cda");
}

/** Bytes of an entry we inflate while looking for `<HealthData` before giving up on it. */
const SNIFF_LIMIT = 2 * 1024 * 1024;

const abortError = () => new DOMException("The import was cancelled.", "AbortError");

async function looksLikeZip(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return head[0] === 0x50 && head[1] === 0x4b && (head[2] === 0x03 || head[2] === 0x05) && (head[3] === 0x04 || head[3] === 0x06);
}

interface EntryScan {
  scanner: AppleHealthScanner;
  decoder: TextDecoder;
  inflated: number;
  rejected: boolean;
  done: boolean;
}

/**
 * Parses an Apple Health `export.zip` (or an unzipped `export.xml`) and returns daily aggregates.
 * Rejects with `AbortError` when `signal` aborts and with `AppleHealthImportError` otherwise.
 */
export async function importAppleHealthExport(file: File | Blob, opts: AppleImportOptions): Promise<AppleImportResult> {
  const until = opts.today ?? localDater(opts.tz)(Date.now());
  const since = shiftDate(until, -((opts.days ?? APPLE_IMPORT_DAYS) - 1));
  const newScanner = () => new AppleHealthScanner({ tz: opts.tz, since, until });
  const { signal, onProgress } = opts;
  if (signal?.aborted) throw abortError();

  const totalBytes = file.size;
  let isZip: boolean;
  try {
    isZip = await looksLikeZip(file);
  } catch {
    throw new AppleHealthImportError("read_failed", "We couldn't read that file. Please choose it again.");
  }

  const reader = file.stream().getReader();
  const onAbort = () => void reader.cancel().catch(() => undefined);
  signal?.addEventListener("abort", onAbort, { once: true });

  let bytesRead = 0;
  let lastProgress = 0;
  let lastYield = typeof performance !== "undefined" ? performance.now() : Date.now();
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  let recordsSoFar = () => 0;
  const report = (force = false) => {
    const t = now();
    if (!onProgress || (!force && t - lastProgress < 120)) return;
    lastProgress = t;
    onProgress({ bytesRead, totalBytes, records: recordsSoFar() });
  };
  /** Gives the browser a frame now and then so progress paints and Cancel stays clickable. */
  const breathe = async () => {
    if (now() - lastYield < 30) return;
    await yieldToBrowser();
    lastYield = now();
  };

  try {
    report(true);
    if (!isZip) {
      const scan = newScanner();
      recordsSoFar = () => scan.records;
      const decoder = new TextDecoder("utf-8");
      for (;;) {
        const { done, value } = await readChunk(reader);
        if (signal?.aborted) throw abortError();
        if (done) break;
        bytesRead += value.byteLength;
        scan.push(decoder.decode(value, { stream: true }));
        if (!scan.sawHealthData && bytesRead > SNIFF_LIMIT) break;
        report();
        await breathe();
      }
      scan.push(decoder.decode());
      if (!scan.sawHealthData) {
        throw new AppleHealthImportError(
          "not_health_export",
          "That file isn't an Apple Health export. Choose export.zip from Health → Export All Health Data (or the export.xml inside it)."
        );
      }
      return finishScan(scan, since, until, () => report(true));
    }

    // ── zip ──
    const state: { current: EntryScan | null; result: EntryScan | null; error: string | null } = { current: null, result: null, error: null };
    let discardCurrent: (() => void) | null = null;

    /** Deflate decoder that only inflates the entry being scanned; every other entry is dropped unread (never buffered). */
    let inflateNext = false;
    class SelectiveInflate implements UnzipDecoder {
      static compression = 8;
      ondata: AsyncFlateStreamHandler = () => undefined;
      private inner: UnzipInflate | null;
      constructor() {
        this.inner = inflateNext ? new UnzipInflate() : null;
        if (this.inner) {
          this.inner.ondata = (err, data, final) => this.ondata(err, data, final);
          discardCurrent = () => {
            this.inner = null;
          };
        }
      }
      push(data: Uint8Array, final: boolean) {
        if (this.inner) this.inner.push(data, final);
        else if (final) this.ondata(null, new Uint8Array(0), true);
      }
    }

    const readable = (f: UnzipFile) => f.compression === 0 || f.compression === 8;
    const unzip = new Unzip((f: UnzipFile) => {
      const wanted = !state.result && !state.current && isExportXmlEntry(f.name);
      if (wanted && !readable(f)) state.error = "This zip uses a compression method ÖRZA can't read. Export again from the Health app and choose the new file.";
      if (!wanted || !readable(f)) {
        inflateNext = false;
        f.ondata = () => undefined;
        if (readable(f)) f.start();
        return;
      }
      const entry: EntryScan = { scanner: newScanner(), decoder: new TextDecoder("utf-8"), inflated: 0, rejected: false, done: false };
      state.current = entry;
      recordsSoFar = () => entry.scanner.records;
      discardCurrent = null;
      f.ondata = (err, data, final) => {
        if (entry.rejected || entry.done) return;
        if (err) {
          state.error = "This export looks damaged — the zip couldn't be decompressed. Export again from the Health app.";
          entry.rejected = true;
          discardCurrent?.();
          state.current = null;
          return;
        }
        entry.inflated += data.byteLength;
        entry.scanner.push(entry.decoder.decode(data, { stream: !final }));
        if (!entry.scanner.sawHealthData && (final || entry.inflated > SNIFF_LIMIT)) {
          // Not the health export after all (some other XML) — stop inflating it and keep looking.
          entry.rejected = true;
          discardCurrent?.();
          state.current = null;
          return;
        }
        if (final) {
          entry.done = true;
          state.result = entry;
          state.current = null;
        }
      };
      inflateNext = true;
      f.start();
      inflateNext = false;
    });
    unzip.register(SelectiveInflate as unknown as UnzipDecoderConstructor);

    const damaged = () =>
      new AppleHealthImportError("damaged", "This zip file is incomplete or damaged. Export again from the Health app and choose the new file.");
    for (;;) {
      const { done, value } = await readChunk(reader);
      if (signal?.aborted) throw abortError();
      if (done) {
        try {
          unzip.push(new Uint8Array(0), true);
        } catch {
          if (!state.result) throw damaged();
        }
        break;
      }
      bytesRead += value.byteLength;
      try {
        unzip.push(value, false);
      } catch {
        if (!state.result) throw damaged();
      }
      if (state.result) {
        // export.xml is complete — the rest of the archive (routes, ECGs, clinical records) isn't needed.
        void reader.cancel().catch(() => undefined);
        bytesRead = totalBytes;
        break;
      }
      report();
      await breathe();
    }

    const finished = state.result;
    if (!finished) {
      if (state.error) throw new AppleHealthImportError("damaged", state.error);
      throw new AppleHealthImportError(
        "not_found",
        "We couldn't find export.xml in that zip. On your iPhone open Health → your profile picture → Export All Health Data, then choose the export.zip it creates."
      );
    }
    return finishScan(finished.scanner, since, until, () => report(true));
  } catch (e) {
    if (signal?.aborted) throw abortError();
    if (e instanceof AppleHealthImportError || (e instanceof DOMException && e.name === "AbortError")) throw e;
    throw new AppleHealthImportError("read_failed", "We couldn't read that file. If it's on iCloud Drive, download it to the device first, then choose it again.");
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

/** A macrotask yield that background tabs don't throttle the way they throttle setTimeout. */
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof MessageChannel === "undefined") {
      setTimeout(resolve, 0);
      return;
    }
    const ch = new MessageChannel();
    ch.port1.onmessage = () => {
      ch.port1.close();
      resolve();
    };
    ch.port2.postMessage(null);
  });
}

async function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<{ done: true; value?: undefined } | { done: false; value: Uint8Array }> {
  const r = await reader.read();
  if (r.done || !r.value) return { done: true };
  return { done: false, value: r.value };
}

function finishScan(scanner: AppleHealthScanner, since: string, until: string, report: () => void): AppleImportResult {
  const days = scanner.finish();
  report();
  if (!days.length) {
    throw new AppleHealthImportError(
      "no_data",
      "Your export didn't include steps, sleep, heart rate, weight or water from the last 12 months, so there was nothing to import."
    );
  }
  return { days, records: scanner.records, since, until };
}
