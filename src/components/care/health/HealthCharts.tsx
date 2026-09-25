"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/orza/primitives";
import { formatDay } from "./format";

/** One slot per calendar day of the range; `value` is undefined when there's no data for that day. */
export interface ChartPoint {
  date: string;
  value: number | undefined;
}

/* ───────────────────────────── helpers ───────────────────────────── */

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = React.useRef<T | null>(null);
  const [width, setWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** "Nice" axis ticks covering [min, max] (1 / 2 / 2.5 / 5 × 10^n steps). */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (max === min) {
    const pad = Math.abs(max) > 0 ? Math.abs(max) * 0.1 : 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

const compact = (v: number) => (Math.abs(v) >= 10_000 ? `${Math.round(v / 1000)}k` : Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(v));

/** Evenly spaced label indexes (first and last always included). */
function labelIndexes(n: number, width: number): number[] {
  const slots = Math.max(2, Math.min(6, Math.floor(width / 72)));
  if (n <= slots) return Array.from({ length: n }, (_, i) => i);
  const out = new Set<number>();
  for (let i = 0; i < slots; i++) out.add(Math.round((i * (n - 1)) / (slots - 1)));
  return [...out];
}

const M = { top: 14, right: 10, bottom: 26, left: 40 };
const HEIGHT = 190;

type Tone = "energy" | "violet" | "coral" | "cyan";
const TONE: Record<Tone, { solid: string; soft: string }> = {
  energy: { solid: "#FF7A6A", soft: "rgba(255,122,106,0.35)" },
  violet: { solid: "#8757F2", soft: "rgba(135,87,242,0.32)" },
  coral: { solid: "#E0593F", soft: "rgba(224,89,63,0.18)" },
  cyan: { solid: "#0B8FA6", soft: "rgba(11,143,166,0.18)" },
};

/** Keyboard + pointer selection shared by the charts. */
function useActiveIndex(points: ChartPoint[], plotLeft: number, band: number) {
  const [active, setActive] = React.useState<number | null>(null);
  const lastWithData = React.useMemo(() => {
    for (let i = points.length - 1; i >= 0; i--) if (points[i].value !== undefined) return i;
    return points.length - 1;
  }, [points]);
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - rect.left - plotLeft) / band);
    setActive(Math.max(0, Math.min(points.length - 1, i)));
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const cur = active ?? lastWithData;
    let next = cur;
    if (e.key === "ArrowLeft") next = Math.max(0, cur - 1);
    else if (e.key === "ArrowRight") next = Math.min(points.length - 1, cur + 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = points.length - 1;
    else if (e.key === "Escape") return setActive(null);
    else return;
    e.preventDefault();
    setActive(next);
  };
  return {
    active,
    handlers: {
      onPointerMove,
      // Touch screens: a tap selects the day under the finger.
      onPointerDown: onPointerMove,
      onPointerLeave: (e: React.PointerEvent<SVGSVGElement>) => {
        if (e.pointerType === "mouse") setActive(null);
      },
    },
    focusHandlers: {
      onKeyDown,
      onFocus: () => setActive((a) => a ?? lastWithData),
      onBlur: () => setActive(null),
    },
  };
}

function Tooltip({ x, width, children }: { x: number; width: number; children: React.ReactNode }) {
  const left = Math.max(70, Math.min(width - 70, x));
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute top-0 z-10 min-w-[120px] -translate-x-1/2 rounded-orza-sm border border-[rgba(20,20,20,0.10)] bg-white/95 px-3 py-2 text-center shadow-orza-floating backdrop-blur-orza"
      style={{ left }}
    >
      {children}
    </div>
  );
}

function SrTable({ caption, points, format }: { caption: string; points: ChartPoint[]; format: (v: number) => string }) {
  const rows = points.filter((p) => p.value !== undefined);
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.date}>
            <td>{formatDay(p.date, true)}</td>
            <td>{format(p.value as number)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Axes({ ticks, y, width, points, band, left }: { ticks: number[]; y: (v: number) => number; width: number; points: ChartPoint[]; band: number; left: number }) {
  return (
    <g aria-hidden>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="rgba(20,20,20,0.08)" strokeWidth={1} shapeRendering="crispEdges" />
          <text x={left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-orza-subtle text-[10.5px] tabular-nums">
            {compact(t)}
          </text>
        </g>
      ))}
      {labelIndexes(points.length, width).map((i) => (
        <text
          key={i}
          x={left + band * i + band / 2}
          y={HEIGHT - 8}
          textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
          className="fill-orza-subtle text-[10.5px]"
        >
          {formatDay(points[i].date)}
        </text>
      ))}
    </g>
  );
}

