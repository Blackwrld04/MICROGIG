import { serverData } from "@/lib/api/server-data";
import { demoJson } from "@/app/api/v1/demo-route";

export const dynamic = "force-dynamic";

/** GET /api/v1/me/seller-profile — freelancers only (demo). */
export function GET() {
  return demoJson(() => serverData.sellerProfile());
}
