"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Home, MapPin, Scale, type LucideIcon } from "lucide-react";
import { GlassCard, IconTile, Section, SectionHeader, Tag } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";
import { cn } from "@/lib/utils";

type Dish = { name: string; serving: string; home: number; restaurant: number; note: string };
type StateFood = { state: string; region: string; dishes: Dish[] };

/** Signature dishes per state with approximate home-style vs restaurant-style calories for one typical serving. */
const STATES: StateFood[] = [
  {
    state: "Punjab",
    region: "North India",
    dishes: [
      { name: "Dal Makhani", serving: "1 katori", home: 230, restaurant: 410, note: "Butter and cream finish in restaurant kitchens." },
      { name: "Aloo Paratha", serving: "1 paratha", home: 230, restaurant: 380, note: "A dhaba-style dollop of white butter adds up fast." },
    ],
  },
  {
    state: "Gujarat",
    region: "West India",
    dishes: [
      { name: "Methi Thepla", serving: "2 pieces", home: 240, restaurant: 330, note: "Oil in the dough and on the tawa varies by kitchen." },
      { name: "Khaman Dhokla", serving: "4 pieces", home: 160, restaurant: 230, note: "Shop-bought versions carry a sweeter, oilier tempering." },
    ],
  },
  {
    state: "Bengal",
    region: "East India",
    dishes: [
      { name: "Machher Jhol", serving: "1 katori", home: 190, restaurant: 290, note: "Mustard-oil base; restaurants fry the fish deeper." },
      { name: "Kosha Mangsho", serving: "1 katori", home: 320, restaurant: 470, note: "Slow-cooked mutton; more oil separates in restaurant style." },
    ],
  },
  {
    state: "Kerala",
    region: "South India",
    dishes: [
      { name: "Appam & Stew", serving: "2 appam + stew", home: 320, restaurant: 430, note: "Restaurant stews use thicker, richer coconut milk." },
      { name: "Meen Curry", serving: "1 katori", home: 200, restaurant: 300, note: "Coconut and kudampuli, finished with coconut oil." },
    ],
  },
  {
    state: "Maharashtra",
    region: "West India",
    dishes: [
      { name: "Kanda Poha", serving: "1 plate", home: 250, restaurant: 340, note: "Extra peanuts and oil tip the balance at stalls." },
      { name: "Misal Pav", serving: "1 plate + 2 pav", home: 420, restaurant: 580, note: "The spicy tarri — the oil layer — is where calories hide." },
    ],
  },
];

const SCALE_MAX = 600; // shared bar scale so dishes compare honestly across states

const CARDS: { icon: LucideIcon; tone: "energy" | "cyan" | "violet"; title: string; desc: string }[] = [
  {
    icon: MapPin,
    tone: "energy",
    title: "State-Wise Recognition",
    desc: "Punjab's dal makhani vs. Bengal's machher jhol — ÖRZA knows the difference in ingredients and calories.",
  },
  {
    icon: Scale,
    tone: "cyan",
    title: "Portion Intelligence",
    desc: "“Ek katori”, “half plate”, “do roti” — understands Indian serving measurements naturally.",
  },
  {
    icon: Home,
    tone: "violet",
    title: "Home vs. Restaurant",
    desc: "Home-cooked dal (5ml oil) vs. restaurant dal (30ml oil) — accurate calorie adjustments.",
  },
];

const slug = (s: string) => s.toLowerCase().replace(/\s+/g, "-");

