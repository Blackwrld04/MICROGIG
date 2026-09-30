import { serverData } from "@/lib/api/server-data";
import { demoJson } from "@/app/api/v1/demo-route";

export const dynamic = "force-dynamic";

/** GET /api/v1/inbox — MSG-02 threads (demo). */
export function GET() {
  return demoJson(() => serverData.inbox());
}
