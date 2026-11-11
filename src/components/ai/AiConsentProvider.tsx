"use client";
/**
 * The website's AI consent (App Store 5.1.2(i), Google Play User Data; docs/notes/ai-consent.md §12 in the mobile
 * repo). The first time a member starts an AI feature, one dialog names OpenAI and what is sent, with Allow and Not now.
 * The record is the account's `ai_consent` (the same as the phone app's), so a consent given on the phone is used
 * here without asking, and one Allow or Turn off works everywhere. The server refuses AI requests without it (403
 * `ai_consent_required`, src/lib/ai-consent.ts).
 *
 * Every AI entry point runs its own checks, then `if (!(await ensureAiConsent(feature))) return;`, then its request,
 * and starts its error handling with `if (onAiRefusal(e, feature, retry)) return;`.
 */
import * as React from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@/components/app/UserProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AI_CONSENT_VERSION, hasAiConsent } from "@/lib/ai-consent-shared";
import { ApiError, api } from "@/lib/api-client";
import type { PublicUser } from "@/lib/types";
import { AI_OUTDATED_LINE, AI_SAVE_FAILED_LINE, CONSENT_COPY, consentLead, type AiFeature } from "./copy";
import { ConsentDetails, ConsentTitle } from "./ConsentDetails";

/** The server refused an AI request because the account has no AI consent. */
export const isAiConsentRefusal = (e: unknown) => e instanceof ApiError && e.status === 403 && e.code === "ai_consent_required";

/**
 * Allow: records the consent for the copy this page shows, for the account it shows (`userId`) → the fresh user. If
 * another account signed in in this browser meanwhile, the server records nothing (409 `account_changed`).
 */
export async function allowAiFeatures(userId: string): Promise<PublicUser> {
  const r = await api.put<{ user: PublicUser }>("/settings/ai-consent", { version: AI_CONSENT_VERSION, user_id: userId });
  return r.user;
}

/** Allow refused because the browser is signed in to another account now: reload to show it. */
export const isAccountChanged = (e: unknown) => e instanceof ApiError && e.status === 409 && e.code === "account_changed";

/** The line a dialog shows when Allow or Turn off couldn't be saved. */
export function consentErrorLine(e: unknown): string {
  if (e instanceof ApiError && e.code === "network") return e.message;
  if (e instanceof ApiError && e.status === 409 && e.code === "ai_consent_outdated") return AI_OUTDATED_LINE;
  return AI_SAVE_FAILED_LINE;
}

/** `/auth/me`, waiting at most 5 s: the fresh user, or null when ÖRZA didn't answer. */
async function readMe(): Promise<PublicUser | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      api.get<{ user: PublicUser }>("/auth/me").then((r) => r?.user ?? null),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 5000);
      }),
    ]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type Ctx = {
  /** Resolves true when the request may go: the account has consent, or the member just allowed it. Never throws. */
  ensureAiConsent: (feature: AiFeature) => Promise<boolean>;
  /** For a 403 `ai_consent_required`: opens the dialog and runs `retry` once after Allow. False for any other error. */
  onAiRefusal: (e: unknown, feature: AiFeature, retry?: () => void) => boolean;
  /** The features whose dialog got Not now (cleared by any Allow). */
  declined: ReadonlySet<AiFeature>;
  /** "Allow AI features" on a Not now line: the dialog, which only records the choice. */
  askAgain: (feature: AiFeature) => void;
};

const AiConsentContext = React.createContext<Ctx | null>(null);

/** An open dialog: for which feature, account and page, and the gate waiting on it. */
type Asking = { feature: AiFeature; userId: string; path: string; resolve: (allowed: boolean) => void };

