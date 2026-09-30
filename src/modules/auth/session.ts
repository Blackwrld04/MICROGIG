import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { mockSessions } from "@/mocks/account";
import { USE_MOCKS } from "@/mocks/config";
import { meSchema, type AccountType, type Me } from "./contracts";

/** Demo-mode session cookie. The real backend replaces this with the §13.1 access/refresh cookies. */
export const DEMO_SESSION_COOKIE = "mg_demo_session";

export function encodeDemoSession(user: Me): string {
  return Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
}

function decodeDemoSession(value: string): Me | null {
  try {
    const parsed = meSchema.safeParse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Current user for Server Components, or null when signed out.
 * TODO(auth owner): verify the access-token cookie + sessions row (PRD §13.1).
 */
export async function getCurrentUser(): Promise<Me | null> {
  if (!USE_MOCKS) return null;
  const value = cookies().get(DEMO_SESSION_COOKIE)?.value;
  return value ? decodeDemoSession(value) : null;
}

/**
 * Page guard. Signed-out visitors go to sign-in; signed-in users of the wrong account
 * type get a 404, so client-only and freelancer-only areas don't reveal each other.
 */
export async function requireUser(options: { next: string; accountType?: AccountType; admin?: boolean }): Promise<Me> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(options.next)}`);
  if (options.admin && !user.isAdmin) notFound();
  if (options.accountType && user.accountType !== options.accountType) notFound();
  return user;
}

/** GET /api/v1/me/sessions — AUTH-08. */
export async function listSessions(nowMs: number) {
  return mockSessions(nowMs);
}
