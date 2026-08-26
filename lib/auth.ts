/**
 * Single-user cookie session. The cookie value is an HMAC derived from
 * APP_PASSWORD, so it cannot be forged without knowing the password, and
 * changing the password invalidates every existing session. Uses Web Crypto
 * only, so the same code runs in the Edge middleware and Node route handlers.
 */

export const AUTH_COOKIE = "tl_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 365;

const SESSION_MESSAGE = "training-log-session-v1";

export async function sessionToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(SESSION_MESSAGE));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function isValidSession(
  cookieValue: string | undefined,
  password: string | undefined
): Promise<boolean> {
  if (!cookieValue || !password) return false;
  return cookieValue === (await sessionToken(password));
}
