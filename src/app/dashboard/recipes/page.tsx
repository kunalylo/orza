"use client";
import * as React from "react";
import { toast } from "sonner";
import { api, ApiError, errorMessage } from "@/lib/api-client";
import { useUser } from "@/components/app/UserProvider";
import { PageHeader, WellnessNote } from "@/components/app/ui";
import { KitchenProfile } from "@/components/recipes/KitchenProfile";
import { RecipeGenerator } from "@/components/recipes/RecipeGenerator";
import { GeneratingCard, RecipeResult } from "@/components/recipes/RecipeResult";
import { RecipeCollection, type CollectionTab } from "@/components/recipes/RecipeCollection";
import type { GenerateRequest, GenerateResponse, RecipeItem, RecipesResponse } from "@/components/recipes/types";

type Busy = { id: string; action: "save" | "log" | "delete" } | null;

/** Personalised recipes: generate (AI or curated library), save, log a serving, browse Saved / Recent. */
export default function RecipesPage() {
  const { user, setCredits, refresh } = useUser();
  const [recipes, setRecipes] = React.useState<RecipeItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [meta, setMeta] = React.useState<{ ai_enabled: boolean | null; cost: number }>({ ai_enabled: null, cost: 2 });
  const [tab, setTab] = React.useState<CollectionTab>("recent");
  const [generating, setGenerating] = React.useState(false);
  const [result, setResult] = React.useState<{ recipe: RecipeItem; notice?: string } | null>(null);
  const [busy, setBusy] = React.useState<Busy>(null);
  const lastRequest = React.useRef<GenerateRequest>({});
  const resultRef = React.useRef<HTMLDivElement>(null);
  const tabChosen = React.useRef(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<RecipesResponse>("/recipes");
      setRecipes(res.recipes || []);
      setMeta({ ai_enabled: !!res.ai_enabled, cost: res.cost ?? 2 });
      // Open on Saved when there's something saved, unless the person already picked a tab.
      if (!tabChosen.current) setTab((res.recipes || []).some((r) => r.saved) ? "saved" : "recent");
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const replace = (r: RecipeItem) => {
    setRecipes((list) => list.map((x) => (x.id === r.id ? r : x)));
    setResult((cur) => (cur && cur.recipe.id === r.id ? { ...cur, recipe: r } : cur));
  };

  const generate = async (req: GenerateRequest) => {
    lastRequest.current = req;
    setGenerating(true);
    setResult(null);
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    try {
      const res = await api.post<GenerateResponse>("/recipes/generate", req);
      setResult({ recipe: res.recipe, notice: res.notice });
      setRecipes((list) => [res.recipe, ...list.filter((r) => r.id !== res.recipe.id)]);
      if (res.credits != null) setCredits(res.credits);
      else if (meta.ai_enabled) refresh();
      toast.success(res.ai ? "Your recipe is ready" : "Here's a recipe that fits you");
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      toast.error(errorMessage(e));
      if (e instanceof ApiError && e.code === "no_credits") refresh();
    } finally {
      setGenerating(false);
    }
  };

  const toggleSave = async (r: RecipeItem) => {
    if (busy) return;
    setBusy({ id: r.id, action: "save" });
    try {
      const res = await api.post<{ recipe: RecipeItem }>(`/recipes/${r.id}/save`, { saved: !r.saved });
      replace(res.recipe);
      toast.success(res.recipe.saved ? "Saved to your cookbook" : "Removed from saved");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const logServing = async (r: RecipeItem) => {
    if (busy) return;
    setBusy({ id: r.id, action: "log" });
    try {
      await api.post("/meals/manual", {
        items: [
          {
            name: r.title.slice(0, 80),
            quantity: 1,
            unit: "serving",
            calories: r.nutrition.calories,
            protein_g: r.nutrition.protein_g,
            carbs_g: r.nutrition.carbs_g,
            fat_g: r.nutrition.fat_g,
            fiber_g: r.nutrition.fiber_g,
          },
        ],
      });
      toast.success(`Logged 1 serving of ${r.title}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (r: RecipeItem): Promise<boolean> => {
    if (busy) return false;
    setBusy({ id: r.id, action: "delete" });
    try {
      await api.del(`/recipes/${r.id}`);
      setRecipes((list) => list.filter((x) => x.id !== r.id));
      setResult((cur) => (cur?.recipe.id === r.id ? null : cur));
      toast.success("Recipe deleted");
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Personalised recipes"
        title="Recipes"
        description="AI-generated Indian recipes personalised for your goals — tuned to your diet, allergies and calorie budget."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <RecipeGenerator
          aiEnabled={meta.ai_enabled}
          cost={meta.cost}
          credits={user.credits}
          profileDiet={user.profile?.diet}
          generating={generating}
          onGenerate={generate}
        />
        <KitchenProfile user={user} />
      </div>

      <div ref={resultRef} className="scroll-mt-20">
        {(generating || result) && (
          <div className="mt-6">
            {generating ? (
              <GeneratingCard />
            ) : result ? (
              <RecipeResult
                recipe={result.recipe}
                notice={result.notice}
                onClose={() => setResult(null)}
                onAnother={() => generate(lastRequest.current)}
                generating={generating}
                onToggleSave={() => toggleSave(result.recipe)}
                saving={busy?.id === result.recipe.id && busy.action === "save"}
                onLog={() => logServing(result.recipe)}
                logging={busy?.id === result.recipe.id && busy.action === "log"}
              />
            ) : null}
          </div>
        )}
      </div>

      <RecipeCollection
        recipes={recipes}
        loading={loading}
        error={loadError}
        onRetry={load}
        tab={tab}
        onTabChange={(t) => {
          tabChosen.current = true;
          setTab(t);
        }}
        busy={busy}
        onToggleSave={toggleSave}
        onLog={logServing}
        onDelete={remove}
      />

      {/* The open recipe carries its own note; otherwise keep one at the foot of the page. */}
      {!result && <WellnessNote className="mt-10 text-center" />}
    </div>
  );
}
