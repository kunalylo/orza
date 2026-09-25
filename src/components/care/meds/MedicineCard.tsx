"use client";
import * as React from "react";
import { Camera, Images, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tag } from "@/components/orza/primitives";
import { MedPhoto } from "./MedPhoto";
import {
  daysLeftText,
  FORM_LABEL,
  needsRefill,
  scheduleSummary,
  TIMING_LABEL,
  type MedicationClient,
} from "./shared";

/** One medicine in the list: primary photo, name, dose, schedule summary, stock, tags. Opens the edit sheet. */
export function MedicineCard({ med, today, onOpen }: { med: MedicationClient; today: string; onOpen: (m: MedicationClient) => void }) {
  const refill = needsRefill(med);
  const left = daysLeftText(med);
  const ended = !!med.schedule.end_date && med.schedule.end_date < today;
  const photos = med.photo_urls.length;
  return (
    <button
      type="button"
      onClick={() => onOpen(med)}
      className={cn(
        "group flex w-full gap-3.5 rounded-orza-md border border-[rgba(20,20,20,0.10)] bg-[rgba(255,255,255,0.62)] p-3 text-left shadow-orza-glass backdrop-blur-orza sm:p-4",
        "transition-[background-color,box-shadow] duration-220 ease-orza hover:bg-[rgba(255,255,255,0.78)] hover:shadow-orza-glass-hover",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan",
        !med.active && "opacity-75"
      )}
      aria-label={`Edit ${med.name}`}
    >
      <div className="relative shrink-0">
        <MedPhoto
          src={med.photo_urls[0]}
          alt={med.name}
          iconSize={26}
          className="h-[88px] w-[88px] rounded-orza-sm border border-[rgba(20,20,20,0.08)] sm:h-24 sm:w-24"
        />
        {photos > 1 && (
          <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-[rgba(7,9,12,0.62)] px-1.5 py-0.5 text-[10px] font-medium text-white">
            <Images size={10} aria-hidden />
            {photos}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-orza-strong">{med.name}</div>
            <div className="truncate text-[13px] text-orza-muted">
              {[med.strength, med.dose, med.form !== "other" ? FORM_LABEL[med.form] : null].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-orza-strong/80">{scheduleSummary(med, today)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {!med.active && (
            <Tag tone="neutral" size="sm" dot={false}>
              <PauseCircle size={11} aria-hidden /> Paused
            </Tag>
          )}
          {med.active && ended && (
            <Tag tone="neutral" size="sm" dot={false}>
              Course finished
            </Tag>
          )}
          {med.as_needed && (
            <Tag tone="info" size="sm" dot={false}>
              SOS
            </Tag>
          )}
          {med.timing !== "any" && (
            <Tag tone="warning" size="sm" dot={false}>
              {TIMING_LABEL[med.timing]}
            </Tag>
          )}
          {med.for_person && (
            <Tag tone="violet" size="sm" dot={false}>
              For {med.for_person}
            </Tag>
          )}
          {med.stock && (
            <Tag tone={refill ? "danger" : "neutral"} size="sm">
              {refill ? "Refill soon · " : ""}
              {med.stock.count} {med.stock.unit} left
            </Tag>
          )}
        </div>
        {med.stock && left && !refill && <div className="mt-1 text-[11px] text-orza-subtle">{left}</div>}
        {(!photos || med.uses_prescription_photo) && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-[#C2410C]">
            <Camera size={13} aria-hidden />
            {photos ? "Showing the prescription — add a pill photo" : "Add a photo — alarms show it"}
          </div>
        )}
      </div>
    </button>
  );
}
