"use client";
import * as React from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { Eyebrow, GlassCard } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, Select } from "@/components/ui/form";
import { cn, formatNumber } from "@/lib/utils";
import type { Diet } from "@/lib/types";
import { CALORIE_OPTIONS, CUISINE_GROUPS, DIET_LABELS, EXAMPLE_PROMPTS, type GenerateRequest } from "./types";

/** Prompt + filters for a personalised recipe. Chips fill the prompt; nothing is spent until "Generate". */
export function RecipeGenerator({
  aiEnabled,
  cost,
  credits,
  profileDiet,
  generating,
  onGenerate,
}: {
  aiEnabled: boolean | null;
  cost: number;
  credits: number;
  profileDiet?: Diet;
  generating: boolean;
  onGenerate: (req: GenerateRequest) => void;
}) {
  const [prompt, setPrompt] = React.useState("");
  const [cuisine, setCuisine] = React.useState("");
  const [maxCalories, setMaxCalories] = React.useState("");
  const [diet, setDiet] = React.useState<"" | Diet>("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const ids = React.useId();

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (generating) return;
    onGenerate({
      prompt: prompt.trim() || undefined,
      cuisine: cuisine || undefined,
      max_calories: maxCalories ? Number(maxCalories) : undefined,
      diet: diet || undefined,
    });
  };

  const applyExample = (text: string) => {
    setPrompt(text);
    inputRef.current?.focus();
  };

  const lowCredits = aiEnabled && credits < cost;

  return (
    <GlassCard variant="strong" padded={false} className="p-5 sm:p-7">
      <Eyebrow>Recipe studio</Eyebrow>
      <h2 className="mt-2 font-editorial text-[24px] font-semibold leading-[1.2] tracking-[-0.01em] text-orza-strong sm:text-[28px]">
        What would you like to cook?
      </h2>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-orza-muted">
        Describe a craving, a meal or what&apos;s in your fridge. ÖRZA tunes it to your diet, allergies and calorie budget.
      </p>

      <form onSubmit={submit} className="mt-5" aria-busy={generating}>
        <Label htmlFor={`${ids}-prompt`} className="sr-only">
          Describe the recipe you want
        </Label>
        <div className="relative">
          <Sparkles size={17} strokeWidth={1.75} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#E0593F]" aria-hidden />
          <Input
            ref={inputRef}
            id={`${ids}-prompt`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, 300))}
            placeholder="e.g. high-protein veg dinner under 500 kcal"
            maxLength={300}
            autoComplete="off"
            enterKeyHint="go"
            className="h-12 pl-10 text-[15.5px]"
          />
        </div>

        <div role="group" className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Example requests">
          <span className="mr-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-orza-subtle">Try</span>
          {EXAMPLE_PROMPTS.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => applyExample(ex)}
              aria-pressed={prompt === ex}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12.5px] leading-4 transition-colors duration-150 ease-orza",
                prompt === ex
                  ? "border-[rgba(255,122,106,0.40)] bg-[#FFF1EA] text-[#C2410C]"
                  : "border-[rgba(20,20,20,0.10)] bg-white/70 text-orza-muted hover:border-[rgba(20,20,20,0.18)] hover:bg-white hover:text-orza-strong"
              )}
            >
              {ex}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor={`${ids}-cuisine`}>Cuisine</Label>
            <Select id={`${ids}-cuisine`} value={cuisine} onChange={(e) => setCuisine(e.target.value)}>
              <option value="">Any cuisine</option>
              {CUISINE_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`${ids}-cal`}>Max calories</Label>
            <Select id={`${ids}-cal`} value={maxCalories} onChange={(e) => setMaxCalories(e.target.value)}>
              <option value="">No limit</option>
              {CALORIE_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  Under {c} kcal / serving
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`${ids}-diet`}>Diet</Label>
            <Select id={`${ids}-diet`} value={diet} onChange={(e) => setDiet(e.target.value as "" | Diet)}>
              <option value="">{profileDiet ? `My diet (${DIET_LABELS[profileDiet]})` : "No restriction"}</option>
              {(Object.keys(DIET_LABELS) as Diet[])
                .filter((d) => d !== profileDiet)
                .map((d) => (
                  <option key={d} value={d}>
                    {DIET_LABELS[d]}
                  </option>
                ))}
            </Select>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <FieldHint className="mt-0 sm:max-w-[60%]">
            {aiEnabled == null
              ? " "
              : aiEnabled
                ? lowCredits
                  ? `Uses ${cost} AI credits — you have ${formatNumber(credits)}, so ÖRZA will pick from its curated collection for free.`
                  : `Uses ${cost} AI credits · ${formatNumber(credits)} left. Your allergies are always avoided.`
                : "Free — picked from ÖRZA's curated collection of Indian and global recipes. Your allergies are always avoided."}
          </FieldHint>
          <Button type="submit" variant="energy" size="lg" loading={generating} className="w-full sm:w-auto">
            {!generating && <Wand2 size={16} strokeWidth={1.9} aria-hidden />}
            {generating ? "Creating your recipe…" : "Generate recipe"}
          </Button>
        </div>
      </form>
    </GlassCard>
  );
}
