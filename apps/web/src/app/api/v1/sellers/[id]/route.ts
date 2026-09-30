import { serverData } from "@/lib/api/server-data";
import { demoJson } from "@/app/api/v1/demo-route";

export const dynamic = "force-dynamic";

/** GET /api/v1/sellers/:id — public seller page, SEL-03 (demo). */
export function GET(_request: Request, { params }: { params: { id: string } }) {
  return demoJson(() => serverData.seller(params.id));
}
