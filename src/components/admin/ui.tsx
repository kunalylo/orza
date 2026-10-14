"use client";
/** Small building blocks shared by the admin console screens. */
import * as React from "react";
import { Check, Copy, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/app/ui";
import { Tag } from "@/components/orza/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import type { AdminRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ADMIN_HOME } from "./routes";

export function roleLabel(role: AdminRole | null | undefined) {
  return role === "super" ? "Super admin" : "Sub-admin";
}

/** "Super admin" (energy) / "Sub-admin" (violet). An admin without a stored role is a sub-admin. */
export function RoleTag({ role, size = "sm", className }: { role: AdminRole | null | undefined; size?: "sm" | "md"; className?: string }) {
  return (
    <Tag tone={role === "super" ? "energy" : "violet"} size={size} className={className}>
      {roleLabel(role)}
    </Tag>
  );
}

/** Copies text to the clipboard (falls back to a hidden textarea on older browsers). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * A one-time password shown after creating a sub-admin or resetting their password: monospace,
 * selectable, with a copy button and the "share it securely" note.
 */
export function OneTimePassword({ password, label = "Temporary password" }: { password: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    if (await copyText(password)) {
      setCopied(true);
      toast.success("Password copied");
    } else {
      toast.error("Couldn't copy — select the password and copy it by hand.");
    }
  }

  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">{label}</div>
      <div className="mt-1.5 flex items-center gap-2 rounded-orza-sm border border-[rgba(20,20,20,0.12)] bg-white/85 py-1.5 pl-4 pr-1.5">
        <code className="min-w-0 flex-1 select-all break-all font-mono text-[17px] tracking-[0.06em] text-orza-strong" aria-label={label}>
          {password}
        </code>
        <Button variant="secondary" size="sm" onClick={copy} aria-label={copied ? "Password copied" : "Copy password"}>
          {copied ? <Check size={14} strokeWidth={2} aria-hidden /> : <Copy size={14} strokeWidth={1.75} aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="mt-2.5 rounded-orza-xs bg-[#FFF4E6] px-3 py-2 text-[12.5px] leading-relaxed text-[#8A5300]">
        This is the only time it&rsquo;s shown. Share it securely (not in a group chat), and ask them to change it from{" "}
        <span className="font-medium">My account</span> after their first sign-in.
      </p>
    </div>
  );
}

/** Password input with a show/hide toggle. */
export const PasswordInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function PasswordInput(
  { className, id, ...rest },
  ref
) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input ref={ref} id={id} type={show ? "text" : "password"} maxLength={128} className={cn("pr-12", className)} {...rest} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        aria-controls={id}
        className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-orza-subtle transition-colors duration-150 ease-orza hover:bg-black/5 hover:text-orza-strong"
      >
        {show ? <EyeOff size={16} strokeWidth={1.75} aria-hidden /> : <Eye size={16} strokeWidth={1.75} aria-hidden />}
      </button>
    </div>
  );
});

/** Shown to sub-admins on super-only pages (the server refuses them too). */
export function SuperAdminOnly({ title }: { title: string }) {
  return (
    <div>
      <PageHeader eyebrow="Admin console" title={title} />
      <EmptyState
        icon={<ShieldAlert size={20} strokeWidth={1.75} aria-hidden />}
        title="Super admin only"
        description="Only the super admin can add, reset or remove admin accounts. Ask them if you need a change to the team."
        action={
          <ButtonLink href={ADMIN_HOME} variant="secondary">
            Back to overview
          </ButtonLink>
        }
      />
    </div>
  );
}
