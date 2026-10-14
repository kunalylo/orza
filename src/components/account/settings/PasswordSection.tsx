"use client";
import * as React from "react";
import { Check, Eye, EyeOff, KeyRound, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/components/app/UserProvider";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { FieldError, SectionCard } from "@/components/account/ui";
import { NETWORK_ERROR_MESSAGE } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const MIN = 8;
const MAX = 128;

type Field = "current" | "next" | "confirm";
type Values = Record<Field, string>;
type Errors = Partial<Record<Field, string>>;

const EMPTY: Values = { current: "", next: "", confirm: "" };

class PasswordChangeError extends Error {
  constructor(message: string, public field?: Field) {
    super(message);
  }
}

/**
 * POST /api/account/password {current_password, new_password}.
 * Uses fetch directly so every status is handled here: a 401 with code "wrong_password" means the
 * current password was wrong; code "unauthorized" means the session expired.
 */
async function changePassword(current: string, next: string) {
  let res: Response;
  try {
    res = await fetch("/api/account/password", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: current, new_password: next }),
    });
  } catch {
    throw new PasswordChangeError(NETWORK_ERROR_MESSAGE);
  }
  if (res.ok) return;
  const data: { error?: string; code?: string } | null = await res.json().catch(() => null);
  if (res.status === 401) {
    // An expired session (code "unauthorized") rather than a wrong password ("wrong_password"): sign in again, then come back.
    if (data?.code === "unauthorized") {
      window.location.href = `/login?next=${encodeURIComponent("/dashboard/settings#security")}`;
      throw new PasswordChangeError("Please sign in again to change your password.");
    }
    throw new PasswordChangeError("Current password is incorrect", "current");
  }
  if (res.status === 429) throw new PasswordChangeError(data?.error || "Too many attempts. Please wait a few minutes and try again.");
  // Validation errors read "new_password: …" / "current_password: …".
  const msg = data?.error || "";
  const m = /^(current_password|new_password):\s*(.+)$/.exec(msg);
  if (m) throw new PasswordChangeError(m[2], m[1] === "current_password" ? "current" : "next");
  throw new PasswordChangeError(msg || "We couldn't change your password. Please try again.");
}

function validate(v: Values): Errors {
  const e: Errors = {};
  if (!v.current) e.current = "Enter your current password.";
  if (!v.next) e.next = "Choose a new password.";
  else if (v.next.length < MIN) e.next = `Use at least ${MIN} characters.`;
  else if (v.next.length > MAX) e.next = `Keep it to ${MAX} characters or fewer.`;
  else if (v.current && v.next === v.current) e.next = "Pick a password that's different from your current one.";
  if (!v.confirm) e.confirm = "Type the new password again.";
  else if (v.next && v.confirm !== v.next) e.confirm = "The passwords don't match.";
  return e;
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  error,
  hint,
  shown,
  onToggle,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder?: string;
  error?: string;
  hint?: React.ReactNode;
  shown: boolean;
  onToggle: () => void;
}) {
  const describedBy = cn(error && `${id}-error`, !error && hint && `${id}-hint`) || undefined;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={MAX}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cn("pr-12", error && "border-[rgba(176,44,44,0.45)]")}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={shown}
          aria-controls={id}
          className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-orza-subtle transition-colors duration-150 ease-orza hover:bg-black/5 hover:text-orza-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan"
        >
          {shown ? <EyeOff size={17} strokeWidth={1.75} aria-hidden /> : <Eye size={17} strokeWidth={1.75} aria-hidden />}
        </button>
      </div>
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : hint}
    </div>
  );
}

