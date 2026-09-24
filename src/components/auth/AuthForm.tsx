"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, ArrowRight, Check, Eye, EyeOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Segmented } from "@/components/ui/form";
import { GlassCard } from "@/components/orza/primitives";
import { SITE } from "@/lib/site";
import type { PublicUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { destinationFor, type AuthMode } from "./safe-next";

type Field = "name" | "email" | "password";
type FieldErrors = Partial<Record<Field, string>>;
type Values = Record<Field, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EASE = [0.16, 1, 0.3, 1] as const;

const COPY: Record<AuthMode, { title: string; lead: string; submit: string; busy: string }> = {
  signin: { title: "Welcome back", lead: "Sign in to continue your journey.", submit: "Sign in", busy: "Signing in…" },
  signup: { title: "Create your account", lead: "Start your wellness journey today.", submit: "Create account", busy: "Creating your account…" },
};

/** Mirrors the server's zod rules so most mistakes are caught before a round trip. */
function validate(mode: AuthMode, v: Values): FieldErrors {
  const e: FieldErrors = {};
  if (mode === "signup") {
    const name = v.name.trim();
    if (!name) e.name = "Please enter your name";
    else if (name.length > 60) e.name = "Please keep your name under 60 characters";
  }
  const email = v.email.trim();
  if (!email) e.email = "Please enter your email";
  else if (email.length > 254 || !EMAIL_RE.test(email)) e.email = "Please enter a valid email address";
  if (!v.password) e.password = mode === "signup" ? "Please choose a password" : "Please enter your password";
  else if (mode === "signup" && v.password.length < 8) e.password = "Password must be at least 8 characters";
  else if (v.password.length > 128) e.password = "Password must be 128 characters or fewer";
  return e;
}

type AuthResult =
  | { ok: true; user: PublicUser }
  | { ok: false; status: number; error: string; code?: string; field?: string | null };

/** Plain fetch (not `api`) so we can read the `field` the auth routes attach to validation errors. */
async function authRequest(path: string, body: Record<string, string>): Promise<AuthResult> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, error: "We couldn't reach ÖRZA. Check your connection and try again." };
  }
  const data = await res.json().catch(() => null);
  if (res.ok && data?.user) return { ok: true, user: data.user as PublicUser };
  return {
    ok: false,
    status: res.status,
    error: data?.error || "Something went wrong. Please try again.",
    code: data?.code,
    field: data?.field ?? null,
  };
}

