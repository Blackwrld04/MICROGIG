import { serverData } from "@/lib/api/server-data";
import { demoJson } from "@/app/api/v1/demo-route";

export const dynamic = "force-dynamic";

/** GET /api/v1/gigs/:slug — gig detail (demo). */
export function GET(_request: Request, { params }: { params: { key: string } }) {
  return demoJson(() => serverData.gig(params.key));
}
