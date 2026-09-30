import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { demoDisabled, errorJson } from "./auth/demo";

/**
 * DEMO-MODE GET handler: serves fixture data through the same /api/v1 paths the real backend
 * will expose. In real mode these files are bypassed (next.config.mjs proxies /api/v1/* to
 * API_URL before they are reached) and answer 501 if hit directly.
 */
export async function demoJson(load: () => Promise<unknown>) {
  const disabled = demoDisabled();
  if (disabled) return disabled;
  try {
    const data = await load();
    if (data === null) return errorJson(404, "Not found");
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof ApiError) return errorJson(err.status, err.message);
    throw err;
  }
}
