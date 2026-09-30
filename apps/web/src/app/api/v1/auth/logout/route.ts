import { NextResponse } from "next/server";
import { DEMO_SESSION_COOKIE } from "@/modules/auth/session";

/** POST /api/v1/auth/logout — demo implementation: clears the session cookie. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(DEMO_SESSION_COOKIE);
  return res;
}
