"use client";
import * as React from "react";
import { BookmarkPlus, ChefHat, RotateCw } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Eyebrow } from "@/components/orza/primitives";
import { EmptyState } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/form";
import { RecipeDetail } from "./RecipeDetail";
import { RecipeTile } from "./RecipeTile";
import type { RecipeItem } from "./types";

export type CollectionTab = "saved" | "recent";

/** Saved / Recent recipe grid; a card opens the full recipe in a dialog. */
export function RecipeCollection({
  recipes,
  loading,
  error,
  onRetry,
  tab,
  onTabChange,
  busy,
  onToggleSave,
  onLog,
  onDelete,
}: {
  recipes: RecipeItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  tab: CollectionTab;
  onTabChange: (t: CollectionTab) => void;
  /** Per-recipe action in flight, e.g. { id, action: "save" }. */
  busy: { id: string; action: "save" | "log" | "delete" } | null;
  onToggleSave: (r: RecipeItem) => void;
  onLog: (r: RecipeItem) => void;
  onDelete: (r: RecipeItem) => Promise<boolean>;
}) {
  const reduce = useReducedMotion();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const saved = React.useMemo(() => recipes.filter((r) => r.saved), [recipes]);
  const list = tab === "saved" ? saved : recipes;
  // Look the open recipe up live so save/unsave in the dialog reflects immediately.
  const open = openId ? recipes.find((r) => r.id === openId) || null : null;

  return (
    <section aria-labelledby="recipes-collection-title" className="mt-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>Your cookbook</Eyebrow>
          <h2 id="recipes-collection-title" className="mt-2 font-editorial text-[26px] font-semibold leading-[1.2] tracking-[-0.01em] text-orza-strong sm:text-[30px]">
            Recipes made for you
          </h2>
        </div>
        <Segmented<CollectionTab> semantics="tabs" id="recipe-collection" panelId="recipe-collection-panel" aria-label="Recipe collection"
          value={tab}
          onChange={onTabChange}
          options={[
            { value: "saved", label: `Saved${loading ? "" : ` · ${saved.length}`}` },
            { value: "recent", label: `Recent${loading ? "" : ` · ${recipes.length}`}` },
          ]}
          className="self-start sm:self-auto"
        />
      </div>

      <div className="mt-6" role="tabpanel" id="recipe-collection-panel" aria-labelledby={`recipe-collection-${tab}`}>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy aria-label="Loading recipes">
            {[0, 1, 2].map((i) => (
              <div key={i} className="orza-skeleton h-[212px] rounded-orza-md" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={<ChefHat size={20} strokeWidth={1.75} />}
            title="Couldn't load your recipes"
            description={error}
            action={
              <Button variant="secondary" onClick={onRetry}>
                <RotateCw size={15} strokeWidth={1.9} aria-hidden /> Try again
              </Button>
            }
          />
        ) : list.length === 0 ? (
          tab === "saved" ? (
            <EmptyState
              icon={<BookmarkPlus size={20} strokeWidth={1.75} />}
              title="No saved recipes yet"
              description={
                recipes.length
                  ? "Open a recipe from Recent and tap Save to keep it here."
                  : "Generate a recipe above and save the ones you love — they'll live here."
              }
              action={
                recipes.length ? (
                  <Button variant="secondary" onClick={() => onTabChange("recent")}>
                    Browse recent
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <EmptyState
              icon={<ChefHat size={20} strokeWidth={1.75} />}
              title="No recipes yet"
              description="Generate your first one above — try a quick breakfast or a high-protein dinner."
            />
          )
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((r, i) => (
              <motion.li
                key={r.id}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: Math.min(i, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
              >
                <RecipeTile recipe={r} onOpen={(x) => setOpenId(x.id)} />
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        {open && (
          <DialogContent
            title={open.title}
            // The recipe renders its own editorial title; keep the dialog title for screen readers only.
            className="w-[min(760px,calc(100%-24px))] p-5 sm:p-8 [&>h2]:sr-only"
          >
            <div className="-mt-5">
              <RecipeDetail
                recipe={open}
                layout="stacked"
                headingLevel="h3"
                onToggleSave={() => onToggleSave(open)}
                saving={busy?.id === open.id && busy.action === "save"}
                onLog={() => onLog(open)}
                logging={busy?.id === open.id && busy.action === "log"}
                onDelete={async () => {
                  if (await onDelete(open)) setOpenId(null);
                }}
                deleting={busy?.id === open.id && busy.action === "delete"}
              />
            </div>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
