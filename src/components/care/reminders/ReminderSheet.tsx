"use client";
import * as React from "react";
import { toast } from "sonner";
import { Bell, Droplets, Plus, Repeat, Scale, Trash2, UtensilsCrossed, X } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FieldHint, Input, Label, Textarea } from "@/components/ui/form";
import { FieldError, Switch } from "@/components/account/ui";
import type { ReminderChannels, ReminderKind } from "@/lib/types";
import {
  DEFAULT_CHANNELS,
  KIND_DEFAULT_BODY,
  KIND_DEFAULT_TITLE,
  KIND_LABEL,
  MAX_TIMES_PER_REMINDER,
  REMINDER_KINDS,
  WEEKDAYS_LETTER,
  WEEKDAYS_SHORT,
  describeDays,
  isHHMM,
  timesEvery,
  type ReminderView,
} from "./shared";

export const KIND_ICON: Record<ReminderKind, React.ElementType> = {
  meal: UtensilsCrossed,
  water: Droplets,
  weight: Scale,
  custom: Bell,
};

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// Display the week Monday-first (Indian calendars), values stay 0 = Sunday.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

interface Draft {
  kind: ReminderKind;
  title: string;
  body: string;
  times: string[];
  days: number[];
  channels: ReminderChannels;
  active: boolean;
}

function draftFrom(r: ReminderView | null): Draft {
  if (r) {
    return {
      kind: r.kind,
      title: r.title,
      body: r.body || "",
      times: [...r.schedule.times],
      days: [...(r.schedule.days || [])],
      channels: { ...DEFAULT_CHANNELS, ...r.channels },
      active: r.active,
    };
  }
  return {
    kind: "meal",
    title: KIND_DEFAULT_TITLE.meal,
    body: "",
    times: ["09:00"],
    days: [],
    channels: { ...DEFAULT_CHANNELS },
    active: true,
  };
}

