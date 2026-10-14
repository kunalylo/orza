import { ADMIN_HOME, isConsolePath } from "@/components/admin/routes";

/**
 * `?next=` handling for /login. Only same-site relative paths are allowed:
 * must start with "/", never "//" or "/\" (protocol-relative → open redirect),
 * no control characters, and never back to /login itself.
 */
export function safeNextPath(raw: string | string[] | null | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== "string" || value.length > 512) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/[\u0000-\u001F\u007F\\]/.test(value)) return null;
  const path = value.split(/[?#]/)[0];
  if (path === "/login" || path.startsWith("/login/")) return null;
  return value;
}

export type AuthMode = "signin" | "signup";

export function parseAuthMode(raw: string | string[] | null | undefined): AuthMode {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.toLowerCase();
  return value === "signup" || value === "register" || value === "sign-up" ? "signup" : "signin";
}

/**
 * Where to send a signed-in user. Admin (staff) accounts only use the admin console, so they land on
 * /dashboard/admin unless `next` already points inside it. Sign-ups always onboard first; other
 * sign-ins honour `next`.
 */
export function destinationFor(
  user: { onboarding_complete: boolean; is_admin?: boolean },
  next: string | null,
  mode: AuthMode = "signin"
) {
  if (user.is_admin === true) return next && isConsolePath(next) ? next : ADMIN_HOME;
  if (mode === "signup") return "/onboarding";
  return next || (user.onboarding_complete ? "/dashboard" : "/onboarding");
}
