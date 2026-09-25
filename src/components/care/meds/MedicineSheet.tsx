"use client";
import * as React from "react";
import { toast } from "sonner";
import { BellRing, PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import type { DoseTiming, MedForm } from "@/lib/types";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FieldHint, Input, Label, Select, Textarea } from "@/components/ui/form";
import { PhotoPicker, type PhotoItem } from "./PhotoPicker";
import { PhotoError, prepareCarePhoto } from "./photo";
import { draftFromSchedule, ScheduleEditor, scheduleFromDraft, type ScheduleDraft } from "./ScheduleEditor";
import { DEFAULT_DOSE, FORM_OPTIONS, refillThreshold, TIMING_OPTIONS, type MedicationClient } from "./shared";

const MAX_NEW_PHOTOS = 4;
const MAX_PHOTOS = 6;
const STOCK_UNITS = ["tablets", "capsules", "doses", "sachets", "puffs", "injections"];

const stockUnitFor = (form: MedForm) => (form === "capsule" ? "capsules" : form === "tablet" ? "tablets" : form === "powder" ? "sachets" : form === "inhaler" ? "puffs" : form === "injection" ? "injections" : "doses");

interface Draft {
  name: string;
  strength: string;
  form: MedForm;
  dose: string;
  doseTouched: boolean;
  timing: DoseTiming;
  instructions: string;
  for_person: string;
  stockOn: boolean;
  stockCount: string;
  stockUnit: string;
  refillAt: string;
  schedule: ScheduleDraft;
}

function draftFor(med: MedicationClient | null, today: string): Draft {
  return {
    name: med?.name || "",
    strength: med?.strength || "",
    form: med?.form || "tablet",
    dose: med?.dose || DEFAULT_DOSE.tablet,
    doseTouched: !!med,
    timing: med?.timing || "any",
    instructions: med?.instructions || "",
    for_person: med?.for_person || "",
    stockOn: !!med?.stock,
    stockCount: med?.stock ? String(med.stock.count) : "",
    stockUnit: med?.stock?.unit || stockUnitFor(med?.form || "tablet"),
    refillAt: med?.stock?.refill_alert_at != null ? String(med.stock.refill_alert_at) : "",
    schedule: draftFromSchedule(med?.schedule || null, med?.as_needed || false, today),
  };
}

/**
 * Add / edit a medicine (bottom sheet on phones, dialog on desktop): photos, name, strength, form,
 * dose, timing, schedule, stock + refill alert, who it's for and instructions.
 * In edit mode photo changes are saved immediately; everything else on "Save changes".
 */
