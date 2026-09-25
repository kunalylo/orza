"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError, api, errorMessage } from "@/lib/api-client";

export type SignOutOptions = {
  /** Also revoke every other signed-in device (all of the account's sessions). */
  everywhere?: boolean;
};

/**
 * Signs out, then leaves the app. Only the server can clear the httpOnly session cookie and revoke
 * the session, so if that request fails the user stays put and is told — never shown the home page
 * while still signed in (shared / family phones). Use this everywhere a "Sign out" control exists.
 */
export function useSignOut() {
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);
  const busy = React.useRef(false);
  const signOut = React.useCallback(
    async (opts: SignOutOptions = {}) => {
      if (busy.current) return;
      busy.current = true;
      setSigningOut(true);
      try {
        await api.post("/auth/logout", opts.everywhere ? { everywhere: true } : {});
      } catch (e) {
        busy.current = false;
        setSigningOut(false);
        toast.error(
          e instanceof ApiError && e.code === "network"
            ? "Couldn't sign you out — check your connection and try again."
            : `Couldn't sign you out. ${errorMessage(e)}`
        );
        return;
      }
      if (opts.everywhere) toast.success("Signed out on every device");
      router.replace("/");
      router.refresh();
    },
    [router]
  );
  return { signOut, signingOut };
}
