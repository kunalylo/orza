import { Home, MapPin, Scale, type LucideIcon } from "lucide-react";
import { GlassCard, IconTile, Section, SectionHeader } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";
import { FOODS } from "@/lib/nutrition/foods";
import { nutrientsFor } from "@/lib/nutrition/nutrients";
import { IndiaExplorer, type ExplorerDish, type ExplorerState } from "./_indiaExplorer";

/**
 * Signature dishes per state, by key in ÖRZA's food database. The numbers shown are computed from that
 * database (`FOODS` + `nutrientsFor`), so the homepage always matches what the app logs.
 */
const STATE_DISHES: { state: string; region: string; keys: string[] }[] = [
  { state: "Punjab", region: "North India", keys: ["dal_makhani", "aloo_paratha"] },
  { state: "Gujarat", region: "West India", keys: ["undhiyu", "thepla"] },
  { state: "Bengal", region: "East India", keys: ["machher_jhol", "aloo_posto"] },
  { state: "Kerala", region: "South India", keys: ["kerala_parotta", "kadala_curry"] },
  { state: "Maharashtra", region: "West India", keys: ["misal_pav", "pav_bhaji"] },
];

const BY_KEY = new Map(FOODS.map((f) => [f.key, f]));

/** One default serving of each dish, home-style and (when the database has a restaurant multiplier) restaurant-style. */
function explorerStates(): ExplorerState[] {
  return STATE_DISHES.map(({ state, region, keys }) => {
    const dishes: ExplorerDish[] = [];
    for (const key of keys) {
      const food = BY_KEY.get(key);
      if (!food) continue;
      const home = nutrientsFor(food, 1);
      const out = (food.restaurant_multiplier ?? 1) > 1 ? nutrientsFor(food, 1, true) : null;
      dishes.push({
        key: food.key,
        name: food.name,
        serving: food.serving.label,
        diet: food.diet,
        home: { calories: home.calories, protein_g: home.protein_g, carbs_g: home.carbs_g, fat_g: home.fat_g },
        restaurant: out ? { calories: out.calories, fat_g: out.fat_g } : null,
      });
    }
    return { state, region, dishes };
  }).filter((s) => s.dishes.length > 0);
}

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

export function HomeIndia() {
  const states = explorerStates();
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
        {/* Interactive state explorer — values straight from the food database */}
        {states.length > 0 && (
          <Reveal className="h-full">
            <IndiaExplorer states={states} />
          </Reveal>
        )}

        {/* Capability cards (verbatim content) — stretch to the explorer's height on desktop */}
        <div className={states.length > 0 ? "grid gap-4 lg:grid-rows-3" : "grid gap-4 lg:col-span-2 lg:grid-cols-3"}>
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
