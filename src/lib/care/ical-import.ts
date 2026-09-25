/**
 * Read-only import of a user's own calendar (Google "Secret address in iCal format", iCloud public
 * calendar link, Outlook "Publish calendar" ICS) so ÖRZA can show it next to doses and meals and
 * spot busy days. Server-only.
 *
 * Fetching is SSRF-guarded: https only (webcal:// is rewritten), no credentials or custom ports,
 * DNS is resolved up front and every address must be public (no private, loopback, link-local,
 * CGNAT, multicast, reserved, IPv6 ULA / link-local), and the socket is pinned to those vetted
 * addresses so a DNS rebind can't swap them. Redirects are followed manually (≤ 3, each re-vetted),
 * the whole exchange has a 5 s deadline and the body is streamed with a 2 MB cap (after decompression).
 *
 * Parsing covers what real-world feeds use: line unfolding, VEVENT with DTSTART/DTEND in UTC,
 * TZID (IANA, common Windows names, "(UTC+05:30) …" labels, single-offset VTIMEZONEs) or floating
 * time, all-day VALUE=DATE, DURATION, STATUS:CANCELLED, EXDATE, RECURRENCE-ID overrides, and RRULE
 * FREQ=DAILY|WEEKLY (INTERVAL, COUNT, UNTIL, BYDAY, BYMONTH, WKST) plus simple MONTHLY/YEARLY rules.
 * Parsed calendars are cached in memory for 10 minutes per user + URL.
 */
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import type { IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import zlib from "node:zlib";
import { addDays, daysBetween, DEFAULT_TZ, utcToZoned, zonedToUtc } from "@/lib/dates";

/* ───────────────────────────── Limits ───────────────────────────── */

export const ICAL_MAX_BYTES = 2 * 1024 * 1024;
export const ICAL_TIMEOUT_MS = 5000;
export const ICAL_MAX_REDIRECTS = 3;
export const ICAL_CACHE_TTL_MS = 10 * 60 * 1000;
const ERROR_CACHE_TTL_MS = 2 * 60 * 1000;
const MAX_CACHE_ENTRIES = 300;
const MAX_VEVENTS = 20000;
const MAX_OCCURRENCES_PER_EVENT = 1000;
const MAX_OUTPUT_EVENTS = 3000;
const MAX_RULE_ITERATIONS = 20000;

/* ───────────────────────────── Errors ───────────────────────────── */

export type IcalErrorCode = "invalid_url" | "blocked_host" | "dns" | "timeout" | "too_large" | "http" | "not_ical" | "network" | "redirects";

export class IcalImportError extends Error {
  readonly code: IcalErrorCode;
  constructor(code: IcalErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "IcalImportError";
  }
}

/* ───────────────────────────── URL + address vetting ───────────────────────────── */

/** Parse a pasted link: trims, rewrites webcal(s):// to https://, and allows only plain https on port 443. */
export function normalizeCalendarUrl(input: string): URL {
  const raw = String(input || "").trim();
  if (!raw) throw new IcalImportError("invalid_url", "Paste your calendar's iCal (ICS) address.");
  if (raw.length > 2048) throw new IcalImportError("invalid_url", "That link is too long to be a calendar address.");
  const s = raw.replace(/^webcals?:\/\//i, "https://");
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new IcalImportError("invalid_url", "That doesn't look like a calendar link. Paste the full address that starts with https:// or webcal://.");
  }
  if (u.protocol !== "https:") throw new IcalImportError("invalid_url", "Only secure calendar links (https:// or webcal://) are supported.");
  if (u.username || u.password) throw new IcalImportError("invalid_url", "Calendar links that contain a username or password aren't supported.");
  if (u.port && u.port !== "443") throw new IcalImportError("invalid_url", "Calendar links on a custom port aren't supported.");
  u.hash = "";
  return u;
}

function parseIPv4(s: string): number[] | null {
  const parts = s.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return nums.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? nums : null;
}

function parseIPv6(input: string): number[] | null {
  let s = input.toLowerCase();
  const zone = s.indexOf("%");
  if (zone >= 0) s = s.slice(0, zone);
  const lastColon = s.lastIndexOf(":");
  if (lastColon < 0) return null;
  const tail = s.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseIPv4(tail);
    if (!v4) return null;
    s = `${s.slice(0, lastColon + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = 8 - head.length - rest.length;
  if (halves.length === 1 ? head.length !== 8 : fill < 1) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? fill : 0).fill("0"), ...rest];
  const nums = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return nums.some(Number.isNaN) ? null : nums;
}

function blockedIPv4(o: number[]): boolean {
  const [a, b, c] = o;
  return (
    a === 0 || // "this" network
    a === 10 || // private
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64/10
    (a === 169 && b === 254) || // link-local
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) || // private
    (a === 192 && b === 0 && (c === 0 || c === 2)) || // IETF protocol assignments, TEST-NET-1
    (a === 192 && b === 88 && c === 99) || // 6to4 relay anycast
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    (a === 198 && b === 51 && c === 100) || // TEST-NET-2
    (a === 203 && b === 0 && c === 113) || // TEST-NET-3
    a >= 224 // multicast 224/4, reserved 240/4, broadcast
  );
}

function blockedIPv6(h: number[]): boolean {
  const v4 = (hi: number, lo: number) => [hi >> 8, hi & 255, lo >> 8, lo & 255];
  const zeros = (from: number, to: number) => h.slice(from, to).every((x) => x === 0);
  if (zeros(0, 8)) return true; // unspecified ::
  if (zeros(0, 7) && h[7] === 1) return true; // loopback ::1
  if (zeros(0, 5) && (h[5] === 0xffff || h[5] === 0)) return blockedIPv4(v4(h[6], h[7])); // IPv4-mapped / -compatible
  if (zeros(0, 4) && h[4] === 0xffff && h[5] === 0) return blockedIPv4(v4(h[6], h[7])); // IPv4-translated
  if (h[0] === 0x64 && h[1] === 0xff9b && zeros(2, 6)) return blockedIPv4(v4(h[6], h[7])); // NAT64 well-known prefix
  if (h[0] === 0x2002) return blockedIPv4(v4(h[1], h[2])); // 6to4 embeds an IPv4 address
  if (h[0] === 0x2001 && h[1] === 0) return true; // Teredo
  if (h[0] === 0x2001 && h[1] === 0xdb8) return true; // documentation
  // Everything outside global unicast 2000::/3 is special-purpose: ULA fc00::/7, link-local fe80::/10,
  // site-local fec0::/10, multicast ff00::/8, discard 100::/64, local-use NAT64 64:ff9b:1::/48 …
  return (h[0] & 0xe000) !== 0x2000;
}

/** True when `ip` is a public unicast address that ÖRZA may connect to. */
export function isPublicAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) {
    const o = parseIPv4(ip);
    return !!o && !blockedIPv4(o);
  }
  if (family === 6) {
    const h = parseIPv6(ip);
    return !!h && !blockedIPv6(h);
  }
  return false;
}

type Resolved = { address: string; family: number };

async function resolvePublic(hostname: string): Promise<Resolved[]> {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const blocked = () =>
    new IcalImportError("blocked_host", "That link points to a private or local network address. Use the public link your calendar app gives you.");
  if (!host || host === "localhost" || /\.(localhost|local|internal|lan|home|intranet|corp)\.?$/.test(host)) throw blocked();
  let addrs: Resolved[];
  const family = isIP(host);
  if (family) addrs = [{ address: host, family }];
  else {
    try {
      addrs = await lookup(host, { all: true, verbatim: true });
    } catch {
      throw new IcalImportError("dns", "We couldn't find that calendar's server. Check the link and try again.");
    }
  }
  if (!addrs.length) throw new IcalImportError("dns", "We couldn't find that calendar's server. Check the link and try again.");
  if (addrs.some((a) => !isPublicAddress(a.address))) throw blocked();
  // Prefer IPv4 first: some hosts publish AAAA records that aren't reachable from every server.
  return [...addrs].sort((a, b) => a.family - b.family);
}

/* ───────────────────────────── Guarded fetch ───────────────────────────── */

type Hop = { kind: "redirect"; location: string } | { kind: "body"; body: Buffer };

function httpError(status: number): IcalImportError {
  if (status === 401 || status === 403)
    return new IcalImportError("http", "That calendar is private or its link was reset. Copy a fresh iCal/ICS address and try again.");
  if (status === 404 || status === 410)
    return new IcalImportError("http", "That calendar link no longer exists. Copy a fresh iCal/ICS address and try again.");
  if (status === 429) return new IcalImportError("http", "Your calendar provider is rate-limiting requests. Please try again in a few minutes.");
  return new IcalImportError("http", `Your calendar provider returned an error (HTTP ${status}). Please try again later.`);
}

function fetchHop(u: URL, addrs: Resolved[], deadline: number): Promise<Hop> {
  return new Promise<Hop>((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new IcalImportError("timeout", "Your calendar took too long to respond (over 5 seconds). Please try again."));
    const host = u.hostname.replace(/^\[|\]$/g, "");
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const req = httpsRequest(
      {
        protocol: "https:",
        host,
        port: 443,
        method: "GET",
        path: `${u.pathname || "/"}${u.search}`,
        servername: isIP(host) ? undefined : host,
        headers: {
          Accept: "text/calendar, text/plain;q=0.8, */*;q=0.5",
          "Accept-Encoding": "gzip",
          "User-Agent": "ORZA-Calendar/1.0 (read-only calendar import)",
        },
        // Pin the socket to the addresses we already vetted — no second, unchecked DNS lookup.
        lookup: ((_hostname: string, options: { all?: boolean; family?: number }, cb: (...args: any[]) => void) => {
          const pool = options?.family === 4 || options?.family === 6 ? addrs.filter((a) => a.family === options.family) : addrs;
          const list = pool.length ? pool : addrs;
          if (options?.all) cb(null, list.map((a) => ({ address: a.address, family: a.family })));
          else cb(null, list[0].address, list[0].family);
        }) as any,
      },
      (res: IncomingMessage) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && status !== 304) {
          const location = res.headers.location;
          res.resume();
          if (!location) return done(() => reject(httpError(status)));
          return done(() => resolve({ kind: "redirect", location }));
        }
        if (status !== 200) {
          res.resume();
          return done(() => reject(httpError(status)));
        }
        const declared = Number(res.headers["content-length"]);
        if (Number.isFinite(declared) && declared > ICAL_MAX_BYTES) {
          req.destroy();
          return done(() => reject(tooLarge()));
        }
        const encoding = String(res.headers["content-encoding"] || "identity").toLowerCase().trim();
        let stream: NodeJS.ReadableStream = res;
        if (encoding === "gzip" || encoding === "x-gzip") stream = res.pipe(zlib.createGunzip());
        else if (encoding === "br") stream = res.pipe(zlib.createBrotliDecompress());
        else if (encoding === "deflate") stream = res.pipe(zlib.createInflate());
        else if (encoding !== "identity") {
          req.destroy();
          return done(() => reject(new IcalImportError("not_ical", "Your calendar provider sent the calendar in a format ÖRZA can't read.")));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > ICAL_MAX_BYTES) {
            req.destroy();
            done(() => reject(tooLarge()));
            return;
          }
          chunks.push(chunk);
        });
        stream.on("end", () => done(() => resolve({ kind: "body", body: Buffer.concat(chunks) })));
        stream.on("error", () =>
          done(() => reject(new IcalImportError("network", "We couldn't read your calendar. Please try again.")))
        );
      }
    );

    const timer = setTimeout(() => {
      req.destroy();
      done(() => reject(new IcalImportError("timeout", "Your calendar took too long to respond (over 5 seconds). Please try again.")));
    }, remaining);

    req.on("error", (e: any) => {
      done(() => {
        if (e instanceof IcalImportError) return reject(e);
        const code = String(e?.code || "");
        if (code.startsWith("ERR_TLS") || code.includes("CERT")) {
          return reject(new IcalImportError("network", "That calendar server's security certificate isn't valid, so ÖRZA won't read it."));
        }
        reject(new IcalImportError("network", "We couldn't reach your calendar provider. Check the link and try again."));
      });
    });
    req.end();
  });
}

const tooLarge = () =>
  new IcalImportError("too_large", "That calendar is larger than 2 MB. Publish a smaller calendar (for example your work calendar only) and try again.");

/** Download an ICS document with SSRF guards. Returns the raw bytes. */
export async function fetchCalendarBytes(input: string | URL): Promise<Buffer> {
  let url = typeof input === "string" ? normalizeCalendarUrl(input) : input;
  const deadline = Date.now() + ICAL_TIMEOUT_MS;
  for (let hop = 0; hop <= ICAL_MAX_REDIRECTS; hop++) {
    const addrs = await resolvePublic(url.hostname);
    const res = await fetchHop(url, addrs, deadline);
    if (res.kind === "body") return res.body;
    let next: URL;
    try {
      next = new URL(res.location, url);
    } catch {
      throw new IcalImportError("network", "Your calendar provider sent an invalid redirect.");
    }
    if (next.protocol === "webcal:" || next.protocol === "webcals:") next = new URL(next.href.replace(/^webcals?:/i, "https:"));
    url = normalizeCalendarUrl(next.href);
  }
  throw new IcalImportError("redirects", "That calendar link redirects too many times.");
}

/* ───────────────────────────── Content lines ───────────────────────────── */

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** Undo RFC 5545 line folding on raw bytes (so a UTF-8 character split across a fold is rejoined), then decode. */
export function unfoldIcs(bytes: Buffer | string): string {
  const latin = typeof bytes === "string" ? Buffer.from(bytes, "utf8").toString("latin1") : bytes.toString("latin1");
  const unfolded = latin.replace(/\r\n[ \t]|\n[ \t]|\r[ \t]/g, "");
  let text = Buffer.from(unfolded, "latin1").toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
}

function splitOutsideQuotes(s: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (const ch of s) {
    if (ch === '"') quoted = !quoted;
    if (ch === sep && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseProp(line: string): Prop | null {
  let quoted = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') quoted = !quoted;
    else if (ch === ":" && !quoted) {
      colon = i;
      break;
    }
  }
  if (colon <= 0) return null;
  const [rawName, ...rawParams] = splitOutsideQuotes(line.slice(0, colon), ";");
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).trim().toUpperCase()] = p.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
  }
  return { name: rawName.trim().toUpperCase(), params, value: line.slice(colon + 1) };
}

/** Undo TEXT escaping: \n \N \, \; \\ */
export function unescapeText(v: string): string {
  return v.replace(/\\([\\;,nN])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));
}

/* ───────────────────────────── Time zones ───────────────────────────── */

/** Common Windows (Outlook / Exchange) zone names → IANA. */
const WINDOWS_ZONES: Record<string, string> = {
  "India Standard Time": "Asia/Kolkata",
  "Sri Lanka Standard Time": "Asia/Colombo",
  "Nepal Standard Time": "Asia/Kathmandu",
  "Bangladesh Standard Time": "Asia/Dhaka",
  "Pakistan Standard Time": "Asia/Karachi",
  "Myanmar Standard Time": "Asia/Yangon",
  "Afghanistan Standard Time": "Asia/Kabul",
  "West Asia Standard Time": "Asia/Tashkent",
  "Arabian Standard Time": "Asia/Dubai",
  "Arab Standard Time": "Asia/Riyadh",
  "Arabic Standard Time": "Asia/Baghdad",
  "Iran Standard Time": "Asia/Tehran",
  "Israel Standard Time": "Asia/Jerusalem",
  "Turkey Standard Time": "Europe/Istanbul",
  "SE Asia Standard Time": "Asia/Bangkok",
  "Singapore Standard Time": "Asia/Singapore",
  "China Standard Time": "Asia/Shanghai",
  "Taipei Standard Time": "Asia/Taipei",
  "Tokyo Standard Time": "Asia/Tokyo",
  "Korea Standard Time": "Asia/Seoul",
  "W. Australia Standard Time": "Australia/Perth",
  "Cen. Australia Standard Time": "Australia/Adelaide",
  "AUS Central Standard Time": "Australia/Darwin",
  "E. Australia Standard Time": "Australia/Brisbane",
  "AUS Eastern Standard Time": "Australia/Sydney",
  "New Zealand Standard Time": "Pacific/Auckland",
  "GMT Standard Time": "Europe/London",
  "Greenwich Standard Time": "Atlantic/Reykjavik",
  "W. Europe Standard Time": "Europe/Berlin",
  "Romance Standard Time": "Europe/Paris",
  "Central Europe Standard Time": "Europe/Budapest",
  "Central European Standard Time": "Europe/Warsaw",
  "E. Europe Standard Time": "Europe/Chisinau",
  "FLE Standard Time": "Europe/Helsinki",
  "GTB Standard Time": "Europe/Bucharest",
  "Russian Standard Time": "Europe/Moscow",
  "South Africa Standard Time": "Africa/Johannesburg",
  "Egypt Standard Time": "Africa/Cairo",
  "E. Africa Standard Time": "Africa/Nairobi",
  "W. Central Africa Standard Time": "Africa/Lagos",
  "Eastern Standard Time": "America/New_York",
  "Central Standard Time": "America/Chicago",
  "Mountain Standard Time": "America/Denver",
  "US Mountain Standard Time": "America/Phoenix",
  "Pacific Standard Time": "America/Los_Angeles",
  "Alaskan Standard Time": "America/Anchorage",
  "Hawaiian Standard Time": "Pacific/Honolulu",
  "Atlantic Standard Time": "America/Halifax",
  "Canada Central Standard Time": "America/Regina",
  "Central Standard Time (Mexico)": "America/Mexico_City",
  "SA Pacific Standard Time": "America/Bogota",
  "E. South America Standard Time": "America/Sao_Paulo",
  "Argentina Standard Time": "America/Argentina/Buenos_Aires",
  "UTC": "UTC",
  "Coordinated Universal Time": "UTC",
};

/** Resolved time reference for a local date-time: an IANA zone, a fixed offset (minutes east of UTC), or floating. */
type TzRef = { iana: string } | { offset: number } | { floating: true };

const zoneValidity = new Map<string, boolean>();
function isValidZone(tz: string): boolean {
  const hit = zoneValidity.get(tz);
  if (hit !== undefined) return hit;
  let ok = false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    ok = true;
  } catch {
    ok = false;
  }
  if (zoneValidity.size < 500) zoneValidity.set(tz, ok);
  return ok;
}

function parseOffset(v: string): number | null {
  const m = /^([+-])(\d{2}):?(\d{2})(?::?\d{2})?$/.exec(v.trim());
  if (!m) return null;
  const mins = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === "-" ? -mins : mins;
}

/** Map a TZID to something we can compute with; unknown zones fall back to floating (the user's zone). */
export function resolveTzid(tzid: string, vtimezones?: Map<string, { offset: number | null }>): TzRef {
  const raw = tzid.trim();
  if (!raw) return { floating: true };
  if (isValidZone(raw)) return { iana: raw };
  const win = WINDOWS_ZONES[raw];
  if (win && isValidZone(win)) return { iana: win };
  // "/mozilla.org/20050126_1/Asia/Kolkata", "/Asia/Kolkata"
  const tailZone = /([A-Za-z_]+\/[A-Za-z_+\-]+(?:\/[A-Za-z_+\-]+)?)$/.exec(raw)?.[1];
  if (tailZone && isValidZone(tailZone)) return { iana: tailZone };
  // "(UTC+05:30) Chennai, Kolkata, Mumbai, New Delhi" / "(GMT-05:00) Eastern Time"
  const label = /\((?:UTC|GMT)\s*(?:([+-]\d{1,2}):?(\d{2}))?\)/i.exec(raw);
  if (label) {
    if (!label[1]) return { offset: 0 };
    const h = Number(label[1]);
    const mins = Math.abs(h) * 60 + Number(label[2] || 0);
    return { offset: h < 0 || label[1].startsWith("-") ? -mins : mins };
  }
  const vtz = vtimezones?.get(raw);
  if (vtz && vtz.offset !== null) return { offset: vtz.offset };
  return { floating: true };
}

/* ───────────────────────────── Date values ───────────────────────────── */

interface Wall {
  date: string; // YYYY-MM-DD
  h: number;
  m: number;
  s: number;
}

type DateValue = { kind: "date"; date: string } | { kind: "utc"; wall: Wall } | { kind: "local"; wall: Wall; tz: TzRef };

function parseDateValue(raw: string, params: Record<string, string>, vtimezones: Map<string, { offset: number | null }>): DateValue | null {
  const v = raw.trim();
  const d = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (d || params.VALUE === "DATE") {
    const m = d || /^(\d{4})(\d{2})(\d{2})/.exec(v);
    if (!m) return null;
    const date = `${m[1]}-${m[2]}-${m[3]}`;
    return validDate(date) ? { kind: "date", date } : null;
  }
  const t = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/i.exec(v);
  if (!t) return null;
  const date = `${t[1]}-${t[2]}-${t[3]}`;
  if (!validDate(date)) return null;
  const wall: Wall = { date, h: Math.min(23, Number(t[4])), m: Math.min(59, Number(t[5])), s: Math.min(59, Number(t[6] || 0)) };
  if (t[7]) return { kind: "utc", wall };
  return { kind: "local", wall, tz: params.TZID ? resolveTzid(params.TZID, vtimezones) : { floating: true } };
}

function validDate(date: string): boolean {
  const t = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === date;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** UTC instant (ms) of a wall-clock time in a zone reference (floating → `fallbackTz`). */
function wallToMs(w: Wall, tz: TzRef, fallbackTz: string): number {
  if ("offset" in tz) {
    const [y, mo, d] = w.date.split("-").map(Number);
    return Date.UTC(y, mo - 1, d, w.h, w.m, w.s) - tz.offset * 60000;
  }
  const zone = "iana" in tz ? tz.iana : fallbackTz;
  return zonedToUtc(w.date, `${pad2(w.h)}:${pad2(w.m)}`, zone).getTime() + w.s * 1000;
}

function msToLocalDate(ms: number, tz: TzRef, fallbackTz: string): string {
  if ("offset" in tz) return new Date(ms + tz.offset * 60000).toISOString().slice(0, 10);
  return utcToZoned(new Date(ms), "iana" in tz ? tz.iana : fallbackTz).date;
}

/** ms of a DURATION value ("PT1H30M", "P1D", "-PT15M", "P1W"). */
export function parseDuration(v: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(v.trim());
  if (!m || /^[+-]?PT?$/i.test(v.trim())) return null;
  const [, sign, w, d, h, mi, s] = m;
  const secs = ((Number(w || 0) * 7 + Number(d || 0)) * 24 + Number(h || 0)) * 3600 + Number(mi || 0) * 60 + Number(s || 0);
  return (sign === "-" ? -1 : 1) * secs * 1000;
}

/* ───────────────────────────── RRULE ───────────────────────────── */

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

interface RRule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  count?: number;
  until?: DateValue;
  byday?: { n: number; wd: number }[];
  bymonth?: number[];
  bymonthday?: number[];
  wkst: number;
}

/** Parse an RRULE value. Returns null for rules we can't expand faithfully (the first instance is still shown). */
export function parseRRule(value: string, vtimezones: Map<string, { offset: number | null }> = new Map()): RRule | null {
  const parts: Record<string, string> = {};
  for (const kv of value.split(";")) {
    const eq = kv.indexOf("=");
    if (eq > 0) parts[kv.slice(0, eq).trim().toUpperCase()] = kv.slice(eq + 1).trim();
  }
  const freq = (parts.FREQ || "").toUpperCase();
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return null;
  if (parts.BYSETPOS || parts.BYHOUR || parts.BYMINUTE || parts.BYSECOND || parts.BYYEARDAY || parts.BYWEEKNO) return null;
  const interval = Math.max(1, Math.min(1000, Math.floor(Number(parts.INTERVAL || 1)) || 1));
  const rule: RRule = { freq: freq as RRule["freq"], interval, wkst: Math.max(0, WEEKDAYS.indexOf((parts.WKST || "MO").toUpperCase())) };
  if (parts.COUNT) {
    const c = Math.floor(Number(parts.COUNT));
    if (!(c > 0)) return null;
    rule.count = Math.min(c, 100000);
  }
  if (parts.UNTIL) {
    const u = parseDateValue(parts.UNTIL, {}, vtimezones);
    if (!u) return null;
    rule.until = u;
  }
  if (parts.BYDAY) {
    const list = parts.BYDAY.split(",").map((s) => /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/i.exec(s.trim()));
    if (list.some((x) => !x)) return null;
    rule.byday = list.map((x) => ({ n: x![1] ? Number(x![1]) : 0, wd: WEEKDAYS.indexOf(x![2].toUpperCase()) }));
    if (freq === "YEARLY") return null;
  }
  if (parts.BYMONTH) {
    const list = parts.BYMONTH.split(",").map((s) => Number(s));
    if (list.some((n) => !Number.isInteger(n) || n < 1 || n > 12)) return null;
    rule.bymonth = list;
  }
  if (parts.BYMONTHDAY) {
    const list = parts.BYMONTHDAY.split(",").map((s) => Number(s));
    if (list.some((n) => !Number.isInteger(n) || n === 0 || n < -31 || n > 31)) return null;
    rule.bymonthday = list;
  }
  return rule;
}

/* ───────────────────────────── Parsed calendar ───────────────────────────── */

export interface ParsedEvent {
  uid: string;
  title: string;
  location?: string;
  busy: boolean;
  cancelled: boolean;
  allDay: boolean;
  start: DateValue;
  /** Timed events: length in ms. */
  durationMs: number;
  /** All-day events: length in days (≥ 1). */
  durationDays: number;
  rrule: RRule | null;
  /** RRULE present but not expandable — only the first instance is shown. */
  rruleUnsupported: boolean;
  exdates: DateValue[];
  recurrenceId?: DateValue;
}

export interface ParsedCalendar {
  name?: string;
  timezone?: string;
  events: ParsedEvent[];
}

interface RawEvent {
  props: Prop[];
}

/** Parse ICS text (already downloaded) into VEVENTs. Throws `not_ical` if it isn't a calendar. */
export function parseIcs(input: Buffer | string): ParsedCalendar {
  const text = unfoldIcs(input);
  if (!/^\s*BEGIN:VCALENDAR/im.test(text.slice(0, 2048)) && !/BEGIN:VCALENDAR/i.test(text)) {
    throw new IcalImportError(
      "not_ical",
      "That link didn't return a calendar file. Make sure you copied the iCal/ICS address, not the calendar's web page."
    );
  }
  const lines = text.split(/\r\n|\n|\r/);
  const stack: string[] = [];
  const raws: RawEvent[] = [];
  const vtimezones = new Map<string, { offset: number | null }>();
  let cal: ParsedCalendar = { events: [] };
  let current: RawEvent | null = null;
  let tzid: string | null = null;
  let tzOffsets: number[] = [];
  let tzHasDaylight = false;

  for (const line of lines) {
    if (!line) continue;
    const p = parseProp(line);
    if (!p) continue;
    if (p.name === "BEGIN") {
      const comp = p.value.trim().toUpperCase();
      stack.push(comp);
      if (comp === "VEVENT" && stack.length === 2 && raws.length < MAX_VEVENTS) current = { props: [] };
      if (comp === "VTIMEZONE") {
        tzid = null;
        tzOffsets = [];
        tzHasDaylight = false;
      }
      if (comp === "DAYLIGHT" && stack[stack.length - 2] === "VTIMEZONE") tzHasDaylight = true;
      continue;
    }
    if (p.name === "END") {
      const comp = p.value.trim().toUpperCase();
      // Pop to the matching BEGIN (tolerates sloppy nesting).
      const idx = stack.lastIndexOf(comp);
      if (idx >= 0) stack.length = idx;
      if (comp === "VEVENT" && current) {
        raws.push(current);
        current = null;
      }
      if (comp === "VTIMEZONE" && tzid) {
        vtimezones.set(tzid, { offset: !tzHasDaylight && tzOffsets.length ? tzOffsets[0] : null });
      }
      continue;
    }
    const top = stack[stack.length - 1];
    if (top === "VCALENDAR") {
      if (p.name === "X-WR-CALNAME" || (p.name === "NAME" && !cal.name)) cal.name = unescapeText(p.value).trim().slice(0, 120) || cal.name;
      if (p.name === "X-WR-TIMEZONE" && isValidZone(p.value.trim())) cal.timezone = p.value.trim();
    } else if (top === "VEVENT" && current) {
      current.props.push(p);
    } else if (top === "VTIMEZONE" && p.name === "TZID") {
      tzid = p.value.trim();
    } else if ((top === "STANDARD" || top === "DAYLIGHT") && p.name === "TZOFFSETTO") {
      const off = parseOffset(p.value);
      if (off !== null && top === "STANDARD") tzOffsets.push(off);
    }
  }

  cal = { ...cal, events: raws.map((r) => toParsedEvent(r, vtimezones)).filter((e): e is ParsedEvent => !!e) };
  return cal;
}

function toParsedEvent(raw: RawEvent, vtimezones: Map<string, { offset: number | null }>): ParsedEvent | null {
  const get = (name: string) => raw.props.find((p) => p.name === name);
  const dtstartProp = get("DTSTART");
  if (!dtstartProp) return null;
  const start = parseDateValue(dtstartProp.value, dtstartProp.params, vtimezones);
  if (!start) return null;
  const allDay = start.kind === "date";
  const summary = get("SUMMARY");
  const location = get("LOCATION");
  const uidProp = get("UID");
  const status = (get("STATUS")?.value || "").trim().toUpperCase();
  const transp = (get("TRANSP")?.value || "").trim().toUpperCase();
  const title = summary ? unescapeText(summary.value).replace(/\s+/g, " ").trim().slice(0, 200) : "";

  let durationMs = 0;
  let durationDays = 1;
  const dtendProp = get("DTEND");
  const durationProp = get("DURATION");
  const dtend = dtendProp ? parseDateValue(dtendProp.value, dtendProp.params, vtimezones) : null;
  if (allDay) {
    if (dtend && dtend.kind === "date") durationDays = Math.max(1, daysBetween(start.date, dtend.date));
    else if (durationProp) {
      const ms = parseDuration(durationProp.value);
      if (ms && ms > 0) durationDays = Math.max(1, Math.round(ms / 86400000));
    }
  } else if (dtend && dtend.kind !== "date") {
    // Store the difference of the two wall/UTC values; resolved again at expansion time for DST safety.
    durationMs = Math.max(0, wallToMs(dtend.wall, dtend.kind === "utc" ? { offset: 0 } : dtend.tz, DEFAULT_TZ) - wallToMs(start.wall, start.kind === "utc" ? { offset: 0 } : start.tz, DEFAULT_TZ));
  } else if (durationProp) {
    const ms = parseDuration(durationProp.value);
    if (ms && ms > 0) durationMs = ms;
  }
  durationMs = Math.min(durationMs, 60 * 86400000);
  durationDays = Math.min(durationDays, 366);

  const rruleProp = get("RRULE");
  const rrule = rruleProp ? parseRRule(rruleProp.value, vtimezones) : null;

  const exdates: DateValue[] = [];
  for (const p of raw.props.filter((x) => x.name === "EXDATE")) {
    for (const part of p.value.split(",")) {
      const v = parseDateValue(part, p.params, vtimezones);
      if (v) exdates.push(v);
    }
  }
  const ridProp = get("RECURRENCE-ID");
  const recurrenceId = ridProp ? parseDateValue(ridProp.value, ridProp.params, vtimezones) || undefined : undefined;
  const startKey = start.kind === "date" ? start.date : `${start.wall.date}T${pad2(start.wall.h)}${pad2(start.wall.m)}${pad2(start.wall.s)}`;

  return {
    uid: (uidProp?.value || "").trim() || `${title}|${startKey}`,
    title: title || "Busy",
    location: location ? unescapeText(location.value).replace(/\s+/g, " ").trim().slice(0, 200) || undefined : undefined,
    busy: transp !== "TRANSPARENT",
    cancelled: status === "CANCELLED",
    allDay,
    start,
    durationMs,
    durationDays,
    rrule,
    rruleUnsupported: !!rruleProp && !rrule,
    exdates,
    recurrenceId,
  };
}

/* ───────────────────────────── Expansion ───────────────────────────── */

export interface ExternalEvent {
  id: string;
  uid: string;
  title: string;
  location?: string;
  all_day: boolean;
  /** Timed: ISO UTC instant. All-day: "YYYY-MM-DD". */
  start: string;
  /** Timed: ISO UTC instant. All-day: exclusive "YYYY-MM-DD". */
  end: string;
  /** False for events marked "free" (TRANSP:TRANSPARENT). */
  busy: boolean;
}

function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const ymd = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;

function occurrenceId(uid: string, start: string): string {
  return `ext_${createHash("sha1").update(`${uid}\n${start}`).digest("base64url").slice(0, 20)}`;
}

/** Expand parsed events into concrete occurrences overlapping [from, to). `tz` = the user's zone (floating times, all-day days). */
export function expandEvents(cal: ParsedCalendar, from: Date, to: Date, tz: string): ExternalEvent[] {
  const userTz = isValidZone(tz) ? tz : DEFAULT_TZ;
  const floatingTz = cal.timezone || userTz;
  const fromMs = from.getTime();
  const toMs = to.getTime();
  if (!(toMs > fromMs)) return [];

  // Instances replaced (moved / cancelled) by RECURRENCE-ID overrides, per UID.
  const overridden = new Map<string, Set<string>>();
  const refKey = (v: DateValue) =>
    v.kind === "date" ? `d:${v.date}` : `t:${wallToMs(v.wall, v.kind === "utc" ? { offset: 0 } : v.tz, floatingTz)}`;
  for (const e of cal.events) {
    if (!e.recurrenceId) continue;
    const set = overridden.get(e.uid) || new Set<string>();
    set.add(refKey(e.recurrenceId));
    if (e.recurrenceId.kind !== "date") {
      const ms = wallToMs(e.recurrenceId.wall, e.recurrenceId.kind === "utc" ? { offset: 0 } : e.recurrenceId.tz, floatingTz);
      set.add(`d:${utcToZoned(new Date(ms), floatingTz).date}`); // tolerate DATE/DATE-TIME mismatches
    } else set.add(`d:${e.recurrenceId.date}`);
    overridden.set(e.uid, set);
  }

  const out: ExternalEvent[] = [];
  for (const ev of cal.events) {
    if (ev.cancelled) continue;
    if (out.length >= MAX_OUTPUT_EVENTS) break;
    expandOne(ev, ev.recurrenceId ? undefined : overridden.get(ev.uid), fromMs, toMs, userTz, floatingTz, out);
  }
  return out.sort((a, b) => sortKey(a, userTz) - sortKey(b, userTz) || a.title.localeCompare(b.title));
}

function sortKey(e: ExternalEvent, tz: string): number {
  return e.all_day ? zonedToUtc(e.start, "00:00", tz).getTime() : Date.parse(e.start);
}

function expandOne(
  ev: ParsedEvent,
  overridden: Set<string> | undefined,
  fromMs: number,
  toMs: number,
  userTz: string,
  floatingTz: string,
  out: ExternalEvent[]
) {
  const start = ev.start;
  const tz: TzRef = start.kind === "utc" ? { offset: 0 } : start.kind === "local" ? ("floating" in start.tz ? { iana: floatingTz } : start.tz) : { iana: userTz };
  const startDate = start.kind === "date" ? start.date : start.wall.date;
  const wall = start.kind === "date" ? null : start.wall;

  const exMs = new Set<number>();
  const exDays = new Set<string>();
  for (const x of ev.exdates) {
    if (x.kind === "date") exDays.add(x.date);
    else exMs.add(wallToMs(x.wall, x.kind === "utc" ? { offset: 0 } : "floating" in x.tz ? { iana: floatingTz } : x.tz, floatingTz));
  }

  const instantOf = (date: string) => (wall ? wallToMs({ ...wall, date }, tz, floatingTz) : zonedToUtc(date, "00:00", userTz).getTime());

  let emitted = 0;
  /** Returns false when expansion should stop. */
  const emit = (date: string): boolean => {
    const startMs = instantOf(date);
    if (wall) {
      if (exMs.has(startMs) || exDays.has(date)) return true;
      if (overridden && (overridden.has(`t:${startMs}`) || overridden.has(`d:${date}`))) return true;
      const endMs = startMs + ev.durationMs;
      const overlaps = ev.durationMs > 0 ? startMs < toMs && endMs > fromMs : startMs >= fromMs && startMs < toMs;
      if (overlaps) {
        const startIso = new Date(startMs).toISOString();
        out.push({
          id: occurrenceId(ev.uid, startIso),
          uid: ev.uid,
          title: ev.title,
          location: ev.location,
          all_day: false,
          start: startIso,
          end: new Date(endMs).toISOString(),
          busy: ev.busy,
        });
        emitted++;
      }
    } else {
      if (exDays.has(date)) return true;
      if (overridden && (overridden.has(`d:${date}`) || overridden.has(`t:${startMs}`))) return true;
      const endDate = addDays(date, ev.durationDays);
      const endMs = zonedToUtc(endDate, "00:00", userTz).getTime();
      if (startMs < toMs && endMs > fromMs) {
        out.push({ id: occurrenceId(ev.uid, date), uid: ev.uid, title: ev.title, location: ev.location, all_day: true, start: date, end: endDate, busy: ev.busy });
        emitted++;
      }
    }
    return emitted < MAX_OCCURRENCES_PER_EVENT && out.length < MAX_OUTPUT_EVENTS;
  };

  const rule = ev.rrule;
  if (!rule) {
    emit(startDate);
    return;
  }

  // Local-date window (with margin for long events and zone offsets).
  const spanDays = wall ? Math.ceil(ev.durationMs / 86400000) : ev.durationDays;
  const windowStart = addDays(msToLocalDate(fromMs, tz, floatingTz), -(spanDays + 2));
  const windowEnd = addDays(msToLocalDate(toMs, tz, floatingTz), 2);

  let untilMs: number | null = null;
  let untilDate: string | null = null;
  if (rule.until) {
    if (rule.until.kind === "date") untilDate = rule.until.date;
    else untilMs = wallToMs(rule.until.wall, rule.until.kind === "utc" ? { offset: 0 } : "floating" in rule.until.tz ? tz : rule.until.tz, floatingTz);
  }
  const pastUntil = (date: string) => (untilDate !== null ? date > untilDate : untilMs !== null ? instantOf(date) > untilMs : false);

  let counted = 0;
  /** Handle one candidate date (already known to satisfy the rule). Returns false to stop. */
  const candidate = (date: string): boolean => {
    if (date < startDate) return true;
    if (pastUntil(date)) return false;
    counted++;
    if (rule.count && counted > rule.count) return false;
    if (date > windowEnd) return false;
    if (date < windowStart) return true;
    return emit(date);
  };

  const monthOk = (date: string) => !rule.bymonth || rule.bymonth.includes(Number(date.slice(5, 7)));
  const monthDayOk = (date: string) => {
    if (!rule.bymonthday) return true;
    const [y, m, d] = date.split("-").map(Number);
    const dim = daysInMonth(y, m);
    return rule.bymonthday.some((n) => (n > 0 ? n : dim + n + 1) === d);
  };
  const skipAllowed = !rule.count; // COUNT needs every instance from DTSTART

  if (rule.freq === "DAILY") {
    const days = rule.byday?.map((b) => b.wd);
    let k = 0;
    if (skipAllowed) {
      const gap = daysBetween(startDate, windowStart);
      if (gap > 0) k = Math.floor(gap / rule.interval);
    }
    for (let i = 0; i < MAX_RULE_ITERATIONS; i++, k++) {
      const date = addDays(startDate, k * rule.interval);
      if (date > windowEnd && !rule.count) break;
      if (days && !days.includes(weekdayOf(date))) {
        if (date > windowEnd) break;
        continue;
      }
      if (!monthOk(date) || !monthDayOk(date)) {
        if (date > windowEnd) break;
        continue;
      }
      if (!candidate(date)) break;
    }
    return;
  }

  if (rule.freq === "WEEKLY") {
    const startWd = weekdayOf(startDate);
    const weekStart0 = addDays(startDate, -((startWd - rule.wkst + 7) % 7));
    const offsets = [...new Set((rule.byday?.length ? rule.byday.map((b) => b.wd) : [startWd]).map((wd) => (wd - rule.wkst + 7) % 7))].sort((a, b) => a - b);
    let k = 0;
    if (skipAllowed) {
      const gap = daysBetween(weekStart0, windowStart);
      if (gap > 0) k = Math.floor(gap / (7 * rule.interval));
    }
    outer: for (let i = 0; i < MAX_RULE_ITERATIONS; i++, k++) {
      const ws = addDays(weekStart0, k * 7 * rule.interval);
      if (ws > windowEnd) break;
      for (const off of offsets) {
        const date = addDays(ws, off);
        if (!monthOk(date)) continue;
        if (!candidate(date)) break outer;
      }
    }
    return;
  }

  const [sy, sm, sd] = startDate.split("-").map(Number);

  if (rule.freq === "MONTHLY") {
    for (let i = 0, k = 0; i < MAX_RULE_ITERATIONS; i++, k++) {
      const total = sy * 12 + (sm - 1) + k * rule.interval;
      const y = Math.floor(total / 12);
      const m = (total % 12) + 1;
      if (ymd(y, m, 1) > windowEnd) break;
      if (rule.bymonth && !rule.bymonth.includes(m)) continue;
      const dim = daysInMonth(y, m);
      let days: number[];
      if (rule.byday?.length) {
        const set = new Set<number>();
        for (const { n, wd } of rule.byday) {
          const firstWd = weekdayOf(ymd(y, m, 1));
          const all: number[] = [];
          for (let d = 1 + ((wd - firstWd + 7) % 7); d <= dim; d += 7) all.push(d);
          if (n === 0) all.forEach((d) => set.add(d));
          else {
            const pick = n > 0 ? all[n - 1] : all[all.length + n];
            if (pick) set.add(pick);
          }
        }
        days = [...set];
        if (rule.bymonthday) days = days.filter((d) => rule.bymonthday!.some((n) => (n > 0 ? n : dim + n + 1) === d));
      } else {
        days = (rule.bymonthday || [sd]).map((n) => (n > 0 ? n : dim + n + 1)).filter((d) => d >= 1 && d <= dim);
      }
      let stop = false;
      for (const d of [...new Set(days)].sort((a, b) => a - b)) {
        if (!candidate(ymd(y, m, d))) {
          stop = true;
          break;
        }
      }
      if (stop) break;
    }
    return;
  }

  // YEARLY (no BYDAY)
  const months = rule.bymonth || [sm];
  for (let i = 0, k = 0; i < MAX_RULE_ITERATIONS; i++, k++) {
    const y = sy + k * rule.interval;
    if (ymd(y, 1, 1) > windowEnd) break;
    let stop = false;
    for (const m of [...new Set(months)].sort((a, b) => a - b)) {
      const dim = daysInMonth(y, m);
      const days = (rule.bymonthday || [sd]).map((n) => (n > 0 ? n : dim + n + 1)).filter((d) => d >= 1 && d <= dim);
      for (const d of [...new Set(days)].sort((a, b) => a - b)) {
        if (!candidate(ymd(y, m, d))) {
          stop = true;
          break;
        }
      }
      if (stop) break;
    }
    if (stop) break;
  }
}

/* ───────────────────────────── Cached entry point ───────────────────────────── */

type CacheEntry = { at: number; ttl: number; promise: Promise<ParsedCalendar> };
const g = globalThis as typeof globalThis & { __orzaIcalCache?: Map<string, CacheEntry> };
const cache: Map<string, CacheEntry> = (g.__orzaIcalCache ??= new Map());

const cacheKey = (userId: string, url: string) => `${userId}\n${url}`;

/** Fetch + parse a calendar, served from a 10-minute in-memory cache per user + URL (failures are cached for 2 minutes). */
export async function loadExternalCalendar(url: string, opts: { userId?: string; fresh?: boolean } = {}): Promise<ParsedCalendar> {
  const normalized = normalizeCalendarUrl(url).href;
  const key = cacheKey(opts.userId || "-", normalized);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && !opts.fresh && now - hit.at < hit.ttl) return hit.promise;

  const promise = fetchCalendarBytes(normalized).then(parseIcs);
  const entry: CacheEntry = { at: now, ttl: ICAL_CACHE_TTL_MS, promise };
  cache.set(key, entry);
  promise.catch(() => {
    if (cache.get(key) === entry) entry.ttl = ERROR_CACHE_TTL_MS;
  });
  if (cache.size > MAX_CACHE_ENTRIES) {
    for (const [k, v] of cache) {
      if (now - v.at >= v.ttl || cache.size > MAX_CACHE_ENTRIES) cache.delete(k);
      if (cache.size <= MAX_CACHE_ENTRIES * 0.8) break;
    }
  }
  return promise;
}

/** Forget cached calendars for a user (after they change or remove the link). */
export function clearExternalCache(userId: string) {
  for (const k of cache.keys()) if (k.startsWith(`${userId}\n`)) cache.delete(k);
}

/**
 * Events from the user's external calendar that overlap [from, to), expanded and converted to UTC
 * (all-day events keep their dates). `tz` is the user's zone for floating times and all-day days.
 */
export async function fetchExternalEvents(url: string, from: Date, to: Date, tz: string, userId?: string): Promise<ExternalEvent[]> {
  const cal = await loadExternalCalendar(url, { userId });
  return expandEvents(cal, from, to, tz);
}

/** Friendly provider name for a calendar link. */
export function calendarProvider(url: string): "google" | "apple" | "outlook" | "other" {
  let host = "";
  try {
    host = new URL(url.replace(/^webcals?:\/\//i, "https://")).hostname.toLowerCase();
  } catch {
    return "other";
  }
  if (host === "calendar.google.com" || host.endsWith(".google.com") || host.endsWith(".googleusercontent.com")) return "google";
  if (host.endsWith("icloud.com") || host.endsWith(".me.com") || host.endsWith(".mac.com")) return "apple";
  if (host.includes("outlook") || host.endsWith("office365.com") || host.endsWith("office.com") || host.endsWith("live.com") || host.endsWith("hotmail.com")) return "outlook";
  return "other";
}
