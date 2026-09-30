import type { Metadata } from "next";
import { VerificationQueue } from "@/components/admin/verification-queue";
import { listPendingVerifications } from "@/modules/seller/queries";

export const metadata: Metadata = { title: "ID verifications" };

/** Admin ID verification queue — SEL-02, §19 risk #5. */
export default async function AdminVerificationsPage() {
  const queue = await listPendingVerifications(Date.now());
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ID verifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">Approve sellers so their gigs become visible in the catalog.</p>
      </div>
      <VerificationQueue initial={queue} />
    </div>
  );
}
