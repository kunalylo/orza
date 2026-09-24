"use client";
/**
 * Browser fetch wrapper for /api/*. Throws ApiError with the server's message.
 * On 401 it sends the user to /login (except for auth endpoints themselves).
 */
export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

/** Shown when the request never reached the server (offline, DNS, dropped connection). */
export const NETWORK_ERROR_MESSAGE = "We couldn't reach ÖRZA. Check your connection and try again.";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path.startsWith("/api") ? path : `/api${path}`, {
      method,
      credentials: "same-origin",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    // Aborts are the caller's decision — let them through untouched so callers can ignore them.
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    // fetch rejects with an engine-specific TypeError ("Failed to fetch", "Load failed", "NetworkError…").
    throw new ApiError(0, NETWORK_ERROR_MESSAGE, "network");
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !path.includes("/auth/")) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?next=${next}`;
    }
    throw new ApiError(res.status, data?.error || fallbackMessage(res.status), data?.code);
  }
  return data as T;
}

/** For responses without an `{error}` body (proxy errors, timeouts, HTML error pages). */
function fallbackMessage(status: number) {
  if (status === 413) return "That's too large to send. Please try a smaller photo or less text.";
  if (status === 429) return "Too many requests right now. Please wait a moment and try again.";
  if (status === 502 || status === 503 || status === 504) return "ÖRZA is briefly unavailable. Please try again in a moment.";
  if (status >= 500) return "Something went wrong on our side. Please try again.";
  return `Request failed (${status})`;
}

export const api = {
  get: <T = any>(path: string) => request<T>("GET", path),
  post: <T = any>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T = any>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
  patch: <T = any>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {}),
  del: <T = any>(path: string) => request<T>("DELETE", path),
};

export const errorMessage = (e: unknown) => {
  if (e instanceof ApiError) return e.message;
  // A raw fetch TypeError from code that doesn't go through `api` — never show the engine's wording.
  if (e instanceof TypeError && /fetch|load failed|network/i.test(e.message)) return NETWORK_ERROR_MESSAGE;
  return e instanceof Error && e.message ? e.message : "Something went wrong. Please try again.";
};
