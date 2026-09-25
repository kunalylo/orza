"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { KG_PER_LB, daysBetween, formatDayDate, formatShortDate, kgToUnit, weightUnit } from "@/components/goals/goal-math";
import type { WeightPoint } from "@/components/goals/types";

const M = { top: 18, right: 60, bottom: 30, left: 40 };
const AXIS = "#7A7A7A";
const GRID = "rgba(20,20,20,0.07)";
const TARGET = "#0BBEDC";

function useWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => setWidth(Math.round(entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Clean y-axis ticks (0.5 / 1 / 2 / 5 / 10 / 20 steps, in the display unit). */
function yScaleFor(values: number[]) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max(0.5, (hi - lo) * 0.15);
  const span = hi - lo + pad * 2;
  const step = [0.5, 1, 2, 5, 10, 20].find((s) => span / s <= 4) ?? 20;
  const min = Math.floor((lo - pad) / step) * step;
  const max = Math.ceil((hi + pad) / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 10) / 10);
  return { min, max, ticks };
}

/** "70.4 kg" / "155.2 lb" for a value already in the display unit. */
const labelFor = (imperial: boolean) => (n: number) => `${n.toLocaleString("en-IN", { maximumFractionDigits: 1 })} ${weightUnit(imperial)}`;

/** Signed change between two display values, e.g. "+0.4" / "−1.2" / "0". */
const signed = (d: number) => (d === 0 ? "0" : `${d > 0 ? "+" : "−"}${Math.abs(d)}`);

/**
 * Weight trend line (single series): 2px energy-gradient line with a soft wash,
 * target reference line, end label, and a crosshair + tooltip on hover/keyboard.
 */
