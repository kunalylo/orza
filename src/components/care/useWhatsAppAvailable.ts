"use client";
import * as React from "react";
import { api } from "@/lib/api-client";
import type { IntegrationsView } from "@/components/care/reminders/shared";

/** One request per page load is plenty: WhatsApp only changes when the server is (re)configured. */
let cached: Promise<boolean> | null = null;

function fetchWhatsAppConfigured(): Promise<boolean> {
  if (!cached) {
    cached = api
      .get<IntegrationsView>("/integrations")
      .then((r) => !!r?.whatsapp?.configured)
      .catch(() => {
        cached = null; // try again on the next mount
        return false;
      });
  }
  return cached;
}

/**
 * True once the server reports WhatsApp messaging is set up (GET /api/integrations → whatsapp.configured).
 * Starts false, so WhatsApp mentions stay hidden until (and unless) it's actually available.
 */
export function useWhatsAppAvailable(): boolean {
  const [available, setAvailable] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    void fetchWhatsAppConfigured().then((v) => {
      if (alive) setAvailable(v);
    });
    return () => {
      alive = false;
    };
  }, []);
  return available;
}
