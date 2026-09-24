"use client";
import * as React from "react";
import { Brain, Lock, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/components/app/UserProvider";
import { EmptyState } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/form";
import { MEMORY_MAX_ITEMS, MEMORY_MAX_LENGTH } from "@/components/account/options";
import { FieldError, SectionCard } from "@/components/account/ui";
import type { UserResponse } from "@/components/account/types";
import { api, errorMessage } from "@/lib/api-client";

/** "What ÖRZA remembers" — the short facts used to personalise advice; view, add, forget. */
export function MemorySection() {
  const { user, setUser } = useUser();
  const memory = React.useMemo(() => user.memory || [], [user.memory]);
  const [busy, setBusy] = React.useState(false);
  const [adding, setAdding] = React.useState("");
  const [addError, setAddError] = React.useState<string | null>(null);
  const [confirmClear, setConfirmClear] = React.useState(false);

  const full = memory.length >= MEMORY_MAX_ITEMS;

  async function save(next: string[], success?: { message: string; undo?: string[] }) {
    setBusy(true);
    try {
      const res = await api.put<UserResponse>("/settings/memory", { memory: next });
      setUser(res.user);
      if (success) {
        const undo = success.undo;
        toast.success(success.message, {
          action: undo
            ? {
                label: "Undo",
                onClick: () => {
                  save(undo);
                },
              }
            : undefined,
        });
      }
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const fact = adding.replace(/\s+/g, " ").trim();
    if (!fact) return;
    if (fact.length > MEMORY_MAX_LENGTH) return setAddError(`Keep it under ${MEMORY_MAX_LENGTH} characters`);
    if (memory.some((m) => m.toLowerCase() === fact.toLowerCase())) return setAddError("ÖRZA already remembers that");
    if (full) return setAddError(`ÖRZA can remember up to ${MEMORY_MAX_ITEMS} things — forget one first`);
    setAddError(null);
    if (await save([...memory, fact], { message: "ÖRZA will remember that" })) setAdding("");
  }

  const forget = (index: number) => save(memory.filter((_, i) => i !== index), { message: "Forgotten", undo: memory });

  return (
    <SectionCard
      id="memory"
      icon={<Brain size={18} strokeWidth={1.75} aria-hidden />}
      tone="violet"
      eyebrow="Memory"
      title="What ÖRZA remembers"
      description="As you chat, ÖRZA keeps short notes — like your diet, routine or favourite foods — so its advice fits your life. You're in control: remove anything, any time."
      actions={
        memory.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)} disabled={busy}>
            <Trash2 size={14} strokeWidth={1.75} aria-hidden /> Forget everything
          </Button>
        ) : undefined
      }
    >
      {memory.length === 0 ? (
        <EmptyState
          icon={<Brain size={20} strokeWidth={1.75} aria-hidden />}
          title="Nothing saved yet"
          description="Chat with ÖRZA and it will note helpful details here. You can also add something yourself below."
        />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Things ÖRZA remembers" aria-busy={busy}>
          {memory.map((fact, i) => (
            <li
              key={`${fact}-${i}`}
              className="group flex items-start gap-3 rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/60 py-2.5 pl-4 pr-2 transition-colors duration-150 ease-orza hover:bg-white/80"
            >
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-orza-dot" aria-hidden />
              <span className="min-w-0 flex-1 break-words py-0.5 text-[14px] leading-relaxed text-orza-strong">{fact}</span>
              <button
                type="button"
                onClick={() => forget(i)}
                disabled={busy}
                aria-label={`Forget: ${fact}`}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-orza-subtle transition-colors hover:bg-[#FDECEC] hover:text-[#B02C2C] disabled:opacity-50"
              >
                <X size={15} strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="mt-4" noValidate>
        <div className="flex gap-2">
          <Input
            aria-label="Something ÖRZA should remember"
            value={adding}
            maxLength={MEMORY_MAX_LENGTH}
            onChange={(e) => {
              setAdding(e.target.value);
              if (addError) setAddError(null);
            }}
            placeholder={full ? "Memory is full — forget something first" : "e.g. I don't eat onion or garlic on Tuesdays"}
            disabled={full}
            aria-invalid={!!addError}
            aria-describedby={addError ? "memory-add-error" : undefined}
          />
          <Button type="submit" variant="secondary" disabled={!adding.trim() || busy || full} className="shrink-0">
            <Plus size={15} strokeWidth={1.75} aria-hidden /> Add
          </Button>
        </div>
        <FieldError id="memory-add-error">{addError}</FieldError>
      </form>

      <div className="mt-5 flex items-start gap-2.5 rounded-orza-sm bg-[rgba(135,87,242,0.06)] px-4 py-3 text-[13px] leading-relaxed text-orza-muted">
        <Lock size={14} strokeWidth={1.75} className="mt-[3px] shrink-0 text-[#6E3ED6]" aria-hidden />
        <p>
          These notes are private to your account and only used to personalise ÖRZA for you. We never share personal health information
          without your consent.{" "}
          <span className="tabular-nums">
            {memory.length}/{MEMORY_MAX_ITEMS}
          </span>{" "}
          saved.
        </p>
      </div>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent title="Forget everything?" description="ÖRZA will clear every note it keeps about you. Your meals, goals and history stay as they are.">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="ghost">Keep them</Button>
            </DialogClose>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                const previous = memory;
                if (await save([], { message: "ÖRZA's memory is cleared", undo: previous })) setConfirmClear(false);
              }}
            >
              Forget everything
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