export function ReminderSheet({
  open,
  onOpenChange,
  reminder,
  whatsappAvailable,
  whatsappReady,
  pushReady,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create a new reminder */
  reminder: ReminderView | null;
  /** WhatsApp messaging is set up on the server. When false the WhatsApp channel isn't shown at all. */
  whatsappAvailable: boolean;
  /** WhatsApp is available and the user saved + opted in a number. */
  whatsappReady: boolean;
  /** At least one device has notifications on. */
  pushReady: boolean;
  onSaved: (r: ReminderView, created: boolean) => void;
  onDeleted: (id: string) => void;
}) {
  const [draft, setDraft] = React.useState<Draft>(() => draftFrom(reminder));
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [errors, setErrors] = React.useState<{ title?: string; times?: string; channels?: string }>({});
  const [repeat, setRepeat] = React.useState({ open: false, every: 2, from: "09:00", to: "21:00" });
  const ids = React.useId();

  React.useEffect(() => {
    if (open) {
      setDraft(draftFrom(reminder));
      setErrors({});
      setConfirmDelete(false);
      setRepeat({ open: false, every: 2, from: "09:00", to: "21:00" });
    }
  }, [open, reminder]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const changeKind = (kind: ReminderKind) =>
    setDraft((d) => {
      const untouched = !d.title.trim() || REMINDER_KINDS.some((k) => KIND_DEFAULT_TITLE[k] === d.title.trim());
      return { ...d, kind, title: untouched ? KIND_DEFAULT_TITLE[kind] : d.title };
    });

  const setTime = (i: number, value: string) => set("times", draft.times.map((t, j) => (j === i ? value : t)));
  const removeTime = (i: number) => set("times", draft.times.filter((_, j) => j !== i));
  const addTime = () => {
    const last = [...draft.times].filter(isHHMM).sort().pop();
    let next = "12:00";
    if (last) {
      const [h, m] = last.split(":").map(Number);
      next = `${String(Math.min(23, h + 2)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    set("times", [...draft.times, next].slice(0, MAX_TIMES_PER_REMINDER));
  };
  const fillRepeat = () => {
    if (!isHHMM(repeat.from) || !isHHMM(repeat.to) || repeat.to <= repeat.from) {
      toast.error("Choose a start time before the end time.");
      return;
    }
    const times = timesEvery(repeat.from, repeat.to, Math.round(repeat.every * 60));
    set("times", times);
    setRepeat((r) => ({ ...r, open: false }));
  };

  const toggleDay = (d: number) => {
    const current = draft.days.length ? draft.days : [0, 1, 2, 3, 4, 5, 6];
    const next = current.includes(d) ? current.filter((x) => x !== d) : [...current, d];
    set("days", next.length === 7 ? [] : next.sort((a, b) => a - b));
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!draft.title.trim()) e.title = "Give the reminder a title.";
    const valid = draft.times.filter(isHHMM);
    if (!valid.length) e.times = "Add at least one time.";
    else if (valid.length !== draft.times.length) e.times = "Fix or remove the empty time.";
    if (!draft.channels.push && !(whatsappAvailable && draft.channels.whatsapp) && !draft.channels.calendar) e.channels = "Pick at least one way to be reminded.";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (saving || !validate()) return;
    setSaving(true);
    const payload = {
      kind: draft.kind,
      title: draft.title.trim(),
      body: draft.body.trim() || null,
      schedule: { times: draft.times, days: draft.days },
      channels: draft.channels,
      active: draft.active,
    };
    try {
      if (reminder) {
        const res = await api.patch<{ reminder: ReminderView }>(`/reminders/${reminder.id}`, payload);
        onSaved(res.reminder, false);
        toast.success("Reminder updated");
      } else {
        const res = await api.post<{ reminder: ReminderView }>("/reminders", { ...payload, body: payload.body || undefined });
        onSaved(res.reminder, true);
        toast.success("Reminder added");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!reminder || deleting) return;
    setDeleting(true);
    try {
      await api.del(`/reminders/${reminder.id}`);
      onDeleted(reminder.id);
      toast.success("Reminder deleted");
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  const activeDays = draft.days.length ? draft.days : [0, 1, 2, 3, 4, 5, 6];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={reminder ? "Edit reminder" : "New reminder"}
        description="Times are in your own timezone. ÖRZA nudges you on the channels you pick."
      >
        <form onSubmit={save} noValidate className="space-y-5">
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-orza-strong" id={`${ids}-kind`}>
              Type
            </span>
            <div role="radiogroup" aria-labelledby={`${ids}-kind`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {REMINDER_KINDS.map((k) => {
                const Icon = KIND_ICON[k];
                const on = draft.kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => changeKind(k)}
                    className={cn(
                      "inline-flex h-10 items-center justify-center gap-1.5 rounded-full border text-[13px] font-medium transition-colors duration-150",
                      on
                        ? "border-transparent bg-[#141414] text-orza-bg-0"
                        : "border-[rgba(20,20,20,0.12)] bg-white/70 text-orza-muted hover:text-orza-strong"
                    )}
                  >
                    <Icon size={14} aria-hidden /> {KIND_LABEL[k]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label htmlFor={`${ids}-title`}>Title</Label>
            <Input
              id={`${ids}-title`}
              value={draft.title}
              maxLength={80}
              onChange={(e) => set("title", e.target.value)}
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? `${ids}-title-err` : undefined}
              placeholder={KIND_DEFAULT_TITLE[draft.kind]}
            />
            <FieldError id={`${ids}-title-err`}>{errors.title}</FieldError>
          </div>

          <div>
            <Label htmlFor={`${ids}-body`}>
              Message <span className="font-normal text-orza-subtle">(optional)</span>
            </Label>
            <Textarea
              id={`${ids}-body`}
              value={draft.body}
              maxLength={240}
              onChange={(e) => set("body", e.target.value)}
              placeholder={KIND_DEFAULT_BODY[draft.kind]}
              className="min-h-[72px]"
            />
          </div>

          <fieldset>
            <legend className="mb-1.5 block text-[13px] font-medium text-orza-strong">Times</legend>
            <div className="flex flex-wrap gap-2">
              {draft.times.map((t, i) => (
                <div key={i} className="flex items-center gap-1 rounded-full border border-[rgba(20,20,20,0.12)] bg-white/80 py-1 pl-3 pr-1">
                  <input
                    type="time"
                    step={60}
                    value={t}
                    onChange={(e) => setTime(i, e.target.value)}
                    aria-label={`Time ${i + 1}`}
                    className="h-8 w-[92px] bg-transparent text-[15px] tabular-nums text-orza-strong focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeTime(i)}
                    disabled={draft.times.length <= 1}
                    aria-label={`Remove time ${t || i + 1}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-orza-muted hover:bg-black/5 hover:text-orza-strong disabled:opacity-40"
                  >
                    <X size={14} aria-hidden />
                  </button>
                </div>
              ))}
              {draft.times.length < MAX_TIMES_PER_REMINDER && (
                <Button type="button" variant="secondary" size="sm" onClick={addTime}>
                  <Plus size={14} aria-hidden /> Add time
                </Button>
              )}
            </div>
            <FieldError id={`${ids}-times-err`}>{errors.times}</FieldError>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => setRepeat((r) => ({ ...r, open: !r.open }))}
                aria-expanded={repeat.open}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#0B8FA6] hover:underline"
              >
                <Repeat size={13} aria-hidden /> Repeat through the day
              </button>
              {repeat.open && (
                <div className="mt-2 flex flex-wrap items-end gap-2 rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/60 p-3">
                  <div>
                    <Label htmlFor={`${ids}-every`} className="text-[12px]">
                      Every
                    </Label>
                    <select
                      id={`${ids}-every`}
                      value={repeat.every}
                      onChange={(e) => setRepeat((r) => ({ ...r, every: Number(e.target.value) }))}
                      className="h-10 rounded-orza-sm border border-[rgba(20,20,20,0.12)] bg-white px-2 text-sm"
                    >
                      {[0.5, 1, 1.5, 2, 3, 4].map((h) => (
                        <option key={h} value={h}>
                          {h < 1 ? "30 min" : `${h} h`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor={`${ids}-from`} className="text-[12px]">
                      From
                    </Label>
                    <input
                      id={`${ids}-from`}
                      type="time"
                      value={repeat.from}
                      onChange={(e) => setRepeat((r) => ({ ...r, from: e.target.value }))}
                      className="h-10 rounded-orza-sm border border-[rgba(20,20,20,0.12)] bg-white px-2 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${ids}-to`} className="text-[12px]">
                      Until
                    </Label>
                    <input
                      id={`${ids}-to`}
                      type="time"
                      value={repeat.to}
                      onChange={(e) => setRepeat((r) => ({ ...r, to: e.target.value }))}
                      className="h-10 rounded-orza-sm border border-[rgba(20,20,20,0.12)] bg-white px-2 text-sm tabular-nums"
                    />
                  </div>
                  <Button type="button" size="sm" variant="primary" onClick={fillRepeat}>
                    Fill times
                  </Button>
                </div>
              )}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 block text-[13px] font-medium text-orza-strong">
              Days <span className="font-normal text-orza-subtle">· {describeDays(draft.days)}</span>
            </legend>
            <div className="flex gap-1 sm:gap-1.5">
              {WEEK_ORDER.map((d) => {
                const on = activeDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    aria-pressed={on}
                    aria-label={WEEKDAY_NAMES[d]}
                    title={WEEKDAYS_SHORT[d]}
                    disabled={on && activeDays.length === 1}
                    className={cn(
                      "inline-flex h-9 w-9 items-center justify-center rounded-full border text-[13px] font-medium transition-colors duration-150 sm:h-10 sm:w-10",
                      on
                        ? "border-transparent bg-[#141414] text-orza-bg-0"
                        : "border-[rgba(20,20,20,0.12)] bg-white/70 text-orza-muted hover:text-orza-strong"
                    )}
                  >
                    {WEEKDAYS_LETTER[d]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1 block text-[13px] font-medium text-orza-strong">Remind me by</legend>
            <div className="divide-y divide-[rgba(20,20,20,0.06)]">
              <ChannelRow
                id={`${ids}-push`}
                title="App notification"
                hint={pushReady ? "On your devices with notifications on, plus the in-app alarm." : "Turn on notifications above so this reaches your phone."}
                checked={draft.channels.push}
                onChange={(v) => set("channels", { ...draft.channels, push: v })}
              />
              {whatsappAvailable && (
                <ChannelRow
                  id={`${ids}-wa`}
                  title="WhatsApp"
                  hint={whatsappReady ? "Sent to your saved WhatsApp number." : "Save your WhatsApp number and consent first."}
                  checked={draft.channels.whatsapp}
                  disabled={!whatsappReady && !draft.channels.whatsapp}
                  onChange={(v) => set("channels", { ...draft.channels, whatsapp: v })}
                />
              )}
              <ChannelRow
                id={`${ids}-cal`}
                title="Calendar"
                hint="Adds it to your ÖRZA calendar feed, so your phone's calendar can ring too."
                checked={draft.channels.calendar}
                onChange={(v) => set("channels", { ...draft.channels, calendar: v })}
              />
            </div>
            <FieldError>{errors.channels}</FieldError>
          </fieldset>

          <div className="flex items-center justify-between gap-4 rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/60 px-4 py-3">
            <div>
              <div id={`${ids}-active-label`} className="text-[14px] font-medium text-orza-strong">
                Active
              </div>
              <FieldHint className="mt-0">Pause it without deleting.</FieldHint>
            </div>
            <Switch checked={draft.active} onCheckedChange={(v) => set("active", v)} aria-labelledby={`${ids}-active-label`} />
          </div>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
            {reminder ? (
              confirmDelete ? (
                <div className="flex items-center gap-2" role="group" aria-label="Confirm delete">
                  <Button type="button" variant="danger" size="sm" loading={deleting} onClick={remove}>
                    Delete reminder
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                    Keep
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} className="text-[#B02C2C] hover:text-[#962424]">
                  <Trash2 size={14} aria-hidden /> Delete
                </Button>
              )
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving} className="flex-1 sm:flex-none">
                {reminder ? "Save changes" : "Add reminder"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChannelRow({
  id,
  title,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  title: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div id={`${id}-label`} className="text-[14px] text-orza-strong">
          {title}
        </div>
        <p id={`${id}-hint`} className="text-[12px] leading-snug text-orza-subtle">
          {hint}
        </p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-labelledby={`${id}-label`} aria-describedby={`${id}-hint`} />
    </div>
  );
}
