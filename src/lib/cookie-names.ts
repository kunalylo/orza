/** Cookie names shared by server and client code (no dependencies, safe to import anywhere). */
export const SESSION_COOKIE = "orza_session";
/** Non-secret, JS-readable hint so static marketing pages can show "Open ÖRZA" without a server round-trip. Never trusted for auth. */
export const SIGNED_IN_HINT_COOKIE = "orza_signed_in";