export function AuthForm({ initialMode, next }: { initialMode: AuthMode; next: string | null }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [mode, setMode] = React.useState<AuthMode>(initialMode);
  const [values, setValues] = React.useState<Values>({ name: "", email: "", password: "" });
  const [touched, setTouched] = React.useState<Partial<Record<Field, boolean>>>({});
  const [submitted, setSubmitted] = React.useState(false);
  const [serverErrors, setServerErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const refs = {
    name: React.useRef<HTMLInputElement>(null),
    email: React.useRef<HTMLInputElement>(null),
    password: React.useRef<HTMLInputElement>(null),
  };

  // Already signed in (e.g. page restored from history)? Skip the form.
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.user) router.replace(destinationFor(d.user, next));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router, next]);

  const clientErrors = validate(mode, values);
  const errorFor = (f: Field) => serverErrors[f] ?? (touched[f] || submitted ? clientErrors[f] : undefined);
  const copy = COPY[mode];

  function setField(f: Field, v: string) {
    setValues((s) => ({ ...s, [f]: v }));
    if (serverErrors[f]) setServerErrors((s) => ({ ...s, [f]: undefined }));
    if (formError) setFormError(null);
  }

  function switchMode(m: AuthMode) {
    if (m === mode || loading) return;
    setMode(m);
    setTouched({});
    setSubmitted(false);
    setServerErrors({});
    setFormError(null);
    try {
      const url = new URL(window.location.href);
      if (m === "signup") url.searchParams.set("mode", "signup");
      else url.searchParams.delete("mode");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch {
      /* URL sync is cosmetic */
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setSubmitted(true);
    setFormError(null);
    const errs = validate(mode, values);
    const firstInvalid = (["name", "email", "password"] as Field[]).find((f) => errs[f]);
    if (firstInvalid) {
      refs[firstInvalid].current?.focus();
      return;
    }

    setLoading(true);
    const email = values.email.trim().toLowerCase();
    const res =
      mode === "signup"
        ? await authRequest("/api/auth/register", { name: values.name.trim(), email, password: values.password })
        : await authRequest("/api/auth/login", { email, password: values.password });

    if (res.ok) {
      const first = res.user.name?.trim().split(/\s+/)[0];
      toast.success(mode === "signup" ? `Welcome to ÖRZA${first ? `, ${first}` : ""}!` : `Welcome back${first ? `, ${first}` : ""}!`);
      // Keep the button busy while the next page loads.
      router.replace(destinationFor(res.user, next, mode));
      router.refresh();
      return;
    }

    setLoading(false);
    if (res.status === 409) {
      setServerErrors({ email: res.error });
      refs.email.current?.focus();
    } else if (res.code === "validation" && res.field && ["name", "email", "password"].includes(res.field)) {
      setServerErrors({ [res.field as Field]: res.error });
      refs[res.field as Field].current?.focus();
    } else {
      setFormError(res.error);
      if (res.status === 401) {
        setValues((s) => ({ ...s, password: "" }));
        refs.password.current?.focus();
      }
    }
    toast.error(res.error);
  }

  const fieldClass = (invalid: boolean) =>
    cn(
      "h-12 rounded-orza-sm bg-white/85",
      invalid && "border-[rgba(176,44,44,0.55)] focus:border-orza-error focus:shadow-[0_0_0_3px_rgba(176,44,44,0.14)]"
    );

  const nameErr = mode === "signup" ? errorFor("name") : undefined;
  const emailErr = errorFor("email");
  const passwordErr = errorFor("password");

  return (
    <div className="w-full max-w-[440px]">
      <motion.div
        {...(reduce ? { initial: false as const } : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay: 0.1, ease: EASE } })}
      >
        <GlassCard variant="strong" padded={false} className="rounded-orza-xl p-6 shadow-orza-floating sm:p-8">
          <Segmented<AuthMode>
            value={mode}
            onChange={switchMode}
            options={[
              { value: "signin", label: "Sign in" },
              { value: "signup", label: "Create account" },
            ]}
            className="flex w-full [&>button]:flex-1"
          />

          <div className="mt-7">
            <h1 className="font-editorial text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-orza-strong sm:text-[32px] sm:leading-[40px]">
              {copy.title}
            </h1>
            <p className="mt-1.5 text-[15px] text-orza-muted">{copy.lead}</p>
            {mode === "signup" && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[rgba(255,122,106,0.30)] bg-[#FFF1EA] px-3 py-1.5 text-[12px] font-medium text-[#C2410C]">
                <Sparkles size={13} strokeWidth={1.75} aria-hidden />
                100 AI credits included · No credit card
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4" aria-describedby={formError ? "auth-form-error" : undefined}>
            <AnimatePresence initial={false}>
              {mode === "signup" && (
                <motion.div
                  key="name"
                  initial={reduce ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={{ duration: 0.28, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="pb-0.5">
                    <Label htmlFor="auth-name">Name</Label>
                    <Input
                      ref={refs.name}
                      id="auth-name"
                      name="name"
                      autoComplete="name"
                      placeholder="Your name"
                      maxLength={80}
                      value={values.name}
                      onChange={(e) => setField("name", e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                      aria-invalid={!!nameErr}
                      aria-describedby={nameErr ? "auth-name-error" : undefined}
                      className={fieldClass(!!nameErr)}
                    />
                    <FieldError id="auth-name-error" message={nameErr} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <Label htmlFor="auth-email">Email</Label>
              <Input
                ref={refs.email}
                id="auth-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="you@example.com"
                maxLength={254}
                value={values.email}
                onChange={(e) => setField("email", e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                aria-invalid={!!emailErr}
                aria-describedby={emailErr ? "auth-email-error" : undefined}
                className={fieldClass(!!emailErr)}
              />
              <FieldError id="auth-email-error" message={emailErr} />
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor="auth-password">Password</Label>
                {mode === "signin" && (
                  <a
                    href={`mailto:${SITE.supportEmail}?subject=${encodeURIComponent("Help signing in to ÖRZA")}`}
                    className="mb-1.5 text-[12px] text-orza-muted underline-offset-4 hover:text-orza-strong hover:underline"
                  >
                    Forgot password?
                  </a>
                )}
              </div>
              <div className="relative">
                <Input
                  ref={refs.password}
                  id="auth-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"}
                  maxLength={128}
                  value={values.password}
                  onChange={(e) => setField("password", e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  aria-invalid={!!passwordErr}
                  aria-describedby={cn(passwordErr && "auth-password-error", mode === "signup" && !passwordErr && "auth-password-hint") || undefined}
                  className={cn(fieldClass(!!passwordErr), "pr-12")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  aria-controls="auth-password"
                  className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-orza-subtle transition-colors duration-150 ease-orza hover:bg-black/5 hover:text-orza-strong"
                >
                  {showPassword ? <EyeOff size={17} strokeWidth={1.75} aria-hidden /> : <Eye size={17} strokeWidth={1.75} aria-hidden />}
                </button>
              </div>
              {passwordErr ? (
                <FieldError id="auth-password-error" message={passwordErr} />
              ) : (
                mode === "signup" && (
                  <p
                    id="auth-password-hint"
                    className={cn(
                      "mt-1.5 flex items-center gap-1.5 text-xs transition-colors duration-150",
                      values.password.length >= 8 ? "text-orza-success" : "text-orza-subtle"
                    )}
                  >
                    <Check size={13} strokeWidth={2} aria-hidden className={values.password.length >= 8 ? "opacity-100" : "opacity-40"} />
                    At least 8 characters
                  </p>
                )
              )}
            </div>

            {formError && (
              <div
                id="auth-form-error"
                role="alert"
                className="flex items-start gap-2.5 rounded-orza-sm border border-[rgba(176,44,44,0.22)] bg-[#FDECEC] px-3.5 py-3 text-[13px] leading-snug text-[#8F2424]"
              >
                <AlertCircle size={16} strokeWidth={1.75} className="mt-px shrink-0" aria-hidden />
                <span>{formError}</span>
              </div>
            )}

            <Button type="submit" size="lg" loading={loading} className="!mt-6 h-12 w-full text-[15px]">
              {loading ? copy.busy : copy.submit}
              {!loading && <ArrowRight size={16} strokeWidth={1.75} aria-hidden />}
            </Button>
          </form>

          <p className="mt-6 text-center text-[14px] text-orza-muted">
            {mode === "signin" ? "New to ÖRZA? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
              className="font-medium text-orza-strong underline decoration-[rgba(20,20,20,0.25)] underline-offset-4 transition-colors hover:decoration-orza-strong"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </GlassCard>
      </motion.div>

      <div className="mt-6 space-y-1.5 px-2 text-center text-[12px] leading-relaxed text-orza-subtle">
        {mode === "signup" && (
          <p>
            By creating an account you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-orza-strong">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-orza-strong">
              Privacy Policy
            </Link>
            .
          </p>
        )}
        <p>General wellness guidance, not medical advice.</p>
      </div>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-xs text-orza-error">
      <AlertCircle size={13} strokeWidth={1.75} aria-hidden className="shrink-0" />
      {message}
    </p>
  );
}