export function MedicineSheet({
  open,
  onOpenChange,
  med,
  today,
  people,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = add a new medicine. */
  med: MedicationClient | null;
  today: string;
  /** Existing "for" names (caregiver mode) for suggestions. */
  people: string[];
  onSaved: (m: MedicationClient) => void;
  onDeleted: (id: string) => void;
}) {
  const editing = !!med;
  const [draft, setDraft] = React.useState<Draft>(() => draftFor(med, today));
  const [newPhotos, setNewPhotos] = React.useState<PhotoItem[]>([]);
  const [current, setCurrent] = React.useState<MedicationClient | null>(med);
  const [photoBusy, setPhotoBusy] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [toggling, setToggling] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const idp = React.useId().replace(/:/g, "");

  // Reset whenever the sheet opens for a (different) medicine.
  React.useEffect(() => {
    if (!open) return;
    setDraft(draftFor(med, today));
    setNewPhotos([]);
    setCurrent(med);
    setConfirmDelete(false);
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, med?.id]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  /* ── Photos ── */
  const photoItems: PhotoItem[] = editing
    ? (current?.photo_ids || []).map((id, i) => ({ id, src: current?.photo_urls[i] || "" }))
    : newPhotos;
  const maxPhotos = editing ? MAX_PHOTOS : MAX_NEW_PHOTOS;

  const addFiles = async (files: File[]) => {
    const room = maxPhotos - photoItems.length + (editing && current?.uses_prescription_photo ? 1 : 0);
    const list = files.slice(0, Math.max(0, room));
    if (files.length > list.length) toast.message(`Only ${maxPhotos} photos per medicine — added the first ${list.length}.`);
    if (!list.length) return;
    setPhotoBusy(true);
    try {
      for (const file of list) {
        let dataUrl: string;
        try {
          dataUrl = await prepareCarePhoto(file);
        } catch (e) {
          toast.error(e instanceof PhotoError ? e.message : "We couldn't read that photo. Please try another.");
          continue;
        }
        if (editing && current) {
          const res = await api.post<{ medication: MedicationClient }>(`/meds/${current.id}/photos`, { image: dataUrl });
          setCurrent(res.medication);
          onSaved(res.medication);
        } else {
          setNewPhotos((p) => [...p, { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, src: dataUrl }]);
        }
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async (id: string) => {
    if (!editing || !current) {
      setNewPhotos((p) => p.filter((x) => x.id !== id));
      return;
    }
    setPhotoBusy(true);
    try {
      const res = await api.del<{ medication: MedicationClient }>(`/meds/${current.id}/photos/${id}`);
      setCurrent(res.medication);
      onSaved(res.medication);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPhotoBusy(false);
    }
  };

  const makePrimary = async (id: string) => {
    if (!editing || !current) {
      setNewPhotos((p) => [...p.filter((x) => x.id === id), ...p.filter((x) => x.id !== id)]);
      return;
    }
    setPhotoBusy(true);
    try {
      const res = await api.patch<{ medication: MedicationClient }>(`/meds/${current.id}`, { primary_photo_id: id });
      setCurrent(res.medication);
      onSaved(res.medication);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPhotoBusy(false);
    }
  };

  /* ── Save ── */
  const validate = () => {
    const errs: Record<string, string> = {};
    if (!draft.name.trim()) errs.name = "Add the medicine's name.";
    if (!draft.dose.trim()) errs.dose = "Add the dose, e.g. 1 tablet.";
    const sched = scheduleFromDraft(draft.schedule);
    if ("error" in sched) errs.schedule = sched.error;
    if (draft.stockOn) {
      const n = Number(draft.stockCount);
      if (draft.stockCount === "" || !Number.isInteger(n) || n < 0 || n > 10000) errs.stock = "Enter how many are left (0–10000).";
      if (draft.refillAt !== "" && (!Number.isInteger(Number(draft.refillAt)) || Number(draft.refillAt) < 0 || Number(draft.refillAt) > 1000)) errs.stock = "The refill alert should be a whole number.";
    }
    setErrors(errs);
    return { ok: !Object.keys(errs).length, sched };
  };

  const save = async () => {
    const { ok, sched } = validate();
    if (!ok || !("schedule" in sched)) {
      toast.error("Please check the highlighted fields.");
      return;
    }
    const stock = draft.stockOn
      ? { count: Number(draft.stockCount), unit: draft.stockUnit, refill_alert_at: draft.refillAt === "" ? null : Number(draft.refillAt) }
      : null;
    const payload = {
      name: draft.name.trim(),
      strength: draft.strength.trim() || null,
      form: draft.form,
      dose: draft.dose.trim(),
      timing: draft.timing,
      instructions: draft.instructions.trim() || null,
      for_person: draft.for_person.trim() || null,
      schedule: sched.schedule.end_date || !editing ? sched.schedule : { ...sched.schedule, end_date: null },
      as_needed: draft.schedule.as_needed,
      stock,
    };
    setSaving(true);
    try {
      if (editing && current) {
        const every = payload.schedule.every_n_days;
        const res = await api.patch<{ medication: MedicationClient }>(`/meds/${current.id}`, {
          ...payload,
          schedule: { ...payload.schedule, every_n_days: every && every > 1 ? every : null },
        });
        onSaved(res.medication);
        toast.success(`${res.medication.name} updated`);
      } else {
        const res = await api.post<{ medication: MedicationClient }>("/meds", {
          ...payload,
          strength: payload.strength || undefined,
          instructions: payload.instructions || undefined,
          for_person: payload.for_person || undefined,
          stock: stock || undefined,
          photos: newPhotos.map((p) => p.src),
        });
        onSaved(res.medication);
        toast.success(
          res.medication.as_needed ? `${res.medication.name} added` : `${res.medication.name} added — alarms are set`,
          !res.medication.photo_ids.length ? { description: "Add a photo so every alarm shows the right strip." } : undefined
        );
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!current) return;
    setToggling(true);
    try {
      const res = await api.patch<{ medication: MedicationClient }>(`/meds/${current.id}`, { active: !current.active });
      setCurrent(res.medication);
      onSaved(res.medication);
      toast.success(res.medication.active ? `Reminders for ${res.medication.name} are back on` : `Reminders for ${res.medication.name} paused`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setToggling(false);
    }
  };

  const remove = async () => {
    if (!current) return;
    setDeleting(true);
    try {
      await api.del(`/meds/${current.id}`);
      onDeleted(current.id);
      toast.success(`${current.name} deleted`);
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  const f = (k: string) => `${idp}-${k}`;
  const autoRefill = draft.stockOn
    ? refillThreshold({
        stock: { count: 0, unit: draft.stockUnit },
        as_needed: draft.schedule.as_needed,
        schedule: { times: draft.schedule.times, days: draft.schedule.repeat === "weekdays" ? draft.schedule.days : [], start_date: today, every_n_days: draft.schedule.repeat === "interval" ? Number(draft.schedule.every_n_days) || 1 : 1 },
      })
    : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent
        title={editing ? `Edit ${med?.name}` : "Add a medicine"}
        description={editing ? "Changes apply to upcoming alarms." : "Add a photo so every alarm shows exactly which strip or bottle to take."}
        className={cn(
          "sm:w-[min(640px,calc(100%-32px))]",
          "max-sm:bottom-0 max-sm:left-0 max-sm:top-auto max-sm:w-full max-sm:max-h-[92dvh] max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-0"
        )}
        onInteractOutside={(e) => {
          if (saving || photoBusy) e.preventDefault();
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          noValidate
          className="space-y-6"
        >
          {/* Photos */}
          <section aria-labelledby={f("photos")}>
            <div className="mb-2 flex items-center gap-2">
              <BellRing size={15} className="text-[#E0593F]" aria-hidden />
              <h3 id={f("photos")} className="text-[13px] font-semibold text-orza-strong">
                Photos
              </h3>
            </div>
            <p className="mb-3 text-[13px] leading-relaxed text-orza-muted">
              Alarms and notifications show the first photo — handy when strips look alike or someone else gives the medicine.
            </p>
            {editing && current?.uses_prescription_photo && (
              <p className="mb-3 rounded-orza-sm bg-[#FFF4E6] px-3 py-2 text-[12px] text-[#8A5300]">
                Showing your prescription for now. Your first pill photo replaces it on alarms.
              </p>
            )}
            <PhotoPicker
              items={photoItems}
              max={maxPhotos}
              busy={photoBusy}
              onAddFiles={addFiles}
              onRemove={removePhoto}
              onMakePrimary={makePrimary}
              label={draft.name.trim() || "Medicine"}
            />
          </section>

          {/* Basics */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor={f("name")}>Medicine name</Label>
              <Input
                id={f("name")}
                value={draft.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="e.g. Metformin, Dolo 650, Thyronorm"
                maxLength={80}
                autoComplete="off"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? f("name-err") : undefined}
                className={cn(errors.name && "border-[#B02C2C]")}
              />
              {errors.name && (
                <p id={f("name-err")} className="mt-1.5 text-xs text-[#B02C2C]">
                  {errors.name}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor={f("strength")}>Strength (optional)</Label>
              <Input id={f("strength")} value={draft.strength} onChange={(e) => set({ strength: e.target.value })} placeholder="e.g. 500 mg" maxLength={40} autoComplete="off" />
            </div>
            <div>
              <Label htmlFor={f("form")}>Form</Label>
              <Select
                id={f("form")}
                value={draft.form}
                onChange={(e) => {
                  const form = e.target.value as MedForm;
                  set({ form, dose: draft.doseTouched ? draft.dose : DEFAULT_DOSE[form], stockUnit: draft.stockOn ? draft.stockUnit : stockUnitFor(form) });
                }}
              >
                {FORM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={f("dose")}>Dose each time</Label>
              <Input
                id={f("dose")}
                value={draft.dose}
                onChange={(e) => set({ dose: e.target.value, doseTouched: true })}
                placeholder="e.g. 1 tablet, ½ tablet, 5 ml"
                maxLength={40}
                aria-invalid={!!errors.dose}
                aria-describedby={errors.dose ? f("dose-err") : undefined}
                className={cn(errors.dose && "border-[#B02C2C]")}
              />
              {errors.dose && (
                <p id={f("dose-err")} className="mt-1.5 text-xs text-[#B02C2C]">
                  {errors.dose}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor={f("timing")}>With food?</Label>
              <Select id={f("timing")} value={draft.timing} onChange={(e) => set({ timing: e.target.value as DoseTiming })}>
                {TIMING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          </section>

          {/* Schedule */}
          <section aria-labelledby={f("sched")} className="rounded-orza-md border border-[rgba(20,20,20,0.08)] bg-white/50 p-4">
            <h3 id={f("sched")} className="mb-3 font-editorial text-[17px] font-semibold text-orza-strong">
              Schedule
            </h3>
            <ScheduleEditor
              value={draft.schedule}
              onChange={(schedule) => setDraft((d) => ({ ...d, schedule }))}
              onTiming={(timing) => set({ timing })}
              today={today}
              idPrefix={f("s")}
            />
            {errors.schedule && <p className="mt-2 text-xs text-[#B02C2C]">{errors.schedule}</p>}
          </section>

          {/* Stock */}
          <section aria-labelledby={f("stock")}>
            <div className="flex items-center justify-between gap-3">
              <h3 id={f("stock")} className="text-[13px] font-semibold text-orza-strong">
                Track stock
              </h3>
              <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-orza-muted">
                <input
                  type="checkbox"
                  checked={draft.stockOn}
                  onChange={(e) => set({ stockOn: e.target.checked })}
                  className="h-4 w-4 accent-[#0B8FA6]"
                />
                Remind me to refill
              </label>
            </div>
            {draft.stockOn && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor={f("count")}>Left now</Label>
                  <Input id={f("count")} type="number" inputMode="numeric" min={0} max={10000} value={draft.stockCount} onChange={(e) => set({ stockCount: e.target.value })} placeholder="e.g. 30" />
                </div>
                <div>
                  <Label htmlFor={f("unit")}>Unit</Label>
                  <Select id={f("unit")} value={draft.stockUnit} onChange={(e) => set({ stockUnit: e.target.value })}>
                    {STOCK_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor={f("refill")}>Alert at</Label>
                  <Input
                    id={f("refill")}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={1000}
                    value={draft.refillAt}
                    onChange={(e) => set({ refillAt: e.target.value })}
                    placeholder={`Auto (${autoRefill})`}
                  />
                </div>
                <FieldHint className="col-span-2 mt-0 sm:col-span-3">
                  Goes down by one each time you tap Take. &ldquo;Refill soon&rdquo; shows at the alert level — by default about five days of doses.
                </FieldHint>
                {errors.stock && <p className="col-span-2 text-xs text-[#B02C2C] sm:col-span-3">{errors.stock}</p>}
              </div>
            )}
          </section>

          {/* Who + instructions */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={f("for")}>For (optional)</Label>
              <Input
                id={f("for")}
                value={draft.for_person}
                onChange={(e) => set({ for_person: e.target.value })}
                placeholder="e.g. Mom, Papa — leave empty if it's yours"
                maxLength={40}
                list={people.length ? f("people") : undefined}
                autoComplete="off"
              />
              {people.length > 0 && (
                <datalist id={f("people")}>
                  {people.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor={f("instr")}>Instructions (optional)</Label>
              <Textarea
                id={f("instr")}
                value={draft.instructions}
                onChange={(e) => set({ instructions: e.target.value })}
                placeholder="e.g. Dissolve in half a glass of water. Don't take with milk."
                maxLength={300}
                className="min-h-[72px]"
              />
            </div>
          </section>

          {editing && current && (
            <section className="flex flex-wrap items-center gap-2 border-t border-[rgba(20,20,20,0.08)] pt-4">
              <Button variant="secondary" size="sm" onClick={toggleActive} loading={toggling}>
                {!toggling && (current.active ? <PauseCircle size={15} aria-hidden /> : <PlayCircle size={15} aria-hidden />)}
                {current.active ? "Pause reminders" : "Resume reminders"}
              </Button>
              {confirmDelete ? (
                <div className="flex flex-wrap items-center gap-2" role="alert">
                  <span className="text-[13px] text-orza-strong">Delete {current.name}, its photos and history?</span>
                  <Button variant="danger" size="sm" onClick={remove} loading={deleting}>
                    Yes, delete
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                    Keep it
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} className="text-[#B02C2C] hover:text-[#962424]">
                  <Trash2 size={15} aria-hidden />
                  Delete medicine
                </Button>
              )}
            </section>
          )}

          <div className="sticky bottom-0 z-[1] -mx-6 flex items-center justify-end gap-2 border-t border-[rgba(20,20,20,0.08)] bg-[rgba(255,255,255,0.96)] px-6 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:-mx-7 sm:px-7">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving} disabled={photoBusy}>
              {editing ? "Save changes" : draft.schedule.as_needed ? "Add medicine" : "Add & set alarms"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
