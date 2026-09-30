import { NextResponse } from "next/server";
import { USE_MOCKS } from "@/mocks/config";
import { DEMO_SESSION_COOKIE, encodeDemoSession } from "@/modules/auth/session";
import type { Me } from "@/modules/auth/contracts";

/*
 * DEMO-MODE auth handlers. They exist so the frontend can be tried end to end before
 * the backend lands. The auth module owner replaces these route files with the real
 * §12.1 implementation (bcrypt, sessions table, rotating refresh cookie, rate limits).
 */

export function demoDisabled() {
  return USE_MOCKS ? null : NextResponse.json({ error: { message: "Not implemented" } }, { status: 501 });
}

export function withSession(res: NextResponse, user: Me) {
  res.cookies.set(DEMO_SESSION_COOKIE, encodeDemoSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export function errorJson(status: number, message: string, fieldErrors?: Record<string, string>) {
  return NextResponse.json({ error: { message, fieldErrors } }, { status });
}
