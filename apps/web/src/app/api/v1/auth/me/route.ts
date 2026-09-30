import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";

export const dynamic = "force-dynamic";

/** GET /api/v1/auth/me — AUTH-07. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { message: "Not signed in" } }, { status: 401 });
  return NextResponse.json(user);
}
