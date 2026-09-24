"use client";
import * as React from "react";
import { api } from "@/lib/api-client";

export type AiStatus = { ai_enabled: boolean; costs: Record<string, number>; credits: number };

/**
 * Whether ÖRZA's AI is switched on + credit costs (from /api/credits/balance).
 * `null` while loading or if the endpoint can't be reached — callers treat that as "unknown"
 * and rely on the API's own 503/402 responses.
 */
export function useAiStatus(): AiStatus | null {
  const [status, setStatus] = React.useState<AiStatus | null>(null);
  React.useEffect(() => {
    let alive = true;
    api
      .get<Partial<AiStatus>>("/credits/balance")
      .then((r) => {
        if (!alive || typeof r?.ai_enabled !== "boolean") return;
        setStatus({ ai_enabled: r.ai_enabled, costs: r.costs || {}, credits: Number(r.credits) || 0 });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return status;
}
