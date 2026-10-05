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
  if (Object.values(DEMO_USERS).some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return errorJson(409, "This email has already been used before. Please sign in or use a different email.", {
      email: "This email has already been used before. Please sign in or use a different email.",
    });
  }

  // Demo verification code validation (if supplied, accept any 6-digit code or fallback 123456)
  if (code && code.trim().length > 0 && code.trim().length !== 6 && code.trim() !== "123456") {
    return errorJson(422, "Invalid confirmation code. Please enter a valid 6-digit code.", {
      code: "Invalid confirmation code",
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