/* ───────────────────────────── bar chart ───────────────────────────── */

export function BarChart({
  points,
  tone,
  format,
  label,
  reference,
  unitNote,
}: {
  points: ChartPoint[];
  tone: "energy" | "violet";
  format: (v: number) => string;
  /** Accessible name, e.g. "Daily steps, last 30 days". */
  label: string;
  /** Horizontal guide (target / recommendation); bars that reach it are drawn at full strength. */
  reference?: { value: number; label: string };
  /** Tooltip line under the value, e.g. "Target reached". */
  unitNote?: (v: number) => string | null;
}) {
  const gradId = React.useId().replace(/:/g, "");
  const [ref, width] = useWidth<HTMLDivElement>();
  const n = Math.max(1, points.length);
  const plotW = Math.max(10, width - M.left - M.right);
  const band = plotW / n;
  const barW = Math.max(2, Math.min(24, band - 2));
  const values = points.map((p) => p.value ?? 0);
  const maxV = Math.max(1, ...values, reference ? reference.value * 1.08 : 0);
  const ticks = niceTicks(0, maxV, 4);
  const top = ticks[ticks.length - 1];
  const plotH = HEIGHT - M.top - M.bottom;
  const y = (v: number) => M.top + plotH - (v / top) * plotH;
  const { active, handlers, focusHandlers } = useActiveIndex(points, M.left, band);
  const colors = TONE[tone];

  const barPath = (i: number, v: number) => {
    const x = M.left + band * i + (band - barW) / 2;
    const h = Math.max(1.5, M.top + plotH - y(v));
    const r = Math.min(4, barW / 2, h);
    const yTop = M.top + plotH - h;
    const base = M.top + plotH;
    return `M${x},${base}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + barW - r}Q${x + barW},${yTop} ${x + barW},${yTop + r}V${base}Z`;
  };

  const activePoint = active != null ? points[active] : null;
  return (
    <div ref={ref} className="relative">
      <div
        tabIndex={0}
        role="group"
        aria-label={`${label}. Use the left and right arrow keys to read each day.`}
        className="rounded-orza-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan/50"
        {...focusHandlers}
      >
        {width > 0 && (
          <svg width={width} height={HEIGHT} className="block touch-pan-y select-none" aria-hidden {...handlers}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
                {tone === "energy" ? (
                  <>
                    <stop offset="0%" stopColor="#FFB454" />
                    <stop offset="55%" stopColor="#FF7A6A" />
                    <stop offset="100%" stopColor="#FF5FA2" />
                  </>
                ) : (
                  <>
                    <stop offset="0%" stopColor="#BFA8FF" />
                    <stop offset="100%" stopColor="#8757F2" />
                  </>
                )}
              </linearGradient>
            </defs>
            <Axes ticks={ticks} y={y} width={width} points={points} band={band} left={M.left} />
            {active != null && <rect x={M.left + band * active} y={M.top} width={band} height={plotH} fill="rgba(20,20,20,0.04)" />}
            {points.map((p, i) =>
              p.value === undefined || p.value <= 0 ? null : (
                <path
                  key={p.date}
                  d={barPath(i, p.value)}
                  fill={`url(#${gradId})`}
                  opacity={reference && p.value < reference.value ? 0.45 : active === i || active == null ? 1 : 0.8}
                />
              )
            )}
            {reference && (
              <g>
                <line
                  x1={M.left}
                  x2={width - M.right}
                  y1={y(reference.value)}
                  y2={y(reference.value)}
                  stroke={colors.solid}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text x={width - M.right} y={y(reference.value) - 5} textAnchor="end" className="fill-orza-muted text-[10.5px] font-medium">
                  {reference.label}
                </text>
              </g>
            )}
          </svg>
        )}
        {width === 0 && <div style={{ height: HEIGHT }} />}
      </div>
      {activePoint && active != null && (
        <Tooltip x={M.left + band * active + band / 2} width={width}>
          <div className="text-[15px] font-semibold tabular-nums text-orza-strong">{activePoint.value !== undefined ? format(activePoint.value) : "No data"}</div>
          <div className="text-[11px] text-orza-muted">{formatDay(activePoint.date, true)}</div>
          {activePoint.value !== undefined && unitNote?.(activePoint.value) && <div className="mt-0.5 text-[11px] text-orza-muted">{unitNote(activePoint.value)}</div>}
        </Tooltip>
      )}
      <SrTable caption={label} points={points} format={format} />
    </div>
  );
}

