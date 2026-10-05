import { NextResponse } from "next/server";
import { DEMO_USERS } from "@/mocks/people";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = (body?.email || "").toLowerCase().trim();
  const exists = Object.values(DEMO_USERS).some((u) => u.email.toLowerCase() === email);
  return NextResponse.json({
    exists,
    message: exists
      ? "This email has already been used before. Please sign in or use a different email."
      : "Email is available",
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = (searchParams.get("email") || "").toLowerCase().trim();
  const exists = Object.values(DEMO_USERS).some((u) => u.email.toLowerCase() === email);
  return NextResponse.json({
    exists,
    message: exists
      ? "This email has already been used before. Please sign in or use a different email."
      : "Email is available",
  });
}
