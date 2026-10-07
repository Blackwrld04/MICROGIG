import { NextResponse } from "next/server";
import { fieldErrors } from "@/lib/form-errors";
import { DEMO_USERS } from "@/mocks/people";
import { registerSchema, type Me } from "@/modules/auth/contracts";
import { demoDisabled, errorJson, withSession } from "../demo";

/** POST /api/v1/auth/register — demo implementation (see ../demo.ts). */
export async function POST(request: Request) {
  const disabled = demoDisabled();
  if (disabled) return disabled;

  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorJson(422, "Please check the highlighted fields.", fieldErrors(parsed.error));

  const { accountType, email, fullName, code } = parsed.data;
  // Like the real API: a code is required, and an existing account never receives one, so
  // signing up over it fails as an invalid code. Demo mode accepts any 6-digit code otherwise.
  const taken = Object.values(DEMO_USERS).some((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!code?.trim() || !/^\d{6}$/.test(code.trim()) || taken) {
    return errorJson(422, "Invalid or expired confirmation code. Please check your email or request a new code.", {
      code: "Invalid or expired confirmation code",
    });
  }

  const user: Me = {
    id: crypto.randomUUID(),
    email,
    fullName,
    accountType,
    isAdmin: false,
    isSeller: accountType === "FREELANCER",
  };
  return withSession(NextResponse.json({ user }, { status: 201 }), user);
}
