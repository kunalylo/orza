import * as React from "react";
import { Droplet, Dumbbell, Flame, Footprints, GlassWater, Wheat } from "lucide-react";
import type { Targets } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { StatCard } from "@/components/app/ui";
import { Reveal } from "@/components/orza/Reveal";

/** Six daily targets as stat tiles (calories, macros, water, steps). */
export function TargetsGrid({ targets, previous }: { targets: Targets; previous?: Targets | null }) {
  const tiles: { key: keyof Targets; label: string; unit: string; hint: string; icon: React.ReactNode }[] = [
    { key: "calories", label: "Calories", unit: "kcal", hint: "Your daily energy target", icon: <Flame size={16} strokeWidth={1.75} /> },
    { key: "protein_g", label: "Protein", unit: "g", hint: "Keeps you full and strong", icon: <Dumbbell size={16} strokeWidth={1.75} /> },
    { key: "carbs_g", label: "Carbs", unit: "g", hint: "Steady energy for your day", icon: <Wheat size={16} strokeWidth={1.75} /> },
    { key: "fat_g", label: "Fat", unit: "g", hint: "For hormones and absorption", icon: <Droplet size={16} strokeWidth={1.75} /> },
    { key: "water_glasses", label: "Water", unit: "glasses", hint: "About 250 ml each", icon: <GlassWater size={16} strokeWidth={1.75} /> },
    { key: "steps", label: "Steps", unit: "steps", hint: "Everyday movement", icon: <Footprints size={16} strokeWidth={1.75} /> },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
      {tiles.map((t, i) => {
        const value = Number(targets[t.key]) || 0;
        const before = previous ? Number(previous[t.key]) || 0 : null;
        const delta = before != null ? Math.round(value - before) : 0;
        return (
          <Reveal key={t.key} delay={i * 0.04} y={10} className="h-full">
            <StatCard
              label={t.label}
              value={<span className="text-[26px] tabular-nums sm:text-[30px]">{formatNumber(value)}</span>}
              unit={t.unit}
              hint={
                delta !== 0 ? (
                  <span className="text-[#C2410C]">
                    {delta > 0 ? "+" : "−"}
                    {formatNumber(Math.abs(delta))} vs before
                  </span>
                ) : (
                  t.hint
                )
              }
              icon={t.icon}
              className="h-full p-4 sm:p-5"
            />
          </Reveal>
        );
      })}
    </div>
  );
}
