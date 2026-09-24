"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { GlassCard, Tag, type TagTone } from "@/components/orza/primitives";
import { cn } from "@/lib/utils";

/** One dish as ÖRZA's food database logs it (computed on the server from `FOODS` + `nutrientsFor`). */
export type ExplorerDish = {
  key: string;
  name: string;
  serving: string;
  diet: "veg" | "vegan" | "egg" | "nonveg";
  home: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  /** Restaurant-style calories and fat, or null when the database uses one estimate for home and outside. */
  restaurant: { calories: number; fat_g: number } | null;
};
export type ExplorerState = { state: string; region: string; dishes: ExplorerDish[] };

const DIET: Record<ExplorerDish["diet"], { label: string; tone: TagTone }> = {
  veg: { label: "Veg", tone: "success" },
  vegan: { label: "Vegan", tone: "success" },
  egg: { label: "Egg", tone: "warning" },
  nonveg: { label: "Non-veg", tone: "danger" },
};

const EASE = [0.16, 1, 0.3, 1] as const;
const slug = (s: string) => s.toLowerCase().replace(/\s+/g, "-");
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Interactive state explorer: pick a state, compare home-style vs restaurant-style calories for its dishes. */
export function IndiaExplorer({ states }: { states: ExplorerState[] }) {
  const [active, setActive] = React.useState(0);
  const reduce = useReducedMotion();
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const current = states[Math.min(active, states.length - 1)];

  // One bar scale for every dish, so values compare honestly across states.
  const scaleMax = React.useMemo(() => {
    const peak = Math.max(1, ...states.flatMap((s) => s.dishes.map((d) => d.restaurant?.calories ?? d.home.calories)));
    return Math.ceil(peak / 100) * 100;
  }, [states]);

  // Roving focus for the state tablist (Arrow keys, Home, End).
  function onTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % states.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + states.length) % states.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = states.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  if (!current) return null;

  return (
    <GlassCard variant="strong" padded={false} className="relative h-full overflow-hidden p-5 sm:p-7">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 -top-28 h-[340px] w-[340px] rounded-full"
        style={{
          background: "radial-gradient(circle at 40% 40%, rgba(255,180,84,0.26) 0%, rgba(255,95,162,0.10) 42%, rgba(251,247,241,0) 70%)",
          filter: "blur(8px)",
        }}
      />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">Explore by state</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">kcal · one serving</span>
        </div>

        <div role="tablist" aria-label="Indian states" className="mt-4 flex flex-wrap gap-2">
          {states.map((s, i) => {
            const selected = s.state === current.state;
            return (
              <button
                key={s.state}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`india-tab-${slug(s.state)}`}
                aria-selected={selected}
                aria-controls="india-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(i)}
                onKeyDown={(e) => onTabKeyDown(e, i)}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-4 text-sm",
                  "transition-[background-color,border-color,color] duration-220 ease-orza",
                  selected
                    ? "border-[#141414] bg-[#141414] text-orza-bg-0"
                    : "border-[rgba(20,20,20,0.10)] bg-white/60 text-orza-muted hover:bg-white/85 hover:text-orza-strong"
                )}
              >
                {s.state}
              </button>
            );
          })}
        </div>

        <div role="tabpanel" id="india-panel" aria-labelledby={`india-tab-${slug(current.state)}`} className="mt-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.state}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: EASE }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-editorial text-2xl font-semibold tracking-[-0.01em] text-orza-strong">{current.state}</h3>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">{current.region}</span>
              </div>
              <ul className="mt-4 grid gap-3">
                {current.dishes.map((d, i) => (
                  <DishCard key={d.key} dish={d} index={i} reduce={!!reduce} scaleMax={scaleMax} />
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>
        </div>

        <p className="mt-5 text-xs leading-relaxed text-orza-subtle">
          Straight from ÖRZA&rsquo;s built-in food database — the same numbers the app logs for one default serving. Mention a
          restaurant, dhaba or delivery when you log, and ÖRZA adds the extra oil, butter and cream.
        </p>
      </div>
    </GlassCard>
  );
}

function DishCard({ dish, index, reduce, scaleMax }: { dish: ExplorerDish; index: number; reduce: boolean; scaleMax: number }) {
  const diet = DIET[dish.diet];
  const extra = dish.restaurant ? dish.restaurant.calories - dish.home.calories : 0;
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.06 * index, ease: EASE }}
      className="rounded-orza-md border border-[rgba(20,20,20,0.08)] bg-white/65 p-4"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orza-energy font-editorial text-[14px] font-semibold text-white"
        >
          {dish.name[0]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h4 className="text-[15px] font-medium text-orza-strong">{dish.name}</h4>
            <Tag tone={diet.tone} size="sm">
              {diet.label}
            </Tag>
          </div>
          <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-orza-subtle">{dish.serving}</p>
          <p className="mt-1.5 text-[13px] leading-snug text-orza-muted">
            {fmt(dish.home.protein_g)} g protein · {fmt(dish.home.carbs_g)} g carbs · {fmt(dish.home.fat_g)} g fat
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-2">
        <KcalRow label="Home" value={dish.home.calories} tone="home" reduce={reduce} delay={0.1 + 0.06 * index} scaleMax={scaleMax} />
        {dish.restaurant && (
          <KcalRow
            label="Restaurant"
            value={dish.restaurant.calories}
            tone="out"
            reduce={reduce}
            delay={0.18 + 0.06 * index}
            scaleMax={scaleMax}
          />
        )}
      </dl>

      <div className="mt-3 flex justify-end">
        {dish.restaurant && extra > 0 ? (
          <Tag tone="energy" size="sm">
            +{extra} kcal · +{fmt(Math.round((dish.restaurant.fat_g - dish.home.fat_g) * 10) / 10)} g fat eating out
          </Tag>
        ) : (
          <Tag tone="neutral" size="sm">
            Logged the same at home or outside
          </Tag>
        )}
      </div>
    </motion.li>
  );
}

function KcalRow({
  label,
  value,
  tone,
  reduce,
  delay,
  scaleMax,
}: {
  label: string;
  value: number;
  tone: "home" | "out";
  reduce: boolean;
  delay: number;
  scaleMax: number;
}) {
  const pct = Math.min(100, (value / scaleMax) * 100);
  return (
    <div className="grid grid-cols-[76px_1fr_auto] items-center gap-3 sm:grid-cols-[88px_1fr_auto]">
      <dt className="text-[12px] text-orza-muted">{label}</dt>
      <dd className="h-1.5 overflow-hidden rounded-full bg-[rgba(20,20,20,0.07)]">
        <motion.div
          className={cn("h-full rounded-full", tone === "home" ? "bg-gradient-to-r from-orza-cyan-300 to-orza-cyan" : "bg-orza-energy")}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, delay, ease: EASE }}
        />
      </dd>
      <dd className="min-w-[68px] text-right font-mono text-[12px] tabular-nums text-orza-strong">{value} kcal</dd>
    </div>
  );
}
