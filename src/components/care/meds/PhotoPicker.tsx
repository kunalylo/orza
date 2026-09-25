"use client";
import * as React from "react";
import { Camera, ImageUp, Loader2, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type PhotoItem = { id: string; src: string };

/**
 * Medicine photos: "Take photo" opens the rear camera on phones (capture="environment"),
 * "Choose from gallery" allows several at once. Preview grid with remove + "show on alarm".
 * The first photo is the one alarms and notifications show.
 */
export function PhotoPicker({
  items,
  max,
  busy,
  onAddFiles,
  onRemove,
  onMakePrimary,
  label = "medicine",
}: {
  items: PhotoItem[];
  max: number;
  busy?: boolean;
  onAddFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  onMakePrimary?: (id: string) => void;
  label?: string;
}) {
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const galleryRef = React.useRef<HTMLInputElement>(null);
  const full = items.length >= max;

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // allow the same file again
    if (files.length) onAddFiles(files);
  };

  return (
    <div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={pick} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden onChange={pick} />

      {items.length > 0 && (
        <ul className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label={`${label} photos`}>
          {items.map((p, i) => (
            <li key={p.id} className="group relative aspect-square overflow-hidden rounded-orza-sm border border-[rgba(20,20,20,0.10)] bg-[#EFE7DD]">
              <img src={p.src} alt={`${label} photo ${i + 1}${i === 0 ? " (shown on alarms)" : ""}`} className="h-full w-full object-cover" />
              {i === 0 ? (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-[rgba(7,9,12,0.66)] px-2 py-0.5 text-[10px] font-medium text-white">On alarm</span>
              ) : (
                onMakePrimary && (
                  <button
                    type="button"
                    onClick={() => onMakePrimary(p.id)}
                    disabled={busy}
                    className="absolute left-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-orza-strong shadow-orza-glass transition-colors hover:bg-white disabled:opacity-50"
                    aria-label={`Show photo ${i + 1} on alarms`}
                    title="Show this one on alarms"
                  >
                    <Star size={13} aria-hidden />
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => onRemove(p.id)}
                disabled={busy}
                className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-orza-strong shadow-orza-glass transition-colors hover:bg-white hover:text-[#B02C2C] disabled:opacity-50"
                aria-label={`Remove photo ${i + 1}`}
              >
                <X size={14} aria-hidden />
              </button>
            </li>
          ))}
          {busy && (
            <li className="flex aspect-square items-center justify-center rounded-orza-sm border border-dashed border-[rgba(20,20,20,0.16)] bg-white/50" aria-label="Adding photo">
              <Loader2 size={18} className="animate-spin text-orza-muted" aria-hidden />
            </li>
          )}
        </ul>
      )}

      {items.length === 0 && busy && (
        <div className="mb-3 flex h-24 items-center justify-center rounded-orza-sm border border-dashed border-[rgba(20,20,20,0.16)] bg-white/50 text-sm text-orza-muted">
          <Loader2 size={16} className="mr-2 animate-spin" aria-hidden /> Preparing photo…
        </div>
      )}

      <div className={cn("flex flex-wrap gap-2", full && "hidden")}>
        <Button variant="secondary" size="sm" onClick={() => cameraRef.current?.click()} disabled={busy || full}>
          <Camera size={15} aria-hidden />
          Take photo
        </Button>
        <Button variant="secondary" size="sm" onClick={() => galleryRef.current?.click()} disabled={busy || full}>
          <ImageUp size={15} aria-hidden />
          Choose from gallery
        </Button>
      </div>
      <p className="mt-2 text-xs text-orza-subtle">
        {full ? `That's the maximum of ${max} photos. Remove one to add another.` : `Up to ${max} photos — the strip, the box and the pill itself work best.`}
      </p>
    </div>
  );
}
