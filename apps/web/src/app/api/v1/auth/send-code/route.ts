import { NextResponse } from "next/server";
import { fieldErrors } from "@/lib/form-errors";
import { DEMO_USERS } from "@/mocks/people";
import { sendCodeSchema } from "@/modules/auth/contracts";
import { demoDisabled, errorJson } from "../demo";

/** POST /api/v1/auth/send-code — demo mode confirmation code sender */
export async function POST(request: Request) {
  const disabled = demoDisabled();
  if (disabled) return disabled;

  const parsed = sendCodeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorJson(422, "Please enter a valid email address.", fieldErrors(parsed.error));
  }

  const { email } = parsed.data;
  if (Object.values(DEMO_USERS).some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return errorJson(409, "This email has already been used before. Please sign in or use a different email.", {
      email: "This email has already been used before. Please sign in or use a different email.",
    });
  }

  // Simulated email code generation
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  if (process.env.NODE_ENV !== "production") {
    console.log(`[DEMO EMAIL CODE] Sent confirmation code "${code}" to ${email}`);
  }

  return NextResponse.json({
    ok: true,
    message: "Confirmation code sent to your email",
  });
}
