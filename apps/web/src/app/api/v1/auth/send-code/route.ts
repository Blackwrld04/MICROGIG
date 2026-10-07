import { NextResponse } from "next/server";
import { fieldErrors } from "@/lib/form-errors";
import { sendCodeSchema } from "@/modules/auth/contracts";
import { demoDisabled, errorJson } from "../demo";

/** POST /api/v1/auth/send-code — demo mode: pretends to email a code (any 6 digits are accepted). */
export async function POST(request: Request) {
  const disabled = demoDisabled();
  if (disabled) return disabled;

  const parsed = sendCodeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorJson(422, "Please enter a valid email address.", fieldErrors(parsed.error));
  }

  // Same answer whether or not the email has an account, like the real API (no enumeration).
  const { email } = parsed.data;
  if (process.env.NODE_ENV !== "production") {
    console.log(`[DEMO EMAIL] confirmation requested for ${email}; any 6-digit code works in demo mode`);
  }

  return NextResponse.json({
    ok: true,
    message: "If this email can be used, we've sent a 6-digit confirmation code to it.",
  });
}
