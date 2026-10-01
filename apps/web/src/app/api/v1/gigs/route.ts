import { gigSearchQuerySchema } from "@/modules/catalog/contracts";
import { serverData } from "@/lib/api/server-data";
import { demoJson } from "@/app/api/v1/demo-route";

export const dynamic = "force-dynamic";

/** GET /api/v1/gigs — GIG-06 search & filter (demo). */
export function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const parsed = gigSearchQuerySchema.safeParse(Object.fromEntries(sp));
  return demoJson(() => serverData.searchGigs(parsed.success ? parsed.data : gigSearchQuerySchema.parse({})));
}
