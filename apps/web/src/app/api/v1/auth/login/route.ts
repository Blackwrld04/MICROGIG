import { NextResponse } from "next/server";
import { fieldErrors } from "@/lib/form-errors";
import { DEMO_USERS } from "@/mocks/people";
import { loginSchema } from "@/modules/auth/contracts";
import { demoDisabled, errorJson, withSession } from "../demo";

/** POST /api/v1/auth/login — demo implementation: the three demo accounts, any password. */
export async function POST(request: Request) {
  const disabled = demoDisabled();
  if (disabled) return disabled;

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorJson(422, "Please check the highlighted fields.", fieldErrors(parsed.error));

  const user = Object.values(DEMO_USERS).find((u) => u.email.toLowerCase() === parsed.data.email.toLowerCase());
  // Same message for unknown email and wrong password: no account enumeration.
  if (!user) return errorJson(401, "Invalid email or password.");

  return withSession(NextResponse.json({ user }), user);
}