/** Change password — current + new + confirm. Other devices are signed out; this one stays signed in. */
export function PasswordSection() {
  const { user } = useUser();
  const [values, setValues] = React.useState<Values>(EMPTY);
  const [errors, setErrors] = React.useState<Errors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [shown, setShown] = React.useState<Record<Field, boolean>>({ current: false, next: false, confirm: false });
  const [saving, setSaving] = React.useState(false);
  const ids = React.useId();
  const fid = (f: Field) => `${ids}-${f}`;

  const set = (f: Field) => (v: string) => {
    setValues((s) => ({ ...s, [f]: v }));
    setFormError(null);
    // Clear this field's error, and the confirm error once the two passwords line up again.
    setErrors((e) => {
      const nextErr: Errors = { ...e, [f]: undefined };
      if (f === "next" || f === "confirm") nextErr.confirm = undefined;
      return nextErr;
    });
  };
  const toggle = (f: Field) => () => setShown((s) => ({ ...s, [f]: !s[f] }));

  const dirty = values.current !== "" || values.next !== "" || values.confirm !== "";
  const longEnough = values.next.length >= MIN;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const errs = validate(values);
    setErrors(errs);
    setFormError(null);
    const first = (["current", "next", "confirm"] as Field[]).find((f) => errs[f]);
    if (first) {
      document.getElementById(fid(first))?.focus();
      return;
    }
    setSaving(true);
    try {
      await changePassword(values.current, values.next);
      setValues(EMPTY);
      setShown({ current: false, next: false, confirm: false });
      toast.success("Password changed", { description: "You're still signed in here. Your other devices have been signed out." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "We couldn't change your password. Please try again.";
      const field = err instanceof PasswordChangeError ? err.field : undefined;
      if (field) {
        setErrors({ [field]: message });
        document.getElementById(fid(field))?.focus();
      } else {
        setFormError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  const reset = () => {
    setValues(EMPTY);
    setErrors({});
    setFormError(null);
    setShown({ current: false, next: false, confirm: false });
  };

  return (
    <SectionCard
      id="security"
      icon={<KeyRound size={18} strokeWidth={1.75} aria-hidden />}
      tone="energy"
      eyebrow="Security"
      title="Change password"
      description="Choose a new password for signing in to ÖRZA."
    >
      <form onSubmit={submit} noValidate>
        {/* Lets password managers save the new password against this account. */}
        <input type="email" name="username" autoComplete="username" value={user.email} readOnly hidden />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 md:max-w-[calc(50%-8px)]">
            <PasswordField
              id={fid("current")}
              label="Current password"
              value={values.current}
              onChange={set("current")}
              autoComplete="current-password"
              placeholder="Enter your current password"
              error={errors.current}
              shown={shown.current}
              onToggle={toggle("current")}
            />
          </div>
          <PasswordField
            id={fid("next")}
            label="New password"
            value={values.next}
            onChange={set("next")}
            autoComplete="new-password"
            placeholder={`At least ${MIN} characters`}
            error={errors.next}
            shown={shown.next}
            onToggle={toggle("next")}
            hint={
              <p
                id={`${fid("next")}-hint`}
                className={cn("mt-1.5 flex items-center gap-1.5 text-xs transition-colors duration-150", longEnough ? "text-[#127A56]" : "text-orza-subtle")}
              >
                <Check size={13} strokeWidth={2} aria-hidden className={longEnough ? "opacity-100" : "opacity-40"} />
                At least {MIN} characters
              </p>
            }
          />
          <PasswordField
            id={fid("confirm")}
            label="Confirm new password"
            value={values.confirm}
            onChange={set("confirm")}
            autoComplete="new-password"
            placeholder="Type it again"
            error={errors.confirm}
            shown={shown.confirm}
            onToggle={toggle("confirm")}
          />
        </div>

        {formError && (
          <p role="alert" className="mt-4 rounded-orza-xs bg-[#FDECEC] px-3 py-2 text-[13px] text-[#B02C2C]">
            {formError}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[rgba(20,20,20,0.08)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-orza-subtle">
            <MonitorSmartphone size={14} strokeWidth={1.75} className="mt-px shrink-0" aria-hidden />
            <span>Changing your password signs you out on your other devices. You stay signed in here.</span>
          </p>
          <div className="flex shrink-0 gap-2">
            {dirty && (
              <Button type="button" variant="ghost" onClick={reset} disabled={saving}>
                Clear
              </Button>
            )}
            <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
              Update password
            </Button>
          </div>
        </div>
      </form>
    </SectionCard>
  );
}
