import type { Metadata } from "next";
import { GigWizard } from "@/components/gig/gig-wizard";
import { requireUser } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Create a gig" };
export const dynamic = "force-dynamic";

/** 5-step gig creation wizard — GIG-01, PRD §16.2. */
export default async function CreateGigPage() {
  await requireUser({ next: "/gigs/new", accountType: "FREELANCER" });
  return (
    <div className="container max-w-4xl space-y-6 py-8">
      <h1 className="text-2xl font-bold">Create a gig</h1>
      <GigWizard />
    </div>
  );
}
