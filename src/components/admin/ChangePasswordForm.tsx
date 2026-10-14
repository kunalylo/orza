"use client";
import * as React from "react";
import { Check, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/form";
import { FieldError } from "@/components/account/ui";
import { NETWORK_ERROR_MESSAGE } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { PasswordInput } from "./ui";

type Field = "current" | "next" | "confirm";
type Errors = Partial<Record<Field | "form", string>>;

type Result = { ok: true } | { ok: false; status: number; error: string; code?: string };

/**
 * POST /api/account/password with a plain fetch, so every status (including a 401 with code
 * "wrong_password", which just means the current password was mistyped) is handled right here.
 */
async function changePassword(current_password: string, new_password: string): Promise<Result> {
  let res: Response;
  try {
    res = await fetch("/api/account/password", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password, new_password }),
    });
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR_MESSAGE };
  }
  const data = await res.json().catch(() => null);
  if (res.ok) return { ok: true };
  return { ok: false, status: res.status, error: data?.error || "Something went wrong. Please try again.", code: data?.code };
}

/**
 * Change password: current password, new password (8–128, different) and a confirmation. On success
 * every other signed-in device is signed out; this one stays signed in.
 */
export function ChangePasswordForm({ username, className }: { /** The account email, for password managers. */ username?: string; className?: string }) {
  const [values, setValues] = React.useState<Record<Field, string>>({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = React.useState<Errors>({});
  const [saving, setSaving] = React.useState(false);
  const refs = {
    current: React.useRef<HTMLInputElement>(null),
    next: React.useRef<HTMLInputElement>(null),
    confirm: React.useRef<HTMLInputElement>(null),
  };

  function set(f: Field, v: string) {
    setValues((s) => ({ ...s, [f]: v }));
    if (errors[f] || errors.form) setErrors((x) => ({ ...x, [f]: undefined, form: undefined }));
  }

  function validate(): Errors {
    const e: Errors = {};
    if (!values.current) e.current = "Enter your current password";
    if (!values.next) e.next = "Choose a new password";
    else if (values.next.length < 8) e.next = "Use at least 8 characters";
    else if (values.next.length > 128) e.next = "Use 128 characters or fewer";
    else if (values.next === values.current) e.next = "Choose a password that's different from your current one";
    if (!e.next && values.confirm !== values.next) e.confirm = "The passwords don't match";
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (saving) return;
    const errs = validate();
    setErrors(errs);
    const firstInvalid = (["current", "next", "confirm"] as Field[]).find((f) => errs[f]);
    if (firstInvalid) {
      refs[firstInvalid].current?.focus();
      return;
    }
    setSaving(true);
    const res = await changePassword(values.current, values.next);
    setSaving(false);
    if (res.ok) {
      setValues({ current: "", next: "", confirm: "" });
      setErrors({});
      toast.success("Password changed", { description: "You've been signed out on your other devices." });
      return;
    }
    if (res.status === 401 && res.code !== "wrong_password") {
      // The session itself expired: sign in again and come back here.
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    // Validation errors read "new_password: …" / "current_password: …".
    const field = /^(current_password|new_password):\s*(.+)$/.exec(res.error);
    if (res.code === "wrong_password") {
      setErrors({ current: res.error });
      setValues((s) => ({ ...s, current: "" }));
      refs.current.current?.focus();
    } else if (field) {
      const f: Field = field[1] === "current_password" ? "current" : "next";
      setErrors({ [f]: field[2] });
      refs[f].current?.focus();
    } else {
      setErrors({ form: res.error });
    }
    toast.error(field ? field[2] : res.error);
  }

  const strongEnough = values.next.length >= 8;

  return (
    <form onSubmit={submit} noValidate className={cn("max-w-md", className)}>
      {/* Lets password managers save the new password against the right account. */}
      {username && <input type="text" name="username" autoComplete="username" value={username} hidden readOnly />}
      <div>
        <Label htmlFor="pw-current">Current password</Label>
        <PasswordInput
          ref={refs.current}
          id="pw-current"
          autoComplete="current-password"
          value={values.current}
          onChange={(e) => set("current", e.target.value)}
          aria-invalid={!!errors.current}
          aria-describedby={errors.current ? "pw-current-error" : undefined}
        />
        <FieldError id="pw-current-error">{errors.current}</FieldError>
      </div>
      <div className="mt-4">
        <Label htmlFor="pw-next">New password</Label>
        <PasswordInput
          ref={refs.next}
          id="pw-next"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={values.next}
          onChange={(e) => set("next", e.target.value)}
          aria-invalid={!!errors.next}
          aria-describedby={errors.next ? "pw-next-error" : "pw-next-hint"}
        />
        {errors.next ? (
          <FieldError id="pw-next-error">{errors.next}</FieldError>
        ) : (
          <p id="pw-next-hint" className={cn("mt-1.5 flex items-center gap-1.5 text-xs transition-colors duration-150", strongEnough ? "text-orza-success" : "text-orza-subtle")}>
            <Check size={13} strokeWidth={2} aria-hidden className={strongEnough ? "opacity-100" : "opacity-40"} />
            At least 8 characters
          </p>
        )}
      </div>
      <div className="mt-4">
        <Label htmlFor="pw-confirm">Confirm new password</Label>
        <PasswordInput
          ref={refs.confirm}
          id="pw-confirm"
          autoComplete="new-password"
          value={values.confirm}
          onChange={(e) => set("confirm", e.target.value)}
          aria-invalid={!!errors.confirm}
          aria-describedby={errors.confirm ? "pw-confirm-error" : undefined}
        />
        <FieldError id="pw-confirm-error">{errors.confirm}</FieldError>
      </div>

      {errors.form && (
        <p role="alert" className="mt-4 rounded-orza-xs bg-[#FDECEC] px-3 py-2 text-[13px] text-[#B02C2C]">
          {errors.form}
        </p>
      )}

      <Button type="submit" variant="primary" loading={saving} className="mt-6">
        {!saving && <KeyRound size={15} strokeWidth={1.75} aria-hidden />}
        {saving ? "Changing password…" : "Change password"}
      </Button>
      <p className="mt-3 text-xs text-orza-subtle">Changing it signs you out on every other device. You stay signed in here.</p>
    </form>
  );
}