export function HomeIndia() {
  const [active, setActive] = React.useState(0);
  const reduce = useReducedMotion();
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const current = STATES[active];

  // Roving focus for the state tablist (Arrow keys, Home, End).
  function onTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % STATES.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + STATES.length) % STATES.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = STATES.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <Section id="india" tone="canvas">
      <SectionHeader
        eyebrow="India-First Intelligence"
        title={
          <>
            Understands <em className="italic">Indian cuisine</em> like no other
          </>
        }
        lead="From home-cooked thalis to wedding buffets, ÖRZA recognizes state-wise dishes, portion sizes, and cooking styles."
      />

      <div className="mt-10 grid gap-6 lg:mt-14 lg:grid-cols-[1.25fr_1fr] lg:gap-8">
        {/* Interactive state explorer */}
        <Reveal className="h-full">
          <GlassCard variant="strong" padded={false} className="relative h-full overflow-hidden p-5 sm:p-7">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-28 -top-28 h-[340px] w-[340px] rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 40% 40%, rgba(255,180,84,0.26) 0%, rgba(255,95,162,0.10) 42%, rgba(251,247,241,0) 70%)",
                filter: "blur(8px)",
              }}
            />
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">Explore by state</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">≈ kcal · one serving</span>
              </div>

              <div role="tablist" aria-label="Indian states" className="mt-4 flex flex-wrap gap-2">
                {STATES.map((s, i) => {
                  const selected = i === active;
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

              <div
                role="tabpanel"
                id="india-panel"
                aria-labelledby={`india-tab-${slug(current.state)}`}
                className="mt-6"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={current.state}
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-editorial text-2xl font-semibold tracking-[-0.01em] text-orza-strong">{current.state}</h3>
                      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">{current.region}</span>
                    </div>
                    <ul className="mt-4 grid gap-3">
                      {current.dishes.map((d, i) => (
                        <DishCard key={d.name} dish={d} index={i} reduce={!!reduce} />
                      ))}
                    </ul>
                  </motion.div>
                </AnimatePresence>
              </div>

              <p className="mt-5 text-xs leading-relaxed text-orza-subtle">
                Approximate values for a typical serving. ÖRZA adjusts for your actual portion and how the dish was cooked.
              </p>
            </div>
          </GlassCard>
        </Reveal>

        {/* Capability cards (verbatim content) — stretch to the explorer's height on desktop */}
        <div className="grid gap-4 lg:grid-rows-3">
          {CARDS.map((c, i) => {
            const Icon = c.icon;
            return (
              <Reveal key={c.title} delay={0.08 * (i + 1)} className="h-full">
                <GlassCard hover className="flex h-full items-center">
                  <div className="flex items-start gap-4">
                    <IconTile tone={c.tone}>
                      <Icon size={18} strokeWidth={1.75} aria-hidden />
                    </IconTile>
                    <div className="min-w-0">
                      <h3 className="font-editorial text-xl font-semibold tracking-[-0.01em] text-orza-strong">{c.title}</h3>
                      <p className="mt-1.5 text-[15px] leading-relaxed text-orza-muted">{c.desc}</p>
                    </div>
                  </div>
                </GlassCard>
              </Reveal>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

function DishCard({ dish, index, reduce }: { dish: Dish; index: number; reduce: boolean }) {
  const extra = dish.restaurant - dish.home;
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.06 * index, ease: [0.16, 1, 0.3, 1] }}
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
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <h4 className="text-[15px] font-medium text-orza-strong">{dish.name}</h4>
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-orza-subtle">{dish.serving}</span>
          </div>
          <p className="mt-0.5 text-[13px] leading-snug text-orza-muted">{dish.note}</p>
        </div>
      </div>

      <dl className="mt-4 grid gap-2">
        <KcalRow label="Home" value={dish.home} tone="home" reduce={reduce} delay={0.1 + 0.06 * index} />
        <KcalRow label="Restaurant" value={dish.restaurant} tone="out" reduce={reduce} delay={0.18 + 0.06 * index} />
      </dl>

      <div className="mt-3 flex justify-end">
        <Tag tone="energy" size="sm">+{extra} kcal eating out</Tag>
      </div>
    </motion.li>
  );
}

function KcalRow({ label, value, tone, reduce, delay }: { label: string; value: number; tone: "home" | "out"; reduce: boolean; delay: number }) {
  const pct = Math.min(100, (value / SCALE_MAX) * 100);
  return (
    <div className="grid grid-cols-[76px_1fr_auto] items-center gap-3 sm:grid-cols-[88px_1fr_auto]">
      <dt className="text-[12px] text-orza-muted">{label}</dt>
      <dd className="h-1.5 overflow-hidden rounded-full bg-[rgba(20,20,20,0.07)]">
        <motion.div
          className={cn("h-full rounded-full", tone === "home" ? "bg-gradient-to-r from-orza-cyan-300 to-orza-cyan" : "bg-orza-energy")}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
        />
      </dd>
      <dd className="min-w-[68px] text-right font-mono text-[12px] tabular-nums text-orza-strong">≈{value} kcal</dd>
    </div>
  );
}