/* ───────────────────────────── line chart ───────────────────────────── */

export function LineChart({
  points,
  tone,
  format,
  label,
  minSpan = 4,
}: {
  points: ChartPoint[];
  tone: "coral" | "cyan";
  format: (v: number) => string;
  label: string;
  /** Smallest y-range shown, so a flat week doesn't look like a cliff. */
  minSpan?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const n = Math.max(1, points.length);
  const plotW = Math.max(10, width - M.left - M.right);
  const band = plotW / n;
  const defined = points.map((p, i) => ({ i, v: p.value })).filter((p): p is { i: number; v: number } => p.v !== undefined);
  const vals = defined.map((d) => d.v);
  let lo = vals.length ? Math.min(...vals) : 0;
  let hi = vals.length ? Math.max(...vals) : 1;
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  const ticks = niceTicks(lo, hi, 4);
  const t0 = ticks[0];
  const t1 = ticks[ticks.length - 1];
  const plotH = HEIGHT - M.top - M.bottom;
  const y = (v: number) => M.top + plotH - ((v - t0) / (t1 - t0 || 1)) * plotH;
  const x = (i: number) => M.left + band * i + band / 2;
  const { active, handlers, focusHandlers } = useActiveIndex(points, M.left, band);
  const colors = TONE[tone];
  const path = defined.map((d, k) => `${k ? "L" : "M"}${x(d.i).toFixed(1)},${y(d.v).toFixed(1)}`).join("");
  const showAllMarkers = defined.length <= 31;
  const activePoint = active != null ? points[active] : null;

  return (
    <div ref={ref} className="relative">
      <div
        tabIndex={0}
        role="group"
        aria-label={`${label}. Use the left and right arrow keys to read each day.`}
        className="rounded-orza-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan/50"
        {...focusHandlers}
      >
        {width > 0 && (
          <svg width={width} height={HEIGHT} className="block touch-pan-y select-none" aria-hidden {...handlers}>
            <Axes ticks={ticks} y={y} width={width} points={points} band={band} left={M.left} />
            {active != null && <line x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + plotH} stroke="rgba(20,20,20,0.18)" strokeWidth={1} />}
            {defined.length > 1 && <path d={path} fill="none" stroke={colors.solid} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
            {defined.map((d, k) =>
              showAllMarkers || k === defined.length - 1 || active === d.i ? (
                <circle key={d.i} cx={x(d.i)} cy={y(d.v)} r={active === d.i ? 5 : 4} fill={colors.solid} stroke="#FFFFFF" strokeWidth={2} />
              ) : null
            )}
          </svg>
        )}
        {width === 0 && <div style={{ height: HEIGHT }} />}
      </div>
      {activePoint && active != null && (
        <Tooltip x={x(active)} width={width}>
          <div className="text-[15px] font-semibold tabular-nums text-orza-strong">{activePoint.value !== undefined ? format(activePoint.value) : "No reading"}</div>
          <div className="text-[11px] text-orza-muted">{formatDay(activePoint.date, true)}</div>
        </Tooltip>
      )}
      <SrTable caption={label} points={points} format={format} />
    </div>
  );
}

/* ───────────────────────────── card ───────────────────────────── */

export function ChartCard({
  title,
  subtitle,
  headline,
  headlineNote,
  empty,
  emptyText,
  dimmed,
  children,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  headline?: React.ReactNode;
  headlineNote?: React.ReactNode;
  empty?: boolean;
  emptyText?: string;
  /** Previous render held at reduced opacity while a new range loads. */
  dimmed?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <GlassCard className={cn("flex flex-col", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-editorial text-[18px] font-semibold leading-6 text-orza-strong">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[12.5px] leading-5 text-orza-muted">{subtitle}</p>}
        </div>
        {headline != null && !empty && (
          <div className="shrink-0 text-right">
            <div className="text-[20px] font-semibold leading-6 tabular-nums text-orza-strong">{headline}</div>
            {headlineNote && <div className="text-[11px] text-orza-subtle">{headlineNote}</div>}
          </div>
        )}
      </div>
      <div className={cn("transition-opacity duration-220", dimmed && "opacity-50")}>
        {empty ? (
          <div className="flex h-[190px] items-center justify-center rounded-orza-sm border border-dashed border-[rgba(20,20,20,0.12)] bg-white/30 px-6 text-center text-[13px] text-orza-muted">
            {emptyText || "No data in this period yet."}
          </div>
        ) : (
          children
        )}
      </div>
    </GlassCard>
  );
}
