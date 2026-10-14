"use client";
import * as React from "react";
import { KeyRound, RotateCw, ShieldCheck, Sparkles, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/app/ui";
import { Eyebrow, GlassCard, Tag } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { FieldHint, Input, Label, Segmented, Skeleton } from "@/components/ui/form";
import { FieldError, LoadError, formatDate, formatDateTime, plural, relativeDay } from "@/components/account/ui";
import { api, ApiError, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { CreateAdminResponse, ResetPasswordResponse, TeamAdmin, TeamResponse } from "./types";
import { OneTimePassword, PasswordInput, RoleTag, SuperAdminOnly } from "./ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const cleanName = (s: string) => s.replace(/\s+/g, " ").trim();

/** "Last sign-in today" / "… 3 days ago" / "… on 2 Sept 2026". */
function lastSignInLabel(iso: string) {
  const r = relativeDay(iso);
  if (r === "Today" || r === "Yesterday") return `Last sign-in ${r.toLowerCase()}`;
  return r.endsWith("ago") ? `Last sign-in ${r}` : `Last sign-in on ${r}`;
}

function Avatar({ admin }: { admin: TeamAdmin }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-editorial text-[16px] font-semibold",
        admin.admin_role === "super" ? "bg-orza-energy text-white" : "bg-[#141414] text-orza-bg-0"
      )}
    >
      {(admin.name || admin.email || "?").trim().slice(0, 1).toUpperCase()}
    </span>
  );
}

/* ───────────────────────────── Add sub-admin ───────────────────────────── */

type PasswordMode = "generate" | "custom";

function AddAdminDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (a: TeamAdmin) => void }) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [mode, setMode] = React.useState<PasswordMode>("generate");
  const [password, setPassword] = React.useState("");
  const [errors, setErrors] = React.useState<{ name?: string; email?: string; password?: string; form?: string }>({});
  const [saving, setSaving] = React.useState(false);
  const [created, setCreated] = React.useState<CreateAdminResponse | null>(null);
  const nameRef = React.useRef<HTMLInputElement>(null);
  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);

  // Start fresh every time the dialog opens (and never keep a shown password around).
  React.useEffect(() => {
    if (!open) {
      setCreated(null);
      setPassword("");
      return;
    }
    setName("");
    setEmail("");
    setMode("generate");
    setPassword("");
    setErrors({});
    setCreated(null);
  }, [open]);

  function validate() {
    const e: typeof errors = {};
    const n = cleanName(name);
    if (!n) e.name = "Enter their name";
    else if (n.length > 60) e.name = "Keep the name under 60 characters";
    const m = email.trim();
    if (!m) e.email = "Enter their email";
    else if (m.length > 254 || !EMAIL_RE.test(m)) e.email = "Enter a valid email address";
    if (mode === "custom") {
      if (password.length < 8) e.password = "Use at least 8 characters";
      else if (password.length > 128) e.password = "Use 128 characters or fewer";
    }
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const errs = validate();
    setErrors(errs);
    const invalid = errs.name ? nameRef : errs.email ? emailRef : errs.password ? passwordRef : null;
    if (invalid) {
      invalid.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<CreateAdminResponse>("/admin/team", {
        name: cleanName(name),
        email: email.trim().toLowerCase(),
        ...(mode === "custom" ? { password } : {}),
      });
      setCreated(res);
      setPassword("");
      onCreated(res.admin);
      toast.success("Sub-admin added", { description: `${res.admin.name} can now sign in to the admin console.` });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setErrors({ email: e.message });
        emailRef.current?.focus();
      } else {
        setErrors({ form: errorMessage(e) });
      }
    } finally {
      setSaving(false);
    }
  }

  function clear(k: "name" | "email" | "password") {
    if (errors[k] || errors.form) setErrors((x) => ({ ...x, [k]: undefined, form: undefined }));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent
        title={created ? "Sub-admin added" : "Add a sub-admin"}
        description={
          created
            ? `${created.admin.name} · ${created.admin.email}`
            : "Creates a separate staff account. Sub-admins see the admin console only — overview, members and credit requests — not the member app."
        }
      >
        {created ? (
          <div>
            <OneTimePassword password={created.password} label={created.generated ? "Generated password" : "Password you set"} />
            <p className="mt-4 text-[13px] leading-relaxed text-orza-muted">
              They sign in at the normal ÖRZA sign-in page with <span className="font-medium text-orza-strong">{created.admin.email}</span> and land
              straight in the admin console.
            </p>
            <div className="mt-6 flex justify-end">
              <DialogClose asChild>
                <Button variant="primary">Done</Button>
              </DialogClose>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <div>
              <Label htmlFor="team-name">Name</Label>
              <Input
                ref={nameRef}
                id="team-name"
                autoComplete="off"
                maxLength={80}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clear("name");
                }}
                placeholder="e.g. Priya Sharma"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "team-name-error" : undefined}
                autoFocus
              />
              <FieldError id="team-name-error">{errors.name}</FieldError>
            </div>
            <div className="mt-4">
              <Label htmlFor="team-email">Work email</Label>
              <Input
                ref={emailRef}
                id="team-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={254}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clear("email");
                }}
                placeholder="name@yourteam.com"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "team-email-error" : "team-email-hint"}
              />
              {errors.email ? (
                <FieldError id="team-email-error">{errors.email}</FieldError>
              ) : (
                <FieldHint id="team-email-hint">Must not already have an ÖRZA account — staff accounts are separate from member accounts.</FieldHint>
              )}
            </div>
            <div className="mt-5">
              <div id="team-password-mode" className="mb-1.5 text-[13px] font-medium text-orza-strong">
                Password
              </div>
              <Segmented<PasswordMode>
                aria-labelledby="team-password-mode"
                value={mode}
                onChange={(v) => {
                  setMode(v);
                  setErrors((x) => ({ ...x, password: undefined, form: undefined }));
                }}
                options={[
                  {
                    value: "generate",
                    label: (
                      <span className="inline-flex items-center gap-1.5">
                        <Sparkles size={13} strokeWidth={1.75} aria-hidden /> Generate
                      </span>
                    ),
                  },
                  { value: "custom", label: "Set one myself" },
                ]}
                className="w-full [&>button]:flex-1"
              />
              {mode === "generate" ? (
                <FieldHint>A strong 14-character password is created and shown to you once.</FieldHint>
              ) : (
                <div className="mt-3">
                  <Label htmlFor="team-password" className="sr-only">
                    Password for the new sub-admin
                  </Label>
                  <PasswordInput
                    ref={passwordRef}
                    id="team-password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clear("password");
                    }}
                    placeholder="At least 8 characters"
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "team-password-error" : undefined}
                  />
                  <FieldError id="team-password-error">{errors.password}</FieldError>
                </div>
              )}
            </div>

            {errors.form && (
              <p role="alert" className="mt-4 rounded-orza-xs bg-[#FDECEC] px-3 py-2 text-[13px] text-[#B02C2C]">
                {errors.form}
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <DialogClose asChild>
                <Button variant="ghost" disabled={saving}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" variant="primary" loading={saving}>
                {!saving && <UserPlus size={15} strokeWidth={1.75} aria-hidden />}
                Add sub-admin
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────────── Reset / remove ───────────────────────────── */

type Pending = { kind: "reset" | "remove"; admin: TeamAdmin };

function ConfirmDialog({ pending, onClose, onRemoved }: { pending: Pending | null; onClose: () => void; onRemoved: (id: string) => void }) {
  // Keep the last target rendered while the dialog closes.
  const [current, setCurrent] = React.useState<Pending | null>(pending);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [newPassword, setNewPassword] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Never keep a shown password once the dialog is gone.
    setNewPassword(null);
    if (!pending) return;
    setCurrent(pending);
    setBusy(false);
    setError(null);
  }, [pending]);

  async function confirm() {
    if (!current) return;
    const { kind, admin } = current;
    setBusy(true);
    setError(null);
    try {
      if (kind === "reset") {
        const res = await api.post<ResetPasswordResponse>(`/admin/team/${encodeURIComponent(admin.id)}/reset-password`, {});
        setNewPassword(res.password);
        toast.success("Password reset", { description: `${admin.name} was signed out everywhere.` });
      } else {
        await api.del(`/admin/team/${encodeURIComponent(admin.id)}`);
        toast.success("Sub-admin removed", { description: `${admin.name} can no longer sign in.` });
        onRemoved(admin.id);
        onClose();
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const admin = current?.admin;
  const reset = current?.kind === "reset";

  return (
    <Dialog open={!!pending} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent
        title={newPassword ? "New password" : reset ? "Reset password?" : "Remove this sub-admin?"}
        description={admin ? `${admin.name} · ${admin.email}` : undefined}
      >
        {admin &&
          (newPassword ? (
            <div>
              <OneTimePassword password={newPassword} label="New password" />
              <div className="mt-6 flex justify-end">
                <DialogClose asChild>
                  <Button variant="primary">Done</Button>
                </DialogClose>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[14px] leading-relaxed text-orza-muted">
                {reset ? (
                  <>
                    Their current password stops working and they&rsquo;re signed out on every device. You&rsquo;ll get a new password to share with
                    them once.
                  </>
                ) : (
                  <>
                    Their staff account is deleted and they&rsquo;re signed out on every device, so they can&rsquo;t open the admin console again. This
                    can&rsquo;t be undone — you can add them again later as a new sub-admin.
                  </>
                )}
              </p>
              {error && (
                <p role="alert" className="mt-4 rounded-orza-xs bg-[#FDECEC] px-3 py-2 text-[13px] text-[#B02C2C]">
                  {error}
                </p>
              )}
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <DialogClose asChild>
                  <Button variant="ghost" disabled={busy}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button variant="danger" onClick={confirm} loading={busy}>
                  {!busy && (reset ? <KeyRound size={15} strokeWidth={1.75} aria-hidden /> : <Trash2 size={15} strokeWidth={1.75} aria-hidden />)}
                  {reset ? "Reset password" : "Remove sub-admin"}
                </Button>
              </div>
            </div>
          ))}
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────────── Team list ───────────────────────────── */

function AdminRow({ admin, isSelf, onAction }: { admin: TeamAdmin; isSelf: boolean; onAction: (p: Pending) => void }) {
  const manageable = admin.admin_role !== "super" && !isSelf;
  const label = admin.name || admin.email;
  return (
    <li className="rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/60 p-3.5 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar admin={admin} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate text-[15px] font-medium text-orza-strong">{admin.name || "Unnamed"}</span>
              <RoleTag role={admin.admin_role} />
              {isSelf && (
                <Tag tone="neutral" size="sm" dot={false}>
                  You
                </Tag>
              )}
            </div>
            <div className="truncate text-[13px] text-orza-subtle">{admin.email}</div>
            <div className="mt-1 text-[12px] text-orza-subtle">
              <span>Added {formatDate(admin.created_at) || "—"}</span>
              {" · "}
              {admin.last_sign_in ? (
                <time dateTime={admin.last_sign_in} title={formatDateTime(admin.last_sign_in)}>
                  {lastSignInLabel(admin.last_sign_in)}
                </time>
              ) : (
                "Not signed in right now"
              )}
            </div>
          </div>
        </div>
        {manageable ? (
          <div className="flex shrink-0 flex-wrap gap-2 pl-[52px] sm:pl-0">
            <Button variant="secondary" size="sm" onClick={() => onAction({ kind: "reset", admin })} aria-label={`Reset the password of ${label}`}>
              <KeyRound size={14} strokeWidth={1.75} aria-hidden /> Reset password
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAction({ kind: "remove", admin })}
              aria-label={`Remove ${label}`}
              className="text-[#B02C2C] hover:bg-[#FDECEC] hover:text-[#962424]"
            >
              <Trash2 size={14} strokeWidth={1.75} aria-hidden /> Remove
            </Button>
          </div>
        ) : (
          <p className="shrink-0 pl-[52px] text-[12px] text-orza-subtle sm:pl-0 sm:text-right">
            {isSelf ? "Change your password in My account" : "Super admins are managed outside the panel"}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * Team page (super admin only): every admin account with its role, plus "Add sub-admin", reset a
 * sub-admin's password and remove a sub-admin (each behind a confirm step). Generated passwords are
 * shown once.
 */
export function TeamManager({ currentUserId }: { currentUserId: string }) {
  const [admins, setAdmins] = React.useState<TeamAdmin[] | null>(null);
  const [error, setError] = React.useState<{ message: string; forbidden: boolean } | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await api.get<TeamResponse>("/admin/team");
      setAdmins(res.admins);
      setError(null);
    } catch (e) {
      setError({ message: errorMessage(e), forbidden: e instanceof ApiError && e.status === 403 });
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (error?.forbidden) return <SuperAdminOnly title="Team" />;

  const subs = admins?.filter((a) => a.admin_role !== "super").length ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Admin console · super admin"
        title="Team"
        description="Staff accounts that can open this console. Sub-admins handle members and credit requests; only super admins manage the team."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={refresh} loading={refreshing} disabled={!admins && !error}>
              {!refreshing && <RotateCw size={14} strokeWidth={1.75} aria-hidden />}
              Refresh
            </Button>
            <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
              <UserPlus size={14} strokeWidth={1.75} aria-hidden /> Add sub-admin
            </Button>
          </>
        }
      />

      <Reveal y={10}>
        {error && !admins ? (
          <LoadError title="We couldn’t load the team" message={error.message} onRetry={refresh} />
        ) : (
          <GlassCard as="section" aria-labelledby="team-title" variant="strong">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <Eyebrow className="text-[11px]">Admin accounts</Eyebrow>
                <h2 id="team-title" className="mt-1 font-editorial text-[22px] font-semibold leading-7 tracking-[-0.01em] text-orza-strong">
                  Who can sign in here
                </h2>
              </div>
              {admins && (
                <Tag tone="violet" size="sm">
                  {plural(subs, "sub-admin")}
                </Tag>
              )}
            </div>

            {!admins ? (
              <div className="mt-5 flex flex-col gap-2.5" aria-busy="true" aria-label="Loading the team">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-[84px] rounded-orza-sm" />
                ))}
              </div>
            ) : (
              <>
                <ul className="mt-5 flex flex-col gap-2.5" aria-label="Admin accounts">
                  {admins.map((a) => (
                    <AdminRow key={a.id} admin={a} isSelf={a.id === currentUserId} onAction={setPending} />
                  ))}
                </ul>
                {subs === 0 && (
                  <EmptyState
                    className="mt-4"
                    icon={<ShieldCheck size={20} strokeWidth={1.75} aria-hidden />}
                    title="No sub-admins yet"
                    description="Add teammates who should handle members and credit requests. They get their own sign-in and see only this console."
                    action={
                      <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
                        <UserPlus size={14} strokeWidth={1.75} aria-hidden /> Add sub-admin
                      </Button>
                    }
                  />
                )}
              </>
            )}
          </GlassCard>
        )}
      </Reveal>

      <AddAdminDialog open={adding} onOpenChange={setAdding} onCreated={(a) => setAdmins((list) => (list ? [...list, a] : [a]))} />
      <ConfirmDialog
        pending={pending}
        onClose={() => setPending(null)}
        onRemoved={(id) => setAdmins((list) => list && list.filter((a) => a.id !== id))}
      />
    </div>
  );
}
