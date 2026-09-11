import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";

// ── Secret-link edit access ────────────────────────────────────────────────
// The site is view-only by default. Visiting /unlock-<EDIT_TOKEN> once sets an
// httpOnly cookie that unlocks editing in that browser. All mutating API
// handlers must call requireEdit() and return its response when non-null.

export const EDIT_COOKIE_NAME = "ppp_edit";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getToken(): string | null {
  const t = process.env.EDIT_TOKEN;
  return t && t.length > 0 ? t : null;
}

/** Cookie stores only a hash of the token so a stolen cookie doesn't reveal it. */
export function signToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function verifyUnlockSecret(secret: string): boolean {
  const token = getToken();
  if (!token) return false;
  return safeEqual(secret, token);
}

export function signCurrentToken(): string | null {
  const token = getToken();
  return token ? signToken(token) : null;
}

export async function hasEditAccess(): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  const store = await cookies();
  const raw = store.get(EDIT_COOKIE_NAME)?.value;
  if (!raw) return false;
  return safeEqual(raw, signToken(token));
}

/** Returns a 403 response when editing is not allowed, otherwise null. */
export async function requireEdit(): Promise<NextResponse | null> {
  if (await hasEditAccess()) return null;
  return NextResponse.json(
    { error: "View-only mode. Editing is disabled." },
    { status: 403 }
  );
}

export const EDIT_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: COOKIE_MAX_AGE,
  path: "/",
};
