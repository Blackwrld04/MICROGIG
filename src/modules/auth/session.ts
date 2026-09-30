import "server-only";
import { mockSessions } from "@/mocks/account";
import { USE_MOCKS } from "@/mocks/config";
import { MOCK_ME } from "@/mocks/people";
import type { Me } from "./contracts";

/**
 * Current user for Server Components (header, guarded pages).
 * TODO(auth owner): read the access-token cookie and verify the session (PRD §13.1).
 * In demo mode this returns the sample user so every screen is reachable.
 */
export async function getCurrentUser(): Promise<Me | null> {
  return USE_MOCKS ? MOCK_ME : null;
}

/** GET /api/v1/me/sessions — AUTH-08. */
export async function listSessions(nowMs: number) {
  return mockSessions(nowMs);
}