/** Mounted once around the members' app (src/app/dashboard/layout.tsx), inside UserProvider. */
export function AiConsentProvider({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useUser();
  const userRef = React.useRef(user);
  React.useEffect(() => {
    userRef.current = user;
  }, [user]);
  const pathname = usePathname();
  const pathRef = React.useRef(pathname);

  const [asking, setAsking] = React.useState<Asking | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [declined, setDeclined] = React.useState<ReadonlySet<AiFeature>>(() => new Set());
  /** A gate or a refusal's dialog is under way: one at a time, so an action never runs twice. */
  const busy = React.useRef(false);
  /** Where focus goes back to when the dialog closes (it has no trigger): the composer or button that asked. */
  const returnFocus = React.useRef<HTMLElement | null>(null);

  // Any Allow (the dialog, Settings, or one from the phone picked up by a refresh) clears every Not now line.
  const allowed = hasAiConsent(user);
  React.useEffect(() => {
    if (allowed) setDeclined((d) => (d.size ? new Set() : d));
  }, [allowed]);

  const showUser = React.useCallback(
    (u: PublicUser) => {
      userRef.current = u;
      setUser(u);
    },
    [setUser]
  );

  const ask = React.useCallback(
    (feature: AiFeature) =>
      new Promise<boolean>((resolve) => {
        const from = document.activeElement;
        returnFocus.current = from instanceof HTMLElement && from !== document.body ? from : null;
        setError(null);
        setAsking({ feature, userId: userRef.current.id, path: pathRef.current, resolve });
      }),
    []
  );

  const ensureAiConsent = React.useCallback(
    async (feature: AiFeature) => {
      if (hasAiConsent(userRef.current)) return true;
      if (busy.current) return false;
      busy.current = true;
      try {
        // A consent given on the phone since this page loaded is used without asking.
        const start = userRef.current.id;
        const path = pathRef.current;
        const fresh = await readMe();
        // The member left the page while ÖRZA answered: nothing is asked or sent for it.
        if (pathRef.current !== path) return false;
        if (fresh && fresh.id !== start) {
          // Another account signed in in this browser meanwhile: nothing is sent; show that account.
          window.location.reload();
          return false;
        }
        if (fresh && hasAiConsent(fresh)) {
          showUser(fresh);
          return true;
        }
        return await ask(feature);
      } finally {
        busy.current = false;
      }
    },
    [ask, showUser]
  );

  const onAiRefusal = React.useCallback(
    (e: unknown, feature: AiFeature, retry?: () => void) => {
      if (!isAiConsentRefusal(e)) return false;
      // The server is the authority (the consent was turned off elsewhere): ask at once, without a refresh.
      userRef.current = { ...userRef.current, ai_consent: null };
      setUser((u) => ({ ...u, ai_consent: null }));
      if (busy.current) return true;
      busy.current = true;
      void ask(feature).then((ok) => {
        busy.current = false;
        if (ok) retry?.();
      });
      return true;
    },
    [ask, setUser]
  );

  const askAgain = React.useCallback(
    (feature: AiFeature) => {
      if (busy.current) return;
      busy.current = true;
      void ask(feature).then(() => {
        busy.current = false;
      });
    },
    [ask]
  );

  /** Not now, Escape, the close button or a click outside: no. Nothing is sent and the feature's line shows. */
  const decline = () => {
    const a = asking;
    if (!a || saving) return;
    setAsking(null);
    setDeclined((d) => new Set(d).add(a.feature));
    a.resolve(false);
  };

  const allow = async () => {
    const a = asking;
    if (!a || saving) return;
    setSaving(true);
    setError(null);
    try {
      const u = await allowAiFeatures(a.userId);
      if (u.id !== a.userId) {
        a.resolve(false);
        window.location.reload();
        return;
      }
      showUser(u);
      setAsking(null);
      // The member left the page that asked while this saved: the choice stands, but that page's action doesn't run.
      a.resolve(pathRef.current === a.path);
    } catch (e) {
      // Another account signed in in this browser meanwhile: nothing was recorded or sent; show that account.
      if (isAccountChanged(e)) {
        a.resolve(false);
        window.location.reload();
        return;
      }
      setError(consentErrorLine(e));
    } finally {
      setSaving(false);
    }
  };

  // Leaving the page that asked (the browser's Back, as Android back is in the app) is Not now: the dialog stays in the
  // layout, and its action must never run on another page.
  const declineRef = React.useRef(decline);
  React.useEffect(() => {
    declineRef.current = decline;
  });
  React.useEffect(() => {
    if (pathRef.current === pathname) return;
    pathRef.current = pathname;
    declineRef.current();
  }, [pathname]);

  const value = React.useMemo<Ctx>(
    () => ({ ensureAiConsent, onAiRefusal, declined, askAgain }),
    [ensureAiConsent, onAiRefusal, declined, askAgain]
  );

  return (
    <AiConsentContext.Provider value={value}>
      {children}
      <Dialog open={!!asking} onOpenChange={(o) => !o && decline()}>
        {asking && (
          <DialogContent
            title={<ConsentTitle eyebrow={CONSENT_COPY.eyebrow} title={CONSENT_COPY.title} />}
            description={consentLead(asking.feature)}
            // The dialog itself takes focus (title and lead are read first), not Allow: Enter pressed to send a
            // message must never be a consent.
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement | null)?.focus();
            }}
            // Radix returns focus to a Dialog trigger, and this dialog has none: back to where the member asked from.
            // If that is gone (a problem panel's Try again), the feature's Not now line takes it (AiDeclinedNote).
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              const to = returnFocus.current;
              returnFocus.current = null;
              if (to?.isConnected) to.focus();
            }}
          >
            <ConsentDetails context={asking.feature} />
            {error && (
              <p role="alert" className="mt-4 text-[13px] leading-relaxed text-[#B02C2C]">
                {error}
              </p>
            )}
            <div className="mt-5 flex flex-col-reverse gap-2 border-t border-[rgba(20,20,20,0.08)] pt-4 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={decline} disabled={saving}>
                {CONSENT_COPY.notNow}
              </Button>
              <Button variant="energy" onClick={() => void allow()} loading={saving}>
                {CONSENT_COPY.allow}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </AiConsentContext.Provider>
  );
}

export function useAiConsent() {
  const ctx = React.useContext(AiConsentContext);
  if (!ctx) throw new Error("useAiConsent must be used inside <AiConsentProvider>");
  return ctx;
}

/** For a feature's Not now line: whether the member said Not now, and the button that asks again. */
export function useAiDeclined(feature: AiFeature) {
  const { declined, askAgain } = useAiConsent();
  return { declined: declined.has(feature), allow: () => askAgain(feature) };
}
