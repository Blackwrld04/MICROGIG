import { serverData } from "@/lib/api/server-data";
import { demoJson } from "@/app/api/v1/demo-route";

export const dynamic = "force-dynamic";

/** GET /api/v1/gigs/:id/more-from-seller — GIG-11 (demo). */
export function GET(_request: Request, { params }: { params: { key: string } }) {
  return demoJson(async () => ({ gigs: await serverData.moreFromSeller(params.key) }));
}