export function WeightChart({
  points: kgPoints,
  target: targetKg,
  imperial = false,
  height = 230,
  className,
}: {
  points: WeightPoint[];
  target?: number | null;
  /** Show weights in lb (Settings → Units). Points and target are always kg. */
  imperial?: boolean;
  height?: number;
  className?: string;
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = React.useState<number | null>(null);
  const gid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const kg = labelFor(imperial);
  const unit = weightUnit(imperial);
  // Plot in the display unit so ticks, labels and deltas read naturally (lb or kg).
  const points = React.useMemo(() => kgPoints.map((p) => ({ date: p.date, weight_kg: kgToUnit(p.weight_kg, imperial) })), [kgPoints, imperial]);
  const target = targetKg != null ? kgToUnit(targetKg, imperial) : null;
  const n = points.length;
  const first = points[0]?.date;
  const last = points[n - 1]?.date;
  const spanDays = n > 1 ? Math.max(1, daysBetween(first, last)) : 1;

  // Include the target in the y-domain only when it's close enough not to flatten the trend.
  const values = points.map((p) => p.weight_kg);
  const dataLo = Math.min(...values);
  const dataHi = Math.max(...values);
  const near = imperial ? 6 / KG_PER_LB : 6;
  const targetInView = target != null && n > 0 && target >= dataLo - near && target <= dataHi + near;
  const y = yScaleFor(targetInView ? [...values, target as number] : values);

  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = height - M.top - M.bottom;
  const xAt = (date: string) => (n > 1 ? M.left + (daysBetween(first, date) / spanDays) * innerW : M.left + innerW / 2);
  const yAt = (v: number) => M.top + (1 - (v - y.min) / (y.max - y.min || 1)) * innerH;

  const coords = points.map((p) => ({ x: xAt(p.date), y: yAt(p.weight_kg), p }));
  const line = coords.map((c, i) => `${i ? "L" : "M"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = n > 1 ? `${line} L${coords[n - 1].x.toFixed(1)},${M.top + innerH} L${coords[0].x.toFixed(1)},${M.top + innerH} Z` : "";

  const xTicks = n > 1 ? (width > 460 ? [0, Math.floor((n - 1) / 2), n - 1] : [0, n - 1]).filter((v, i, a) => a.indexOf(v) === i) : [0];

  const nearest = (clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left;
    let best = 0;
    let dist = Infinity;
    coords.forEach((c, i) => {
      const d = Math.abs(c.x - x);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    return best;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!n) return;
    const cur = active ?? n - 1;
    let next = cur;
    if (e.key === "ArrowLeft") next = Math.max(0, cur - 1);
    else if (e.key === "ArrowRight") next = Math.min(n - 1, cur + 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else if (e.key === "Escape") return setActive(null);
    else return;
    e.preventDefault();
    setActive(next);
  };

  const a = active != null ? coords[active] : null;
  const prev = active != null && active > 0 ? points[active - 1] : null;
  const delta = a && prev ? Math.round((a.p.weight_kg - prev.weight_kg) * 10) / 10 : null;
  const end = coords[n - 1];

  return (
    <div
      ref={wrapRef}
      className={cn("relative select-none rounded-orza-sm outline-none", className)}
      style={{ height }}
      tabIndex={n ? 0 : -1}
      role="group"
      aria-label={`Weight trend chart with ${n} weigh-in${n === 1 ? "" : "s"}. Use the left and right arrow keys to move between them.`}
      onKeyDown={onKeyDown}
      onFocus={() => n && active == null && setActive(n - 1)}
      onBlur={() => setActive(null)}
    >
      {width > 0 && n > 0 && (
        <svg width={width} height={height} className="block overflow-visible" aria-hidden>
          <defs>
            <linearGradient id={`${gid}-line`} gradientUnits="userSpaceOnUse" x1={M.left} y1="0" x2={M.left + innerW} y2="0">
              <stop offset="0%" stopColor="#FFB454" />
              <stop offset="55%" stopColor="#FF7A6A" />
              <stop offset="100%" stopColor="#FF5FA2" />
            </linearGradient>
            <linearGradient id={`${gid}-wash`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF7A6A" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#FF7A6A" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* grid + y ticks */}
          {y.ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={M.left + innerW} y1={yAt(t)} y2={yAt(t)} stroke={GRID} strokeWidth={1} />
              <text x={M.left - 8} y={yAt(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS} style={{ fontVariantNumeric: "tabular-nums" }}>
                {t}
              </text>
            </g>
          ))}

          {/* x ticks */}
          {xTicks.map((i) => (
            <text
              key={i}
              x={coords[i].x}
              y={height - 8}
              textAnchor={n === 1 ? "middle" : i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              fontSize={11}
              fill={AXIS}
            >
              {formatShortDate(points[i].date)}
            </text>
          ))}

          {/* target reference */}
          {targetInView && (
            <g>
              <line x1={M.left} x2={M.left + innerW} y1={yAt(target as number)} y2={yAt(target as number)} stroke={TARGET} strokeOpacity={0.7} strokeWidth={1} />
              <text
                x={M.left + innerW + 6}
                y={yAt(target as number) + (Math.abs(yAt(target as number) - (end.y - 10)) < 14 ? 14 : 0)}
                dy="0.32em"
                fontSize={11}
                fill="#0A6F82"
              >
                Target
              </text>
            </g>
          )}

          {n > 1 && <path d={area} fill={`url(#${gid}-wash)`} />}
          {n > 1 && <path d={line} fill="none" stroke={`url(#${gid}-line)`} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}

          {/* end marker + label */}
          <circle cx={end.x} cy={end.y} r={5} fill="#FF7A6A" stroke="#FFFFFF" strokeWidth={2} />
          {(!a || active !== n - 1) && (
            <text x={Math.min(end.x + 9, width - 4)} y={end.y - 10} textAnchor={end.x + 60 > width ? "end" : "start"} fontSize={12} fontWeight={600} fill="#141414">
              {kg(end.p.weight_kg)}
            </text>
          )}

          {/* crosshair */}
          {a && (
            <g>
              <line x1={a.x} x2={a.x} y1={M.top} y2={M.top + innerH} stroke="rgba(20,20,20,0.22)" strokeWidth={1} />
              <circle cx={a.x} cy={a.y} r={5.5} fill="#FF7A6A" stroke="#FFFFFF" strokeWidth={2} />
            </g>
          )}

          {/* hit layer */}
          <rect
            x={M.left - 8}
            y={M.top}
            width={innerW + 16}
            height={innerH}
            fill="transparent"
            onPointerMove={(e) => setActive(nearest(e.clientX, (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()))}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
      )}

      {/* tooltip */}
      {a && width > 0 && (
        <div
          className="pointer-events-none absolute z-10 min-w-[120px] -translate-x-1/2 rounded-orza-sm border border-[rgba(20,20,20,0.10)] bg-white/95 px-3 py-2 shadow-orza-floating backdrop-blur-orza"
          style={{ left: Math.min(Math.max(a.x, 70), width - 70), top: Math.max(0, a.y - 70) }}
        >
          <div className="text-[15px] font-semibold text-orza-strong">{kg(a.p.weight_kg)}</div>
          <div className="text-[12px] text-orza-muted">{formatDayDate(a.p.date)}</div>
          {delta != null && (
            <div className="mt-0.5 text-[11px] text-orza-subtle tabular-nums">
              {delta === 0 ? "Same as previous weigh-in" : `${signed(delta)} ${unit} since previous`}
            </div>
          )}
        </div>
      )}

      <div aria-live="polite" className="sr-only">
        {a ? `${kg(a.p.weight_kg)} on ${formatDayDate(a.p.date)}` : ""}
      </div>
    </div>
  );
}

/** Accessible table view of the same weigh-ins (newest first). */
export function WeightTable({ points, imperial = false }: { points: WeightPoint[]; imperial?: boolean }) {
  const kg = labelFor(imperial);
  const rows = points.map((p) => ({ date: p.date, weight_kg: kgToUnit(p.weight_kg, imperial) })).reverse();
  return (
    <div className="max-h-[230px] overflow-y-auto rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/50">
      <table className="w-full text-left text-[13px]">
        <caption className="sr-only">Weigh-ins, newest first</caption>
        <thead className="sticky top-0 bg-orza-bg-1/95 backdrop-blur-orza">
          <tr>
            <th scope="col" className="px-4 py-2 font-mono text-[11px] font-normal uppercase tracking-[0.14em] text-orza-subtle">Date</th>
            <th scope="col" className="px-4 py-2 text-right font-mono text-[11px] font-normal uppercase tracking-[0.14em] text-orza-subtle">Weight</th>
            <th scope="col" className="px-4 py-2 text-right font-mono text-[11px] font-normal uppercase tracking-[0.14em] text-orza-subtle">Change ({weightUnit(imperial)})</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const older = rows[i + 1];
            const d = older ? Math.round((r.weight_kg - older.weight_kg) * 10) / 10 : null;
            return (
              <tr key={r.date} className="border-t border-[rgba(20,20,20,0.06)]">
                <td className="px-4 py-2 text-orza-strong">{formatDayDate(r.date)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-orza-strong">{kg(r.weight_kg)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-orza-muted">{d == null ? "—" : signed(d)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
