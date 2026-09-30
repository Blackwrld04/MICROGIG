import { serverData } from "@/lib/api/server-data";
import { demoJson } from "@/app/api/v1/demo-route";

export const dynamic = "force-dynamic";

/** GET /api/v1/me/sessions — AUTH-08 (demo). */
export function GET() {
  return demoJson(async () => ({ sessions: await serverData.sessions() }));
}
